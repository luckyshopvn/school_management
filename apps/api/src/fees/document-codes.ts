import type { SchoolYearDatabase } from '@school-management/database';
import type { Transaction } from 'kysely';

// Số chứng từ liên tục toàn trường trong năm học theo loại, dạng TIỀN_TỐ-000001 (BR-30, YCTD-30)
export async function nextDocumentCode(
  transaction: Transaction<SchoolYearDatabase>,
  documentType: string,
  prefix: string,
): Promise<string> {
  const row = await transaction
    .insertInto('document_sequences')
    .values({ document_type: documentType, last_value: 1 })
    .onConflict((conflict) =>
      conflict.column('document_type').doUpdateSet((expression) => ({
        last_value: expression('document_sequences.last_value', '+', 1),
      })),
    )
    .returning('last_value')
    .executeTakeFirstOrThrow();
  return `${prefix}-${String(row.last_value).padStart(6, '0')}`;
}
