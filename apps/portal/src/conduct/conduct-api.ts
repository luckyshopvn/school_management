import { ApiError, requestJson } from '../session/api-client.js';

// Gọi các điểm cuối nề nếp, thi đua lớp (DT-20 phần 20b, YCTD-159)
export type ConductKind = 'plus' | 'minus';
export type ConductPeriod = 'week' | 'month' | 'first_term' | 'second_term';

export const PERIOD_LABELS: Record<ConductPeriod, string> = {
  week: 'Tuần',
  month: 'Tháng',
  first_term: 'Học kỳ I',
  second_term: 'Học kỳ II',
};

export interface ConductSettings {
  enabled: boolean;
  base_points: number;
  updated_by_name: string | null;
  updated_at: string | null;
}

export interface ConductCriterion {
  id: string;
  code: string;
  name: string;
  kind: ConductKind;
  points: number;
  school_level: string;
  order_no: number;
  status: 'active' | 'inactive';
}

export interface ConductEntry {
  id: string;
  class_id: string;
  class_name: string;
  criterion_id: string;
  criterion_name: string;
  kind: ConductKind;
  entry_date: string;
  quantity: number;
  points: number;
  note: string | null;
  reported_by: string | null;
  recorded_by_name: string;
  created_at: string;
}

export interface ConductRanking {
  period: ConductPeriod;
  from: string;
  to: string;
  weeks: number;
  base_points: number;
  enabled: boolean;
  classes: Array<{
    class_id: string;
    class_name: string;
    grade_level: string;
    plus_points: number;
    minus_points: number;
    score: number;
    rank: number;
  }>;
}

export function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export function vietnamToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

// Thứ hai và chủ nhật của tuần chứa ngày
export function weekOf(date: string): { from: string; to: string } {
  const time = Date.parse(`${date}T00:00:00Z`);
  const monday = time - ((new Date(time).getUTCDay() + 6) % 7) * 86_400_000;
  const format = (value: number) => new Date(value).toISOString().slice(0, 10);
  return { from: format(monday), to: format(monday + 6 * 86_400_000) };
}

export const readConductSettings = () => requestJson<ConductSettings>('/api/v1/conduct/settings');
export const saveConductSettings = (input: { enabled: boolean; base_points: number }) =>
  requestJson<ConductSettings>('/api/v1/conduct/settings', { method: 'PUT', body: JSON.stringify(input) });
export const listConductCriteria = () => requestJson<ConductCriterion[]>('/api/v1/conduct/criteria?school_level=TH');
export const createConductCriterion = (input: { code: string; name: string; kind: ConductKind; points: number }) =>
  requestJson<ConductCriterion>('/api/v1/conduct/criteria', {
    method: 'POST',
    body: JSON.stringify({ ...input, school_level: 'TH' }),
  });
export const updateConductCriterion = (
  criterionId: string,
  changes: Partial<Pick<ConductCriterion, 'name' | 'points' | 'status'>>,
) =>
  requestJson<ConductCriterion>(`/api/v1/conduct/criteria/${criterionId}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
export const loadDefaultCriteria = () =>
  requestJson<{ created: string[]; skipped: string[] }>('/api/v1/conduct/criteria/defaults', {
    method: 'POST',
    body: JSON.stringify({ school_level: 'TH' }),
  });
export const listConductEntries = (filter: { from: string; to: string; class_id?: string }) =>
  requestJson<ConductEntry[]>(
    `/api/v1/conduct/entries?${new URLSearchParams(Object.entries(filter).filter(([, value]) => value) as string[][])}`,
  );
export const recordConductEntry = (input: {
  class_id: string;
  criterion_id: string;
  date: string;
  quantity: number;
  note: string | null;
  reported_by: string | null;
}) => requestJson('/api/v1/conduct/entries', { method: 'POST', body: JSON.stringify(input) });
export const deleteConductEntry = (entryId: string) =>
  requestJson(`/api/v1/conduct/entries/${entryId}`, { method: 'DELETE' });
export const readConductRanking = (filter: { period: ConductPeriod; date: string; org_unit_id?: string }) =>
  requestJson<ConductRanking>(
    `/api/v1/conduct/ranking?${new URLSearchParams(
      Object.entries({ ...filter, school_level: 'TH' }).filter(([, value]) => value) as string[][],
    )}`,
  );
