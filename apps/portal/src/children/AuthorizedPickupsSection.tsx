import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';

// Người được ủy quyền đón trẻ trong chi tiết hồ sơ trẻ (P02-04, BR-11): ai xem được trẻ thì xem danh sách;
// P02.authorized-pickup.manage khai báo và hủy (YCTD-48)
interface AuthorizedPickup {
  id: string;
  full_name: string;
  relationship: string;
  phone: string;
  valid_from: string;
  valid_to: string | null;
  source: 'parent' | 'staff';
  is_valid_today: boolean;
}

const EMPTY_FORM = { full_name: '', relationship: '', phone: '', valid_from: '', valid_to: '' };

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ';
}

export function AuthorizedPickupsSection({ childId, childName }: { childId: string; childName: string }) {
  const canManage = useHasPermission(PERMISSION_CODES.authorizedPickupManage);
  const queryClient = useQueryClient();
  const queryKey = ['authorized-pickups', childId];
  const [form, setForm] = useState(EMPTY_FORM);
  const list = useQuery({
    queryKey,
    queryFn: () => requestJson<AuthorizedPickup[]>(`/api/v1/children/${childId}/authorized-pickups`),
  });
  const create = useMutation({
    mutationFn: () =>
      requestJson(`/api/v1/children/${childId}/authorized-pickups`, {
        method: 'POST',
        body: JSON.stringify({ ...form, valid_from: form.valid_from || null, valid_to: form.valid_to || null }),
      }),
    onSuccess: async () => {
      setForm(EMPTY_FORM);
      await queryClient.invalidateQueries({ queryKey });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => requestJson(`/api/v1/authorized-pickups/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate();
  }

  const error = list.error ?? create.error ?? revoke.error;
  return (
    <section
      className="flex flex-col gap-3 border-t border-border pt-4"
      aria-label={`Người được ủy quyền đón ${childName}`}
    >
      <h3 className="text-content font-semibold text-text">Người được ủy quyền đón trẻ</h3>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <table className="w-full text-left text-content">
        <thead className="text-label text-text-secondary">
          <tr>
            <th className="py-1">Họ tên</th>
            <th className="py-1">Quan hệ</th>
            <th className="py-1">Số điện thoại</th>
            <th className="py-1">Hiệu lực</th>
            <th className="py-1">Người khai báo</th>
            {canManage ? <th className="py-1" /> : null}
          </tr>
        </thead>
        <tbody>
          {list.data && list.data.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-2 text-text-secondary">
                Chưa khai báo người đón nào.
              </td>
            </tr>
          ) : null}
          {(list.data ?? []).map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="py-2">{row.full_name}</td>
              <td className="py-2">{row.relationship}</td>
              <td className="py-2">{row.phone}</td>
              <td className="py-2">
                {row.valid_from} đến {row.valid_to ?? 'không thời hạn'}
                {row.is_valid_today ? '' : ' (không hiệu lực hôm nay)'}
              </td>
              <td className="py-2">{row.source === 'parent' ? 'Phụ huynh' : 'Nhà trường'}</td>
              {canManage ? (
                <td className="py-2">
                  <Button
                    variant="text"
                    disabled={revoke.isPending}
                    aria-label={`Hủy ủy quyền ${row.full_name}`}
                    onClick={() => revoke.mutate(row.id)}
                  >
                    Hủy
                  </Button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {canManage ? (
        <form onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-2" aria-label="Khai báo người đón">
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
            label="Số điện thoại người đón"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
          <TextField
            label="Hiệu lực từ ngày"
            type="date"
            value={form.valid_from}
            onChange={(event) => setForm({ ...form, valid_from: event.target.value })}
          />
          <TextField
            label="Hiệu lực đến ngày"
            type="date"
            value={form.valid_to}
            onChange={(event) => setForm({ ...form, valid_to: event.target.value })}
          />
          <div className="flex items-end">
            <Button type="submit" variant="primary" disabled={create.isPending}>
              Khai báo người đón
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
