import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  StatusBadge,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { formatMoney } from '../fees/fees-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  decideResolution,
  listReminders,
  listResolutions,
  proposeResolution,
  sendReminders,
  type DebtResolution,
  type ReminderRow,
} from './finance-g2-api.js';

// MH-08 phần nhắc nợ và xử lý công nợ quá hạn (P05-10, P05-12; BR-33; YCTD-23, YCTD-82): danh sách hóa đơn quá hạn theo
// mốc, gửi nhắc cho phụ huynh; quản lý đơn vị, kế toán lập đề xuất xử lý; Phó Hiệu trưởng, Hiệu trưởng ghi quyết định.
// Hai danh sách dùng lưới dữ liệu chung: chọn dòng để gửi nhắc nợ, quyết định ghi dưới dòng đề xuất (DT-15 phần 15f1)
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const REMINDER_COLUMNS: Array<DataGridColumn<ReminderRow>> = [
  {
    id: 'child_name',
    header: 'Học sinh',
    alwaysVisible: true,
    className: 'font-medium',
    cell: (row) => row.child_name,
  },
  { id: 'class_name', header: 'Lớp', cell: (row) => row.class_name ?? '' },
  { id: 'invoice_code', header: 'Hóa đơn', cell: (row) => `${row.invoice_code ?? ''} (${row.period})` },
  { id: 'due_date', header: 'Hạn', cell: (row) => row.due_date ?? '' },
  {
    id: 'outstanding_amount',
    header: 'Còn nợ',
    className: 'text-right',
    cell: (row) => formatMoney(row.outstanding_amount),
  },
  { id: 'overdue_days', header: 'Quá hạn', className: 'text-right', cell: (row) => `${row.overdue_days} ngày` },
  {
    id: 'milestone',
    header: 'Mốc',
    cell: (row) =>
      row.needs_reminder ? (
        <StatusBadge tone="danger" label={`Cần nhắc mốc ${row.milestone_days}`} />
      ) : (
        <StatusBadge tone="neutral" label={row.milestone_days ? `Mốc ${row.milestone_days}` : 'Chưa tới mốc'} />
      ),
  },
  {
    id: 'last_reminded_at',
    header: 'Đã nhắc',
    cell: (row) => (row.last_reminded_at ? new Date(row.last_reminded_at).toLocaleDateString('vi-VN') : ''),
  },
];

const RESOLUTION_COLUMNS: Array<DataGridColumn<DebtResolution>> = [
  {
    id: 'child_name',
    header: 'Học sinh',
    alwaysVisible: true,
    className: 'font-medium',
    cell: (row) => row.child_name,
  },
  {
    id: 'overdue',
    header: 'Nợ quá hạn',
    cell: (row) => `${formatMoney(row.overdue_amount)}, ${row.overdue_days} ngày`,
  },
  { id: 'proposal', header: 'Đề xuất', cell: (row) => row.proposal },
  { id: 'decision', header: 'Quyết định', cell: (row) => row.decision ?? '' },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) => (
      <StatusBadge
        tone={row.status === 'pending' ? 'warning' : 'success'}
        label={row.status === 'pending' ? 'Chờ quyết định' : 'Đã quyết định'}
      />
    ),
  },
];

function DecisionForm({ resolution, onDone }: { resolution: DebtResolution; onDone(message: string): void }) {
  const [decision, setDecision] = useState('');
  const queryClient = useQueryClient();
  const decide = useMutation({
    mutationFn: () => decideResolution(resolution.id, decision),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['debt-resolutions'] });
      onDone('Đã ghi quyết định xử lý công nợ');
    },
  });
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={`Quyết định cho ${resolution.child_name}`}>
      <FormRow label="Quyết định">
        <textarea
          className={FORM_CONTROL_CLASS}
          value={decision}
          onChange={(event) => setDecision(event.target.value)}
        />
      </FormRow>
      {decide.error ? <Alert tone="danger">{messageOf(decide.error)}</Alert> : null}
      <div>
        <Button variant="primary" disabled={!decision.trim() || decide.isPending} onClick={() => decide.mutate()}>
          Ghi quyết định
        </Button>
      </div>
    </div>
  );
}

export function DebtCollectionPage() {
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const canRemind = useHasPermission(PERMISSION_CODES.debtReminderManage);
  const canPropose = useHasPermission(PERMISSION_CODES.overdueDebtPropose);
  const canDecide = useHasPermission(PERMISSION_CODES.overdueDebtDecide);
  const queryClient = useQueryClient();
  const reminderGrid = useGridSettings('debt-reminders');
  const resolutionGrid = useGridSettings('debt-resolutions');
  const [dueOnly, setDueOnly] = useState(false);
  const [reminderSearch, setReminderSearch] = useState('');
  const [resolutionSearch, setResolutionSearch] = useState('');
  // Đổi sau mỗi lần gửi để lưới bỏ các dòng đã chọn
  const [sentCount, setSentCount] = useState(0);
  const [proposalChild, setProposalChild] = useState<{ id: string; name: string }>();
  const [proposal, setProposal] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  const reminders = useQuery({
    queryKey: ['debt-reminders', orgUnitId, dueOnly],
    queryFn: () => listReminders(orgUnitId ?? '', dueOnly),
    enabled: Boolean(orgUnitId) && canRemind,
  });
  const resolutions = useQuery({
    queryKey: ['debt-resolutions', orgUnitId],
    queryFn: () => listResolutions(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId),
  });
  const send = useMutation({
    mutationFn: (invoiceIds: string[]) => sendReminders(orgUnitId ?? '', invoiceIds),
    onSuccess: async (result) => {
      setSentCount((count) => count + 1);
      await queryClient.invalidateQueries({ queryKey: ['debt-reminders'] });
      setToastMessage(`Đã gửi ${result.sent_count} nhắc nợ, bỏ qua ${result.skipped.length}`);
    },
  });
  const propose = useMutation({
    mutationFn: () => proposeResolution({ child_id: proposalChild?.id ?? '', proposal }),
    onSuccess: async () => {
      setProposalChild(undefined);
      setProposal('');
      await queryClient.invalidateQueries({ queryKey: ['debt-resolutions'] });
      setToastMessage('Đã lập đề xuất xử lý công nợ');
    },
  });
  const reminderKeyword = reminderSearch.trim().toLocaleLowerCase('vi');
  const reminderRows = (reminders.data?.rows ?? []).filter(
    (row) =>
      reminderKeyword === '' ||
      `${row.child_name} ${row.class_name ?? ''} ${row.invoice_code ?? ''}`
        .toLocaleLowerCase('vi')
        .includes(reminderKeyword),
  );
  const resolutionKeyword = resolutionSearch.trim().toLocaleLowerCase('vi');
  const resolutionRows = (resolutions.data ?? []).filter(
    (row) => resolutionKeyword === '' || row.child_name.toLocaleLowerCase('vi').includes(resolutionKeyword),
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/debt-collection')}</h1>
        <Toast message={toastMessage} onClose={closeToast} />
        <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
        {canRemind ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-section-title font-semibold text-text">Danh sách nhắc nợ</h2>
              <span className="text-content text-text-secondary">
                Mốc nhắc: {(reminders.data?.milestones ?? []).join(', ')} ngày sau hạn. Tổng còn nợ{' '}
                {formatMoney(reminders.data?.totals.outstanding_amount ?? 0)}
              </span>
            </div>
            {reminders.error ? <Alert tone="danger">{messageOf(reminders.error)}</Alert> : null}
            {send.error ? <Alert tone="danger">{messageOf(send.error)}</Alert> : null}
            {reminderGrid.error ? <Alert tone="danger">{messageOf(reminderGrid.error)}</Alert> : null}
            <DataGrid
              key={sentCount}
              label="Danh sách nhắc nợ"
              columns={REMINDER_COLUMNS}
              rows={reminderRows}
              getRowId={(row) => row.invoice_id}
              getRowLabel={(row) => `${row.child_name} ${row.invoice_code ?? ''}`.trim()}
              loading={Boolean(orgUnitId) && reminders.isPending}
              emptyText="Không có hóa đơn quá hạn."
              search={{ label: 'Tìm theo học sinh, lớp, hóa đơn', value: reminderSearch, onChange: setReminderSearch }}
              advancedSearch={
                <label className="flex items-center gap-2 text-content">
                  <input type="checkbox" checked={dueOnly} onChange={(event) => setDueOnly(event.target.checked)} />
                  Chỉ hóa đơn cần nhắc ở mốc hiện tại
                </label>
              }
              selectable
              toolbar={(selectedRows) => (
                <Button
                  variant="primary"
                  disabled={selectedRows.length === 0 || send.isPending}
                  onClick={() => send.mutate(selectedRows.map((row) => row.invoice_id))}
                >
                  Gửi nhắc nợ ({selectedRows.length})
                </Button>
              )}
              rowActions={
                canPropose
                  ? (row) => (
                      <Button
                        variant="text"
                        onClick={() => setProposalChild({ id: row.child_id, name: row.child_name })}
                      >
                        Đề xuất xử lý
                      </Button>
                    )
                  : undefined
              }
              settings={reminderGrid.settings}
              onSettingsChange={reminderGrid.update}
            />
          </div>
        ) : null}
        {proposalChild ? (
          <section
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            aria-label="Lập đề xuất xử lý công nợ"
          >
            <h2 className="text-section-title font-semibold text-text">Đề xuất xử lý cho {proposalChild.name}</h2>
            <FormBlock title="Nội dung">
              <FormRow label="Nội dung đề xuất">
                <textarea
                  className={FORM_CONTROL_CLASS}
                  value={proposal}
                  onChange={(event) => setProposal(event.target.value)}
                />
              </FormRow>
            </FormBlock>
            {propose.error ? <Alert tone="danger">{messageOf(propose.error)}</Alert> : null}
            <div className="flex gap-3">
              <Button
                variant="primary"
                disabled={!proposal.trim() || propose.isPending}
                onClick={() => propose.mutate()}
              >
                Gửi đề xuất
              </Button>
              <Button onClick={() => setProposalChild(undefined)}>Hủy</Button>
            </div>
          </section>
        ) : null}
        <div className="flex flex-col gap-3">
          <h2 className="text-section-title font-semibold text-text">Đề xuất xử lý công nợ quá hạn</h2>
          <p className="text-content text-text-secondary">
            Đề xuất và quyết định chỉ ghi nhận cách xử lý, không thay đổi số tiền công nợ.
          </p>
          {resolutions.error ? <Alert tone="danger">{messageOf(resolutions.error)}</Alert> : null}
          {resolutionGrid.error ? <Alert tone="danger">{messageOf(resolutionGrid.error)}</Alert> : null}
          <DataGrid
            label="Đề xuất xử lý công nợ quá hạn"
            columns={RESOLUTION_COLUMNS}
            rows={resolutionRows}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.child_name}
            loading={Boolean(orgUnitId) && resolutions.isPending}
            emptyText="Chưa có đề xuất."
            search={{ label: 'Tìm theo học sinh', value: resolutionSearch, onChange: setResolutionSearch }}
            renderRowDetail={(row) =>
              row.status === 'pending' && canDecide ? <DecisionForm resolution={row} onDone={setToastMessage} /> : null
            }
            settings={resolutionGrid.settings}
            onSettingsChange={resolutionGrid.update}
          />
        </div>
      </div>
    </AppShell>
  );
}
