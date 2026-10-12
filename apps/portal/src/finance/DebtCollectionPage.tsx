import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, StatusBadge, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { formatMoney } from '../fees/fees-api.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  decideResolution,
  listReminders,
  listResolutions,
  proposeResolution,
  sendReminders,
  type DebtResolution,
} from './finance-g2-api.js';

// MH-08 phần nhắc nợ và xử lý công nợ quá hạn (P05-10, P05-12; BR-33; YCTD-23, YCTD-82): danh sách hóa đơn quá hạn theo
// mốc, gửi nhắc cho phụ huynh; quản lý đơn vị, kế toán lập đề xuất xử lý; Phó Hiệu trưởng, Hiệu trưởng ghi quyết định
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

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
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-label font-medium text-text">
        Quyết định
        <textarea
          value={decision}
          onChange={(event) => setDecision(event.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
        />
      </label>
      {decide.error ? <Alert tone="danger">{messageOf(decide.error)}</Alert> : null}
      <Button variant="primary" disabled={!decision.trim() || decide.isPending} onClick={() => decide.mutate()}>
        Ghi quyết định
      </Button>
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
  const [dueOnly, setDueOnly] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
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
    mutationFn: () => sendReminders(orgUnitId ?? '', selected),
    onSuccess: async (result) => {
      setSelected([]);
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
  const rows = reminders.data?.rows ?? [];
  const toggle = (invoiceId: string) =>
    setSelected((current) =>
      current.includes(invoiceId) ? current.filter((id) => id !== invoiceId) : [...current, invoiceId],
    );

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Nhắc nợ và xử lý quá hạn</h1>
        <Toast message={toastMessage} onClose={closeToast} />
        <div className="flex flex-wrap items-end gap-4">
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
          {canRemind ? (
            <label className="flex items-center gap-2 text-label font-medium text-text">
              <input type="checkbox" checked={dueOnly} onChange={(event) => setDueOnly(event.target.checked)} />
              Chỉ hóa đơn cần nhắc ở mốc hiện tại
            </label>
          ) : null}
        </div>
        {canRemind ? (
          <section
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            aria-label="Danh sách nhắc nợ"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-section-title font-semibold text-text">Danh sách nhắc nợ</h2>
              <span className="text-content text-text-secondary">
                Mốc nhắc: {(reminders.data?.milestones ?? []).join(', ')} ngày sau hạn. Tổng còn nợ{' '}
                {formatMoney(reminders.data?.totals.outstanding_amount ?? 0)}
              </span>
            </div>
            {reminders.error ? <Alert tone="danger">{messageOf(reminders.error)}</Alert> : null}
            {send.error ? <Alert tone="danger">{messageOf(send.error)}</Alert> : null}
            {rows.length === 0 ? (
              <p className="text-content text-text-secondary">Không có hóa đơn quá hạn.</p>
            ) : (
              <table className="w-full text-content">
                <thead className="text-left text-label font-medium text-text-secondary">
                  <tr>
                    <th className="px-3 py-2" />
                    <th className="px-3 py-2">Trẻ</th>
                    <th className="px-3 py-2">Lớp</th>
                    <th className="px-3 py-2">Hóa đơn</th>
                    <th className="px-3 py-2">Hạn</th>
                    <th className="px-3 py-2 text-right">Còn nợ</th>
                    <th className="px-3 py-2 text-right">Quá hạn</th>
                    <th className="px-3 py-2">Mốc</th>
                    <th className="px-3 py-2">Đã nhắc</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.invoice_id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Chọn ${row.child_name} ${row.invoice_code ?? ''}`}
                          checked={selected.includes(row.invoice_id)}
                          onChange={() => toggle(row.invoice_id)}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium">{row.child_name}</td>
                      <td className="px-3 py-2">{row.class_name ?? ''}</td>
                      <td className="px-3 py-2">
                        {row.invoice_code} ({row.period})
                      </td>
                      <td className="px-3 py-2">{row.due_date}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(row.outstanding_amount)}</td>
                      <td className="px-3 py-2 text-right">{row.overdue_days} ngày</td>
                      <td className="px-3 py-2">
                        {row.needs_reminder ? (
                          <StatusBadge tone="danger" label={`Cần nhắc mốc ${row.milestone_days}`} />
                        ) : (
                          <StatusBadge
                            tone="neutral"
                            label={row.milestone_days ? `Mốc ${row.milestone_days}` : 'Chưa tới mốc'}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.last_reminded_at ? new Date(row.last_reminded_at).toLocaleDateString('vi-VN') : ''}
                      </td>
                      <td className="px-3 py-2">
                        {canPropose ? (
                          <Button
                            variant="text"
                            onClick={() => setProposalChild({ id: row.child_id, name: row.child_name })}
                          >
                            Đề xuất xử lý
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div>
              <Button
                variant="primary"
                disabled={selected.length === 0 || send.isPending}
                onClick={() => send.mutate()}
              >
                Gửi nhắc nợ ({selected.length})
              </Button>
            </div>
          </section>
        ) : null}
        {proposalChild ? (
          <section
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            aria-label="Lập đề xuất xử lý công nợ"
          >
            <h2 className="text-section-title font-semibold text-text">Đề xuất xử lý cho {proposalChild.name}</h2>
            <label className="flex flex-col gap-1 text-label font-medium text-text">
              Nội dung đề xuất
              <textarea
                value={proposal}
                onChange={(event) => setProposal(event.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
              />
            </label>
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
        <section
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          aria-label="Đề xuất xử lý công nợ quá hạn"
        >
          <h2 className="text-section-title font-semibold text-text">Đề xuất xử lý công nợ quá hạn</h2>
          <p className="text-content text-text-secondary">
            Đề xuất và quyết định chỉ ghi nhận cách xử lý, không thay đổi số tiền công nợ.
          </p>
          {resolutions.error ? <Alert tone="danger">{messageOf(resolutions.error)}</Alert> : null}
          {(resolutions.data ?? []).length === 0 ? (
            <p className="text-content text-text-secondary">Chưa có đề xuất.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {(resolutions.data ?? []).map((resolution) => (
                <li key={resolution.id} className="flex flex-col gap-2 border-t border-border pt-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium">{resolution.child_name}</span>
                    <span>
                      Nợ quá hạn {formatMoney(resolution.overdue_amount)}, {resolution.overdue_days} ngày
                    </span>
                    <StatusBadge
                      tone={resolution.status === 'pending' ? 'warning' : 'success'}
                      label={resolution.status === 'pending' ? 'Chờ quyết định' : 'Đã quyết định'}
                    />
                  </div>
                  <p className="text-content">Đề xuất: {resolution.proposal}</p>
                  {resolution.decision ? <p className="text-content">Quyết định: {resolution.decision}</p> : null}
                  {resolution.status === 'pending' && canDecide ? (
                    <DecisionForm resolution={resolution} onDone={setToastMessage} />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
