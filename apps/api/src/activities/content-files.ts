import { Body, Controller, Get, Injectable, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { FilePurpose, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Response } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { FileStorage } from '../files/file-storage.js';
import { MAXIMUM_FILE_BYTES } from '../files/files.js';
import { ActivityAccess, audienceCondition, covers, type AudienceScope } from './activity-access.js';

// Tệp của hoạt động và nội dung truyền thông (P14-04, P14-05, P14-06, P14-09; YCTD-78): ảnh hoạt động chỉ nhận JPEG, PNG;
// tệp nội dung (ảnh bìa tin tức, tài liệu thư viện, hình tô màu) nhận thêm PDF; tối đa 10 MB như tệp hồ sơ trẻ
export const CONTENT_MANAGE_PERMISSIONS = [
  PERMISSION_CODES.contentManage,
  PERMISSION_CODES.libraryManage,
  PERMISSION_CODES.extracurricularManage,
];

const SIGNATURES: Array<{ contentType: string; bytes: number[] }> = [
  { contentType: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { contentType: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { contentType: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
];

export interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export function decodeFileName(part: UploadedPart): string {
  return Buffer.from(part.originalname, 'latin1').toString('utf8');
}

// Lưu tệp vào kho và ghi dòng tệp; định dạng nhận diện theo các byte đầu, không tin phần mở rộng
export async function storeContentFile(
  fileStorage: FileStorage,
  database: Executor,
  input: { orgUnitId: string; purpose: FilePurpose; fileName: string; body: Buffer; createdBy: string },
) {
  const contentType = SIGNATURES.find((signature) =>
    signature.bytes.every((byte, index) => input.body[index] === byte),
  )?.contentType;
  const imageOnly = input.purpose === 'activity_photo';
  if (!contentType || (imageOnly && contentType === 'application/pdf')) {
    throw validationError([
      {
        field: 'file',
        message: imageOnly ? 'Ảnh hoạt động là ảnh JPEG hoặc PNG' : 'Chỉ nhận ảnh JPEG, PNG hoặc tệp PDF',
      },
    ]);
  }
  const storageKey = `${input.purpose}/${randomUUID()}`;
  await fileStorage.put(storageKey, input.body, contentType);
  return database
    .insertInto('files')
    .values({
      org_unit_id: input.orgUnitId,
      purpose: input.purpose,
      file_name: input.fileName.slice(0, 200),
      content_type: contentType,
      size_bytes: input.body.length,
      storage_key: storageKey,
      created_by: input.createdBy,
    })
    .returning(['id', 'org_unit_id', 'purpose', 'file_name', 'content_type', 'size_bytes'])
    .executeTakeFirstOrThrow();
}

export function sendStoredFile(response: Response, file: { content_type: string; file_name: string }, body: Buffer) {
  response.setHeader('content-type', file.content_type);
  response.setHeader('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.file_name)}`);
  response.setHeader('cache-control', 'no-store');
  response.send(body);
}

@Injectable()
export class ContentFilesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: ActivityAccess,
    private readonly fileStorage: FileStorage,
  ) {}

  async upload(currentUser: CurrentUser, orgUnitId: string, part: UploadedPart) {
    const { database } = await this.currentSchoolYear.require();
    if (!(await this.canManageUnit(currentUser, orgUnitId))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền tải tệp nội dung cho đơn vị này');
    }
    return storeContentFile(this.fileStorage, database, {
      orgUnitId,
      purpose: 'content_file',
      fileName: decodeFileName(part),
      body: part.buffer,
      createdBy: currentUser.id,
    });
  }

  // Người quản lý nội dung của đơn vị xem mọi tệp; người khác chỉ xem tệp gắn với nội dung đã công bố trong phạm vi
  async download(currentUser: CurrentUser, fileId: string) {
    const { database } = await this.currentSchoolYear.require();
    const file = await database
      .selectFrom('files')
      .select(['id', 'org_unit_id', 'purpose', 'file_name', 'content_type', 'storage_key'])
      .where('id', '=', fileId)
      .where('purpose', '=', 'content_file')
      .executeTakeFirst();
    if (!file) {
      throw notFoundError('Không tìm thấy tệp', 'file');
    }
    const managed = file.org_unit_id !== null && (await this.canManageUnit(currentUser, file.org_unit_id));
    if (!managed && !(await this.isPublishedFor(database, await this.access.audience(database, currentUser), fileId))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem tệp này');
    }
    return { file, body: await this.fileStorage.get(file.storage_key) };
  }

  private async canManageUnit(currentUser: CurrentUser, orgUnitId: string): Promise<boolean> {
    for (const permission of CONTENT_MANAGE_PERMISSIONS) {
      if (covers(await this.access.staffScope(currentUser, permission), orgUnitId)) {
        return true;
      }
    }
    return false;
  }

  private async isPublishedFor(database: Executor, audience: AudienceScope, fileId: string): Promise<boolean> {
    const news = await database
      .selectFrom('news')
      .select('id')
      .where('cover_file_id', '=', fileId)
      .where('status', '=', 'published')
      .where(audienceCondition(audience))
      .executeTakeFirst();
    if (news) {
      return true;
    }
    const item = await database
      .selectFrom('library_items')
      .select('id')
      .where('file_id', '=', fileId)
      .where('status', '=', 'published')
      .where(audienceCondition(audience))
      .executeTakeFirst();
    if (item) {
      return true;
    }
    const page = await database
      .selectFrom('coloring_pages')
      .select('id')
      .where('file_id', '=', fileId)
      .where('status', '=', 'published')
      .where(audienceCondition(audience))
      .executeTakeFirst();
    if (page) {
      return true;
    }
    // Ảnh bìa album: album đang dùng có ít nhất một nội dung đã công bố trong phạm vi
    const album = await database
      .selectFrom('library_albums')
      .innerJoin('library_items', 'library_items.album_id', 'library_albums.id')
      .select('library_albums.id')
      .where('library_albums.cover_file_id', '=', fileId)
      .where('library_albums.status', '=', 'active')
      .where('library_items.status', '=', 'published')
      .where(audienceCondition(audience) as never)
      .executeTakeFirst();
    return album !== undefined;
  }
}

@Controller('content-files')
export class ContentFilesController {
  constructor(private readonly contentFiles: ContentFilesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_FILE_BYTES, files: 1 } }))
  upload(
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const orgUnitId = readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị');
    if (!file || file.size === 0) {
      errors.push({ field: 'file', message: 'Bắt buộc chọn tệp' });
    }
    if (errors.length > 0 || !file) {
      throw validationError(errors);
    }
    return this.contentFiles.upload(currentUser, orgUnitId, file);
  }

  @Get(':id')
  async download(
    @Param('id', uuidParameter('Mã tệp không hợp lệ')) fileId: string,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const { file, body } = await this.contentFiles.download(currentUser, fileId);
    sendStoredFile(response, file, body);
  }
}
