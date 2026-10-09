import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { APPROVAL_DOCUMENT_TYPES, PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { listApprovalThresholds, saveApprovalThreshold, type ApprovalThreshold } from './catalogs-api.js';
import { UnitSelect, useUnitChoice } from './UnitSelect.js';

// MH-33 Hạn mức phê duyệt theo đơn vị và loại chứng từ (P01-10, BR-77); có hiệu lực ngay khi lưu (YCTD-42)
const MONEY = new Intl.NumberFormat('vi-VN');

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function ThresholdRow({
  orgUnitId,
  documentType,
  label,
  current,
  canManage,
  onSaved,
}: {
  orgUnitId: string;
  documentType: string;
  label: string;
  current: ApprovalThreshold | undefined;
  canManage: boolean;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(current ? String(current.threshold_amount) : '');
  const save = useMutation({
    mutationFn: (value: number | null) =>
      saveApprovalThreshold({ org_unit_id: orgUnitId, document_type: documentType, threshold_amount: value }),
    onSuccess: async (_saved, value) => {
      await queryClient.invalidateQueries({ queryKey: ['approval-thresholds'] });
      onSaved(value === null ? `Đã gỡ hạn mức ${label.toLowerCase()}` : `Đã lưu hạn mức ${label.toLowerCase()}`);
    },
  });

  return (
    <tr className="border-t border-border align-top">
      <td className="px-3 py-2 font-medium">{label}</td>
      <td className="px-3 py-2">
        {current ? `${MONEY.format(current.threshold_amount)} đồng` : 'Chưa cấu hình, Hiệu trưởng phê duyệt'}
      </td>
      <td className="px-3 py-2">{current ? formatDate(current.effective_from) : ''}</td>
      {canManage ? (
        <td className="px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label={`Hạn mức ${label}`}
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-44 rounded-lg border border-border bg-card px-3 py-2"
            />
            <Button disabled={save.isPending} onClick={() => save.mutate(amount.trim() === '' ? null : Number(amount))}>
              Lưu
            </Button>
            {current ? (
              <Button
                variant="text"
                disabled={save.isPending}
                onClick={() => {
                  setAmount('');
                  save.mutate(null);
                }}
              >
                Gỡ hạn mức
              </Button>
            ) : null}
          </div>
          {save.error ? <p className="mt-1 text-label text-danger">{messageOf(save.error)}</p> : null}
        </td>
      ) : null}
    </tr>
  );
}

export function ApprovalThresholdsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.approvalThresholdManage);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const thresholds = useQuery({ queryKey: ['approval-thresholds'], queryFn: listApprovalThresholds });
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Hạn mức phê duyệt</h1>
        <p className="text-label text-text-secondary">
          Phó Hiệu trưởng phê duyệt chứng từ dưới hạn mức; bằng hoặc trên hạn mức thì Hiệu trưởng phê duyệt. Loại chứng
          từ chưa cấu hình thì Hiệu trưởng phê duyệt. Hạn mức có hiệu lực ngay khi lưu.
        </p>
        <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
        {thresholds.error ? <Alert tone="danger">{messageOf(thresholds.error)}</Alert> : null}
        {orgUnitId && thresholds.data ? (
          <section className="rounded-xl border border-border bg-card p-4" aria-label="Hạn mức theo loại chứng từ">
            <table className="w-full text-content">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-2">Loại chứng từ</th>
                  <th className="px-3 py-2">Hạn mức đang áp dụng</th>
                  <th className="px-3 py-2">Hiệu lực từ</th>
                  {canManage ? <th className="px-3 py-2">Hạn mức mới (đồng)</th> : null}
                </tr>
              </thead>
              <tbody>
                {APPROVAL_DOCUMENT_TYPES.map((type) => {
                  const current = thresholds.data.find(
                    (row) => row.org_unit_id === orgUnitId && row.document_type === type.code,
                  );
                  return (
                    <ThresholdRow
                      key={`${orgUnitId}-${type.code}-${current?.id ?? 'none'}`}
                      orgUnitId={orgUnitId}
                      documentType={type.code}
                      label={type.label}
                      current={current}
                      canManage={canManage}
                      onSaved={setToastMessage}
                    />
                  );
                })}
              </tbody>
            </table>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
