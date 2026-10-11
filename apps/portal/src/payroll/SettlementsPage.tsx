import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { listStaff } from '../staff/staff-api.js';
import {
  approvePayrollAdjustment,
  approveSettlement,
  calculateSettlement,
  createPayrollAdjustment,
  createRecoveryReceipt,
  createSettlementPayment,
  DOCUMENT_STATUS_LABELS,
  formatMoney,
  listPayrollAdjustments,
  listSettlements,
  PAYROLL_STATUS_LABELS,
  readSettlement,
  rejectPayrollAdjustment,
  returnSettlement,
  submitSettlement,
  type PayrollAdjustment,
  type Settlement,
} from './payroll-api.js';
import { AccountCategoryFields } from './PaymentSourceForm.js';

// MH-54 Quyết toán và điều chỉnh lương (P08-06; BR-45, BR-90; YCTD-61): kế toán lập bảng quyết toán khi chấm dứt hợp
// đồng, trình Ban Giám hiệu duyệt theo hạn mức; trả thêm thì lập phiếu chi lương, trả thừa thì thu hồi bằng phiếu thu
// không gắn trẻ. Khoản điều chỉnh lương cho kỳ sau có lý do và người phê duyệt
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

function SettlementDetail({ settlement, onChanged }: { settlement: Settlement; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['settlements'] });
    await queryClient.invalidateQueries({ queryKey: ['settlement', settlement.id] });
    onChanged(message);
  };
  const submit = useMutation({
    mutationFn: () => submitSettlement(settlement.id),
    onSuccess: () => refresh('Đã trình duyệt bảng quyết toán'),
  });
  const approve = useMutation({
    mutationFn: () => approveSettlement(settlement.id),
    onSuccess: () => refresh('Đã duyệt bảng quyết toán'),
  });
  const giveBack = useMutation({
    mutationFn: () => returnSettlement(settlement.id, reason),
    onSuccess: () => refresh('Đã trả lại bảng quyết toán'),
  });
  const pay = useMutation({
    mutationFn: (source: { account_id: string; category_id: string }) =>
      createSettlementPayment(settlement.id, { ...source, request_key: crypto.randomUUID() }),
    onSuccess: () => refresh('Đã lập phiếu chi quyết toán nháp; đính chứng từ và trình duyệt ở trang Phiếu chi'),
  });
  const recover = useMutation({
    mutationFn: (source: { account_id: string; category_id: string; account_type: string }) =>
      createRecoveryReceipt(settlement.id, {
        amount: Number(amount),
        method: source.account_type === 'cash' ? 'cash' : 'transfer',
        account_id: source.account_id,
        category_id: source.category_id,
        receipt_date: today(),
        request_key: crypto.randomUUID(),
      }),
    onSuccess: () => {
      setAmount('');
      return refresh('Đã lập phiếu thu thu hồi lương');
    },
  });
  const error = submit.error ?? approve.error ?? giveBack.error ?? pay.error ?? recover.error;
  const activePayment = settlement.payments.find((payment) => payment.status !== 'reversed');

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label={`Bảng quyết toán của ${settlement.full_name}`}
    >
      <h2 className="text-section-title font-semibold text-text">
        Bảng quyết toán của {settlement.full_name} (hợp đồng {settlement.contract_no}, nghỉ từ{' '}
        {settlement.terminated_on})
      </h2>
      <p className="text-content text-text">Trạng thái: {PAYROLL_STATUS_LABELS[settlement.status]}</p>
      {settlement.return_reason && settlement.status === 'draft' ? (
        <Alert tone="warning">Bị trả lại: {settlement.return_reason}</Alert>
      ) : null}
      <table className="w-full text-content">
        <tbody>
          {settlement.lines.map((line, index) => (
            <tr key={index} className="border-t border-border">
              <td className="px-3 py-1 font-medium">{line.name}</td>
              <td className="px-3 py-1 text-text-secondary">{line.basis}</td>
              <td className="px-3 py-1 text-right">{formatMoney(line.amount)}</td>
            </tr>
          ))}
          <tr className="border-t border-border">
            <td className="px-3 py-1 font-semibold">Lương được hưởng</td>
            <td />
            <td className="px-3 py-1 text-right font-semibold">{formatMoney(settlement.earned_amount)}</td>
          </tr>
          <tr className="border-t border-border">
            <td className="px-3 py-1">Đã trả trước tháng nghỉ việc</td>
            <td />
            <td className="px-3 py-1 text-right">{formatMoney(-settlement.prepaid_amount)}</td>
          </tr>
          <tr className="border-t border-border">
            <td className="px-3 py-1">Chênh lệch thuế thu nhập cá nhân</td>
            <td />
            <td className="px-3 py-1 text-right">{formatMoney(-settlement.tax_difference)}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-content font-semibold text-text">
        {settlement.payable_amount >= 0
          ? `Trả thêm: ${formatMoney(settlement.payable_amount)} đồng`
          : `Phải thu hồi: ${formatMoney(-settlement.payable_amount)} đồng`}
        {settlement.status === 'approved' && settlement.payable_amount < 0
          ? `, còn phải thu ${formatMoney(settlement.recovery_outstanding)} đồng`
          : ''}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        {settlement.can_manage && settlement.status === 'draft' ? (
          <Button variant="primary" disabled={submit.isPending} onClick={() => submit.mutate()}>
            Trình duyệt quyết toán
          </Button>
        ) : null}
        {settlement.can_approve && settlement.status === 'pending' ? (
          <>
            <Button variant="primary" disabled={approve.isPending} onClick={() => approve.mutate()}>
              Duyệt quyết toán
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
      {settlement.can_manage && settlement.status === 'approved' && settlement.payable_amount > 0 && !activePayment ? (
        <AccountCategoryFields
          flowType="expense"
          label="Lập phiếu chi quyết toán"
          busy={pay.isPending}
          onSubmit={(source) => pay.mutate({ account_id: source.account_id, category_id: source.category_id })}
        />
      ) : null}
      {settlement.status === 'approved' && settlement.recovery_outstanding > 0 ? (
        <AccountCategoryFields
          flowType="income"
          label="Lập phiếu thu thu hồi"
          busy={recover.isPending}
          onSubmit={(source) => recover.mutate(source)}
        >
          <TextField
            label="Số tiền thu hồi"
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </AccountCategoryFields>
      ) : null}
      {[
        ...settlement.payments.map((row) => ({ ...row, kind: 'Phiếu chi' })),
        ...settlement.receipts.map((row) => ({ ...row, kind: 'Phiếu thu' })),
      ].map((row) => (
        <p key={row.id} className="text-content text-text">
          {row.kind} {row.code ?? 'nháp'}: {formatMoney(row.amount)} đồng,{' '}
          {DOCUMENT_STATUS_LABELS[row.status] ?? row.status}
        </p>
      ))}
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
    </section>
  );
}

function AdjustmentRow({ adjustment, onChanged }: { adjustment: PayrollAdjustment; onChanged(message: string): void }) {
  const [reason, setReason] = useState('');
  const approve = useMutation({
    mutationFn: () => approvePayrollAdjustment(adjustment.id),
    onSuccess: () => onChanged('Đã duyệt khoản điều chỉnh'),
  });
  const reject = useMutation({
    mutationFn: () => rejectPayrollAdjustment(adjustment.id, reason),
    onSuccess: () => onChanged('Đã từ chối khoản điều chỉnh'),
  });
  const error = approve.error ?? reject.error;
  return (
    <tr className="border-t border-border align-top" aria-label={`Điều chỉnh lương của ${adjustment.full_name}`}>
      <td className="px-3 py-2 font-medium">{adjustment.full_name}</td>
      <td className="px-3 py-2">
        {adjustment.target_month}/{adjustment.target_year}
      </td>
      <td className="px-3 py-2 text-right">{formatMoney(adjustment.amount)}</td>
      <td className="px-3 py-2">{adjustment.reason}</td>
      <td className="px-3 py-2">
        {adjustment.status === 'pending'
          ? 'Chờ duyệt'
          : adjustment.status === 'approved'
            ? 'Đã duyệt'
            : `Bị từ chối: ${adjustment.reject_reason ?? ''}`}
      </td>
      <td className="px-3 py-2">
        {adjustment.can_decide ? (
          <div className="flex flex-col items-end gap-2">
            <Button variant="primary" disabled={approve.isPending} onClick={() => approve.mutate()}>
              Duyệt
            </Button>
            <TextField label="Lý do từ chối" value={reason} onChange={(event) => setReason(event.target.value)} />
            <Button variant="danger" disabled={reject.isPending} onClick={() => reject.mutate()}>
              Từ chối
            </Button>
          </div>
        ) : null}
        {error ? <p className="text-label text-danger">{messageOf(error)}</p> : null}
      </td>
    </tr>
  );
}

function AdjustmentsSection({ canManage, onChanged }: { canManage: boolean; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const adjustments = useQuery({ queryKey: ['payroll-adjustments'], queryFn: listPayrollAdjustments });
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const staff = useQuery({
    queryKey: ['staff', orgUnitId, ''],
    queryFn: () => listStaff(orgUnitId ?? '', ''),
    enabled: canManage && Boolean(orgUnitId),
  });
  const [staffId, setStaffId] = useState('');
  const [month, setMonth] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['payroll-adjustments'] });
    onChanged(message);
  };
  const create = useMutation({
    mutationFn: () => createPayrollAdjustment({ staff_id: staffId, month, amount: Number(amount), reason }),
    onSuccess: () => {
      setAmount('');
      setReason('');
      return refresh('Đã lập khoản điều chỉnh lương, chờ duyệt');
    },
  });
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Khoản điều chỉnh lương"
    >
      <h2 className="text-section-title font-semibold text-text">Khoản điều chỉnh lương cho kỳ sau</h2>
      {canManage ? (
        <form
          className="grid grid-cols-1 items-end gap-3 md:grid-cols-6"
          aria-label="Lập khoản điều chỉnh"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
          <label className="text-label font-medium text-text">
            Nhân sự
            <select value={staffId} onChange={(event) => setStaffId(event.target.value)} className={selectClass}>
              <option value="">Chọn nhân sự</option>
              {(staff.data ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.code} – {row.full_name}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Vào lương tháng"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
          <TextField
            label="Số tiền (âm là trừ)"
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <TextField label="Lý do điều chỉnh" value={reason} onChange={(event) => setReason(event.target.value)} />
          <div>
            <Button type="submit" variant="primary" disabled={create.isPending}>
              Lập khoản điều chỉnh
            </Button>
          </div>
        </form>
      ) : null}
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      {adjustments.error ? <Alert tone="danger">{messageOf(adjustments.error)}</Alert> : null}
      {adjustments.data && adjustments.data.length === 0 ? (
        <p className="text-content text-text-secondary">Chưa có khoản điều chỉnh.</p>
      ) : null}
      {adjustments.data && adjustments.data.length > 0 ? (
        <table className="w-full text-content">
          <tbody>
            {adjustments.data.map((row) => (
              <AdjustmentRow key={row.id} adjustment={row} onChanged={refresh} />
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

export function SettlementsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.payrollManage);
  const queryClient = useQueryClient();
  const settlements = useQuery({ queryKey: ['settlements'], queryFn: listSettlements });
  const [openId, setOpenId] = useState<string>();
  const detail = useQuery({
    queryKey: ['settlement', openId],
    queryFn: () => readSettlement(openId ?? ''),
    enabled: Boolean(openId),
  });
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const calculate = useMutation({
    mutationFn: calculateSettlement,
    onSuccess: async (result) => {
      setOpenId(result.id);
      await queryClient.invalidateQueries({ queryKey: ['settlements'] });
      await queryClient.invalidateQueries({ queryKey: ['settlement', result.id] });
      setToastMessage('Đã tính bảng quyết toán');
    },
  });

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Quyết toán và điều chỉnh lương</h1>
        <section
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          aria-label="Hợp đồng đã chấm dứt"
        >
          <h2 className="text-section-title font-semibold text-text">Hợp đồng đã chấm dứt</h2>
          {settlements.error ? <Alert tone="danger">{messageOf(settlements.error)}</Alert> : null}
          {calculate.error ? <Alert tone="danger">{messageOf(calculate.error)}</Alert> : null}
          {settlements.data && settlements.data.length === 0 ? (
            <p className="text-content text-text-secondary">Chưa có hợp đồng chấm dứt.</p>
          ) : null}
          {settlements.data && settlements.data.length > 0 ? (
            <table className="w-full text-content">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-2">Nhân sự</th>
                  <th className="px-3 py-2">Hợp đồng</th>
                  <th className="px-3 py-2">Ngày nghỉ</th>
                  <th className="px-3 py-2">Quyết toán</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {settlements.data.map((row) => (
                  <tr
                    key={row.contract_id}
                    className="border-t border-border"
                    aria-label={`Quyết toán của ${row.full_name}`}
                  >
                    <td className="px-3 py-2 font-medium">{row.full_name}</td>
                    <td className="px-3 py-2">{row.contract_no}</td>
                    <td className="px-3 py-2">{row.terminated_on}</td>
                    <td className="px-3 py-2">
                      {row.status
                        ? `${PAYROLL_STATUS_LABELS[row.status]}, ${formatMoney(row.payable_amount ?? 0)}`
                        : 'Chưa lập'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canManage && (!row.status || row.status === 'draft') ? (
                        <Button disabled={calculate.isPending} onClick={() => calculate.mutate(row.contract_id)}>
                          {row.status ? 'Tính lại' : 'Lập bảng quyết toán'}
                        </Button>
                      ) : null}
                      {row.settlement_id ? (
                        <Button variant="text" onClick={() => setOpenId(row.settlement_id ?? undefined)}>
                          Chi tiết
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
        {detail.error ? <Alert tone="danger">{messageOf(detail.error)}</Alert> : null}
        {detail.data ? <SettlementDetail settlement={detail.data} onChanged={setToastMessage} /> : null}
        <AdjustmentsSection canManage={canManage} onChanged={setToastMessage} />
      </div>
    </AppShell>
  );
}
