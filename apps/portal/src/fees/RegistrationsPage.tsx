import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, StatusBadge, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  approveLate,
  cancelRegistration,
  listPending,
  listPeriods,
  lockPeriod,
  readSheet,
  registerService,
  registerSummer,
  rejectLate,
  REGISTRATION_STATUS_LABELS,
  type PendingRegistration,
  type Registration,
} from './registrations-api.js';

// MH-05 Đăng ký dịch vụ theo kỳ và duyệt đăng ký trễ (P05-03, P05-04, P05-13; BR-26, BR-83, BR-92; YCTD-50)
const LIVE_STATUSES = ['active', 'pending_late', 'pending_cancel'];

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function nextMonth(): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const date = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1));
  return date.toISOString().slice(0, 7);
}

function PendingSection({ orgUnitId, onChanged }: { orgUnitId: string; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const pending = useQuery({ queryKey: ['pending-registrations', orgUnitId], queryFn: () => listPending(orgUnitId) });
  const [methods, setMethods] = useState<Record<string, 'full_month' | 'actual_days'>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const decide = useMutation({
    mutationFn: ({ row, approve }: { row: PendingRegistration; approve: boolean }) =>
      approve
        ? approveLate(row.id, row.status === 'pending_late' ? (methods[row.id] ?? 'full_month') : null)
        : rejectLate(row.id, reasons[row.id] ?? ''),
    onSuccess: async (_result, { approve }) => {
      await queryClient.invalidateQueries({ queryKey: ['pending-registrations'] });
      await queryClient.invalidateQueries({ queryKey: ['registration-sheet'] });
      onChanged(approve ? 'Đã duyệt' : 'Đã từ chối');
    },
  });
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Chờ Ban Giám hiệu duyệt"
    >
      <h2 className="text-section-title font-semibold text-text">Đăng ký và hủy sau ngày chốt chờ duyệt</h2>
      {decide.error ? <Alert tone="danger">{messageOf(decide.error)}</Alert> : null}
      {pending.data && pending.data.length === 0 ? (
        <p className="text-content text-text-secondary">Không có yêu cầu chờ duyệt.</p>
      ) : null}
      {(pending.data ?? []).map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap items-end gap-3 border-t border-border pt-3"
          role="group"
          aria-label={`Yêu cầu của ${row.child_name}`}
        >
          <div className="flex flex-col">
            <span className="font-medium">
              {row.child_name}: {row.status === 'pending_late' ? 'đăng ký' : 'hủy'} {row.service_name}
            </span>
            <span className="text-label text-text-secondary">
              Kỳ {row.period_year}-{String(row.period_month).padStart(2, '0')}
              {row.service_start_date ? `, bắt đầu học ${row.service_start_date}` : ''}
            </span>
          </div>
          {row.status === 'pending_late' ? (
            <label className="text-label font-medium text-text">
              Cách thu
              <select
                value={methods[row.id] ?? 'full_month'}
                onChange={(event) =>
                  setMethods({ ...methods, [row.id]: event.target.value as 'full_month' | 'actual_days' })
                }
                className="mt-1 block rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
              >
                <option value="full_month">Thu cả tháng</option>
                <option value="actual_days">Thu theo ngày thực tế</option>
              </select>
            </label>
          ) : null}
          <Button variant="primary" disabled={decide.isPending} onClick={() => decide.mutate({ row, approve: true })}>
            Duyệt
          </Button>
          <TextField
            label="Lý do từ chối"
            value={reasons[row.id] ?? ''}
            onChange={(event) => setReasons({ ...reasons, [row.id]: event.target.value })}
          />
          <Button variant="danger" disabled={decide.isPending} onClick={() => decide.mutate({ row, approve: false })}>
            Từ chối
          </Button>
        </div>
      ))}
    </section>
  );
}

export function RegistrationsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.registrationManage);
  const canApprove = useHasPermission(PERMISSION_CODES.lateRegistrationApprove);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const periods = useQuery({ queryKey: ['registration-periods'], queryFn: listPeriods });
  const [chosenPeriod, setChosenPeriod] = useState<string>();
  const period =
    chosenPeriod ?? periods.data?.find((item) => item.period === nextMonth())?.period ?? periods.data?.[0]?.period;
  const queryClient = useQueryClient();
  const sheet = useQuery({
    queryKey: ['registration-sheet', orgUnitId, period],
    queryFn: () => readSheet(orgUnitId ?? '', period ?? ''),
    enabled: Boolean(orgUnitId && period),
  });
  const [startDate, setStartDate] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['registration-sheet'] });

  const change = useMutation({
    mutationFn: async (action: {
      kind: 'register' | 'cancel' | 'summer' | 'lock';
      childId?: string;
      serviceId?: string;
      registrationId?: string;
    }) => {
      if (action.kind === 'register') {
        return registerService({
          child_id: action.childId ?? '',
          period: period ?? '',
          service_id: action.serviceId ?? '',
          service_start_date: sheet.data?.is_late ? startDate || null : null,
        });
      }
      if (action.kind === 'cancel') {
        return cancelRegistration(action.registrationId ?? '');
      }
      if (action.kind === 'summer') {
        return registerSummer(action.childId ?? '', period ?? '');
      }
      return lockPeriod(orgUnitId ?? '', period ?? '');
    },
    onSuccess: async (_result, action) => {
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ['pending-registrations'] });
      setToastMessage(
        action.kind === 'lock'
          ? 'Đã chốt danh sách đăng ký'
          : action.kind === 'cancel'
            ? 'Đã gửi hủy dịch vụ'
            : 'Đã đăng ký',
      );
    },
  });

  const optionalServices = (sheet.data?.services ?? []).filter((service) => !service.is_mandatory);
  const mandatoryServices = (sheet.data?.services ?? []).filter((service) => service.is_mandatory);
  const cell = (registrations: Registration[], serviceId: string) =>
    registrations.find((row) => row.service_id === serviceId && LIVE_STATUSES.includes(row.status));

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Đăng ký dịch vụ</h1>
        <div className="flex flex-wrap items-end gap-4">
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Kỳ
            <select
              value={period ?? ''}
              onChange={(event) => setChosenPeriod(event.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
            >
              {(periods.data ?? []).map((item) => (
                <option key={item.period} value={item.period}>
                  {item.period}
                  {item.is_summer ? ' (hè)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        {canApprove && orgUnitId ? <PendingSection orgUnitId={orgUnitId} onChanged={setToastMessage} /> : null}
        {sheet.error ? <Alert tone="danger">{messageOf(sheet.error)}</Alert> : null}
        {change.error ? <Alert tone="danger">{messageOf(change.error)}</Alert> : null}
        {sheet.data ? (
          <section
            className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
            aria-label="Bảng đăng ký dịch vụ"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-content">Ngày chốt đăng ký: {sheet.data.closing_date}</span>
              {sheet.data.is_locked ? <StatusBadge tone="success" label="Đã chốt danh sách" /> : null}
              {sheet.data.is_late ? <StatusBadge tone="warning" label="Đăng ký thêm là đăng ký trễ" /> : null}
              {sheet.data.is_summer ? <StatusBadge tone="info" label="Tháng hè" /> : null}
              {canManage && !sheet.data.is_locked ? (
                <Button disabled={change.isPending} onClick={() => change.mutate({ kind: 'lock' })}>
                  Chốt danh sách đăng ký
                </Button>
              ) : null}
            </div>
            {canManage && sheet.data.is_late ? (
              <div className="w-64">
                <TextField
                  label="Ngày bắt đầu học (đăng ký trễ)"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
            ) : null}
            <table className="w-full text-content">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-2">Trẻ</th>
                  <th className="px-3 py-2">Lớp</th>
                  {sheet.data.is_summer ? <th className="px-3 py-2">Học hè</th> : null}
                  {mandatoryServices.map((service) => (
                    <th key={service.id} className="px-3 py-2">
                      {service.name}
                    </th>
                  ))}
                  {optionalServices.map((service) => (
                    <th key={service.id} className="px-3 py-2">
                      {service.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.data.children.map((child) => {
                  const enrolledThisMonth = !sheet.data.is_summer || child.summer_registered;
                  return (
                    <tr key={child.child_id} className="border-t border-border" aria-label={child.full_name}>
                      <td className="px-3 py-2 font-medium">{child.full_name}</td>
                      <td className="px-3 py-2">{child.class_name}</td>
                      {sheet.data.is_summer ? (
                        <td className="px-3 py-2">
                          {child.summer_registered ? (
                            <StatusBadge tone="success" label="Đã đăng ký" />
                          ) : canManage && !sheet.data.is_locked ? (
                            <Button
                              variant="text"
                              disabled={change.isPending}
                              onClick={() => change.mutate({ kind: 'summer', childId: child.child_id })}
                            >
                              Đăng ký học hè
                            </Button>
                          ) : (
                            'Không'
                          )}
                        </td>
                      ) : null}
                      {mandatoryServices.map((service) => (
                        <td key={service.id} className="px-3 py-2">
                          {cell(child.registrations, service.id) ? 'Bắt buộc' : ''}
                        </td>
                      ))}
                      {optionalServices.map((service) => {
                        const registration = cell(child.registrations, service.id);
                        return (
                          <td key={service.id} className="px-3 py-2">
                            {registration ? (
                              <div className="flex flex-col items-start gap-1">
                                <StatusBadge
                                  tone={registration.status === 'active' ? 'success' : 'warning'}
                                  label={REGISTRATION_STATUS_LABELS[registration.status]}
                                />
                                {canManage && registration.status !== 'pending_cancel' ? (
                                  <Button
                                    variant="text"
                                    aria-label={`Hủy ${service.name} của ${child.full_name}`}
                                    disabled={change.isPending}
                                    onClick={() => change.mutate({ kind: 'cancel', registrationId: registration.id })}
                                  >
                                    Hủy
                                  </Button>
                                ) : null}
                              </div>
                            ) : canManage && enrolledThisMonth ? (
                              <Button
                                variant="text"
                                aria-label={`Đăng ký ${service.name} cho ${child.full_name}`}
                                disabled={change.isPending}
                                onClick={() =>
                                  change.mutate({ kind: 'register', childId: child.child_id, serviceId: service.id })
                                }
                              >
                                Đăng ký
                              </Button>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
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
