import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, DataGrid, StatusBadge, TextField, Toast, type DataGridColumn } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  approvePayroll,
  calculatePayroll,
  createPayrollPayment,
  DOCUMENT_STATUS_LABELS,
  formatMoney,
  listPayrolls,
  PAYROLL_STATUS_LABELS,
  readPayroll,
  returnPayroll,
  submitPayroll,
  type Payroll,
  type Payslip,
} from './payroll-api.js';
import { AccountCategoryFields } from './PaymentSourceForm.js';
import { PayslipView } from './PayslipView.js';

// MH-15 Bảng lương và phê duyệt (P08-06, BR-43, BR-45, BR-77; YCTD-60): bảng lương toàn trường theo tháng, kế toán tính
// và trình; Hiệu trưởng hoặc Phó Hiệu trưởng duyệt theo hạn mức của Trường chính; người xem chỉ thấy nhân sự trong phạm vi.
// Bảng lương là chứng từ nên giữ bố cục; DT-15 phần 15f2 đổi tiêu đề có số theo menu và đưa các phiếu lương vào lưới dữ
// liệu chung (khóa `payslips`) có tìm kiếm, chi tiết phiếu mở ngay dưới dòng
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const vietnamMonth = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()).slice(0, 7);
const STATUS_TONES = { draft: 'neutral', pending: 'warning', approved: 'success' } as const;
type MoneyField = 'prepaid_amount' | 'adjustment_amount' | 'taxable_income' | 'tax_amount' | 'net_amount';
const money = (
  header: string,
  id: MoneyField,
  options: { strong?: boolean; hiddenByDefault?: boolean } = {},
): DataGridColumn<Payslip> => ({
  id,
  header,
  hiddenByDefault: options.hiddenByDefault,
  className: options.strong ? 'text-right font-semibold' : 'text-right',
  cell: (row) => formatMoney(row[id]),
});

const PAYSLIP_COLUMNS: Array<DataGridColumn<Payslip>> = [
  { id: 'code', header: 'Mã nhân sự', hiddenByDefault: true, cell: (row) => row.code ?? '' },
  { id: 'full_name', header: 'Nhân sự', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
  { id: 'unit_name', header: 'Đơn vị', cell: (row) => row.unit_name },
  money('Trả trước', 'prepaid_amount'),
  money('Điều chỉnh', 'adjustment_amount'),
  money('Thu nhập chịu thuế', 'taxable_income', { hiddenByDefault: true }),
  money('Thuế', 'tax_amount'),
  money('Thực nhận', 'net_amount', { strong: true }),
];

function PayrollDetail({ payroll, onChanged }: { payroll: Payroll; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('payslips');
  const [openId, setOpenId] = useState<string>();
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const keyword = search.trim().toLocaleLowerCase('vi');
  const payslips = payroll.payslips.filter(
    (payslip) =>
      keyword === '' ||
      [payslip.full_name, payslip.code, payslip.unit_name].some((value) =>
        (value ?? '').toLocaleLowerCase('vi').includes(keyword),
      ),
  );
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['payrolls'] });
    await queryClient.invalidateQueries({ queryKey: ['payroll', payroll.id] });
    onChanged(message);
  };
  const submit = useMutation({
    mutationFn: () => submitPayroll(payroll.id),
    onSuccess: () => refresh('Đã trình duyệt bảng lương'),
  });
  const approve = useMutation({
    mutationFn: () => approvePayroll(payroll.id),
    onSuccess: () => refresh('Đã duyệt bảng lương'),
  });
  const giveBack = useMutation({
    mutationFn: () => returnPayroll(payroll.id, reason),
    onSuccess: () => refresh('Đã trả lại bảng lương'),
  });
  const pay = useMutation({
    mutationFn: (source: { account_id: string; category_id: string }) =>
      createPayrollPayment(payroll.id, { ...source, request_key: crypto.randomUUID() }),
    onSuccess: () => refresh('Đã lập phiếu chi lương nháp; đính chứng từ và trình duyệt ở trang Phiếu chi'),
  });
  const activePayment = payroll.payments.find((payment) => payment.status !== 'reversed');
  const error = submit.error ?? approve.error ?? giveBack.error ?? pay.error;

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label={`Bảng lương tháng ${payroll.period_month}/${payroll.period_year}`}
    >
      <h2 className="text-section-title font-semibold text-text">
        Bảng lương tháng {payroll.period_month}/{payroll.period_year}
      </h2>
      <p className="text-content text-text">
        Trạng thái: {PAYROLL_STATUS_LABELS[payroll.status]}. Tổng thực nhận toàn trường:{' '}
        {formatMoney(payroll.total_net)} đồng.
        {payroll.status === 'pending'
          ? payroll.requires_principal
            ? ' Cần Hiệu trưởng duyệt.'
            : ' Dưới hạn mức, Phó Hiệu trưởng duyệt được.'
          : ''}
      </p>
      {payroll.return_reason && payroll.status === 'draft' ? (
        <Alert tone="warning">Bị trả lại: {payroll.return_reason}</Alert>
      ) : null}
      {payroll.skipped.length > 0 ? (
        <div aria-label="Nhân sự chưa tính lương">
          <p className="text-label font-semibold text-text">Nhân sự chưa tính lương</p>
          <ul className="list-disc pl-6 text-content">
            {payroll.skipped.map((row) => (
              <li key={row.staff_id}>
                {row.full_name}: {row.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        {payroll.can_manage && payroll.status === 'draft' ? (
          <Button variant="primary" disabled={submit.isPending} onClick={() => submit.mutate()}>
            Trình duyệt
          </Button>
        ) : null}
        {payroll.can_approve && payroll.status === 'pending' ? (
          <>
            <Button variant="primary" disabled={approve.isPending} onClick={() => approve.mutate()}>
              Duyệt bảng lương
            </Button>
            <div className="w-72">
              <TextField label="Lý do trả lại" value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
            <Button variant="danger" disabled={giveBack.isPending} onClick={() => giveBack.mutate()}>
              Trả lại
            </Button>
          </>
        ) : null}
      </div>
      {payroll.payments.length > 0 ? (
        <ul className="list-disc pl-6 text-content" aria-label="Phiếu chi lương">
          {payroll.payments.map((payment) => (
            <li key={payment.id}>
              Phiếu chi {payment.code ?? 'nháp'}: {formatMoney(payment.amount)} đồng,{' '}
              {DOCUMENT_STATUS_LABELS[payment.status] ?? payment.status}
            </li>
          ))}
        </ul>
      ) : null}
      {payroll.can_manage && payroll.status === 'approved' && !activePayment ? (
        <AccountCategoryFields
          flowType="expense"
          label="Lập phiếu chi lương"
          busy={pay.isPending}
          onSubmit={(source) => pay.mutate({ account_id: source.account_id, category_id: source.category_id })}
        />
      ) : null}
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
      <DataGrid
        label="Danh sách phiếu lương"
        columns={PAYSLIP_COLUMNS}
        rows={payslips}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.full_name ?? ''}
        getRowAriaLabel={(row) => `Lương của ${row.full_name ?? ''}`}
        emptyText="Bảng lương chưa có phiếu lương."
        search={{ label: 'Tìm theo tên, mã nhân sự, đơn vị', value: search, onChange: setSearch }}
        rowActions={(row) => (
          <Button variant="text" onClick={() => setOpenId(openId === row.id ? undefined : row.id)}>
            {openId === row.id ? 'Ẩn' : 'Chi tiết'}
          </Button>
        )}
        activeRowId={openId}
        renderRowDetail={(row) => (openId === row.id ? <PayslipView payslip={row} /> : null)}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </section>
  );
}

export function PayrollPage() {
  const canManage = useHasPermission(PERMISSION_CODES.payrollManage);
  const queryClient = useQueryClient();
  const payrolls = useQuery({ queryKey: ['payrolls'], queryFn: listPayrolls });
  const [month, setMonth] = useState(vietnamMonth);
  const [selectedId, setSelectedId] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const shownId = selectedId ?? payrolls.data?.[0]?.id;
  const payroll = useQuery({
    queryKey: ['payroll', shownId],
    queryFn: () => readPayroll(shownId ?? ''),
    enabled: Boolean(shownId),
  });
  const calculate = useMutation({
    mutationFn: () => calculatePayroll(month),
    onSuccess: async (result) => {
      setSelectedId(result.id);
      await queryClient.invalidateQueries({ queryKey: ['payrolls'] });
      await queryClient.invalidateQueries({ queryKey: ['payroll', result.id] });
      setToastMessage(`Đã tính bảng lương tháng ${result.period_month}/${result.period_year}`);
    },
  });

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/payrolls')}</h1>
        <p className="text-content text-text-secondary">
          Đầu tháng tính lương trả trước của tháng, kèm điều chỉnh theo bảng công đã chốt của tháng trước. Bảng đã duyệt
          không sửa trực tiếp.
        </p>
        {canManage ? (
          <form
            className="flex flex-wrap items-end gap-3"
            aria-label="Tính bảng lương"
            onSubmit={(event) => {
              event.preventDefault();
              calculate.mutate();
            }}
          >
            <div className="w-48">
              <TextField
                label="Tháng lương"
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
            </div>
            <Button type="submit" variant="primary" disabled={calculate.isPending}>
              Tính bảng lương
            </Button>
          </form>
        ) : null}
        {calculate.error ? <Alert tone="danger">{messageOf(calculate.error)}</Alert> : null}
        {payrolls.error ? <Alert tone="danger">{messageOf(payrolls.error)}</Alert> : null}
        {payrolls.data && payrolls.data.length > 0 ? (
          <div className="flex flex-wrap gap-2" aria-label="Các bảng lương">
            {payrolls.data.map((row) => (
              <Button
                key={row.id}
                variant={row.id === shownId ? 'primary' : 'secondary'}
                onClick={() => setSelectedId(row.id)}
              >
                {`Tháng ${row.period_month}/${row.period_year}`}
              </Button>
            ))}
          </div>
        ) : null}
        {payrolls.data && payrolls.data.length === 0 ? (
          <p className="text-content text-text-secondary">Chưa có bảng lương.</p>
        ) : null}
        {payroll.error ? <Alert tone="danger">{messageOf(payroll.error)}</Alert> : null}
        {payroll.data ? (
          <>
            <StatusBadge tone={STATUS_TONES[payroll.data.status]} label={PAYROLL_STATUS_LABELS[payroll.data.status]} />
            <PayrollDetail payroll={payroll.data} onChanged={setToastMessage} />
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
