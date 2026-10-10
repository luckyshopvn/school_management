import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// MP-18 Người được ủy quyền đón trẻ (P02-04, BR-11) và phụ huynh xác nhận người đón ngoài danh sách (BR-56, YCTD-48)
interface AuthorizedPickup {
  id: string;
  full_name: string;
  relationship: string;
  phone: string;
  valid_from: string;
  valid_to: string | null;
  is_valid_today: boolean;
}

interface ConfirmationRequest {
  id: string;
  child_name: string;
  pickup_date: string;
  person_name: string;
  relationship: string;
  phone: string | null;
}

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export function AuthorizedPickupsPanel({ child }: { child: { id: string; full_name: string } }) {
  const [rows, setRows] = useState<AuthorizedPickup[]>();
  const [form, setForm] = useState({ full_name: '', relationship: '', phone: '', valid_to: '' });
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await requestJson<AuthorizedPickup[]>(`/api/v1/children/${child.id}/authorized-pickups`));
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    }
  }, [child.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await requestJson(`/api/v1/children/${child.id}/authorized-pickups`, {
        method: 'POST',
        body: JSON.stringify({ ...form, valid_to: form.valid_to || null }),
      });
      setForm({ full_name: '', relationship: '', phone: '', valid_to: '' });
      await load();
      setMessage({ tone: 'success', text: 'Đã thêm người đón' });
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    } finally {
      setBusy(false);
    }
  }

  async function revoke(row: AuthorizedPickup) {
    setBusy(true);
    try {
      await requestJson(`/api/v1/authorized-pickups/${row.id}`, { method: 'DELETE' });
      await load();
      setMessage({ tone: 'success', text: `Đã hủy ủy quyền của ${row.full_name}` });
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-label={`Người đón ${child.full_name}`}>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      <ul className="flex flex-col gap-2 text-content">
        {rows && rows.length === 0 ? <li className="text-text-secondary">Chưa khai báo người đón nào.</li> : null}
        {(rows ?? []).map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {row.full_name} ({row.relationship}) - {row.phone}
              {row.valid_to ? `, đến ${row.valid_to}` : ''}
              {row.is_valid_today ? '' : ', chưa hoặc hết hiệu lực'}
            </span>
            <Button variant="text" disabled={busy} onClick={() => void revoke(row)}>
              Hủy ủy quyền {row.full_name}
            </Button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} noValidate className="flex flex-col gap-3" aria-label="Thêm người đón">
        <TextField
          label="Họ tên người đón"
          value={form.full_name}
          onChange={(event) => setForm({ ...form, full_name: event.target.value })}
        />
        <TextField
          label="Quan hệ với trẻ"
          value={form.relationship}
          onChange={(event) => setForm({ ...form, relationship: event.target.value })}
        />
        <TextField
          label="Số điện thoại"
          inputMode="tel"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
        />
        <TextField
          label="Hiệu lực đến ngày (để trống là không thời hạn)"
          type="date"
          value={form.valid_to}
          onChange={(event) => setForm({ ...form, valid_to: event.target.value })}
        />
        <Button type="submit" variant="primary" disabled={busy}>
          Thêm người đón
        </Button>
      </form>
    </section>
  );
}

// Yêu cầu xác nhận người đón đang chờ của các con; hiện ở đầu trang chủ
export function PickupConfirmations() {
  const [requests, setRequests] = useState<ConfirmationRequest[]>([]);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRequests(await requestJson<ConfirmationRequest[]>('/api/v1/pickup-confirmations'));
    } catch {
      setRequests([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function answer(request: ConfirmationRequest, decision: 'confirm' | 'refuse') {
    setBusy(true);
    try {
      await requestJson(`/api/v1/pickup-confirmations/${request.id}/${decision}`, { method: 'POST' });
      await load();
      setMessage({
        tone: 'success',
        text:
          decision === 'confirm'
            ? `Đã xác nhận ${request.person_name} đón ${request.child_name}`
            : `Đã từ chối ${request.person_name}`,
      });
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    } finally {
      setBusy(false);
    }
  }

  if (requests.length === 0 && !message) {
    return null;
  }
  return (
    <section className="flex flex-col gap-3" aria-label="Yêu cầu xác nhận người đón">
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {requests.map((request) => (
        <div key={request.id} className="flex flex-col gap-2 rounded-xl border border-warning bg-card p-4">
          <p className="text-content">
            {request.person_name} ({request.relationship}
            {request.phone ? `, ${request.phone}` : ''}) đến đón {request.child_name} ngày {request.pickup_date}. Người
            này không có trong danh sách được ủy quyền.
          </p>
          <div className="flex gap-2">
            <Button variant="primary" disabled={busy} onClick={() => void answer(request, 'confirm')}>
              Xác nhận người đón
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => void answer(request, 'refuse')}>
              Từ chối
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}
