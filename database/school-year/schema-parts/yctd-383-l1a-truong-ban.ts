import type { ColumnType, Generated } from 'kysely';
import type { CreatedTimestamp } from '../schema.js';

// Dòng thu Gia sư AI trên hóa đơn học phí, lát L1a trường bán (YCTD-383; migration năm học 0231_add_ai_tutor_invoice_charges)
export interface AiTutorInvoiceChargesTable {
  id: Generated<string>;
  invoice_item_id: string;
  child_id: string;
  subscription_id: string;
  upgrade_id: string | null;
  amount: ColumnType<string, string | number, string | number>;
  created_at: CreatedTimestamp;
}

declare module '../schema.js' {
  interface SchoolYearDatabase {
    ai_tutor_invoice_charges: AiTutorInvoiceChargesTable;
  }
}
