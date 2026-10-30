import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, StatusBadge, TextField } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Thiết bị điểm danh của đơn vị (YCTD-389 lát L2, MH-641 ngăn Thiết bị): khai báo máy quét thẻ, đầu đọc RFID, máy chấm công; khóa
// thiết bị chỉ hiện một lần khi tạo hoặc đổi; tắt, bật thiết bị; nhập tệp xuất từ máy chấm công (CSV hoặc Excel: cột Mã, Thời điểm,
// Hướng). Thiết bị thật chưa nối, thử bằng scripts/gia-lap-may-cham-cong.mjs
type Kind = 'qr_scanner' | 'rfid_reader' | 'face_terminal' | 'camera_station';
type Direction = 'in' | 'out' | 'both';

interface Device {
  id: string;
  org_unit_id: string;
  kind: Kind;
  name: string;
  location_name: string | null;
  direction: Direction;
  key_hint: string;
  last_seen_at: string | null;
  disabled_at: string | null;
}

interface ImportResult {
  total: number;
  counts: Record<'recorded' | 'duplicate' | 'unchanged' | 'manual_kept' | 'unknown_code' | 'rejected', number>;
  errors: Array<{ line: number; message: string }>;
}

const KIND_LABELS: Record<Kind, string> = {
  qr_scanner: 'Máy quét thẻ QR',
  rfid_reader: 'Đầu đọc thẻ RFID',
  face_terminal: 'Máy chấm công',
  camera_station: 'Trạm camera',
};
const DIRECTION_LABELS: Record<Direction, string> = { in: 'Vào', out: 'Ra', both: 'Vào và ra' };
const TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
});

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export function AttendanceDevicesPanel({ orgUnitId }: { orgUnitId: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    location: '',
    kind: 'face_terminal' as Kind,
    direction: 'both' as Direction,
  });
  const [shownKey, setShownKey] = useState<{ name: string; key: string }>();
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const [imported, setImported] = useState<{ name: string; result: ImportResult }>();
  const devices = useQuery({
    queryKey: ['attendance-devices'],
    queryFn: () => requestJson<Device[]>('/api/v1/attendance-devices'),
    retry: false,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['attendance-devices'] });
  const onError = (error: unknown) => setMessage({ tone: 'danger', text: messageOf(error) });

  const create = useMutation({
    mutationFn: () =>
      requestJson<Device & { key: string }>('/api/v1/attendance-devices', {
        method: 'POST',
        body: JSON.stringify({
          org_unit_id: orgUnitId,
          kind: form.kind,
          name: form.name.trim(),
          location_name: form.location.trim() || null,
          direction: form.direction,
        }),
      }),
    onSuccess: async (device) => {
      setShownKey({ name: device.name, key: device.key });
      setForm({ ...form, name: '', location: '' });
      setMessage(undefined);
      await refresh();
    },
    onError,
  });
  const rotate = useMutation({
    mutationFn: (device: Device) =>
      requestJson<Device & { key: string }>(`/api/v1/attendance-devices/${device.id}/rotate-key`, { method: 'POST' }),
    onSuccess: async (device) => {
      setShownKey({ name: device.name, key: device.key });
      await refresh();
    },
    onError,
  });
  const toggle = useMutation({
    mutationFn: (device: Device) =>
      requestJson(`/api/v1/attendance-devices/${device.id}/disable`, {
        method: 'POST',
        body: JSON.stringify({ disabled: device.disabled_at === null }),
      }),
    onSuccess: refresh,
    onError,
  });
  const importFile = useMutation({
    mutationFn: async ({ device, file }: { device: Device; file: File }) => {
      const body = new FormData();
      body.set('file', file);
      return {
        name: device.name,
        result: await requestJson<ImportResult>(`/api/v1/attendance-devices/${device.id}/import`, {
          method: 'POST',
          body,
        }),
      };
    },
    onSuccess: (value) => {
      setImported(value);
      setMessage(undefined);
    },
    onError,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  const inputClass = 'rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
      aria-label="Thiết bị điểm danh"
    >
      <h2 className="text-section-title font-bold text-text">Thiết bị điểm danh</h2>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {shownKey ? (
        <Alert tone="warning">
          Khóa của “{shownKey.name}”: <span className="break-all font-mono">{shownKey.key}</span>. Khóa chỉ hiện một
          lần; nhập vào thiết bị rồi đóng thông báo này.{' '}
          <Button variant="text" onClick={() => void navigator.clipboard?.writeText(shownKey.key)}>
            Sao chép
          </Button>
          <Button variant="text" onClick={() => setShownKey(undefined)}>
            Đóng
          </Button>
        </Alert>
      ) : null}
      {devices.isPending ? <p className="text-content text-text-secondary">Đang tải thiết bị…</p> : null}
      {devices.isError ? <Alert tone="warning">{messageOf(devices.error)}</Alert> : null}
      {devices.data && devices.data.length === 0 ? (
        <p className="text-content text-text-secondary">Chưa có thiết bị nào. Khai báo thiết bị ở biểu mẫu bên dưới.</p>
      ) : null}
      <ul className="flex flex-col divide-y divide-border">
        {(devices.data ?? []).map((device) => (
          <li key={device.id} className="flex flex-col gap-2 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 break-words">
                <span className="font-semibold">{device.name}</span>{' '}
                <span className="text-label text-text-secondary">
                  {KIND_LABELS[device.kind]} · {DIRECTION_LABELS[device.direction]}
                  {device.location_name ? ` · ${device.location_name}` : ''} · khóa …{device.key_hint}
                </span>
              </span>
              {device.disabled_at ? (
                <StatusBadge tone="neutral" label="Đã tắt" />
              ) : (
                <StatusBadge
                  tone={device.last_seen_at ? 'success' : 'info'}
                  label={
                    device.last_seen_at
                      ? `Gửi lần cuối ${TIME.format(new Date(device.last_seen_at))}`
                      : 'Chưa gửi lần nào'
                  }
                />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={rotate.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Đổi khóa của “${device.name}”? Khóa cũ hết hiệu lực ngay, phải nhập khóa mới vào thiết bị.`,
                    )
                  ) {
                    rotate.mutate(device);
                  }
                }}
              >
                Đổi khóa
              </Button>
              <Button
                disabled={toggle.isPending}
                onClick={() => {
                  if (
                    device.disabled_at !== null ||
                    window.confirm(`Tắt “${device.name}”? Lượt thiết bị gửi sẽ bị từ chối.`)
                  ) {
                    toggle.mutate(device);
                  }
                }}
              >
                {device.disabled_at ? 'Bật lại' : 'Tắt'}
              </Button>
              <label className="flex flex-wrap items-center gap-2 text-label font-medium text-text">
                Nhập tệp máy chấm công
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  disabled={importFile.isPending}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      importFile.mutate({ device, file });
                    }
                    event.target.value = '';
                  }}
                />
              </label>
            </div>
          </li>
        ))}
      </ul>
      {importFile.isPending ? <p className="text-content text-text-secondary">Đang nhập tệp…</p> : null}
      {imported ? (
        <Alert tone={imported.result.errors.length > 0 ? 'warning' : 'success'}>
          Tệp của “{imported.name}”: {imported.result.total} dòng; ghi mới {imported.result.counts.recorded}, đã có{' '}
          {imported.result.counts.duplicate + imported.result.counts.unchanged}, giữ giờ nhập tay{' '}
          {imported.result.counts.manual_kept}, mã không có {imported.result.counts.unknown_code}, bị từ chối{' '}
          {imported.result.counts.rejected}.
          {imported.result.errors.length > 0 ? (
            <ul className="mt-2 list-disc pl-5">
              {imported.result.errors.map((error) => (
                <li key={`${error.line}-${error.message}`}>
                  Dòng {error.line}: {error.message}
                </li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}
      <form className="flex flex-wrap items-end gap-3 border-t border-border pt-4" onSubmit={submit}>
        <TextField
          label="Tên thiết bị"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <TextField
          label="Vị trí"
          value={form.location}
          onChange={(event) => setForm({ ...form, location: event.target.value })}
        />
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Loại
          <select
            className={inputClass}
            value={form.kind}
            onChange={(event) => setForm({ ...form, kind: event.target.value as Kind })}
          >
            {(['face_terminal', 'qr_scanner', 'rfid_reader'] as Kind[]).map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Hướng
          <select
            className={inputClass}
            value={form.direction}
            onChange={(event) => setForm({ ...form, direction: event.target.value as Direction })}
          >
            {(Object.keys(DIRECTION_LABELS) as Direction[]).map((direction) => (
              <option key={direction} value={direction}>
                {DIRECTION_LABELS[direction]}
              </option>
            ))}
          </select>
        </label>
        <Button variant="primary" type="submit" disabled={create.isPending || form.name.trim() === ''}>
          Khai báo thiết bị
        </Button>
      </form>
      <p className="text-label text-text-secondary">
        Trên máy chấm công, khai mã người bằng mã thẻ QR của học sinh hoặc mã cán bộ. Tệp nhập cần cột “Mã”, “Thời điểm”
        (năm-tháng-ngày giờ:phút, giờ Việt Nam) và có thể có cột “Hướng” (Vào, Ra).
      </p>
    </section>
  );
}
