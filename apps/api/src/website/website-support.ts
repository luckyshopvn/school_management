import { createHash } from 'node:crypto';
import type { SystemDatabase, WebsiteEventTarget } from '@school-management/database';
import { ApplicationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';

// Phần dùng chung của phân hệ Website trường (DT-18 phần 18f, YCTD-144): quyền, mã quy tắc, nhận dạng loại tệp, ghi lịch sử
export const WEBSITE_RULE_CODE = 'YCTD-144';
export const WEBSITE_PERMISSIONS = {
  edit: PERMISSION_CODES.websiteEdit,
  approve: PERMISSION_CODES.websiteApprove,
  configure: PERMISSION_CODES.websiteConfigure,
} as const;
// Người soạn và người duyệt đều xem, soạn được nội dung; chỉ người duyệt đăng, trả lại, gỡ
export const CONTENT_PERMISSIONS = [WEBSITE_PERMISSIONS.edit, WEBSITE_PERMISSIONS.approve];

export type SystemExecutor = Kysely<SystemDatabase> | Transaction<SystemDatabase>;

export function requireAny(currentUser: CurrentUser, codes: readonly string[]): void {
  if (!codes.some((code) => currentUser.hasPermission(code))) {
    throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này');
  }
}

export const sha256 = (body: Buffer) => createHash('sha256').update(body).digest('hex');

const startsWith = (body: Buffer, bytes: number[]) => bytes.every((byte, index) => body[index] === byte);
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0];

// Ảnh của website chỉ nhận JPEG, PNG, WebP (nhận theo nội dung tệp, không theo đuôi)
export function detectImageType(body: Buffer): string | undefined {
  if (startsWith(body, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (startsWith(body, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (startsWith(body, [0x52, 0x49, 0x46, 0x46]) && body.subarray(8, 12).toString('latin1') === 'WEBP') {
    return 'image/webp';
  }
  return undefined;
}

// Tệp đính kèm của bài: ảnh, PDF, Word, Excel
export function detectAttachmentType(fileName: string, body: Buffer): string | undefined {
  const image = detectImageType(body);
  if (image) {
    return image;
  }
  if (startsWith(body, [0x25, 0x50, 0x44, 0x46])) {
    return 'application/pdf';
  }
  const extension = /\.([a-z]+)$/i.exec(fileName)?.[1]?.toLowerCase() ?? '';
  const office: Record<string, { signature: number[]; type: string }> = {
    docx: {
      signature: ZIP,
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
    xlsx: { signature: ZIP, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    doc: { signature: OLE, type: 'application/msword' },
    xls: { signature: OLE, type: 'application/vnd.ms-excel' },
  };
  const match = office[extension];
  return match && startsWith(body, match.signature) ? match.type : undefined;
}

export async function recordEvent(
  executor: SystemExecutor,
  target: WebsiteEventTarget,
  targetId: string | null,
  action: string,
  note: string | null,
  currentUser: CurrentUser,
): Promise<void> {
  await executor
    .insertInto('website_events')
    .values({
      target_type: target,
      target_id: targetId,
      action,
      note,
      actor_id: currentUser.id,
      actor_name: currentUser.description.full_name,
    })
    .execute();
}
