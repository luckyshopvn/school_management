import { Controller, Get, Injectable, Query } from '@nestjs/common';
import type { SystemDatabase } from '@school-management/database';
import { Clock, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { sql, type Kysely } from 'kysely';
import { RequirePermission } from '../authentication/authentication.guard.js';
import { Databases } from '../common/databases.js';
import { monthlyWindow, vietnamMonthOf } from './ai-tutor-rules.js';
import { tutorTokenUsage } from './tutor-usage.js';

// Báo cáo Gia sư AI cho trường theo tháng (YCTD-383 lát L5; bản mẫu MH-599 "Lượt hỏi tháng", "Token tháng (vào hóa đơn dịch vụ)"). Quy tắc
// tính giữ như lát L2 (BR-470), dùng chung hàm tổng hợp token với việc nền ghi token lên nền tảng nên số liệu khớp hóa đơn dịch vụ:
// - lượt hỏi: lượt đã trừ (`captured`) có thời điểm trừ trong tháng, giờ Việt Nam; lượt được hoàn không tính lượt;
// - token: mọi câu trả lời của gia sư đã gọi nhà cung cấp trong tháng, kể cả câu được hoàn lượt (vẫn tính phí vì đã tốn);
// - token của gói trường bán vào hóa đơn dịch vụ của trường; token của gói phụ huynh mua trực tiếp từ nền tảng là chi phí của nền tảng,
//   ghi riêng để trường biết, không tính cho trường;
// - báo cáo không có tên học sinh, không có nội dung hội thoại; số tiền thật xem ở hóa đơn dịch vụ (đơn giá, token miễn phí, làm tròn).
const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

interface SourceTotals {
  questions: number;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

const emptyTotals = (): SourceTotals => ({
  questions: 0,
  requests: 0,
  input_tokens: 0,
  output_tokens: 0,
  total_tokens: 0,
});

@Injectable()
export class AiTutorSchoolReportService {
  constructor(
    private readonly databases: Databases,
    private readonly clock: Clock,
  ) {}

  private get system(): Kysely<SystemDatabase> {
    return this.databases.system;
  }

  async report(month: string | undefined) {
    if (month !== undefined && !MONTH_PATTERN.test(month)) {
      throw validationError([{ field: 'month', message: 'Tháng dạng YYYY-MM' }]);
    }
    const periodMonth = month ? `${month}-01` : vietnamMonthOf(this.clock.now());
    const { validFrom: from, validUntil: until } = monthlyWindow(periodMonth);
    const [usage, turns, refunded] = await Promise.all([
      tutorTokenUsage(this.system, { from, until }),
      this.system
        .selectFrom('ai_tutor_turn_ledger')
        .innerJoin('ai_tutor_subscriptions', 'ai_tutor_subscriptions.id', 'ai_tutor_turn_ledger.subscription_id')
        .select(['ai_tutor_subscriptions.plan_source', sql<string>`count(*)`.as('questions')])
        .where('ai_tutor_turn_ledger.status', '=', 'captured')
        .where('ai_tutor_turn_ledger.settled_at', '>=', from)
        .where('ai_tutor_turn_ledger.settled_at', '<', until)
        .groupBy('ai_tutor_subscriptions.plan_source')
        .execute(),
      this.system
        .selectFrom('ai_tutor_messages')
        .innerJoin('ai_tutor_turn_ledger', 'ai_tutor_turn_ledger.id', 'ai_tutor_messages.ledger_entry_id')
        .select(sql<string>`count(*)`.as('answers'))
        .where('ai_tutor_messages.role', '=', 'tutor')
        .where('ai_tutor_messages.model', 'is not', null)
        .where('ai_tutor_messages.created_at', '>=', from)
        .where('ai_tutor_messages.created_at', '<', until)
        .where('ai_tutor_turn_ledger.status', '=', 'released')
        .executeTakeFirstOrThrow(),
    ]);
    const students = await this.system
      .selectFrom('ai_tutor_turn_ledger')
      .select(sql<string>`count(distinct child_id)`.as('students'))
      .where('status', '=', 'captured')
      .where('settled_at', '>=', from)
      .where('settled_at', '<', until)
      .executeTakeFirstOrThrow();
    const totals = { school: emptyTotals(), platform: emptyTotals() };
    for (const row of turns) {
      totals[row.plan_source].questions += Number(row.questions);
    }
    for (const row of usage) {
      const source = row.config === 'tutor_school' ? totals.school : totals.platform;
      source.requests += row.requests;
      source.input_tokens += row.inputTokens;
      source.output_tokens += row.outputTokens;
      source.total_tokens += row.inputTokens + row.outputTokens;
    }
    return {
      month: periodMonth.slice(0, 7),
      questions: totals.school.questions + totals.platform.questions,
      students: Number(students.students),
      refunded_answers_with_tokens: Number(refunded.answers),
      school: totals.school,
      platform: totals.platform,
    };
  }
}

// Quản trị trường xem báo cáo bằng quyền của trang Gia sư AI (MH-599)
@Controller('ai-tutor/school/report')
export class AiTutorSchoolReportController {
  constructor(private readonly reports: AiTutorSchoolReportService) {}

  @Get()
  @RequirePermission(PERMISSION_CODES.integrationManage)
  report(@Query('month') month: string | undefined) {
    return this.reports.report(month === '' ? undefined : month);
  }
}
