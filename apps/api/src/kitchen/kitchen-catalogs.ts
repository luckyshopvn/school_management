import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ruleViolationError, type FieldError } from '@school-management/server';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import {
  conflictOnDuplicate,
  notFoundError,
  readRequiredUuid,
  readStatus,
  type RecordStatus,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { KitchenAccess } from './kitchen-access.js';
import { check, queryUuid, readQuantity, readText } from './kitchen-fields.js';

// Danh mục của bếp theo đơn vị: nguyên liệu và tồn, món ăn kèm định lượng trên một suất, nhà cung cấp thực phẩm (P12-01,
// P12-04, P12-08; BR-60; YCTD-76)
const MAXIMUM_NORMS = 50;

interface NormInput {
  ingredient_id: string;
  quantity_per_serving: number;
}

type Changes = Record<string, string | null | undefined>;

@Injectable()
export class KitchenCatalogsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: KitchenAccess,
  ) {}

  async ingredients(currentUser: CurrentUser, orgUnitId: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertRead(currentUser, orgUnitId);
    const rows = await database
      .selectFrom('ingredients')
      .select(['id', 'org_unit_id', 'code', 'name', 'unit', 'current_stock', 'status'])
      .where('org_unit_id', '=', orgUnitId)
      .orderBy('name')
      .execute();
    return rows.map((row) => ({ ...row, current_stock: Number(row.current_stock) }));
  }

  async createIngredient(
    currentUser: CurrentUser,
    input: { org_unit_id: string; code: string; name: string; unit: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertManage(currentUser, input.org_unit_id);
    return database.transaction().execute(async (transaction) => {
      const created = await conflictOnDuplicate(
        transaction
          .insertInto('ingredients')
          .values({ ...input, created_by: origin.actorUserId })
          .returningAll()
          .executeTakeFirstOrThrow(),
        'Mã nguyên liệu đã có trong đơn vị',
        'code',
      );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'ingredients',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return { ...created, current_stock: Number(created.current_stock) };
    });
  }

  async updateIngredient(
    currentUser: CurrentUser,
    id: string,
    changes: { name?: string; unit?: string; status?: RecordStatus },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const before = await database.selectFrom('ingredients').selectAll().where('id', '=', id).executeTakeFirst();
    if (!before) {
      throw notFoundError('Không tìm thấy nguyên liệu', 'ingredient');
    }
    await this.access.assertManage(currentUser, before.org_unit_id);
    return database.transaction().execute(async (transaction) => {
      const after = await transaction
        .updateTable('ingredients')
        .set({ ...changes, updated_at: new Date() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: before.org_unit_id,
        entityName: 'ingredients',
        entityId: id,
        action: 'update',
        before,
        after,
      });
      return { ...after, current_stock: Number(after.current_stock) };
    });
  }

  async dishes(currentUser: CurrentUser, orgUnitId: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertRead(currentUser, orgUnitId);
    const dishes = await database
      .selectFrom('dishes')
      .select(['id', 'org_unit_id', 'name', 'group_name', 'recipe_note', 'status'])
      .where('org_unit_id', '=', orgUnitId)
      .orderBy('name')
      .execute();
    const norms = await this.normsOf(
      database,
      dishes.map((dish) => dish.id),
    );
    return dishes.map((dish) => ({ ...dish, norms: norms.filter((norm) => norm.dish_id === dish.id) }));
  }

  async createDish(
    currentUser: CurrentUser,
    input: {
      org_unit_id: string;
      name: string;
      group_name: string | null;
      recipe_note: string | null;
      norms: NormInput[] | undefined;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertManage(currentUser, input.org_unit_id);
    const { norms, ...values } = input;
    if (norms) {
      await this.assertIngredients(database, input.org_unit_id, norms);
    }
    const created = await database.transaction().execute(async (transaction) => {
      const dish = await conflictOnDuplicate(
        transaction
          .insertInto('dishes')
          .values({ ...values, created_by: origin.actorUserId })
          .returningAll()
          .executeTakeFirstOrThrow(),
        'Tên món đã có trong đơn vị',
        'name',
      );
      if (norms && norms.length > 0) {
        await transaction
          .insertInto('ingredient_norms')
          .values(norms.map((norm) => ({ ...norm, dish_id: dish.id })))
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'dishes',
        entityId: dish.id,
        action: 'create',
        before: null,
        after: { ...dish, norms: norms ?? [] },
      });
      return dish;
    });
    return { ...created, norms: await this.normsOf(database, [created.id]) };
  }

  async updateDish(currentUser: CurrentUser, id: string, changes: Changes, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const before = await this.findDish(database, id);
    await this.access.assertManage(currentUser, before.org_unit_id);
    return database.transaction().execute(async (transaction) => {
      const after = await conflictOnDuplicate(
        transaction
          .updateTable('dishes')
          .set({ ...changes, updated_at: new Date() })
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirstOrThrow(),
        'Tên món đã có trong đơn vị',
        'name',
      );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: before.org_unit_id,
        entityName: 'dishes',
        entityId: id,
        action: 'update',
        before,
        after,
      });
      return after;
    });
  }

  // P12-04: thay toàn bộ định lượng trên một suất của món
  async replaceNorms(currentUser: CurrentUser, dishId: string, norms: NormInput[], origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const dish = await this.findDish(database, dishId);
    await this.access.assertManage(currentUser, dish.org_unit_id);
    await this.assertIngredients(database, dish.org_unit_id, norms);
    const before = await this.normsOf(database, [dishId]);
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('ingredient_norms').where('dish_id', '=', dishId).execute();
      if (norms.length > 0) {
        await transaction
          .insertInto('ingredient_norms')
          .values(norms.map((norm) => ({ ...norm, dish_id: dishId })))
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: dish.org_unit_id,
        entityName: 'ingredient_norms',
        entityId: dishId,
        action: 'update',
        before,
        after: norms,
      });
    });
    return { ...dish, norms: await this.normsOf(database, [dishId]) };
  }

  async suppliers(currentUser: CurrentUser, orgUnitId: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertRead(currentUser, orgUnitId);
    return database
      .selectFrom('food_suppliers')
      .select(['id', 'org_unit_id', 'name', 'food_groups', 'tax_code', 'contact_name', 'phone', 'address', 'status'])
      .where('org_unit_id', '=', orgUnitId)
      .orderBy('name')
      .execute();
  }

  async createSupplier(
    currentUser: CurrentUser,
    input: { org_unit_id: string; name: string } & Changes,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertManage(currentUser, input.org_unit_id);
    return database.transaction().execute(async (transaction) => {
      const created = await conflictOnDuplicate(
        transaction
          .insertInto('food_suppliers')
          .values({ ...input, created_by: origin.actorUserId })
          .returningAll()
          .executeTakeFirstOrThrow(),
        'Nhà cung cấp đã có trong đơn vị',
        'name',
      );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'food_suppliers',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async updateSupplier(currentUser: CurrentUser, id: string, changes: Changes, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const before = await database.selectFrom('food_suppliers').selectAll().where('id', '=', id).executeTakeFirst();
    if (!before) {
      throw notFoundError('Không tìm thấy nhà cung cấp', 'food_supplier');
    }
    await this.access.assertManage(currentUser, before.org_unit_id);
    return database.transaction().execute(async (transaction) => {
      const after = await conflictOnDuplicate(
        transaction
          .updateTable('food_suppliers')
          .set({ ...changes, updated_at: new Date() })
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirstOrThrow(),
        'Nhà cung cấp đã có trong đơn vị',
        'name',
      );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: before.org_unit_id,
        entityName: 'food_suppliers',
        entityId: id,
        action: 'update',
        before,
        after,
      });
      return after;
    });
  }

  private async findDish(database: Kysely<SchoolYearDatabase>, id: string) {
    const dish = await database.selectFrom('dishes').selectAll().where('id', '=', id).executeTakeFirst();
    if (!dish) {
      throw notFoundError('Không tìm thấy món ăn', 'dish');
    }
    return dish;
  }

  private async normsOf(database: Kysely<SchoolYearDatabase>, dishIds: string[]) {
    if (dishIds.length === 0) {
      return [];
    }
    const rows = await database
      .selectFrom('ingredient_norms')
      .innerJoin('ingredients', 'ingredients.id', 'ingredient_norms.ingredient_id')
      .select([
        'ingredient_norms.dish_id',
        'ingredient_norms.ingredient_id',
        'ingredients.name as ingredient_name',
        'ingredients.unit',
        'ingredient_norms.quantity_per_serving',
      ])
      .where('ingredient_norms.dish_id', 'in', dishIds)
      .orderBy('ingredients.name')
      .execute();
    return rows.map((row) => ({ ...row, quantity_per_serving: Number(row.quantity_per_serving) }));
  }

  // Nguyên liệu của định lượng phải thuộc đơn vị của món và đang dùng
  private async assertIngredients(database: Kysely<SchoolYearDatabase>, orgUnitId: string, norms: NormInput[]) {
    if (norms.length === 0) {
      return;
    }
    const ids = [...new Set(norms.map((norm) => norm.ingredient_id))];
    const found = await database
      .selectFrom('ingredients')
      .select('id')
      .where('id', 'in', ids)
      .where('org_unit_id', '=', orgUnitId)
      .where('status', '=', 'active')
      .execute();
    if (found.length !== ids.length) {
      throw ruleViolationError('BR-60', 'Nguyên liệu của định lượng phải thuộc đơn vị của món và đang dùng');
    }
  }
}

export function readNorms(body: RequestBody, errors: FieldError[]): NormInput[] | undefined {
  const value = body?.norms;
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.length > MAXIMUM_NORMS) {
    errors.push({ field: 'norms', message: `Danh sách định lượng tối đa ${MAXIMUM_NORMS} dòng` });
    return undefined;
  }
  const norms: NormInput[] = [];
  value.forEach((item: RequestBody, index) => {
    const ingredientId = readRequiredUuid(item, 'ingredient_id', errors, `Dòng ${index + 1}: chọn nguyên liệu`);
    const quantity = readQuantity(item?.quantity_per_serving, `norms.${index}.quantity_per_serving`, errors);
    if (ingredientId && quantity !== null) {
      norms.push({ ingredient_id: ingredientId, quantity_per_serving: quantity });
    }
  });
  if (new Set(norms.map((norm) => norm.ingredient_id)).size !== norms.length) {
    errors.push({ field: 'norms', message: 'Mỗi nguyên liệu chỉ một dòng' });
  }
  return norms;
}

function optionalTexts(body: RequestBody, fields: string[], errors: FieldError[]): Changes {
  const changes: Changes = {};
  for (const field of fields) {
    if (body?.[field] !== undefined) {
      changes[field] = readText(body, field, errors);
    }
  }
  return changes;
}

@Controller()
export class KitchenCatalogsController {
  constructor(private readonly catalogs: KitchenCatalogsService) {}

  @Get('ingredients')
  ingredients(@Query('org_unit_id') orgUnitId: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.catalogs.ingredients(currentUser, queryUuid(orgUnitId, 'org_unit_id', true) ?? '');
  }

  @Post('ingredients')
  @HttpCode(201)
  createIngredient(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      code: readText(body, 'code', errors, true) ?? '',
      name: readText(body, 'name', errors, true) ?? '',
      unit: readText(body, 'unit', errors, true) ?? '',
    };
    check(errors);
    return this.catalogs.createIngredient(currentUser, input, originOf(request, currentUser));
  }

  @Patch('ingredients/:id')
  updateIngredient(
    @Param('id', uuidParameter('Mã nguyên liệu không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const changes: { name?: string; unit?: string; status?: RecordStatus } = {};
    for (const field of ['name', 'unit'] as const) {
      if (body?.[field] !== undefined) {
        changes[field] = readText(body, field, errors, true) ?? '';
      }
    }
    const status = readStatus(body, errors);
    if (status) {
      changes.status = status;
    }
    check(errors);
    return this.catalogs.updateIngredient(currentUser, id, changes, originOf(request, currentUser));
  }

  @Get('dishes')
  dishes(@Query('org_unit_id') orgUnitId: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.catalogs.dishes(currentUser, queryUuid(orgUnitId, 'org_unit_id', true) ?? '');
  }

  @Post('dishes')
  @HttpCode(201)
  createDish(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      name: readText(body, 'name', errors, true) ?? '',
      group_name: readText(body, 'group_name', errors),
      recipe_note: readText(body, 'recipe_note', errors),
      norms: readNorms(body, errors),
    };
    check(errors);
    return this.catalogs.createDish(currentUser, input, originOf(request, currentUser));
  }

  @Patch('dishes/:id')
  updateDish(
    @Param('id', uuidParameter('Mã món ăn không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const changes = optionalTexts(body, ['group_name', 'recipe_note'], errors);
    if (body?.name !== undefined) {
      changes.name = readText(body, 'name', errors, true);
    }
    const status = readStatus(body, errors);
    if (status) {
      changes.status = status;
    }
    check(errors);
    return this.catalogs.updateDish(currentUser, id, changes, originOf(request, currentUser));
  }

  @Put('dishes/:id/norms')
  replaceNorms(
    @Param('id', uuidParameter('Mã món ăn không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const norms = readNorms(body, errors);
    if (norms === undefined && errors.length === 0) {
      errors.push({ field: 'norms', message: 'Bắt buộc gửi danh sách định lượng' });
    }
    check(errors);
    return this.catalogs.replaceNorms(currentUser, id, norms ?? [], originOf(request, currentUser));
  }

  @Get('food-suppliers')
  suppliers(@Query('org_unit_id') orgUnitId: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.catalogs.suppliers(currentUser, queryUuid(orgUnitId, 'org_unit_id', true) ?? '');
  }

  @Post('food-suppliers')
  @HttpCode(201)
  createSupplier(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      name: readText(body, 'name', errors, true) ?? '',
      ...optionalTexts(body, ['food_groups', 'tax_code', 'contact_name', 'phone', 'address'], errors),
    };
    check(errors);
    return this.catalogs.createSupplier(currentUser, input, originOf(request, currentUser));
  }

  @Patch('food-suppliers/:id')
  updateSupplier(
    @Param('id', uuidParameter('Mã nhà cung cấp không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const changes = optionalTexts(body, ['food_groups', 'tax_code', 'contact_name', 'phone', 'address'], errors);
    if (body?.name !== undefined) {
      changes.name = readText(body, 'name', errors, true);
    }
    const status = readStatus(body, errors);
    if (status) {
      changes.status = status;
    }
    check(errors);
    return this.catalogs.updateSupplier(currentUser, id, changes, originOf(request, currentUser));
  }
}
