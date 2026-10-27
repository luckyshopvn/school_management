import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TUTORING_CANCEL_REFUND_LABELS,
  TUTORING_CONTENT_TYPE_LABELS,
  TUTORING_CREDIT_STATUS_LABELS,
  TUTORING_FUNDING_SOURCE_LABELS,
  TUTORING_NO_FEE_BASIS,
} from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { tutoringApi, type CreditRow } from './tutoring-api.js';
import { messageOf } from './TutoringProgramsPage.js';

// 5. Thu chi gia sư (DT-27 phần 27c, YCTD-253): báo cáo thu, trừ, hoàn, chi thù lao theo chương trình và kỳ (xuất Excel); kế toán
// đẩy thù lao buổi đã dạy vào bảng lương tháng; xử lý khoản trừ của buổi bị hủy sau khi đã thu (điều chỉnh giảm hóa đơn qua luồng
// điều chỉnh hiện có, chuyển sang trừ kỳ sau, hoặc đóng sau khi đã hoàn qua phiếu chi hoàn)
const thisMonth = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()).slice(0, 7);
const money = (amount: number) => `${amount.toLocaleString('vi-VN')} đ`;

function creditStatus(credit: CreditRow): string {
  if (credit.adjustment_rejected) {
    return 'Điều chỉnh bị từ chối';
  }
  if (credit.status === 'adjusted') {
    return `${TUTORING_CREDIT_STATUS_LABELS.adjusted} ${credit.adjustment_code ?? ''}`;
  }
  if (credit.status === 'closed') {
    return `${TUTORING_CREDIT_STATUS_LABELS.closed}: ${credit.closed_note ?? ''}`;
  }
  return credit.deducted > 0
    ? `Đã trừ ${money(credit.deducted)} (${credit.deducted_on.join(', ')}), còn ${money(credit.remaining)}`
    : TUTORING_CREDIT_STATUS_LABELS.open;
}

export function TutoringFinancePage() {
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const [range, setRange] = useState({ from: thisMonth(), to: thisMonth() });
  const [payMonth, setPayMonth] = useState(thisMonth());
  const [error, setError] = useState<string>();
  const report = useQuery({
    queryKey: ['tutoring-finance', range.from, range.to],
    queryFn: () => tutoringApi.financeReport(range.from, range.to),
  });
  const pay = useQuery({
    queryKey: ['tutoring-teacher-pay', payMonth],
    queryFn: () => tutoringApi.teacherPay(payMonth),
  });
  const credits = useQuery({ queryKey: ['tutoring-credits'], queryFn: tutoringApi.credits });
  const run = useMutation({
    mutationFn: async (work: () => Promise<string>) => work(),
    onSuccess: async (text) => {
      setError(undefined);
      setToastMessage(text);
      await Promise.all(
        ['tutoring-finance', 'tutoring-teacher-pay', 'tutoring-credits'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
    onError: (caught) => setError(messageOf(caught)),
  });
  const payable = (pay.data?.rows ?? []).filter((row) => row.problem === null);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/tutoring/finance')}</h1>
        <p className="text-label text-text-secondary">{TUTORING_NO_FEE_BASIS}</p>
        {error ? <Alert tone="danger">{error}</Alert> : null}

        <section aria-label="Báo cáo thu chi" className="flex flex-col gap-3">
          <h2 className="text-section-title font-semibold">Báo cáo thu chi theo chương trình</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-label">
              Từ tháng
              <input
                type="month"
                className={FORM_CONTROL_CLASS}
                value={range.from}
                onChange={(event) => setRange({ ...range, from: event.target.value })}
              />
            </label>
            <label className="flex flex-col text-label">
              Đến tháng
              <input
                type="month"
                className={FORM_CONTROL_CLASS}
                value={range.to}
                onChange={(event) => setRange({ ...range, to: event.target.value })}
              />
            </label>
            <Button
              onClick={() =>
                run.mutate(async () => {
                  await tutoringApi.exportFinance(range.from, range.to);
                  return 'Đã tải tệp Excel';
                })
              }
            >
              Xuất Excel
            </Button>
          </div>
          {report.error ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
          <table aria-label="Thu chi theo chương trình" className="w-full text-content">
            <thead>
              <tr className="text-left text-text-secondary">
                <th>Chương trình</th>
                <th>Loại nội dung</th>
                <th>Đã thu</th>
                <th>Trừ kỳ sau</th>
                <th>Điều chỉnh giảm</th>
                <th>Đã hoàn</th>
                <th>Chờ trừ, hoàn</th>
                <th>Thu thuần</th>
                <th>Thù lao đã đẩy</th>
                <th>Thù lao chưa đẩy</th>
                <th>Nguồn chi</th>
              </tr>
            </thead>
            <tbody>
              {(report.data?.programs ?? []).map((row) => (
                <tr key={row.program_id}>
                  <td>{row.name}</td>
                  <td>{TUTORING_CONTENT_TYPE_LABELS[row.content_type]}</td>
                  <td>{row.charges_fee ? money(row.billed) : 'Không thu tiền'}</td>
                  <td>{money(row.deducted)}</td>
                  <td>{money(row.adjusted)}</td>
                  <td>{money(row.refunded)}</td>
                  <td>{money(row.credit_open)}</td>
                  <td>{money(row.net_income)}</td>
                  <td>
                    {money(row.teacher_pay)} ({row.teacher_periods} tiết)
                  </td>
                  <td>{money(row.teacher_pay_pending)}</td>
                  <td>{TUTORING_FUNDING_SOURCE_LABELS[row.funding_source]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.data ? (
            <p className="text-label">
              Tổng thu thuần {money(report.data.totals.net_income)} · Thù lao chi từ kinh phí trường{' '}
              {money(report.data.totals.teacher_pay_school_budget)} · từ khoản thu của chương trình{' '}
              {money(report.data.totals.teacher_pay_tutoring_fees)}
            </p>
          ) : null}
        </section>

        <section aria-label="Thù lao giáo viên" className="flex flex-col gap-3">
          <h2 className="text-section-title font-semibold">Thù lao giáo viên vào bảng lương</h2>
          <p className="text-label text-text-secondary">
            Buổi đã dạy (chưa hủy, đã xác nhận điểm danh) đến hết tháng chọn; một dòng thưởng mỗi giáo viên, khoản mục
            &quot;Thù lao dạy phụ đạo, bồi dưỡng&quot;, chịu thuế thu nhập cá nhân theo biểu thuế của bảng lương.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-label">
              Tháng lương
              <input
                type="month"
                className={FORM_CONTROL_CLASS}
                value={payMonth}
                onChange={(event) => setPayMonth(event.target.value)}
              />
            </label>
            <Button
              variant="primary"
              disabled={payable.length === 0 || run.isPending}
              onClick={() =>
                run.mutate(async () => {
                  const result = await tutoringApi.pushTeacherPay(payMonth);
                  return `Đã đẩy thù lao của ${result.pushed.length} giáo viên vào bảng lương tháng ${payMonth}`;
                })
              }
            >
              Đẩy thù lao vào bảng lương
            </Button>
          </div>
          {pay.error ? <Alert tone="danger">{messageOf(pay.error)}</Alert> : null}
          {pay.data?.payroll_status && pay.data.payroll_status !== 'draft' ? (
            <Alert tone="warning">Bảng lương tháng này đã gửi duyệt hoặc đã duyệt; chọn tháng sau.</Alert>
          ) : null}
          <table aria-label="Buổi chưa đẩy thù lao" className="w-full text-content">
            <thead>
              <tr className="text-left text-text-secondary">
                <th>Ngày</th>
                <th>Chương trình</th>
                <th>Giáo viên</th>
                <th>Số tiết</th>
                <th>Đơn giá</th>
                <th>Thù lao</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {(pay.data?.rows ?? []).map((row) => (
                <tr key={row.session_id}>
                  <td>{row.session_date}</td>
                  <td>{row.program_name}</td>
                  <td>{row.teacher_name ?? ''}</td>
                  <td>{row.periods}</td>
                  <td>{row.rate === null ? '' : money(row.rate)}</td>
                  <td>{row.amount === null ? '' : money(row.amount)}</td>
                  <td>{row.problem ?? TUTORING_FUNDING_SOURCE_LABELS[row.funding_source]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pay.data ? <p className="text-label">Tổng thù lao đẩy được: {money(pay.data.total)}</p> : null}
        </section>

        <section aria-label="Khoản trừ buổi hủy" className="flex flex-col gap-3">
          <h2 className="text-section-title font-semibold">Khoản trừ của buổi bị hủy sau khi đã thu</h2>
          {credits.error ? <Alert tone="danger">{messageOf(credits.error)}</Alert> : null}
          <table aria-label="Khoản trừ" className="w-full text-content">
            <thead>
              <tr className="text-left text-text-secondary">
                <th>Chương trình</th>
                <th>Học sinh</th>
                <th>Lý do</th>
                <th>Số tiền</th>
                <th>Cách xử lý</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(credits.data ?? []).map((credit) => (
                <tr key={credit.id}>
                  <td>{credit.program_name}</td>
                  <td>{credit.child_name}</td>
                  <td>{credit.reason}</td>
                  <td>{money(credit.amount)}</td>
                  <td>{TUTORING_CANCEL_REFUND_LABELS[credit.mode]}</td>
                  <td>{creditStatus(credit)}</td>
                  <td className="flex flex-wrap gap-2">
                    {credit.actionable ? (
                      <>
                        {credit.deducted === 0 ? (
                          <Button
                            onClick={() =>
                              run.mutate(async () => {
                                await tutoringApi.creditAction(credit.id, 'adjust');
                                return 'Đã lập phiếu điều chỉnh giảm hóa đơn, chờ duyệt';
                              })
                            }
                          >
                            Lập điều chỉnh hóa đơn
                          </Button>
                        ) : null}
                        {credit.mode !== 'deduct_next' || credit.adjustment_rejected ? (
                          <Button
                            onClick={() =>
                              run.mutate(async () => {
                                await tutoringApi.creditAction(credit.id, 'deduct-next');
                                return 'Đã chuyển sang trừ kỳ sau';
                              })
                            }
                          >
                            Trừ kỳ sau
                          </Button>
                        ) : null}
                        <Button
                          onClick={() =>
                            run.mutate(async () => {
                              const note = window.prompt('Số phiếu chi hoàn hoặc cách đã hoàn') ?? '';
                              await tutoringApi.creditAction(credit.id, 'close', note);
                              return 'Đã đóng khoản trừ';
                            })
                          }
                        >
                          Đã hoàn, đóng
                        </Button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}
