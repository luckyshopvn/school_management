import {
  Body,
  Controller,
  Get,
  Injectable,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { FilePurpose, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely } from 'kysely';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { writeDataAccessLog } from '../common/data-access-log.js';
import { notFoundError, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { ChildScope } from '../children/child-scope.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { FileStorage } from './file-storage.js';

// Tệp đính kèm của hồ sơ trẻ: bản chụp giấy khai sinh và giấy đồng ý hình ảnh; ảnh hoặc PDF, tối đa 10 MB (YCTD-45).
// Ảnh bàn giao trẻ do giáo viên chủ nhiệm chụp khi đón trả (Q-40, YCTD-48)
export const MAXIMUM_FILE_BYTES = 10 * 1024 * 1024;
const PURPOSES: FilePurpose[] = ['birth_certificate', 'photo_consent', 'pickup_photo', 'payment_voucher'];
const SIGNATURES: Array<{ contentType: string; bytes: number[] }> = [
  { contentType: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { contentType: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { contentType: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
];

// Phần tệp do bộ nhận tệp nhiều phần của Express trả về
interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

export interface StoredFile {
  id: string;
  org_unit_id: string | null;
  purpose: FilePurpose;
  file_name: string;
  content_type: string;
  size_bytes: number;
}

// Nhận diện định dạng theo các byte đầu của tệp, không tin phần mở rộng hay kiểu do trình duyệt gửi
function detectContentType(body: Buffer): string | undefined {
  return SIGNATURES.find((signature) => signature.bytes.every((byte, index) => body[index] === byte))?.contentType;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly fileStorage: FileStorage,
    private readonly childScope: ChildScope,
  ) {}

  async upload(
    currentUser: CurrentUser,
    input: { orgUnitId: string; purpose: FilePurpose; fileName: string; body: Buffer },
    origin: ChangeOrigin,
  ): Promise<StoredFile> {
    const { database } = await this.currentSchoolYear.require();
    if (input.purpose === 'pickup_photo') {
      await this.assertHomeroomInUnit(currentUser, database, input.orgUnitId);
    } else if (input.purpose === 'payment_voucher') {
      await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.paymentManage, input.orgUnitId);
    } else {
      await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.childManage, input.orgUnitId);
    }
    const contentType = detectContentType(input.body);
    if (!contentType || (input.purpose === 'pickup_photo' && contentType === 'application/pdf')) {
      throw validationError([
        {
          field: 'file',
          message:
            input.purpose === 'pickup_photo'
              ? 'Ảnh bàn giao là ảnh JPEG hoặc PNG'
              : 'Chỉ nhận ảnh JPEG, PNG hoặc tệp PDF',
        },
      ]);
    }
    const storageKey = `${input.purpose}/${randomUUID()}`;
    await this.fileStorage.put(storageKey, input.body, contentType);
    return database
      .insertInto('files')
      .values({
        org_unit_id: input.orgUnitId,
        purpose: input.purpose,
        file_name: input.fileName.slice(0, 200),
        content_type: contentType,
        size_bytes: input.body.length,
        storage_key: storageKey,
        created_by: origin.actorUserId,
      })
      .returning(['id', 'org_unit_id', 'purpose', 'file_name', 'content_type', 'size_bytes'])
      .executeTakeFirstOrThrow();
  }

  // Giấy khai sinh chỉ vai trò được xem đầy đủ số định danh mới tải được và luôn ghi nhật ký truy cập (BR-81)
  async download(
    currentUser: CurrentUser,
    fileId: string,
    origin: ChangeOrigin,
  ): Promise<{ file: StoredFile; body: Buffer }> {
    const { database } = await this.currentSchoolYear.require();
    const file = await database
      .selectFrom('files')
      .select(['id', 'org_unit_id', 'purpose', 'file_name', 'content_type', 'size_bytes', 'storage_key'])
      .where('id', '=', fileId)
      .executeTakeFirst();
    if (!file) {
      throw notFoundError('Không tìm thấy tệp', 'file');
    }
    // Tệp gắn với hồ sơ trẻ thì phạm vi theo đơn vị hiện tại của trẻ
    const child = await database
      .selectFrom('children')
      .select(['id', 'org_unit_id'])
      .where((expression) =>
        expression.or([
          expression('birth_certificate_file_id', '=', fileId),
          expression('photo_consent_file_id', '=', fileId),
        ]),
      )
      .executeTakeFirst();
    const orgUnitId = child?.org_unit_id ?? file.org_unit_id;
    if (!orgUnitId) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem tệp này');
    }
    if (file.purpose === 'pickup_photo') {
      // Ảnh bàn giao xem theo phạm vi xem trẻ của lượt bàn giao
      const pickup = await database
        .selectFrom('pickup_records')
        .select('child_id')
        .where('photo_file_id', '=', fileId)
        .executeTakeFirst();
      if (pickup) {
        await this.childScope.assertCanRead(currentUser, database, pickup.child_id);
      } else {
        await this.assertHomeroomInUnit(currentUser, database, orgUnitId);
      }
    } else if (file.purpose === 'payment_voucher') {
      await this.assertCanViewPayments(currentUser, orgUnitId);
    } else if (file.purpose === 'birth_certificate') {
      await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.nationalIdView, orgUnitId);
      await writeDataAccessLog(database, {
        origin,
        orgUnitId,
        entityName: 'children',
        entityId: child?.id ?? file.id,
        scope: 'birth_certificate',
      });
    } else {
      const permission = currentUser.hasPermission(PERMISSION_CODES.childManage)
        ? PERMISSION_CODES.childManage
        : PERMISSION_CODES.childApprove;
      await this.organizationScopes.assertCanAccess(currentUser, permission, orgUnitId);
    }
    const { storage_key: storageKey, ...stored } = file;
    return { file: stored, body: await this.fileStorage.get(storageKey) };
  }

  // Chứng từ phiếu chi: người xem phiếu chi của đơn vị (P06-04)
  private async assertCanViewPayments(currentUser: CurrentUser, orgUnitId: string): Promise<void> {
    for (const permission of ['P06.view', PERMISSION_CODES.paymentManage, PERMISSION_CODES.paymentApprove]) {
      const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
      if (scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId)) {
        return;
      }
    }
    throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem chứng từ này');
  }

  // Giáo viên chủ nhiệm đang được phân công một lớp của đơn vị
  private async assertHomeroomInUnit(
    currentUser: CurrentUser,
    database: Kysely<SchoolYearDatabase>,
    orgUnitId: string,
  ): Promise<void> {
    const homeroom = currentUser.description.assignments.some((assignment) => assignment.role_code === 'VT-07')
      ? await database
          .selectFrom('class_staff_assignments')
          .innerJoin('classes', 'classes.id', 'class_staff_assignments.class_id')
          .select('class_staff_assignments.id')
          .where('class_staff_assignments.staff_user_id', '=', currentUser.id)
          .where('class_staff_assignments.assignment_role', '=', 'homeroom')
          .where('class_staff_assignments.status', '=', 'active')
          .where('classes.org_unit_id', '=', orgUnitId)
          .executeTakeFirst()
      : undefined;
    if (!homeroom) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền tải ảnh bàn giao cho đơn vị này');
    }
  }
}

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // Quyền kiểm tra ở tầng nghiệp vụ theo mục đích: hồ sơ trẻ cần P02.child.manage, ảnh bàn giao cần là giáo viên chủ nhiệm
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_FILE_BYTES, files: 1 } }))
  upload(
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const orgUnitId = readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị');
    const purpose = body?.purpose as FilePurpose;
    if (!PURPOSES.includes(purpose)) {
      errors.push({
        field: 'purpose',
        message: 'Mục đích là birth_certificate, photo_consent, pickup_photo hoặc payment_voucher',
      });
    }
    if (!file || file.size === 0) {
      errors.push({ field: 'file', message: 'Bắt buộc chọn tệp' });
    }
    if (errors.length > 0 || !file) {
      throw validationError(errors);
    }
    return this.filesService.upload(
      currentUser,
      { orgUnitId, purpose, fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'), body: file.buffer },
      originOf(request, currentUser),
    );
  }

  @Get(':id')
  async download(
    @Param('id', uuidParameter('Mã tệp không hợp lệ')) fileId: string,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const { file, body } = await this.filesService.download(currentUser, fileId, originOf(request, currentUser));
    response.setHeader('content-type', file.content_type);
    response.setHeader('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.file_name)}`);
    response.setHeader('cache-control', 'no-store');
    response.send(body);
  }
}
