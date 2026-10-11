import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// MP-08 Sức khỏe của con (P10-01, P10-06, P10-07, P10-08, P10-12; BR-53, BR-87, BR-88; YCTD-74): chỉ số theo lần đo,
// kết quả khám đã công bố, sự kiện y tế và xác nhận đã biết, chăm sóc hằng ngày 30 ngày gần nhất, yêu cầu báo cáo sức khỏe
type Status = 'below' | 'normal' | 'above';
type Evaluation = Partial<Record<'height_cm' | 'weight_kg' | 'bmi', Status>>;

interface HealthSummary {
  profile: { allergies: string | null; chronic_conditions: string | null } | null;
  measurements: Array<{
    id: string;
    measured_on: string;
    height_cm: number | null;
    weight_kg: number | null;
    evaluation: Evaluation;
  }>;
  check_results: Array<{
    id: string;
    campaign_name: string;
    height_cm: number | null;
    weight_kg: number | null;
    conclusion: string | null;
    evaluation: Evaluation;
  }>;
  medical_events: Array<{
    id: string;
    occurred_at: string;
    symptoms: string;
    handling: string;
    handler_name: string;
    parent_acknowledged_at: string | null;
  }>;
  daily_care: Array<{
    id: string;
    care_date: string;
    temperature: number | null;
    condition_note: string | null;
    special_care_note: string | null;
  }>;
}

interface ReportRequest {
  id: string;
  child_id: string;
  report_type: 'growth' | 'medical' | 'full';
  period_from: string;
  period_to: string;
  status: 'pending' | 'sent';
  response_note: string | null;
}

const LABELS = { height_cm: 'Chiều cao', weight_kg: 'Cân nặng', bmi: 'Chỉ số khối cơ thể' };
const STATUS = { below: 'dưới ngưỡng', normal: 'bình thường', above: 'trên ngưỡng' };
const TYPES = { growth: 'Tăng trưởng', medical: 'Y tế', full: 'Đầy đủ' };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

function describe(evaluation: Evaluation): string {
  return Object.entries(evaluation)
    .map(([key, status]) => `${LABELS[key as keyof typeof LABELS]} ${STATUS[status as Status]}`)
    .join(', ');
}

const messageOf = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';

export function HealthPanel({ child }: { child: { id: string; full_name: string } }) {
  const [summary, setSummary] = useState<HealthSummary>();
  const [reports, setReports] = useState<ReportRequest[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [reportType, setReportType] = useState<'growth' | 'medical' | 'full'>('full');
  const [fromDate, setFromDate] = useState(() => `${today().slice(0, 7)}-01`);
  const [toDate, setToDate] = useState(today);

  const load = useCallback(async () => {
    try {
      setSummary(await requestJson<HealthSummary>(`/api/v1/children/${child.id}/health`));
      const all = await requestJson<ReportRequest[]>('/api/v1/health-report-requests');
      setReports(all.filter((report) => report.child_id === child.id));
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  }, [child.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const acknowledge = async (eventId: string) => {
    try {
      await requestJson(`/api/v1/medical-events/${eventId}/acknowledge`, { method: 'POST' });
      await load();
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };

  const requestReport = async () => {
    try {
      await requestJson('/api/v1/health-report-requests', {
        method: 'POST',
        body: JSON.stringify({ child_id: child.id, report_type: reportType, period_from: fromDate, period_to: toDate }),
      });
      setNotice('Đã gửi yêu cầu báo cáo sức khỏe');
      await load();
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };

  return (
    <section className="flex flex-col gap-3" aria-label={`Sức khỏe của ${child.full_name}`}>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {summary?.profile?.allergies ? <p className="text-content">Dị ứng: {summary.profile.allergies}</p> : null}

      <h3 className="text-content font-semibold">Sự kiện y tế</h3>
      {summary?.medical_events.length === 0 ? (
        <p className="text-content text-text-secondary">Chưa có sự kiện.</p>
      ) : null}
      {(summary?.medical_events ?? []).map((event) => (
        <article key={event.id} className="rounded-lg border border-border p-3 text-content">
          <p className="font-semibold">{new Date(event.occurred_at).toLocaleString('vi-VN')}</p>
          <p>Triệu chứng: {event.symptoms}</p>
          <p>
            Xử lý: {event.handling} ({event.handler_name})
          </p>
          {event.parent_acknowledged_at ? (
            <p className="text-text-secondary">Đã xác nhận đã biết</p>
          ) : (
            <Button onClick={() => void acknowledge(event.id)}>Đã biết</Button>
          )}
        </article>
      ))}

      <h3 className="text-content font-semibold">Chăm sóc hằng ngày</h3>
      {(summary?.daily_care ?? []).map((care) => (
        <p key={care.id} className="text-content">
          {care.care_date}: {care.temperature !== null ? `${care.temperature} độ` : ''} {care.condition_note ?? ''}{' '}
          {care.special_care_note ?? ''}
        </p>
      ))}

      <h3 className="text-content font-semibold">Chỉ số và kết quả khám</h3>
      {(summary?.measurements ?? []).map((row) => (
        <p key={row.id} className="text-content">
          {row.measured_on}: {row.height_cm ?? '—'} cm, {row.weight_kg ?? '—'} kg {describe(row.evaluation)}
        </p>
      ))}
      {(summary?.check_results ?? []).map((row) => (
        <p key={row.id} className="text-content">
          {row.campaign_name}: {row.height_cm ?? '—'} cm, {row.weight_kg ?? '—'} kg. {row.conclusion ?? ''}{' '}
          {describe(row.evaluation)}
        </p>
      ))}

      <h3 className="text-content font-semibold">Báo cáo sức khỏe</h3>
      {reports.map((report) => (
        <p key={report.id} className="text-content">
          {TYPES[report.report_type]} từ {report.period_from} đến {report.period_to}:{' '}
          {report.status === 'sent' ? `đã gửi. ${report.response_note ?? ''}` : 'đang chờ y tế gửi'}
        </p>
      ))}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-label font-medium text-text">
          Loại báo cáo
          <select
            className="mt-2 block rounded-lg border border-border bg-card px-3 py-2"
            value={reportType}
            onChange={(event) => setReportType(event.target.value as 'growth' | 'medical' | 'full')}
          >
            <option value="full">Đầy đủ</option>
            <option value="growth">Tăng trưởng</option>
            <option value="medical">Y tế</option>
          </select>
        </label>
        <TextField
          label="Báo cáo từ ngày"
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
        />
        <TextField
          label="Báo cáo đến ngày"
          type="date"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
        />
        <Button onClick={() => void requestReport()}>Yêu cầu báo cáo</Button>
      </div>
    </section>
  );
}
