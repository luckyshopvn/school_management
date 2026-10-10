import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, ConfirmDialog, StatusBadge, TextField } from '@school-management/ui';
import { listClasses } from '../classes/classes-api.js';
import { ApiError, fetchWithSession } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  approveChild,
  CHILD_STATUS_LABELS,
  openFile,
  PHOTO_CONSENT_LABELS,
  readChild,
  readNationalId,
  rejectChild,
  submitChild,
  transferClass,
  updateChild,
  uploadFile,
  type ChildDetail,
} from './children-api.js';

// Chi tiết trẻ: mã trẻ, lịch sử lớp, phụ huynh; gửi trình duyệt, duyệt và phân lớp, từ chối, chuyển lớp (QT-01 mục 11)
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function isOverCapacity(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.code === 'ERR_RULE_VIOLATION' &&
    error.details.some((detail) => detail.field === 'max_size')
  );
}

function ClassPicker({
  child,
  label,
  actionLabel,
  onPick,
  busy,
  sameUnitOnly,
}: {
  child: ChildDetail;
  label: string;
  actionLabel: string;
  onPick(classId: string): void;
  busy: boolean;
  sameUnitOnly: boolean;
}) {
  const [classId, setClassId] = useState('');
  const classes = useQuery({ queryKey: ['classes', child.org_unit_id], queryFn: () => listClasses(child.org_unit_id) });
  const options = (classes.data ?? []).filter(
    (item) =>
      item.status === 'active' &&
      item.id !== child.current_class?.class_id &&
      (!sameUnitOnly || item.org_unit_id === child.org_unit_id),
  );
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-2 text-label font-medium text-text">
        {label}
        <select
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
        >
          <option value="">Chọn lớp</option>
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.enrolled_count}/{item.max_size})
            </option>
          ))}
        </select>
      </label>
      <Button variant="primary" disabled={busy || classId === ''} onClick={() => onPick(classId)}>
        {actionLabel}
      </Button>
    </div>
  );
}

export function ChildDetailPanel({ childId, onChanged }: { childId: string; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.childManage);
  const canApprove = useHasPermission(PERMISSION_CODES.childApprove);
  const canViewNationalId = useHasPermission(PERMISSION_CODES.nationalIdView);
  const child = useQuery({ queryKey: ['child', childId], queryFn: () => readChild(childId) });
  const [nationalId, setNationalId] = useState<string>();
  const [rejectReason, setRejectReason] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [pendingCapacity, setPendingCapacity] = useState<{ action: 'approve' | 'transfer'; classId: string }>();
  const [fileError, setFileError] = useState<string>();

  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['child', childId] });
    await queryClient.invalidateQueries({ queryKey: ['children'] });
    await queryClient.invalidateQueries({ queryKey: ['classes'] });
    onChanged(message);
  };
  const submit = useMutation({
    mutationFn: () => submitChild(childId),
    onSuccess: () => refresh('Đã gửi trình duyệt'),
  });
  const approve = useMutation({
    mutationFn: ({ classId, confirm }: { classId: string; confirm: boolean }) =>
      approveChild(childId, classId, confirm),
    onSuccess: () => {
      setPendingCapacity(undefined);
      return refresh('Đã duyệt hồ sơ và phân lớp');
    },
    onError: (error, variables) => {
      if (isOverCapacity(error)) {
        setPendingCapacity({ action: 'approve', classId: variables.classId });
      }
    },
  });
  const reject = useMutation({
    mutationFn: () => rejectChild(childId, rejectReason),
    onSuccess: () => {
      setRejectReason('');
      return refresh('Đã từ chối hồ sơ');
    },
  });
  const transfer = useMutation({
    mutationFn: ({ classId, confirm }: { classId: string; confirm: boolean }) =>
      transferClass(childId, classId, transferReason, confirm),
    onSuccess: () => {
      setPendingCapacity(undefined);
      setTransferReason('');
      return refresh('Đã chuyển lớp');
    },
    onError: (error, variables) => {
      if (isOverCapacity(error)) {
        setPendingCapacity({ action: 'transfer', classId: variables.classId });
      }
    },
  });
  // Trẻ nhập từ Excel bổ sung giấy khai sinh sau (YCTD-46)
  const supplementCertificate = useMutation({
    mutationFn: async (file: File) => {
      const stored = await uploadFile(child.data?.org_unit_id ?? '', 'birth_certificate', file);
      return updateChild(childId, { birth_certificate_file_id: stored.id });
    },
    onSuccess: () => refresh('Đã bổ sung giấy khai sinh'),
    onError: (error) => setFileError(messageOf(error)),
  });
  const revealNationalId = useMutation({
    mutationFn: () => readNationalId(childId),
    onSuccess: (result) => setNationalId(result.national_id),
  });

  if (child.isPending) {
    return <div className="h-64 animate-pulse rounded bg-border" aria-hidden="true" />;
  }
  if (child.isError) {
    return <Alert tone="danger">{messageOf(child.error)}</Alert>;
  }
  const data = child.data;
  const actionError = [submit.error, approve.error, reject.error, transfer.error, revealNationalId.error].find(
    (error) => error && !isOverCapacity(error),
  );

  return (
    <section className="flex flex-col gap-4" aria-label={`Hồ sơ ${data.full_name}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-section-title font-semibold text-text">{data.full_name}</h2>
        <StatusBadge
          tone={data.status === 'active' ? 'success' : data.status === 'pending' ? 'warning' : 'neutral'}
          label={CHILD_STATUS_LABELS[data.status]}
        />
      </div>
      {actionError ? <Alert tone="danger">{messageOf(actionError)}</Alert> : null}
      {fileError ? <Alert tone="danger">{fileError}</Alert> : null}
      {data.reject_reason && data.status === 'draft' ? (
        <Alert tone="warning">Bị từ chối: {data.reject_reason}</Alert>
      ) : null}

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-content">
        <dt className="text-text-secondary">Ngày sinh</dt>
        <dd>{data.dob}</dd>
        <dt className="text-text-secondary">Giới tính</dt>
        <dd>{data.gender === 'male' ? 'Nam' : 'Nữ'}</dd>
        <dt className="text-text-secondary">Số định danh</dt>
        <dd className="flex flex-wrap items-center gap-2">
          <span data-testid="national-id">{nationalId ?? data.national_id_masked}</span>
          {canViewNationalId && !nationalId ? (
            <Button variant="text" onClick={() => revealNationalId.mutate()}>
              Xem đầy đủ
            </Button>
          ) : null}
          {canViewNationalId && data.birth_certificate_file_id ? (
            <Button
              variant="text"
              onClick={() =>
                openFile(data.birth_certificate_file_id ?? '', fetchWithSession).catch((error: unknown) =>
                  setFileError(messageOf(error)),
                )
              }
            >
              Xem giấy khai sinh
            </Button>
          ) : null}
        </dd>
        {data.birth_certificate_file_id === null ? (
          <>
            <dt className="text-text-secondary">Giấy khai sinh</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-danger/10 px-2 text-danger">Thiếu giấy khai sinh</span>
              {canApprove ? (
                <input
                  type="file"
                  aria-label="Bổ sung giấy khai sinh"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      supplementCertificate.mutate(file);
                    }
                  }}
                />
              ) : null}
            </dd>
          </>
        ) : null}
        <dt className="text-text-secondary">Mã định danh ngành</dt>
        <dd className={data.moet_student_code ? '' : 'rounded bg-danger/10 px-2 text-danger'} data-testid="moet-code">
          {data.moet_student_code ?? 'Chưa có'}
        </dd>
        <dt className="text-text-secondary">Lớp hiện tại</dt>
        <dd>{data.current_class?.class_name ?? 'Chưa xếp lớp'}</dd>
        <dt className="text-text-secondary">Đồng ý hình ảnh</dt>
        <dd>{PHOTO_CONSENT_LABELS[data.photo_consent]}</dd>
        {data.is_staff_child ? (
          <>
            <dt className="text-text-secondary">Trẻ con nhân viên</dt>
            <dd>{data.related_staff_name}</dd>
          </>
        ) : null}
      </dl>

      <div>
        <h3 className="mb-2 text-content font-semibold">Phụ huynh</h3>
        <ul className="flex flex-col gap-1">
          {data.guardians.map((guardian) => (
            <li key={guardian.id} className="flex flex-wrap items-center gap-2 text-content">
              <span className="font-medium">{guardian.full_name}</span>
              <span>{guardian.relationship}</span>
              <span className="text-text-secondary">{guardian.phone ?? 'Không có số điện thoại'}</span>
              {guardian.is_primary ? <StatusBadge tone="info" label="Liên hệ chính" /> : null}
              {guardian.has_account ? <StatusBadge tone="success" label="Đã có tài khoản" /> : null}
            </li>
          ))}
        </ul>
      </div>

      {data.health ? (
        <div>
          <h3 className="mb-2 text-content font-semibold">Sức khỏe</h3>
          <p className="text-content">
            Dị ứng:{' '}
            {data.health.has_allergies === null
              ? 'Chưa khai báo'
              : data.health.has_allergies
                ? data.health.allergies
                : 'Không có'}
          </p>
          {data.health.chronic_conditions ? (
            <p className="text-content">Bệnh nền: {data.health.chronic_conditions}</p>
          ) : null}
          {data.special_needs_note ? <p className="text-content">Lưu ý chăm sóc: {data.special_needs_note}</p> : null}
        </div>
      ) : null}

      {data.enrollments.length > 0 ? (
        <div>
          <h3 className="mb-2 text-content font-semibold">Lịch sử lớp</h3>
          <ul className="flex flex-col gap-1 text-content">
            {data.enrollments.map((enrollment) => (
              <li key={enrollment.id}>
                {enrollment.class_name}: từ {enrollment.from_date}
                {enrollment.to_date ? ` đến ${enrollment.to_date}` : ''}
                {enrollment.reason ? ` — ${enrollment.reason}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canManage && data.status === 'draft' ? (
        <div>
          <Button variant="primary" disabled={submit.isPending} onClick={() => submit.mutate()}>
            Gửi trình duyệt
          </Button>
        </div>
      ) : null}

      {canApprove && data.status === 'pending' ? (
        <div className="flex flex-col gap-3 rounded-lg bg-page p-3">
          <ClassPicker
            child={data}
            label="Lớp cho trẻ"
            actionLabel="Duyệt và phân lớp"
            busy={approve.isPending}
            sameUnitOnly={false}
            onPick={(classId) => approve.mutate({ classId, confirm: false })}
          />
          <div className="flex flex-wrap items-end gap-3">
            <TextField
              label="Lý do từ chối"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
            <Button disabled={reject.isPending || rejectReason.trim() === ''} onClick={() => reject.mutate()}>
              Từ chối
            </Button>
          </div>
        </div>
      ) : null}

      {canApprove && data.status === 'active' ? (
        <div className="flex flex-col gap-3 rounded-lg bg-page p-3">
          <TextField
            label="Lý do chuyển lớp"
            value={transferReason}
            onChange={(event) => setTransferReason(event.target.value)}
          />
          <ClassPicker
            child={data}
            label="Lớp đích"
            actionLabel="Chuyển lớp"
            busy={transfer.isPending || transferReason.trim() === ''}
            sameUnitOnly
            onPick={(classId) => transfer.mutate({ classId, confirm: false })}
          />
        </div>
      ) : null}

      {pendingCapacity ? (
        <ConfirmDialog
          open
          title="Lớp đã đủ sĩ số"
          confirmLabel="Xác nhận vượt sĩ số"
          busy={approve.isPending || transfer.isPending}
          onCancel={() => setPendingCapacity(undefined)}
          onConfirm={() =>
            pendingCapacity.action === 'approve'
              ? approve.mutate({ classId: pendingCapacity.classId, confirm: true })
              : transfer.mutate({ classId: pendingCapacity.classId, confirm: true })
          }
        >
          Lớp đã đủ sĩ số tối đa. Quản lý đơn vị xác nhận để vẫn phân trẻ vào lớp này (BR-04).
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
