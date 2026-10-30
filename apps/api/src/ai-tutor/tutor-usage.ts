import type { AiUsageRow, SystemDatabase } from '@school-management/database';
import { sql, type Kysely } from 'kysely';

// Token của gia sư AI học sinh theo ngày (giờ Việt Nam), mô hình, nguồn gói (YCTD-383 lát L2; Q8 của Eric ngày 2026-10-30). Mỗi câu trả
// lời của gia sư gắn với lượt đã tạm giữ của một lần mua nên biết lượt đó thuộc gói trường bán hay nền tảng bán: `tutor_school` tính lên
// hóa đơn dịch vụ của trường, `tutor_platform` là chi phí của nền tảng. Câu trả lời đã gọi nhà cung cấp nhưng lượt được hoàn (kiểm duyệt,
// ngoài học tập) vẫn tính token vì đã tốn. Việc nền tổng hợp token của trợ lý AI gọi thêm hàm này rồi ghi đè lên nền tảng
export async function tutorTokenUsage(system: Kysely<SystemDatabase>): Promise<AiUsageRow[]> {
  const rows = await sql<{
    usage_date: string;
    model: string;
    config: 'tutor_school' | 'tutor_platform';
    requests: string;
    input_tokens: string;
    output_tokens: string;
  }>`select to_char(m.created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as usage_date, m.model,
      case when s.plan_source = 'school' then 'tutor_school' else 'tutor_platform' end as config,
      count(*) as requests, sum(m.input_tokens) as input_tokens, sum(m.output_tokens) as output_tokens
    from ai_tutor_messages m
    join ai_tutor_turn_ledger l on l.id = m.ledger_entry_id
    join ai_tutor_subscriptions s on s.id = l.subscription_id
    where m.role = 'tutor' and m.model is not null and m.input_tokens is not null and m.output_tokens is not null
    group by 1, 2, 3`.execute(system);
  return rows.rows.map((row) => ({
    usageDate: row.usage_date,
    model: row.model,
    config: row.config,
    requests: Number(row.requests),
    inputTokens: Number(row.input_tokens),
    outputTokens: Number(row.output_tokens),
  }));
}
