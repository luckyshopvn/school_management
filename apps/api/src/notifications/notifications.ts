import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Post, Put, Query } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

// Trung tâm thông báo (P19-04, P19-05; BR-70; YCTD-64). Người nhận là một tài khoản, hoặc mọi tài khoản có vai trò ở
// đơn vị (gán ở Trường chính hoặc toàn trường cũng nhận); mỗi người đọc được ghi riêng để biết ai đã đọc, ai chưa đọc.
// Mẫu thông báo chung toàn trường thay tiêu đề và nội dung khi hiển thị, dùng biến {tieu_de}, {noi_dung}, {don_vi}
const PAGE_SIZE = 50;
const MAXIMUM_TEMPLATE = 1000;

interface NotificationRow {
  id: string;
  org_unit_id: string | null;
  template_code: string;
  title: string;
  body: string;
  target_type: string;
  target_id: string;
  created_at: Date;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {}

  async list(currentUser: CurrentUser, unreadOnly: boolean) {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return { unread_count: 0, notifications: [] };
    }
    const { database } = current;
    const visible = await this.visibleIds(database, currentUser);
    if (visible.length === 0) {
      return { unread_count: 0, notifications: [] };
    }
    const reads = new Set(
      (
        await database
          .selectFrom('notification_reads')
          .select('notification_id')
          .where('user_id', '=', currentUser.id)
          .where('notification_id', 'in', visible)
          .execute()
      ).map((row) => row.notification_id),
    );
    const unread = visible.filter((id) => !reads.has(id));
    const ids = unreadOnly ? unread : visible;
    const rows = ids.length
      ? await database
          .selectFrom('notifications')
          .selectAll()
          .where('id', 'in', ids)
          .orderBy('created_at', 'desc')
          .limit(PAGE_SIZE)
          .execute()
      : [];
    const rendered = await this.render(database, rows);
    return {
      unread_count: unread.length,
      notifications: rendered.map((row) => ({ ...row, is_read: reads.has(row.id) })),
    };
  }

  async markRead(currentUser: CurrentUser, notificationId: string) {
    const { database } = await this.currentSchoolYear.require();
    const visible = await this.visibleIds(database, currentUser, [notificationId]);
    if (visible.length === 0) {
      throw notFoundError('Không tìm thấy thông báo', 'notification');
    }
    await this.recordReads(database, currentUser.id, visible);
    return { id: notificationId, is_read: true };
  }

  async markAllRead(currentUser: CurrentUser) {
    const { database } = await this.currentSchoolYear.require();
    await this.recordReads(database, currentUser.id, await this.visibleIds(database, currentUser));
    return { unread_count: 0 };
  }

  // BR-70: người nhận trực tiếp kèm trạng thái đã đọc; thông báo gửi theo vai trò thì liệt kê những người đã đọc
  async receipts(currentUser: CurrentUser, notificationId: string) {
    const { database } = await this.currentSchoolYear.require();
    const notification = await database
      .selectFrom('notifications')
      .selectAll()
      .where('id', '=', notificationId)
      .executeTakeFirst();
    if (!notification) {
      throw notFoundError('Không tìm thấy thông báo', 'notification');
    }
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.notificationReceiptView);
    const allowed =
      scope.wholeSchool || (notification.org_unit_id !== null && scope.orgUnitIds.includes(notification.org_unit_id));
    if (!allowed) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem ai đã đọc thông báo này');
    }
    const recipients = await database
      .selectFrom('notification_recipients')
      .select(['user_id', 'role_code', 'org_unit_id', 'channel'])
      .where('notification_id', '=', notificationId)
      .execute();
    const reads = await database
      .selectFrom('notification_reads')
      .select(['user_id', 'read_at'])
      .where('notification_id', '=', notificationId)
      .execute();
    const userIds = [
      ...new Set([
        ...recipients.map((row) => row.user_id).filter((id): id is string => id !== null),
        ...reads.map((row) => row.user_id),
      ]),
    ];
    const names = await this.names(database, userIds);
    const readAt = new Map(reads.map((row) => [row.user_id, row.read_at]));
    const direct = [
      ...new Set(
        recipients.filter((row) => row.user_id && row.channel === 'in_app').map((row) => row.user_id as string),
      ),
    ];
    return {
      notification_id: notificationId,
      direct_recipients: direct.map((userId) => ({
        user_id: userId,
        name: names.get(userId) ?? null,
        read_at: readAt.get(userId) ?? null,
      })),
      role_recipients: recipients
        .filter((row) => row.role_code && row.channel === 'in_app')
        .map((row) => ({ role_code: row.role_code, org_unit_id: row.org_unit_id })),
      readers: reads.map((row) => ({
        user_id: row.user_id,
        name: names.get(row.user_id) ?? null,
        read_at: row.read_at,
      })),
      unread_count: direct.filter((userId) => !readAt.has(userId)).length,
    };
  }

  // Mẫu đã sửa kèm các mã thông báo đã từng phát sinh để chọn sửa
  async templates(currentUser: CurrentUser) {
    this.assertTemplateAccess(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const templates = await database.selectFrom('notification_templates').selectAll().execute();
    const codes = await database
      .selectFrom('notifications')
      .select('template_code')
      .distinct()
      .orderBy('template_code')
      .execute();
    const allCodes = [
      ...new Set([...codes.map((row) => row.template_code), ...templates.map((row) => row.template_code)]),
    ].sort();
    return allCodes.map((code) => {
      const template = templates.find((row) => row.template_code === code);
      return {
        template_code: code,
        title_template: template?.title_template ?? null,
        body_template: template?.body_template ?? null,
      };
    });
  }

  async saveTemplate(currentUser: CurrentUser, code: string, input: { title: string; body: string }) {
    await this.assertTemplateManager(currentUser);
    const { database } = await this.currentSchoolYear.require();
    await database
      .insertInto('notification_templates')
      .values({
        template_code: code,
        title_template: input.title,
        body_template: input.body,
        updated_by: currentUser.id,
      })
      .onConflict((conflict) =>
        conflict.column('template_code').doUpdateSet({
          title_template: input.title,
          body_template: input.body,
          updated_by: currentUser.id,
          updated_at: this.clock.now(),
        }),
      )
      .execute();
    return { template_code: code, title_template: input.title, body_template: input.body };
  }

  async resetTemplate(currentUser: CurrentUser, code: string): Promise<void> {
    await this.assertTemplateManager(currentUser);
    const { database } = await this.currentSchoolYear.require();
    await database.deleteFrom('notification_templates').where('template_code', '=', code).execute();
  }

  // Thông báo trong ứng dụng gửi trực tiếp cho tài khoản hoặc theo vai trò của tài khoản ở đơn vị
  private async visibleIds(database: Kysely<SchoolYearDatabase>, currentUser: CurrentUser, only?: string[]) {
    const root = await database
      .selectFrom('org_units')
      .select('id')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    const assignments = currentUser.description.assignments;
    let query = database
      .selectFrom('notification_recipients')
      .select('notification_id')
      .distinct()
      .where('channel', '=', 'in_app')
      .where((expression) =>
        expression.or([
          expression('user_id', '=', currentUser.id),
          ...assignments.map((assignment) =>
            assignment.org_unit_id === null || assignment.org_unit_id === root?.id
              ? expression('role_code', '=', assignment.role_code)
              : expression.and([
                  expression('role_code', '=', assignment.role_code),
                  expression('org_unit_id', '=', assignment.org_unit_id),
                ]),
          ),
        ]),
      );
    if (only) {
      query = query.where('notification_id', 'in', only);
    }
    return (await query.execute()).map((row) => row.notification_id);
  }

  private async recordReads(database: Kysely<SchoolYearDatabase>, userId: string, ids: string[]) {
    if (ids.length === 0) {
      return;
    }
    await database
      .insertInto('notification_reads')
      .values(ids.map((id) => ({ notification_id: id, user_id: userId })))
      .onConflict((conflict) => conflict.columns(['notification_id', 'user_id']).doNothing())
      .execute();
    await database
      .updateTable('notification_recipients')
      .set({ is_read: true, read_at: this.clock.now() })
      .where('user_id', '=', userId)
      .where('notification_id', 'in', ids)
      .where('is_read', '=', false)
      .execute();
  }

  private async render(database: Kysely<SchoolYearDatabase>, rows: NotificationRow[]) {
    if (rows.length === 0) {
      return [];
    }
    const templates = new Map(
      (
        await database
          .selectFrom('notification_templates')
          .selectAll()
          .where('template_code', 'in', [...new Set(rows.map((row) => row.template_code))])
          .execute()
      ).map((row) => [row.template_code, row]),
    );
    const units = new Map(
      (await database.selectFrom('org_units').select(['id', 'name']).execute()).map((row) => [row.id, row.name]),
    );
    return rows.map((row) => {
      const template = templates.get(row.template_code);
      if (!template) {
        return row;
      }
      const fill = (text: string) =>
        text
          .replaceAll('{tieu_de}', row.title)
          .replaceAll('{noi_dung}', row.body)
          .replaceAll('{don_vi}', row.org_unit_id ? (units.get(row.org_unit_id) ?? '') : '');
      return { ...row, title: fill(template.title_template), body: fill(template.body_template) };
    });
  }

  private async names(database: Kysely<SchoolYearDatabase>, userIds: string[]) {
    const result = new Map<string, string>();
    if (userIds.length === 0) {
      return result;
    }
    for (const row of await database
      .selectFrom('staff')
      .select(['user_id', 'full_name'])
      .where('user_id', 'in', userIds)
      .execute()) {
      if (row.user_id) {
        result.set(row.user_id, row.full_name);
      }
    }
    for (const row of await database
      .selectFrom('guardians')
      .select(['user_id', 'full_name'])
      .where('user_id', 'in', userIds)
      .execute()) {
      if (row.user_id && !result.has(row.user_id)) {
        result.set(row.user_id, row.full_name);
      }
    }
    return result;
  }

  private assertTemplateAccess(currentUser: CurrentUser) {
    if (!currentUser.hasPermission(PERMISSION_CODES.notificationTemplateManage)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem mẫu thông báo');
    }
  }

  // Mẫu chung toàn trường nên người sửa phải được gán ở Trường chính
  private async assertTemplateManager(currentUser: CurrentUser) {
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.notificationTemplateManage);
    if (!scope.wholeSchool) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người được gán ở Trường chính sửa được mẫu thông báo');
    }
  }
}

@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('notifications')
  list(@Query('unread_only') unreadOnly: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.notifications.list(currentUser, unreadOnly === 'true');
  }

  @Post('notifications/read-all')
  @HttpCode(200)
  markAllRead(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.notifications.markAllRead(currentUser);
  }

  @Post('notifications/:id/read')
  @HttpCode(200)
  markRead(
    @Param('id', uuidParameter('Mã thông báo không hợp lệ')) notificationId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.notifications.markRead(currentUser, notificationId);
  }

  @Get('notifications/:id/receipts')
  receipts(
    @Param('id', uuidParameter('Mã thông báo không hợp lệ')) notificationId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.notifications.receipts(currentUser, notificationId);
  }

  @Get('notification-templates')
  templates(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.notifications.templates(currentUser);
  }

  @Put('notification-templates/:code')
  saveTemplate(@Param('code') code: string, @Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const title = typeof body?.title_template === 'string' ? body.title_template.trim() : '';
    const text = typeof body?.body_template === 'string' ? body.body_template.trim() : '';
    if (!/^[a-z_]{3,60}$/.test(code)) {
      throw validationError([{ field: 'code', message: 'Mã mẫu không hợp lệ' }]);
    }
    if (!title || !text || title.length > MAXIMUM_TEMPLATE || text.length > MAXIMUM_TEMPLATE) {
      throw validationError([
        { field: 'title_template', message: `Tiêu đề và nội dung bắt buộc, tối đa ${MAXIMUM_TEMPLATE} ký tự` },
      ]);
    }
    return this.notifications.saveTemplate(currentUser, code, { title, body: text });
  }

  @Delete('notification-templates/:code')
  @HttpCode(204)
  async resetTemplate(@Param('code') code: string, @AuthenticatedUser() currentUser: CurrentUser): Promise<void> {
    await this.notifications.resetTemplate(currentUser, code);
  }
}
