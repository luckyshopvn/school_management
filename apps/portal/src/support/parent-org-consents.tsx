import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError, requestJson } from '../session/api-client.js';

// Đồng ý chia sẻ số liệu tổng hợp với đơn vị cấp trên (DT-SaaS phần S6, YCTD-202): quản trị của trường bật, tắt theo cấp (Bộ, Sở,
// Phòng Văn hóa – Xã hội) và nhóm số liệu; cấp trên chỉ thấy số liệu tổng hợp của nhóm đã đồng ý, không thấy chi tiết từng học sinh.
// Đề nghị xem chi tiết của cấp trên: duyệt, từ chối, rút (rút thì phiên xem chi tiết đang mở kết thúc ngay). Mọi thay đổi ghi nhật ký
type Level = 'ministry' | 'department' | 'commune';
type Category = 'scale' | 'attendance' | 'learning' | 'facilities' | 'staff' | 'emis';

interface Overview {
  available: boolean;
  chain: Array<{ id: string; code: string; name: string; level: Level }>;
  levels: Array<{ key: Level; label: string }>;
  categories: Array<{ key: Category; label: string }>;
  consents: Array<{ level: Level; category: Category; granted_at: string; granted_by_name: string }>;
  history: Array<{
    id: string;
    level: Level;
    category: Category;
    granted_at: string;
    granted_by_name: string;
    revoked_at: string | null;
    revoked_by_name: string | null;
  }>;
  requests: Array<{
    id: string;
    user_name: string;
    unit_name: string;
    categories: Category[];
    reason: string;
    hours: number;
    status: 'pending' | 'approved' | 'rejected' | 'revoked';
    expires_at: string | null;
    created_at: string;
  }>;
}

const TIME = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' });

export function ParentOrgConsentsPage() {
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: ['parent-org-consents'],
    queryFn: () => requestJson<Overview>('/api/v1/parent-org-consents'),
  });
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const data = overview.data;

  useEffect(() => {
    if (data) {
      setDraft(Object.fromEntries(data.consents.map((consent) => [`${consent.level}:${consent.category}`, true])));
    }
  }, [data]);

  const onError = (error: unknown) =>
    setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại');
  const save = useMutation({
    mutationFn: () =>
      requestJson('/api/v1/parent-org-consents', {
        method: 'PUT',
        body: JSON.stringify({
          items: (data?.levels ?? []).flatMap((level) =>
            (data?.categories ?? []).map((category) => ({
              level: level.key,
              category: category.key,
              granted: Boolean(draft[`${level.key}:${category.key}`]),
            })),
          ),
        }),
      }),
    onSuccess: async () => {
      setMessage('Đã lưu đồng ý chia sẻ số liệu');
      await queryClient.invalidateQueries({ queryKey: ['parent-org-consents'] });
    },
    onError,
  });
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' | 'revoke' }) =>
      requestJson(`/api/v1/parent-org-consents/requests/${id}/${decision}`, { method: 'POST', body: '{}' }),
    onSuccess: async (_result, variables) => {
      setMessage(
        variables.decision === 'approve'
          ? 'Đã duyệt đề nghị xem chi tiết'
          : variables.decision === 'reject'
            ? 'Đã từ chối đề nghị'
            : 'Đã rút đề nghị; phiên xem chi tiết đang mở đã kết thúc',
      );
      await queryClient.invalidateQueries({ queryKey: ['parent-org-consents'] });
    },
    onError,
  });

  return (
    <AppShell>
      <section className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/parent-org-consents')}</h1>
        <p className="text-label text-text-secondary">
          Đơn vị cấp trên chỉ thấy số liệu tổng hợp (số lượng, tỉ lệ) của nhóm trường đã đồng ý, không thấy tên hay chi
          tiết từng học sinh. Ô có ít người bị ẩn. Rút đồng ý bất kỳ lúc nào; trường chưa đồng ý không có mặt trong số
          liệu của cấp đó.
        </p>
        {message ? <Alert tone="success">{message}</Alert> : null}
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        {data && !data.available ? (
          <Alert tone="info">Chế độ một trường không có đơn vị cấp trên trên nền tảng.</Alert>
        ) : null}
        {data?.available ? (
          <>
            <p className="text-label" aria-label="Đơn vị quản lý">
              Đơn vị quản lý:{' '}
              {data.chain.length
                ? data.chain.map((unit) => unit.name).join(' › ')
                : 'chưa gắn (đề nghị nhà cung cấp gắn trường vào đơn vị)'}
            </p>
            <table className="w-full text-label" aria-label="Đồng ý chia sẻ số liệu">
              <thead>
                <tr>
                  <th className="text-left">Nhóm số liệu</th>
                  {data.levels.map((level) => (
                    <th key={level.key} className="text-left">
                      {level.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.categories.map((category) => (
                  <tr key={category.key}>
                    <td>{category.label}</td>
                    {data.levels.map((level) => {
                      const key = `${level.key}:${category.key}`;
                      return (
                        <td key={level.key}>
                          <input
                            type="checkbox"
                            aria-label={`${category.label} cho ${level.label}`}
                            checked={Boolean(draft[key])}
                            onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div>
              <Button type="button" variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
                Lưu đồng ý
              </Button>
            </div>
            <h2 className="text-section-title font-semibold">Đề nghị xem chi tiết của cấp trên</h2>
            {data.requests.length === 0 ? <p className="text-label text-text-secondary">Chưa có đề nghị.</p> : null}
            <table className="w-full text-label" aria-label="Đề nghị xem chi tiết">
              <tbody>
                {data.requests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      {request.user_name} ({request.unit_name})
                    </td>
                    <td>
                      {request.categories
                        .map((key) => data.categories.find((category) => category.key === key)?.label ?? key)
                        .join(', ')}
                    </td>
                    <td>
                      {request.reason} ({request.hours} giờ)
                    </td>
                    <td>
                      {request.status === 'pending'
                        ? 'Chờ duyệt'
                        : request.status === 'approved'
                          ? `Đã duyệt đến ${request.expires_at ? TIME.format(new Date(request.expires_at)) : ''}`
                          : request.status === 'rejected'
                            ? 'Đã từ chối'
                            : 'Đã rút'}
                    </td>
                    <td className="flex gap-2">
                      {request.status === 'pending' ? (
                        <>
                          <Button
                            type="button"
                            variant="primary"
                            onClick={() => decide.mutate({ id: request.id, decision: 'approve' })}
                          >
                            Duyệt
                          </Button>
                          <Button type="button" onClick={() => decide.mutate({ id: request.id, decision: 'reject' })}>
                            Từ chối
                          </Button>
                        </>
                      ) : null}
                      {request.status === 'approved' ? (
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => decide.mutate({ id: request.id, decision: 'revoke' })}
                        >
                          Rút
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h2 className="text-section-title font-semibold">Lịch sử đồng ý</h2>
            <ul className="text-label">
              {data.history.map((item) => (
                <li key={item.id}>
                  {TIME.format(new Date(item.granted_at))}: {item.granted_by_name} đồng ý{' '}
                  {data.categories.find((category) => category.key === item.category)?.label} cho{' '}
                  {data.levels.find((level) => level.key === item.level)?.label}
                  {item.revoked_at
                    ? `; rút lúc ${TIME.format(new Date(item.revoked_at))} bởi ${item.revoked_by_name ?? ''}`
                    : ''}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
