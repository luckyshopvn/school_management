import { ElectiveSubjectsSection } from '../subjects/ElectiveSubjectsSection.js';
import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, ConfirmDialog, StatusBadge, TextField } from '@school-management/ui';
import { listClasses } from '../classes/classes-api.js';
import { ApiError, fetchWithSession } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { MoetProfileSection } from '../imports/MoetProfileSection.js';
import { AuthorizedPickupsSection } from './AuthorizedPickupsSection.js';
import { ChildLifecycleSection } from './ChildLifecycleSection.js';
import { StudentProfileForm, valuesOf } from './StudentProfileForm.js';
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

// Hồ sơ học sinh: thẻ "Hồ sơ học sinh" theo thứ tự ô nhập của Sở có nút Ghi, thẻ "Thông tin riêng của trường" (giấy khai
// sinh, đồng ý hình ảnh, sức khỏe, lịch sử lớp; YCTD-108); bên dưới là các thao tác gửi trình duyệt, duyệt và phân lớp, từ
// chối, chuyển lớp, chuyển đơn vị, thôi học, người đón (QT-01 mục 11)
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
  // Thẻ Hồ sơ học sinh theo Sở và thẻ thông tin riêng của trường (YCTD-108)
  const [tab, setTab] = useState<'profile' | 'school'>('profile');
  const tabIdPrefix = useId();

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

  // Hồ sơ đã duyệt chỉ người có quyền duyệt sửa; hồ sơ chờ duyệt không sửa được (QT-01 E7)
  const editable =
    (data.status === 'draft' && canManage) || (data.status !== 'draft' && data.status !== 'pending' && canApprove);
  const nationalIdCell = (
    <span className="flex flex-wrap items-center gap-2 text-content">
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
    </span>
  );
  const tabs = [
    { id: 'profile', label: 'Hồ sơ học sinh' },
    { id: 'school', label: 'Thông tin riêng của trường' },
  ] as const;

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
      {data.birth_certificate_file_id === null ? (
        <Alert tone="warning">Thiếu giấy khai sinh, bổ sung ở thẻ "Thông tin riêng của trường".</Alert>
      ) : null}

      <div role="tablist" aria-label="Thông tin hồ sơ" className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${tabIdPrefix}-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`${tabIdPrefix}-${item.id}-panel`}
            onClick={() => setTab(item.id)}
            className={`-mb-px rounded-t-lg border border-b-0 px-3 py-2 text-content ${
              tab === item.id
                ? 'border-border bg-card font-semibold text-text'
                : 'border-transparent text-text-secondary'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${tabIdPrefix}-profile-panel`}
        aria-labelledby={`${tabIdPrefix}-profile`}
        hidden={tab !== 'profile'}
        className="flex flex-col gap-4"
      >
        <StudentProfileForm
          key={JSON.stringify(valuesOf(data))}
          child={data}
          editable={editable}
          nationalId={nationalIdCell}
          onSaved={(message) => void refresh(message)}
        />
        <MoetProfileSection entries={data.moet_profile} />
      </div>

      <div
        role="tabpanel"
        id={`${tabIdPrefix}-school-panel`}
        aria-labelledby={`${tabIdPrefix}-school`}
        hidden={tab !== 'school'}
        className="flex flex-col gap-4"
      >
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-content md:grid-cols-[12rem_1fr]">
          <dt className="text-text-secondary md:text-right">Giấy khai sinh</dt>
          <dd className="flex flex-wrap items-center gap-2">
            {data.birth_certificate_file_id === null ? (
              <>
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
              </>
            ) : (
              'Đã có bản chụp'
            )}
          </dd>
          <dt className="text-text-secondary md:text-right">Đồng ý hình ảnh</dt>
          <dd>{PHOTO_CONSENT_LABELS[data.photo_consent]}</dd>
          <dt className="text-text-secondary md:text-right">Học sinh là con nhân viên</dt>
          <dd>{data.is_staff_child ? data.related_staff_name : 'Không'}</dd>
          <dt className="text-text-secondary md:text-right">Ngày nhập học</dt>
          <dd>{data.enroll_date ?? 'Chưa có'}</dd>
          <dt className="text-text-secondary md:text-right">Ghi chú</dt>
          <dd>{data.note ?? ''}</dd>
        </dl>

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
      </div>

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
            label="Lớp cho học sinh"
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

      {canApprove && ['active', 'paused', 'withdrawn'].includes(data.status) ? (
        <ChildLifecycleSection key={data.status + data.org_unit_id} child={data} onChanged={onChanged} />
      ) : null}

      {data.status === 'active' ? <AuthorizedPickupsSection childId={data.id} childName={data.full_name} /> : null}
      {/* Môn tự chọn của học sinh Tiểu học (DT-20 phần 20a); trẻ Mầm non không có mục này */}
      {data.status === 'active' && data.current_class ? (
        <ElectiveSubjectsSection childId={data.id} onChanged={onChanged} />
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
          Lớp đã đủ sĩ số tối đa. Quản lý đơn vị xác nhận để vẫn phân học sinh vào lớp này (BR-04).
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
