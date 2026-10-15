import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  StatusBadge,
  TextField,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { uploadFile } from '../children/children-api.js';
import { formatMoney, listCashflowCategories } from '../fees/fees-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission, useHasPermissionOnlyThrough } from '../session/permissions.js';
import { ApprovalQueueGrid } from './ApprovalQueueGrid.js';
import {
  createPayment,
  decidePayment,
  decidePaymentReversal,
  deletePayment,
  listCashAccounts,
  listDebts,
  listPayments,
  listPendingPaymentReversals,
  listPendingPayments,
  PAYMENT_STATUS_TEXT,
  PAYMENT_TYPE_LABELS,
  reversePayment,
  submitPayment,
  type Payment,
  type PaymentReversal,
  type PaymentType,
} from './finance-api.js';

// MH-10 Phiếu chi và phê duyệt (P06-04; QT-05; BR-24, BR-28, BR-34, BR-77; YCTD-55): lập nháp kèm chứng từ, trình duyệt;
// Ban Giám hiệu duyệt theo hạn mức, duyệt là phát hành; phiếu hoàn tiền thôi học chỉ Hiệu trưởng duyệt; lập và duyệt
// phiếu đảo phiếu chi (YCTD-56). Danh sách và hai danh sách chờ duyệt dùng lưới dữ liệu chung; Thêm mới mở biểu mẫu theo
// khối: Ghi lưu nháp, Ghi và trình duyệt; xóa nháp phải xác nhận (DT-15 phần 15f1)
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const principalBadge = (required: boolean | null) =>
  required ? <StatusBadge tone="warning" label="Cần Hiệu trưởng duyệt" /> : null;

const PAYMENT_COLUMNS: Array<DataGridColumn<Payment>> = [
  { id: 'code', header: 'Số phiếu', className: 'font-medium', cell: (row) => row.code ?? '' },
  { id: 'payment_date', header: 'Ngày chi', cell: (row) => row.payment_date ?? '' },
  { id: 'payment_type', header: 'Loại', cell: (row) => PAYMENT_TYPE_LABELS[row.payment_type] },
  { id: 'payee_name', header: 'Người nhận', alwaysVisible: true, cell: (row) => row.payee_name },
  { id: 'account_name', header: 'Nguồn chi', cell: (row) => row.account_name },
  { id: 'amount', header: 'Số tiền', className: 'text-right', cell: (row) => formatMoney(row.amount) },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) => (
      <>
        <StatusBadge
          tone={row.status === 'issued' ? 'success' : row.status === 'draft' ? 'neutral' : 'warning'}
          label={PAYMENT_STATUS_TEXT[row.status]}
        />
        {row.reject_reason && row.status === 'draft' ? (
          <span className="block text-label text-danger">Bị từ chối: {row.reject_reason}</span>
        ) : null}
      </>
    ),
  },
];

const PENDING_COLUMNS: Array<DataGridColumn<Payment>> = [
  { id: 'payment_type', header: 'Loại', cell: (row) => PAYMENT_TYPE_LABELS[row.payment_type] },
  {
    id: 'payee_name',
    header: 'Người nhận',
    alwaysVisible: true,
    className: 'font-medium',
    cell: (row) => `${row.payee_name}${row.child_name ? ` (học sinh ${row.child_name})` : ''}`,
  },
  { id: 'amount', header: 'Số tiền', className: 'text-right', cell: (row) => formatMoney(row.amount) },
  { id: 'account_name', header: 'Nguồn chi', cell: (row) => row.account_name },
  { id: 'content', header: 'Nội dung chi', cell: (row) => row.content },
  { id: 'requires_principal', header: 'Cấp duyệt', cell: (row) => principalBadge(row.requires_principal) },
];

const REVERSAL_COLUMNS: Array<DataGridColumn<PaymentReversal>> = [
  { id: 'code', header: 'Số phiếu đảo', alwaysVisible: true, className: 'font-medium', cell: (row) => row.code },
  { id: 'payment_code', header: 'Phiếu chi gốc', cell: (row) => row.payment_code ?? '' },
  { id: 'payee_name', header: 'Người nhận', cell: (row) => row.payee_name },
  { id: 'amount', header: 'Số tiền', className: 'text-right', cell: (row) => formatMoney(row.amount) },
  { id: 'reason', header: 'Lý do', cell: (row) => row.reason },
  { id: 'requires_principal', header: 'Cấp duyệt', cell: (row) => principalBadge(row.requires_principal) },
];

function PaymentForm({
  orgUnitId,
  onCreated,
  onCancel,
}: {
  orgUnitId: string;
  onCreated(message: string): void;
  onCancel(): void;
}) {
  const cashOnly = useHasPermissionOnlyThrough(PERMISSION_CODES.paymentManage, 'VT-16');
  const accounts = useQuery({ queryKey: ['cash-accounts', orgUnitId], queryFn: () => listCashAccounts(orgUnitId) });
  const categories = useQuery({ queryKey: ['cashflow-categories'], queryFn: listCashflowCategories });
  const [paymentType, setPaymentType] = useState<PaymentType>('regular');
  const debts = useQuery({
    queryKey: ['debts', orgUnitId, false],
    queryFn: () => listDebts(orgUnitId, false),
    enabled: paymentType === 'refund',
  });
  const [childId, setChildId] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [amount, setAmount] = useState('');
  const [content, setContent] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  // Mã yêu cầu giữ nguyên khi bấm lại để máy chủ không tạo phiếu thứ hai (QT-05 E5)
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const usableAccounts = (accounts.data ?? []).filter(
    (account) => account.status === 'active' && (!cashOnly || account.account_type === 'cash'),
  );
  const expenseCategories = (categories.data ?? []).filter(
    (category) => category.flow_type === 'expense' && category.status === 'active',
  );
  const refundable = (debts.data ?? []).filter((row) => row.credit_amount > 0);

  const save = useMutation({
    mutationFn: async (submit: boolean) => {
      const fileIds = [];
      for (const file of files) {
        fileIds.push((await uploadFile(orgUnitId, 'payment_voucher', file)).id);
      }
      const created = await createPayment({
        request_key: requestKey,
        org_unit_id: orgUnitId,
        payment_type: paymentType,
        ...(paymentType === 'refund' ? { child_id: childId || refundable[0]?.id } : {}),
        payee_name: payeeName,
        amount: Number(amount || 0),
        content,
        account_id: accountId || usableAccounts[0]?.id || '',
        category_id: categoryId || expenseCategories[0]?.id || '',
        file_ids: fileIds,
      });
      return submit ? submitPayment(created.id) : created;
    },
    onSuccess: (payment) => {
      setRequestKey(crypto.randomUUID());
      setAmount('');
      setContent('');
      setFiles([]);
      onCreated(payment.status === 'pending' ? 'Đã trình duyệt phiếu chi' : 'Đã lưu phiếu chi nháp');
    },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
      aria-label="Lập phiếu chi"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(true);
      }}
    >
      <h2 className="text-section-title font-semibold text-text">Lập phiếu chi</h2>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thông tin phiếu chi">
        <FormRow label="Loại phiếu chi">
          <select
            className={FORM_CONTROL_CLASS}
            value={paymentType}
            onChange={(event) => setPaymentType(event.target.value as PaymentType)}
          >
            {(['regular', 'refund', 'payroll'] as const).map((value) => (
              <option key={value} value={value}>
                {PAYMENT_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </FormRow>
        {paymentType === 'refund' ? (
          <FormRow label="Học sinh được hoàn tiền">
            <select className={FORM_CONTROL_CLASS} value={childId} onChange={(event) => setChildId(event.target.value)}>
              {refundable.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.full_name} (số dư có {formatMoney(row.credit_amount)})
                </option>
              ))}
            </select>
          </FormRow>
        ) : null}
        <FormRow label="Người nhận">
          <input
            className={FORM_CONTROL_CLASS}
            value={payeeName}
            onChange={(event) => setPayeeName(event.target.value)}
          />
        </FormRow>
        <FormRow label="Số tiền chi">
          <input
            className={FORM_CONTROL_CLASS}
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </FormRow>
        <FormRow label="Nguồn chi">
          <select
            className={FORM_CONTROL_CLASS}
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            {usableAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({formatMoney(account.current_balance)})
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Khoản mục chi">
          <select
            className={FORM_CONTROL_CLASS}
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            {expenseCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Nội dung chi">
          <input className={FORM_CONTROL_CLASS} value={content} onChange={(event) => setContent(event.target.value)} />
        </FormRow>
        <FormRow label="Chứng từ kèm theo (ảnh hoặc PDF)">
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,application/pdf"
            className="block text-content"
            onChange={(event) => setFiles([...(event.target.files ?? [])])}
          />
        </FormRow>
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi và trình duyệt
        </Button>
        <Button disabled={save.isPending} onClick={() => save.mutate(false)}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

type ActionKind = 'submit' | 'delete' | 'approve' | 'reject' | 'reverse' | 'approveReversal' | 'rejectReversal';

export function PaymentsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.paymentManage);
  const canApprove = useHasPermission(PERMISSION_CODES.paymentApprove);
  const canReverse = useHasPermission(PERMISSION_CODES.paymentReversalCreate);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const queryClient = useQueryClient();
  const grid = useGridSettings('payments');
  const payments = useQuery({
    queryKey: ['payments', orgUnitId],
    queryFn: () => listPayments(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId),
  });
  const pending = useQuery({
    queryKey: ['payments-pending', orgUnitId],
    queryFn: () => listPendingPayments(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId) && canApprove,
  });
  const pendingReversals = useQuery({
    queryKey: ['payment-reversals', orgUnitId],
    queryFn: () => listPendingPaymentReversals(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId) && canApprove,
  });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [reversingId, setReversingId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Payment>();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['payments'] });
    await queryClient.invalidateQueries({ queryKey: ['payments-pending'] });
    await queryClient.invalidateQueries({ queryKey: ['payment-reversals'] });
    await queryClient.invalidateQueries({ queryKey: ['cash-accounts'] });
    setToastMessage(message);
  };
  const action = useMutation({
    mutationFn: (input: { paymentId: string; kind: ActionKind }): Promise<unknown> => {
      const reason = reasons[input.paymentId] ?? '';
      switch (input.kind) {
        case 'submit':
          return submitPayment(input.paymentId);
        case 'delete':
          return deletePayment(input.paymentId);
        case 'reverse':
          return reversePayment(input.paymentId, reason);
        case 'approveReversal':
        case 'rejectReversal':
          return decidePaymentReversal(input.paymentId, input.kind === 'approveReversal', reason);
        default:
          return decidePayment(input.paymentId, input.kind === 'approve', reason);
      }
    },
    onSuccess: (_result, input) =>
      refresh(
        {
          submit: 'Đã trình duyệt phiếu chi',
          delete: 'Đã xóa phiếu chi nháp',
          approve: 'Đã duyệt và phát hành phiếu chi',
          reject: 'Đã từ chối phiếu chi',
          reverse: 'Đã lập phiếu đảo, chờ Ban Giám hiệu duyệt',
          approveReversal: 'Đã duyệt phiếu đảo phiếu chi',
          rejectReversal: 'Đã từ chối phiếu đảo phiếu chi',
        }[input.kind],
      ).then(() => {
        setReversingId(undefined);
        setDeleting(undefined);
      }),
    onError: () => setDeleting(undefined),
  });
  const keyword = search.trim().toLocaleLowerCase('vi');
  const rows = (payments.data ?? []).filter(
    (row) =>
      (status === '' || row.status === status) &&
      (paymentType === '' || row.payment_type === paymentType) &&
      (keyword === '' ||
        `${row.code ?? ''} ${row.payee_name} ${row.content}`.toLocaleLowerCase('vi').includes(keyword)),
  );
  const decisionButtons = (paymentId: string, reasonLabel: string, approve: ActionKind, reject: ActionKind) => (
    <>
      <Button variant="primary" disabled={action.isPending} onClick={() => action.mutate({ paymentId, kind: approve })}>
        Duyệt
      </Button>
      <TextField
        label={reasonLabel}
        value={reasons[paymentId] ?? ''}
        onChange={(event) => setReasons({ ...reasons, [paymentId]: event.target.value })}
      />
      <Button variant="danger" disabled={action.isPending} onClick={() => action.mutate({ paymentId, kind: reject })}>
        Từ chối
      </Button>
    </>
  );

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/payments')}</h1>
        <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
        {payments.error ? <Alert tone="danger">{messageOf(payments.error)}</Alert> : null}
        {action.error ? <Alert tone="danger">{messageOf(action.error)}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        {canManage && orgUnitId && creating ? (
          <PaymentForm
            key={orgUnitId}
            orgUnitId={orgUnitId}
            onCancel={() => setCreating(false)}
            onCreated={(message) => {
              setCreating(false);
              void refresh(message);
            }}
          />
        ) : null}
        {canApprove ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-section-title font-semibold text-text">Phiếu chi chờ duyệt</h2>
            <ApprovalQueueGrid
              label="Phiếu chi chờ duyệt"
              gridKey="payment-approvals"
              rows={pending.data ?? []}
              loading={Boolean(orgUnitId) && pending.isPending}
              columns={PENDING_COLUMNS}
              getRowId={(row) => row.id}
              getRowLabel={(row) => row.payee_name}
              searchText={(row) => `${row.payee_name} ${row.child_name ?? ''} ${row.content}`}
              searchLabel="Tìm theo người nhận, nội dung"
              emptyText="Không có phiếu chi chờ duyệt."
              groupLabel={(row) => `Phiếu chi cho ${row.payee_name}`}
              renderActions={(row) =>
                decisionButtons(row.id, `Lý do từ chối phiếu chi cho ${row.payee_name}`, 'approve', 'reject')
              }
            />
          </div>
        ) : null}
        {canApprove ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-section-title font-semibold text-text">Phiếu đảo phiếu chi chờ duyệt</h2>
            <ApprovalQueueGrid
              label="Phiếu đảo phiếu chi chờ duyệt"
              gridKey="payment-reversals"
              rows={pendingReversals.data ?? []}
              loading={Boolean(orgUnitId) && pendingReversals.isPending}
              columns={REVERSAL_COLUMNS}
              getRowId={(row) => row.id}
              getRowLabel={(row) => row.code}
              searchText={(row) => `${row.code} ${row.payment_code ?? ''} ${row.payee_name}`}
              searchLabel="Tìm theo số phiếu, người nhận"
              emptyText="Không có phiếu đảo phiếu chi chờ duyệt."
              groupLabel={(row) => `Phiếu đảo ${row.code}`}
              renderActions={(row) =>
                decisionButtons(row.payment_id, `Lý do từ chối ${row.code}`, 'approveReversal', 'rejectReversal')
              }
            />
          </div>
        ) : null}
        <DataGrid
          label="Danh sách phiếu chi"
          columns={PAYMENT_COLUMNS}
          rows={rows}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.code ?? row.payee_name}
          getRowAriaLabel={(row) => `Phiếu chi ${row.payee_name}`}
          loading={Boolean(orgUnitId) && payments.isPending}
          emptyText="Chưa có phiếu chi."
          search={{ label: 'Tìm theo số phiếu, người nhận, nội dung', value: search, onChange: setSearch }}
          advancedSearch={
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-label font-medium text-text">
                Loại phiếu
                <select
                  value={paymentType}
                  onChange={(event) => setPaymentType(event.target.value)}
                  className={`mt-1 ${FORM_CONTROL_CLASS}`}
                >
                  <option value="">Tất cả</option>
                  {Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-label font-medium text-text">
                Trạng thái
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className={`mt-1 ${FORM_CONTROL_CLASS}`}
                >
                  <option value="">Tất cả</option>
                  {Object.entries(PAYMENT_STATUS_TEXT).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          }
          toolbar={
            canManage && orgUnitId ? (
              <Button variant="primary" onClick={() => setCreating(true)}>
                Thêm mới
              </Button>
            ) : null
          }
          rowActions={(row) => (
            <span className="flex flex-wrap justify-end gap-1 whitespace-nowrap">
              {canManage && row.status === 'draft' ? (
                <>
                  <Button
                    variant="text"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ paymentId: row.id, kind: 'submit' })}
                  >
                    Trình duyệt
                  </Button>
                  <Button variant="text" disabled={action.isPending} onClick={() => setDeleting(row)}>
                    Xóa
                  </Button>
                </>
              ) : null}
              {canReverse && row.status === 'issued' && reversingId !== row.id ? (
                <Button variant="text" onClick={() => setReversingId(row.id)}>
                  Lập phiếu đảo
                </Button>
              ) : null}
            </span>
          )}
          activeRowId={reversingId}
          renderRowDetail={(row) =>
            reversingId === row.id ? (
              <div className="flex flex-wrap items-end gap-2">
                <TextField
                  label={`Lý do đảo ${row.code ?? ''}`}
                  value={reasons[row.id] ?? ''}
                  onChange={(event) => setReasons({ ...reasons, [row.id]: event.target.value })}
                />
                <Button
                  variant="primary"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ paymentId: row.id, kind: 'reverse' })}
                >
                  Gửi duyệt phiếu đảo
                </Button>
                <Button variant="text" onClick={() => setReversingId(undefined)}>
                  Hủy
                </Button>
              </div>
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
      <ConfirmDeleteDialog
        open={deleting !== undefined}
        subject={`phiếu chi nháp cho ${deleting?.payee_name ?? ''}`}
        busy={action.isPending}
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) {
            action.mutate({ paymentId: deleting.id, kind: 'delete' });
          }
        }}
      >
        Chỉ xóa được phiếu chi còn nháp, chưa trình duyệt.
      </ConfirmDeleteDialog>
    </AppShell>
  );
}
