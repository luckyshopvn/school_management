import { downloadFile } from '../growth/growth-api.js';
import { requestJson } from '../session/api-client.js';

// Gọi các điểm cuối báo cáo, thống kê THCS, THPT (DT-21 phần 21g, YCTD-175); biểu EMIS dùng hàm của 20f với gốc
// `secondary-reports`
export type SecondaryTerm = 'first_term' | 'second_term' | 'year';

const query = (params: Record<string, string | undefined>) =>
  new URLSearchParams(Object.entries(params).filter(([, value]) => value) as string[][]).toString();

export const readSecondaryReport = <T>(report: string, params: Record<string, string | undefined>) =>
  requestJson<T>(`/api/v1/secondary-reports/${report}?${query(params)}`);
export const exportSecondaryReport = (
  report: string,
  params: Record<string, string | undefined>,
  format: 'xlsx' | 'pdf',
) =>
  downloadFile(
    `/api/v1/secondary-reports/${report}/export?${query({ ...params, format })}`,
    `bao-cao-${report}.${format}`,
  );
