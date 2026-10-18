import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  SIGNING_CERTIFICATE_STATUS_LABELS,
  SIGNING_SIGNATURE_TYPE_LABELS,
  SIGNING_SYNC_STATUS_LABELS,
  type SigningSignatureType,
} from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDialog,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  StatusBadge,
  Toast,
  type StatusTone,
} from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import {
  certificateAction,
  deleteSeal,
  markCertificateSynced,
  readCertificate,
  readSealUrl,
  saveCertificate,
  uploadSeal,
  type CertificateInput,
  type SigningCertificate,
  type SigningEvent,
} from './signing-api.js';

// 1.1 Chứng thư số nhà trường và 2.1 Đồng bộ chứng thư số của phân hệ Quản lý kí hồ sơ, bản chạy nội bộ (DT-16 phần 16k;
// quyết định của Eric ngày 2026-10-16). Phần mềm chưa kết nối nhà cung cấp kí số, chưa kết nối hệ thống của Bộ: màn hình
// ghi thông tin chứng thư (không lưu mật khẩu), ảnh con dấu, "Đăng ký kí nội bộ" để dùng nút kí xác nhận nội bộ ở 2.2, và
// "Đánh dấu đã đồng bộ" sau khi nhà trường đăng ký đồng bộ trên hệ thống của Bộ
export function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export const formatDate = (value: string | null) => (value ? value.slice(0, 10).split('-').reverse().join('/') : '');
export const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '';
export const todayText = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

const STATUS_TONES: Record<SigningCertificate['status'], StatusTone> = {
  draft: 'neutral',
  registered: 'success',
  revoked: 'warning',
};

const EVENT_LABELS: Record<string, string> = {
  certificate_save: 'Ghi thông tin chứng thư',
  certificate_register: 'Đăng ký kí nội bộ',
  certificate_revoke: 'Hủy đăng ký',
  seal_upload: 'Tải ảnh con dấu',
  seal_delete: 'Xóa ảnh con dấu',
  certificate_sync: 'Đánh dấu đã đồng bộ',
  certificate_unsync: 'Đặt lại chưa đồng bộ',
  create: 'Tạo hồ sơ',
  sign: 'Kí',
  check_changes: 'Tải thông tin thay đổi',
  cancel: 'Hủy hồ sơ',
  complete: 'Xác nhận hoàn thành',
  uncomplete: 'Hủy xác nhận',
  mark_sent: 'Đánh dấu đã gửi',
};

export function EventList({ events, label }: { events: SigningEvent[]; label: string }) {
  if (events.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-2" aria-label={label}>
      <h2 className="text-section-title font-semibold text-text">{label}</h2>
      <ul className="flex flex-col gap-1 text-label text-text-secondary">
        {events.map((event) => (
          <li key={event.id}>
            {formatDateTime(event.created_at)} – {EVENT_LABELS[event.action] ?? event.action} – {event.actor_name}
            {event.note ? `: ${event.note}` : ''}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CertificateStatus({ certificate }: { certificate: SigningCertificate }) {
  return (
    <FormBlock title="Trạng thái">
      <FormRow label="Trạng thái chữ ký">
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge
            tone={STATUS_TONES[certificate.status]}
            label={SIGNING_CERTIFICATE_STATUS_LABELS[certificate.status]}
          />
          {certificate.expired ? <StatusBadge tone="danger" label="Hết hiệu lực" /> : null}
          {certificate.registered_at ? (
            <span className="text-label text-text-secondary">
              {formatDateTime(certificate.registered_at)} – {certificate.registered_by_name}
            </span>
          ) : null}
        </span>
      </FormRow>
      <FormRow label="Trạng thái đồng bộ với Bộ">
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge
            tone={certificate.sync_status === 'synced' ? 'success' : 'neutral'}
            label={SIGNING_SYNC_STATUS_LABELS[certificate.sync_status]}
          />
          {certificate.synced_on ? (
            <span className="text-label text-text-secondary">
              Ngày {formatDate(certificate.synced_on)} – {certificate.synced_by_name}
              {certificate.sync_note ? ` – ${certificate.sync_note}` : ''}
            </span>
          ) : null}
        </span>
      </FormRow>
    </FormBlock>
  );
}

function SealImage({ version }: { version: string | null }) {
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let created: string | undefined;
    readSealUrl()
      .then((value) => {
        created = value;
        setUrl(value);
      })
      .catch((reason: unknown) => setError(messageOf(reason)));
    return () => {
      if (created) {
        URL.revokeObjectURL(created);
      }
    };
  }, [version]);
  if (error) {
    return <Alert tone="danger">{error}</Alert>;
  }
  return url ? <img src={url} alt="Ảnh con dấu" className="h-28 w-28 rounded border border-border object-contain" /> : null;
}

const EMPTY_INPUT: CertificateInput = {
  signature_type: 'remote',
  provider: null,
  login_name: null,
  holder_name: null,
  holder_title: null,
  serial_number: null,
  valid_from: null,
  valid_to: null,
};

const TEXT_FIELDS: Array<{ key: Exclude<keyof CertificateInput, 'signature_type'>; label: string; type?: string }> = [
  { key: 'provider', label: 'Nhà phát hành' },
  { key: 'login_name', label: 'Tên đăng nhập' },
  { key: 'holder_name', label: 'Người đứng tên' },
  { key: 'holder_title', label: 'Chức danh' },
  { key: 'serial_number', label: 'Số sê-ri chứng thư' },
  { key: 'valid_from', label: 'Hiệu lực từ ngày', type: 'date' },
  { key: 'valid_to', label: 'Hiệu lực đến ngày', type: 'date' },
];

function CertificateForm({
  certificate,
  onSaved,
}: {
  certificate: SigningCertificate;
  onSaved(message: string, next: SigningCertificate): void;
}) {
  const [values, setValues] = useState<CertificateInput>(() => ({
    ...EMPTY_INPUT,
    ...Object.fromEntries(Object.keys(EMPTY_INPUT).map((key) => [key, certificate[key as keyof CertificateInput]])),
  }));
  const locked = certificate.status === 'registered' || !certificate.can_manage;
  const save = useMutation({
    mutationFn: () => saveCertificate(values),
    onSuccess: (next) => onSaved('Đã ghi thông tin chứng thư', next),
  });
  const fieldError = (field: string) =>
    save.error instanceof ApiError ? save.error.details.find((detail) => detail.field === field)?.message : undefined;
  return (
    <section className="flex flex-col gap-4" aria-label="Thông tin chứng thư">
      {save.error && !(save.error instanceof ApiError && save.error.details.length > 0) ? (
        <Alert tone="danger">{messageOf(save.error)}</Alert>
      ) : null}
      <FormBlock title="Thông tin chứng thư">
        <FormRow label="Kiểu chữ ký" error={fieldError('signature_type')}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.signature_type}
            disabled={locked}
            onChange={(event) =>
              setValues({ ...values, signature_type: event.target.value as SigningSignatureType })
            }
          >
            {Object.entries(SIGNING_SIGNATURE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormRow>
        {TEXT_FIELDS.map((field) => (
          <FormRow key={field.key} label={field.label} error={fieldError(field.key)}>
            <input
              className={FORM_CONTROL_CLASS}
              type={field.type ?? 'text'}
              disabled={locked}
              value={values[field.key] ?? ''}
              onChange={(event) => setValues({ ...values, [field.key]: event.target.value || null })}
            />
          </FormRow>
        ))}
      </FormBlock>
      {certificate.can_manage ? (
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" disabled={locked || save.isPending} onClick={() => save.mutate()}>
            Ghi
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export function SigningCertificatePage() {
  const queryClient = useQueryClient();
  const certificate = useQuery({ queryKey: ['signing', 'certificate'], queryFn: readCertificate });
  const [toastMessage, setToastMessage] = useState<string>();
  const [pending, setPending] = useState<'register' | 'revoke' | 'delete-seal'>();
  const [sealVersion, setSealVersion] = useState<string | null>(null);
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const update = (message: string, next: SigningCertificate) => {
    queryClient.setQueryData(['signing', 'certificate'], next);
    setToastMessage(message);
  };
  const act = useMutation({
    mutationFn: async (action: 'register' | 'revoke' | 'delete-seal') =>
      action === 'delete-seal' ? deleteSeal() : certificateAction(action),
    onSuccess: (next, action) => {
      setPending(undefined);
      setSealVersion(String(Date.now()));
      update(
        action === 'register'
          ? 'Đã đăng ký kí nội bộ'
          : action === 'revoke'
            ? 'Đã hủy đăng ký kí nội bộ'
            : 'Đã xóa ảnh con dấu',
        next,
      );
    },
    onError: () => setPending(undefined),
  });
  const upload = useMutation({
    mutationFn: uploadSeal,
    onSuccess: (next) => {
      setSealVersion(String(Date.now()));
      update('Đã tải ảnh con dấu', next);
    },
  });
  const data = certificate.data;
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/signing-certificate')}</h1>
        <Alert tone="info">
          Phần mềm chưa kết nối nhà cung cấp chữ ký số. Thông tin chứng thư chỉ để ghi nhận và in lên hồ sơ; phần mềm
          không lưu mật khẩu hay mã PIN của chứng thư. "Đăng ký kí nội bộ" cho phép dùng nút "Kí xác nhận nội bộ" ở mục
          2.2: hồ sơ được xác nhận trên phần mềm (người kí, thời điểm kí, ảnh con dấu, mã băm của tệp), không phải chữ ký
          số.
        </Alert>
        {certificate.isError ? <Alert tone="danger">{messageOf(certificate.error)}</Alert> : null}
        {act.error ? <Alert tone="danger">{messageOf(act.error)}</Alert> : null}
        {upload.error ? <Alert tone="danger">{messageOf(upload.error)}</Alert> : null}
        {!data ? (
          <div className="h-40 animate-pulse rounded bg-border" aria-hidden="true" />
        ) : (
          <>
            <CertificateStatus certificate={data} />
            <CertificateForm key={data.updated_at ?? 'new'} certificate={data} onSaved={update} />
            <FormBlock title="Ảnh con dấu">
              <FormRow label="Ảnh hiện tại">
                {data.has_seal ? (
                  <span className="flex flex-wrap items-center gap-3">
                    <SealImage version={sealVersion ?? data.seal_file_name} />
                    <span className="text-label text-text-secondary">{data.seal_file_name}</span>
                  </span>
                ) : (
                  <span className="text-label text-text-secondary">Chưa có ảnh con dấu</span>
                )}
              </FormRow>
              {data.can_manage ? (
                <FormRow label="Tải ảnh con dấu">
                  <input
                    className={FORM_CONTROL_CLASS}
                    type="file"
                    accept="image/png,image/jpeg"
                    aria-label="Chọn ảnh con dấu (PNG, JPEG, tối đa 1 MB)"
                    disabled={data.status === 'registered' || upload.isPending}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        upload.mutate(file);
                      }
                      event.target.value = '';
                    }}
                  />
                </FormRow>
              ) : null}
            </FormBlock>
            {data.can_manage ? (
              <div className="flex flex-wrap gap-3">
                {data.status === 'registered' ? (
                  <Button variant="secondary" onClick={() => setPending('revoke')}>
                    Hủy đăng ký
                  </Button>
                ) : (
                  <Button variant="primary" onClick={() => setPending('register')}>
                    Đăng ký kí nội bộ
                  </Button>
                )}
                {data.has_seal && data.status !== 'registered' ? (
                  <Button variant="text" onClick={() => setPending('delete-seal')}>
                    Xóa ảnh con dấu
                  </Button>
                ) : null}
              </div>
            ) : null}
            <EventList events={data.events} label="Lịch sử thao tác" />
          </>
        )}
      </div>
      <ConfirmDialog
        open={pending !== undefined}
        title={
          pending === 'register'
            ? 'Đăng ký kí nội bộ cho chứng thư này?'
            : pending === 'revoke'
              ? 'Hủy đăng ký kí nội bộ?'
              : 'Xóa ảnh con dấu?'
        }
        confirmLabel={pending === 'register' ? 'Đăng ký' : pending === 'revoke' ? 'Hủy đăng ký' : 'Xóa'}
        busy={act.isPending}
        onCancel={() => setPending(undefined)}
        onConfirm={() => pending && act.mutate(pending)}
      >
        {pending === 'register'
          ? 'Sau khi đăng ký, người có quyền kí dùng được nút "Kí xác nhận nội bộ"; thông tin chứng thư và ảnh con dấu khóa sửa đến khi hủy đăng ký. Phần mềm không đăng ký với nhà cung cấp chữ ký số.'
          : pending === 'revoke'
            ? 'Không kí được hồ sơ mới đến khi đăng ký lại; hồ sơ đã kí giữ nguyên.'
            : 'Hồ sơ kí sau này sẽ không có ảnh con dấu.'}
      </ConfirmDialog>
    </AppShell>
  );
}

export function SigningCertificateSyncPage() {
  const queryClient = useQueryClient();
  const certificate = useQuery({ queryKey: ['signing', 'certificate'], queryFn: readCertificate });
  const [syncedOn, setSyncedOn] = useState(todayText);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState<'sync' | 'unsync'>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const act = useMutation({
    mutationFn: (action: 'sync' | 'unsync') =>
      action === 'sync' ? markCertificateSynced(syncedOn, note.trim() || null) : certificateAction('unsync'),
    onSuccess: (next, action) => {
      setPending(undefined);
      queryClient.setQueryData(['signing', 'certificate'], next);
      setToastMessage(action === 'sync' ? 'Đã đánh dấu đã đồng bộ' : 'Đã đặt lại chưa đồng bộ');
    },
    onError: () => setPending(undefined),
  });
  const data = certificate.data;
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/signing-certificate-sync')}</h1>
        <Alert tone="info">
          Phần mềm chưa kết nối với hệ thống của Bộ nên không tự đồng bộ chứng thư. Nhà trường đăng ký đồng bộ chứng thư
          trên hệ thống của Bộ rồi bấm "Đánh dấu đã đồng bộ" kèm ngày đồng bộ để lưu trạng thái.
        </Alert>
        {certificate.isError ? <Alert tone="danger">{messageOf(certificate.error)}</Alert> : null}
        {act.error ? <Alert tone="danger">{messageOf(act.error)}</Alert> : null}
        {!data ? (
          <div className="h-40 animate-pulse rounded bg-border" aria-hidden="true" />
        ) : (
          <>
            <FormBlock title="Chứng thư số nhà trường">
              <FormRow label="Kiểu chữ ký">{SIGNING_SIGNATURE_TYPE_LABELS[data.signature_type]}</FormRow>
              <FormRow label="Nhà phát hành">{data.provider ?? ''}</FormRow>
              <FormRow label="Người đứng tên">{data.holder_name ?? ''}</FormRow>
              <FormRow label="Hiệu lực">
                {[formatDate(data.valid_from), formatDate(data.valid_to)].filter(Boolean).join(' – ')}
              </FormRow>
            </FormBlock>
            <CertificateStatus certificate={data} />
            {data.can_manage ? (
              data.sync_status === 'synced' ? (
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => setPending('unsync')}>
                    Đặt lại chưa đồng bộ
                  </Button>
                </div>
              ) : (
                <FormBlock title="Đánh dấu đã đồng bộ">
                  <FormRow label="Ngày đồng bộ">
                    <input
                      className={FORM_CONTROL_CLASS}
                      type="date"
                      value={syncedOn}
                      max={todayText()}
                      onChange={(event) => setSyncedOn(event.target.value)}
                    />
                  </FormRow>
                  <FormRow label="Ghi chú">
                    <input className={FORM_CONTROL_CLASS} value={note} onChange={(event) => setNote(event.target.value)} />
                  </FormRow>
                  <div>
                    <Button
                      variant="primary"
                      disabled={data.status !== 'registered' || !syncedOn}
                      onClick={() => setPending('sync')}
                    >
                      Đánh dấu đã đồng bộ
                    </Button>
                  </div>
                  {data.status !== 'registered' ? (
                    <p className="text-label text-text-secondary">
                      Đăng ký kí nội bộ cho chứng thư ở mục 1.1 trước khi đánh dấu đồng bộ.
                    </p>
                  ) : null}
                </FormBlock>
              )
            ) : null}
            <EventList
              events={data.events.filter((event) => event.action.startsWith('certificate_'))}
              label="Lịch sử thao tác"
            />
          </>
        )}
      </div>
      <ConfirmDialog
        open={pending !== undefined}
        title={pending === 'sync' ? 'Đánh dấu chứng thư đã đồng bộ với Bộ?' : 'Đặt lại chứng thư chưa đồng bộ?'}
        confirmLabel={pending === 'sync' ? 'Đánh dấu' : 'Đặt lại'}
        busy={act.isPending}
        onCancel={() => setPending(undefined)}
        onConfirm={() => pending && act.mutate(pending)}
      >
        {pending === 'sync'
          ? `Ngày đồng bộ ${formatDate(syncedOn)}. Phần mềm chỉ ghi trạng thái, không gửi dữ liệu lên hệ thống của Bộ.`
          : 'Trạng thái đồng bộ trở về "Chưa đồng bộ".'}
      </ConfirmDialog>
    </AppShell>
  );
}
