import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';
import { nextDocumentCode } from '../fees/document-codes.js';

// Mở năm học mới thì chuyển nhà cung cấp, tài sản chưa thanh lý kèm vị trí và trạng thái, phiếu cấp phát và phiếu mượn
// đang mở, mặt hàng kèm tồn hiện tại; tồn chuyển sang ghi một phiếu chuyển năm để tồn ban đầu không nhập lại được (BR-62).
// Phiếu nhập xuất, kiểm kê, hỏng mất, đề nghị và phiếu mua hàng tra ở năm cũ (YCTD-77). Chạy sau bước chuyển y tế
export const inventoryTransitionStep: AcademicYearTransitionStep = {
  name: 'inventory',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    for (const row of await previous.selectFrom('suppliers').selectAll().execute()) {
      await next.insertInto('suppliers').values(row).execute();
    }
    const assets = await previous.selectFrom('assets').selectAll().where('status', '<>', 'disposed').execute();
    for (const row of assets) {
      await next.insertInto('assets').values(row).execute();
    }
    const assetIds = assets.map((row) => row.id);
    if (assetIds.length > 0) {
      for (const row of await previous
        .selectFrom('asset_assignments')
        .selectAll()
        .where('asset_id', 'in', assetIds)
        .where('returned_on', 'is', null)
        .execute()) {
        await next.insertInto('asset_assignments').values(row).execute();
      }
      for (const row of await previous
        .selectFrom('asset_loans')
        .selectAll()
        .where('asset_id', 'in', assetIds)
        .where('status', '=', 'open')
        .execute()) {
        await next.insertInto('asset_loans').values(row).execute();
      }
    }
    const items = await previous.selectFrom('stock_items').selectAll().execute();
    if (items.length === 0) {
      return;
    }
    await next.transaction().execute(async (transaction) => {
      const code = await nextDocumentCode(transaction, 'stock_carry_over', 'CTK');
      for (const row of items) {
        await transaction.insertInto('stock_items').values(row).execute();
        await transaction
          .insertInto('stock_transactions')
          .values({
            code,
            stock_item_id: row.id,
            transaction_type: 'carry_over',
            quantity: row.current_qty,
            unit_price: null,
            balance_after: row.current_qty,
            reference_type: null,
            reference_id: null,
            transaction_date: context.academicYear.startDate,
            note: 'Tồn chuyển từ năm học trước',
            created_by: context.actorUserId,
          })
          .execute();
      }
    });
  },
};
