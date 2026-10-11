import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, ConfirmDialog, TextField } from '@school-management/ui';
import { listStaff } from '../classes/classes-api.js';
import { ApiError, requestJson } from '../session/api-client.js';
import {
  PHOTO_CONSENT_LABELS,
  readPhotoConsent,
  recordPhotoConsent,
  saveStaffChild,
  transferUnit,
  uploadFile,
  withdrawChild,
  type ChildDetail,
} from './children-api.js';
import { STAFF_ROLES } from './CreateChildForm.js';

// Chuyển đơn vị (P02-07), thôi học (P02-08), ghi nhận đồng ý hình ảnh bằng giấy ký tay và cờ trẻ con nhân viên (P02-09)
// cho người có quyền quản lý trẻ đang học (YCTD-67)
const selectClass = 'rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const money = new Intl.NumberFormat('vi-VN');
const METHOD_LABELS = { app: 'trên ứng dụng', paper: 'giấy ký tay' } as const;

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join(': ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

interface ClassOption {
  id: string;
  org_unit_id: string;
  name: string;
  status: string;
  enrolled_count: number;
  max_size: number;
}

export function ChildLifecycleSection({ child, onChanged }: { child: ChildDetail; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [overCapacity, setOverCapacity] = useState(false);
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [consentAction, setConsentAction] = useState<'grant' | 'withdraw'>('grant');
  const [consentFile, setConsentFile] = useState<File>();
  const [isStaffChild, setIsStaffChild] = useState(child.is_staff_child);
  const [staffRole, setStaffRole] = useState('VT-07');
  const [staffUserId, setStaffUserId] = useState(child.related_staff_user_id ?? '');

  const classes = useQuery({
    queryKey: ['classes', 'all'],
    queryFn: () => requestJson<ClassOption[]>('/api/v1/classes'),
    enabled: child.status === 'active',
  });
  const consent = useQuery({ queryKey: ['photo-consent', child.id], queryFn: () => readPhotoConsent(child.id) });
  const staff = useQuery({
    queryKey: ['staff-directory', staffRole, child.org_unit_id],
    queryFn: () => listStaff(staffRole, child.org_unit_id),
    enabled: isStaffChild,
  });

  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['child', child.id] });
    await queryClient.invalidateQueries({ queryKey: ['children'] });
    await queryClient.invalidateQueries({ queryKey: ['photo-consent', child.id] });
    onChanged(message);
  };
  const transfer = useMutation({
    mutationFn: () =>
      transferUnit(child.id, { class_id: classId, reason: transferReason, confirm_over_capacity: overCapacity }),
    onSuccess: () => refresh('Đã chuyển trẻ sang đơn vị mới'),
  });
  const withdraw = useMutation({
    mutationFn: () => withdrawChild(child.id, { reason: leaveReason, ...(leaveDate ? { leave_date: leaveDate } : {}) }),
    onSuccess: (result) => {
      setConfirmWithdraw(false);
      return refresh(
        `Đã ghi nhận thôi học. Còn phải nộp ${money.format(result.outstanding_amount)} đồng, số dư có ${money.format(result.credit_amount)} đồng`,
      );
    },
  });
  const recordConsent = useMutation({
    mutationFn: async () => {
      const stored = await uploadFile(child.org_unit_id, 'photo_consent', consentFile as File);
      return recordPhotoConsent(child.id, { action: consentAction, file_id: stored.id });
    },
    onSuccess: () => {
      setConsentFile(undefined);
      return refresh('Đã ghi nhận đồng ý hình ảnh');
    },
  });
  const staffChild = useMutation({
    mutationFn: () =>
      saveStaffChild(child.id, {
        is_staff_child: isStaffChild,
        related_staff_user_id: isStaffChild ? staffUserId || null : null,
        related_staff_role_code: isStaffChild ? staffRole : null,
      }),
    onSuccess: () => refresh('Đã lưu cờ trẻ con nhân viên'),
  });
  const error = [transfer.error, withdraw.error, recordConsent.error, staffChild.error].find(Boolean);
  const targets = (classes.data ?? []).filter(
    (item) => item.status === 'active' && item.org_unit_id !== child.org_unit_id,
  );

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}

      <section className="flex flex-col gap-2 rounded-lg bg-page p-3" aria-label="Đồng ý sử dụng hình ảnh">
        <h3 className="text-content font-semibold">Đồng ý sử dụng hình ảnh</h3>
        <ul className="flex flex-col gap-1 text-content">
          {(consent.data?.history ?? []).map((row) => (
            <li key={row.created_at}>
              {new Date(row.created_at).toLocaleString('vi-VN')}: {PHOTO_CONSENT_LABELS[row.action]}
              {row.method ? ` (${METHOD_LABELS[row.method]})` : ''}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Ghi nhận giấy ký tay
            <select
              value={consentAction}
              onChange={(event) => setConsentAction(event.target.value as 'grant' | 'withdraw')}
              className={selectClass}
            >
              <option value="grant">Đồng ý</option>
              <option value="withdraw">Rút đồng ý</option>
            </select>
          </label>
          <input
            type="file"
            aria-label="Bản chụp giấy đồng ý"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(event) => setConsentFile(event.target.files?.[0])}
          />
          <Button disabled={!consentFile || recordConsent.isPending} onClick={() => recordConsent.mutate()}>
            Lưu đồng ý hình ảnh
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-lg bg-page p-3" aria-label="Cờ trẻ con nhân viên">
        <label className="flex items-center gap-2 text-content">
          <input type="checkbox" checked={isStaffChild} onChange={(event) => setIsStaffChild(event.target.checked)} />
          Trẻ là con của nhân sự trong trường
        </label>
        {isStaffChild ? (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-2 text-label font-medium text-text">
              Vai trò của nhân sự
              <select
                value={staffRole}
                onChange={(event) => {
                  setStaffRole(event.target.value);
                  setStaffUserId('');
                }}
                className={selectClass}
              >
                {STAFF_ROLES.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-label font-medium text-text">
              Nhân sự liên quan
              <select
                value={staffUserId}
                onChange={(event) => setStaffUserId(event.target.value)}
                className={selectClass}
              >
                <option value="">Chọn nhân sự</option>
                {(staff.data ?? []).map((entry) => (
                  <option key={entry.user_id} value={entry.user_id}>
                    {entry.full_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <div>
          <Button disabled={staffChild.isPending} onClick={() => staffChild.mutate()}>
            Lưu cờ trẻ con nhân viên
          </Button>
        </div>
      </section>

      {child.status === 'active' ? (
        <section className="flex flex-col gap-2 rounded-lg bg-page p-3" aria-label="Chuyển đơn vị">
          <h3 className="text-content font-semibold">Chuyển đơn vị</h3>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-2 text-label font-medium text-text">
              Lớp ở đơn vị mới
              <select value={classId} onChange={(event) => setClassId(event.target.value)} className={selectClass}>
                <option value="">Chọn lớp</option>
                {targets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.enrolled_count}/{item.max_size})
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="Lý do chuyển đơn vị"
              value={transferReason}
              onChange={(event) => setTransferReason(event.target.value)}
            />
            <label className="flex items-center gap-2 text-content">
              <input
                type="checkbox"
                checked={overCapacity}
                onChange={(event) => setOverCapacity(event.target.checked)}
              />
              Xác nhận nếu lớp đủ sĩ số
            </label>
            <Button
              disabled={transfer.isPending || classId === '' || transferReason.trim() === ''}
              onClick={() => transfer.mutate()}
            >
              Chuyển đơn vị
            </Button>
          </div>
        </section>
      ) : null}

      {child.status === 'active' || child.status === 'paused' ? (
        <section className="flex flex-col gap-2 rounded-lg bg-page p-3" aria-label="Thôi học">
          <h3 className="text-content font-semibold">Thôi học</h3>
          <div className="flex flex-wrap items-end gap-3">
            <TextField
              label="Ngày thôi học"
              type="date"
              value={leaveDate}
              onChange={(event) => setLeaveDate(event.target.value)}
            />
            <TextField
              label="Lý do thôi học"
              value={leaveReason}
              onChange={(event) => setLeaveReason(event.target.value)}
            />
            <Button disabled={leaveReason.trim() === ''} onClick={() => setConfirmWithdraw(true)}>
              Ghi nhận thôi học
            </Button>
          </div>
        </section>
      ) : null}

      {confirmWithdraw ? (
        <ConfirmDialog
          open
          title="Ghi nhận thôi học"
          confirmLabel="Xác nhận thôi học"
          busy={withdraw.isPending}
          onCancel={() => setConfirmWithdraw(false)}
          onConfirm={() => withdraw.mutate()}
        >
          {child.full_name} chuyển sang trạng thái thôi học. Hồ sơ được giữ lại; học phí tháng thôi học tính đến ngày
          thôi học khi tính học phí kỳ đó.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
