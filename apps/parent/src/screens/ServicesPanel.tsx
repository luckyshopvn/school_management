import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, StatusBadge, TextField } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// MP-12 Đăng ký dịch vụ và đăng ký học hè (P05-03, P05-13; BR-26, BR-83, BR-92; YCTD-50): phụ huynh đăng ký, hủy dịch vụ
// của con theo tháng; sau ngày chốt thì chờ Ban Giám hiệu duyệt
interface PeriodInfo {
  period: string;
  is_summer: boolean;
}

interface Registration {
  id: string;
  service_id: string;
  status: 'active' | 'pending_late' | 'pending_cancel' | 'cancelled' | 'rejected';
}

interface ChildServices {
  period: string;
  is_summer: boolean;
  is_late: boolean;
  is_locked: boolean;
  closing_date: string;
  summer_registered: boolean;
  services: Array<{ id: string; name: string; is_mandatory: boolean }>;
  registrations: Registration[];
}

const STATUS_LABELS: Record<Registration['status'], string> = {
  active: 'Đã đăng ký',
  pending_late: 'Chờ nhà trường duyệt',
  pending_cancel: 'Chờ duyệt hủy',
  cancelled: 'Đã hủy',
  rejected: 'Bị từ chối',
};

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function nextMonth(): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  return new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1)).toISOString().slice(0, 7);
}

export function ServicesPanel({ child }: { child: { id: string; full_name: string } }) {
  const [periods, setPeriods] = useState<PeriodInfo[]>([]);
  const [period, setPeriod] = useState<string>();
  const [data, setData] = useState<ChildServices>();
  const [startDate, setStartDate] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    requestJson<PeriodInfo[]>('/api/v1/service-registrations/periods')
      .then((loaded) => {
        setPeriods(loaded);
        // Chỉ đặt tháng mặc định khi người dùng chưa chọn tháng
        setPeriod(
          (current) => current ?? loaded.find((item) => item.period === nextMonth())?.period ?? loaded[0]?.period,
        );
      })
      .catch((error: unknown) => setMessage({ tone: 'danger', text: messageOf(error) }));
  }, []);

  // Đổi tháng nhanh thì kết quả của tháng cũ có thể về sau; chỉ nhận kết quả của lần tải mới nhất
  const latestRequest = useRef(0);
  const load = useCallback(async () => {
    if (!period) {
      return;
    }
    const requestNumber = ++latestRequest.current;
    try {
      const loaded = await requestJson<ChildServices>(
        `/api/v1/children/${child.id}/service-registrations?period=${period}`,
      );
      if (requestNumber === latestRequest.current) {
        setData(loaded);
      }
    } catch (error) {
      if (requestNumber === latestRequest.current) {
        setMessage({ tone: 'danger', text: messageOf(error) });
      }
    }
  }, [child.id, period]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      await load();
      setMessage({ tone: 'success', text: success });
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    } finally {
      setBusy(false);
    }
  }

  const live = (serviceId: string) =>
    data?.registrations.find(
      (row) => row.service_id === serviceId && ['active', 'pending_late', 'pending_cancel'].includes(row.status),
    );

  return (
    <section className="flex flex-col gap-3" aria-label={`Dịch vụ của ${child.full_name}`}>
      <label className="flex flex-col gap-1 text-label font-medium text-text">
        Tháng
        <select
          value={period ?? ''}
          onChange={(event) => setPeriod(event.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
        >
          {periods.map((item) => (
            <option key={item.period} value={item.period}>
              {item.period}
              {item.is_summer ? ' (hè)' : ''}
            </option>
          ))}
        </select>
      </label>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {data ? (
        <>
          <p className="text-label text-text-secondary">
            Hạn đăng ký: {data.closing_date}
            {data.is_late ? '. Đã qua hạn, đăng ký hoặc hủy cần nhà trường duyệt.' : ''}
          </p>
          {data.is_summer && !data.summer_registered ? (
            <Button
              variant="primary"
              disabled={busy || data.is_locked}
              onClick={() =>
                void act(
                  () =>
                    requestJson('/api/v1/summer-registrations', {
                      method: 'POST',
                      body: JSON.stringify({ child_id: child.id, period: data.period }),
                    }),
                  'Đã đăng ký học hè',
                )
              }
            >
              Đăng ký học hè tháng này
            </Button>
          ) : null}
          {data.is_late ? (
            <TextField
              label="Ngày bắt đầu học dịch vụ"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          ) : null}
          <ul className="flex flex-col gap-2" aria-label={`Danh sách dịch vụ của ${child.full_name}`}>
            {data.services.map((service) => {
              const registration = live(service.id);
              const available = !data.is_summer || data.summer_registered;
              return (
                <li
                  key={service.id}
                  className="flex flex-wrap items-center justify-between gap-2"
                  aria-label={service.name}
                >
                  <span className="text-content">{service.name}</span>
                  {service.is_mandatory ? (
                    registration ? (
                      <StatusBadge tone="neutral" label="Bắt buộc" />
                    ) : null
                  ) : registration ? (
                    <span className="flex items-center gap-2">
                      <StatusBadge
                        tone={registration.status === 'active' ? 'success' : 'warning'}
                        label={STATUS_LABELS[registration.status]}
                      />
                      {registration.status !== 'pending_cancel' ? (
                        <Button
                          variant="text"
                          disabled={busy}
                          onClick={() =>
                            void act(
                              () =>
                                requestJson(`/api/v1/service-registrations/${registration.id}/cancel`, {
                                  method: 'POST',
                                  body: '{}',
                                }),
                              'Đã gửi hủy dịch vụ',
                            )
                          }
                        >
                          Hủy
                        </Button>
                      ) : null}
                    </span>
                  ) : available ? (
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void act(
                          () =>
                            requestJson('/api/v1/service-registrations', {
                              method: 'POST',
                              body: JSON.stringify({
                                child_id: child.id,
                                period: data.period,
                                service_id: service.id,
                                service_start_date: data.is_late ? startDate || null : null,
                              }),
                            }),
                          data.is_late ? 'Đã gửi đăng ký, chờ nhà trường duyệt' : 'Đã đăng ký dịch vụ',
                        )
                      }
                    >
                      Đăng ký
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </section>
  );
}
