import type { SchoolYearDatabase, SystemDatabase } from '@school-management/database';
import { PROFESSIONAL_EVIDENCE_FRAMEWORKS } from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';

// Mã tiêu chí của bộ chuẩn của cá nhân (chép từ danh mục P07-05, YCTD-396 lát L6b) đã có minh chứng của một người (lát L9,
// BR-557): minh chứng gắn vào tiêu chí, khác trạng thái "Chưa có". Bộ của loại chuẩn chưa nạp thì trả null (không kiểm). Hàm
// đọc thẳng bảng của kho, không qua dịch vụ kho, để phân hệ chuẩn nghề nghiệp dùng mà không phụ thuộc vòng
export async function criteriaWithEvidence(
  system: Kysely<SystemDatabase>,
  year: Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>,
  standardType: string,
  userId: string,
): Promise<Set<string> | null> {
  const code = PROFESSIONAL_EVIDENCE_FRAMEWORKS.find((item) => item.standard_type === standardType)?.code;
  const framework = code
    ? await year.selectFrom('quality_frameworks').select('id').where('code', '=', code).executeTakeFirst()
    : undefined;
  if (!framework) {
    return null;
  }
  const nodes = new Map(
    (
      await year
        .selectFrom('quality_criteria')
        .select(['id', 'code'])
        .where('framework_id', '=', framework.id)
        .execute()
    ).map((row) => [row.id, row.code]),
  );
  const links = await system
    .selectFrom('evidence_node_links as links')
    .innerJoin('evidence_items as items', 'items.id', 'links.evidence_id')
    .select('links.node_id')
    .where('links.framework_id', '=', framework.id)
    .where('items.subject_user_id', '=', userId)
    .where('items.status', '<>', 'missing')
    .execute();
  return new Set(links.map((link) => nodes.get(link.node_id)).filter((value): value is string => value !== undefined));
}
