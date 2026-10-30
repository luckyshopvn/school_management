import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, FORM_CONTROL_CLASS } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Báo cáo Gia sư AI theo tháng của trường (YCTD-383 lát L5; bản mẫu MH-599 "Lượt hỏi tháng", "Token tháng (vào hóa đơn dịch vụ)"). Máy chủ
// tính theo quy tắc của lát L2: lượt hỏi là lượt đã trừ; token gồm cả câu được hoàn lượt; chỉ token của gói trường bán vào hóa đơn dịch vụ
interface SourceTotals {
  questions: number;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

interface Report {
  month: string;
  questions: number;
  students: number;
  refunded_answers_with_tokens: number;
  school: SourceTotals;
  platform: SourceTotals;
}

const currentVietnamMonth = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()).slice(0, 7);
const count = (value: number) => value.toLocaleString('vi-VN');
// Token lớn đọc theo triệu như bản mẫu ("21,6 triệu")
const tokenCount = (value: number) =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu`
    : count(value);

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không tải được báo cáo, vui lòng thử lại';
}

export function AiTutorSchoolReport() {
  const [month, setMonth] = useState(currentVietnamMonth);
  const report = useQuery({
    queryKey: ['ai-tutor-school', 'report', month],
    queryFn: () => requestJson<Report>(`/api/v1/ai-tutor/school/report${month ? `?month=${month}` : ''}`),
  });
  const monthNumber = Number((report.data?.month ?? month).slice(5, 7));
  return (
    <section className="flex flex-col gap-3" aria-label="Báo cáo tháng">
      <h2 className="text-section-title font-semibold text-text">Báo cáo tháng</h2>
      <label className="flex max-w-xs flex-col text-label">
        Tháng báo cáo
        <input
          type="month"
          className={FORM_CONTROL_CLASS}
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        />
      </label>
      {report.error ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
      {report.data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1 rounded-lg border border-border p-4" aria-label="Lượt hỏi tháng">
              <span className="text-label text-text-secondary">Lượt hỏi tháng {monthNumber}</span>
              <span className="text-section-title font-semibold tabular-nums text-text">
                {count(report.data.questions)}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-border p-4" aria-label="Token tháng">
              <span className="text-label text-text-secondary">Token tháng {monthNumber} (vào hóa đơn dịch vụ)</span>
              <span className="text-section-title font-semibold tabular-nums text-text">
                {tokenCount(report.data.school.total_tokens)}
              </span>
            </div>
          </div>
          <ul className="flex flex-col gap-1 text-label text-text-secondary">
            <li>
              {count(report.data.students)} học sinh đã hỏi; gói trường bán {count(report.data.school.questions)} lượt,
              gói phụ huynh mua trực tiếp từ nền tảng {count(report.data.platform.questions)} lượt.
            </li>
            <li>
              Token vào hóa đơn dịch vụ: {count(report.data.school.input_tokens)} token vào,{' '}
              {count(report.data.school.output_tokens)} token ra; gồm cả câu đã gửi gia sư nhưng được hoàn lượt. Tháng
              này có {count(report.data.refunded_answers_with_tokens)} câu được hoàn lượt vẫn tính token (cả hai nguồn
              gói).
            </li>
            <li>
              Token của gói mua trực tiếp từ nền tảng ({count(report.data.platform.total_tokens)}) là chi phí của nền
              tảng, không tính cho trường. Số tiền xem ở hóa đơn dịch vụ.
            </li>
          </ul>
        </>
      ) : null}
    </section>
  );
}
