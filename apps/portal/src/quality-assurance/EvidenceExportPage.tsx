import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button } from '@school-management/ui';
import { messageOf, selectClass } from '../archives/archive-ui.js';
import { Page, useToast } from '../directives/directive-ui.js';
import { useFrameworkChoice } from './EvidenceCoveragePages.js';
import {
  checkReportCitations,
  exportStoreEvidences,
  readEvidenceFrameworks,
  requestEvidencePackage,
} from './evidence-api.js';
import { exportSelfReport, listAssessments } from './quality-api.js';

// 3.4 Xuất danh mục và báo cáo (YCTD-396 lát L5, MH-685): danh mục minh chứng theo mẫu hướng dẫn (Excel, Word, PDF), gói hồ
// sơ minh chứng theo hộp (ZIP, tác vụ nền), báo cáo tự đánh giá của đợt kèm kiểm mã trích dẫn trước khi xuất (BR-550)
type ReportFormat = 'docx' | 'pdf';

export function EvidenceExportPage() {
  const { toast, setToast, close } = useToast();
  const choice = useFrameworkChoice();
  const store = useQuery({ queryKey: ['evidence', 'frameworks'], queryFn: readEvidenceFrameworks });
  // Người không có quyền tự đánh giá không xem được đợt: ẩn phần báo cáo
  const assessments = useQuery({ queryKey: ['quality', 'assessments'], queryFn: listAssessments, retry: false });
  const [assessmentId, setAssessmentId] = useState('');
  const [pending, setPending] = useState<ReportFormat | null>(null);
  const catalog = useMutation({
    mutationFn: (format: 'xlsx' | 'docx' | 'pdf') => exportStoreEvidences(choice.frameworkId, format),
  });
  const pack = useMutation({
    mutationFn: () => requestEvidencePackage(choice.frameworkId),
    onSuccess: () => setToast('Đang tạo gói hồ sơ minh chứng; tải tệp ở Tệp đã tạo khi xong'),
  });
  const citations = useMutation({ mutationFn: () => checkReportCitations(assessmentId) });
  const report = useMutation({
    mutationFn: (format: ReportFormat) => exportSelfReport(assessmentId, format),
    onSuccess: () => setPending(null),
  });
  // Kiểm mã trích dẫn trước; có mã chưa có trong danh mục thì báo, người dùng bấm Vẫn xuất mới xuất
  const exportReport = async (format: ReportFormat) => {
    const result = await citations.mutateAsync();
    if (result.unknown.length > 0) {
      setPending(format);
      return;
    }
    report.mutate(format);
  };
  const ofFramework = (assessments.data ?? []).filter((row) => row.framework_id === choice.frameworkId);
  const error = choice.error ?? catalog.error ?? pack.error ?? citations.error ?? report.error;
  return (
    <Page path="/quality/evidence-exports" toast={toast} onToastClose={close}>
      <div className="flex flex-wrap items-end gap-3">{choice.select}</div>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <section
        aria-label="Danh mục minh chứng"
        className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
      >
        <h2 className="text-title font-semibold">Danh mục minh chứng</h2>
        <p className="text-content text-muted">
          Theo mẫu của hướng dẫn tự đánh giá: nhóm theo tiêu chuẩn, tiêu chí; minh chứng dùng chung ghi lại mã gốc.
        </p>
        <span className="flex flex-wrap gap-2">
          {(['xlsx', 'docx', 'pdf'] as const).map((format) => (
            <Button
              key={format}
              disabled={!choice.frameworkId || catalog.isPending}
              onClick={() => catalog.mutate(format)}
            >
              {format === 'xlsx'
                ? 'Xuất danh mục Excel'
                : format === 'docx'
                  ? 'Xuất danh mục Word'
                  : 'Xuất danh mục PDF'}
            </Button>
          ))}
        </span>
      </section>
      {store.data?.can_manage ? (
        <section
          aria-label="Gói hồ sơ minh chứng"
          className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
        >
          <h2 className="text-title font-semibold">Gói hồ sơ minh chứng</h2>
          <p className="text-content text-muted">
            Tệp ZIP có thư mục theo hộp H1, H2…, mỗi minh chứng một tệp đặt tên theo mã, kèm danh mục. Minh chứng có dữ
            liệu cá nhân chỉ vào gói khi bạn có quyền xem nguồn; mỗi tệp đưa vào gói ghi nhật ký truy cập.
          </p>
          <span className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={!choice.frameworkId || pack.isPending} onClick={() => pack.mutate()}>
              Tạo gói hồ sơ minh chứng
            </Button>
            <a className="inline-flex min-h-11 items-center text-primary underline" href="/generated-files">
              Tệp đã tạo
            </a>
          </span>
        </section>
      ) : null}
      {assessments.data ? (
        <section
          aria-label="Báo cáo tự đánh giá"
          className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
        >
          <h2 className="text-title font-semibold">Báo cáo tự đánh giá</h2>
          <label className="text-label font-medium text-text">
            Đợt tự đánh giá
            <select
              className={selectClass}
              value={assessmentId}
              onChange={(event) => {
                setAssessmentId(event.target.value);
                setPending(null);
                citations.reset();
              }}
            >
              <option value="">Chọn đợt</option>
              {ofFramework.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title}
                </option>
              ))}
            </select>
          </label>
          {citations.data ? (
            citations.data.unknown.length > 0 ? (
              <Alert tone="warning">
                <p>
                  Có {citations.data.unknown.length} mã minh chứng trích dẫn chưa có trong danh mục của bộ:{' '}
                  {citations.data.unknown.map((row) => `[${row.code}] (${row.location})`).join('; ')}.
                </p>
                {pending ? (
                  <span className="mt-2 flex flex-wrap gap-2">
                    <Button disabled={report.isPending} onClick={() => report.mutate(pending)}>
                      Vẫn xuất
                    </Button>
                    <Button variant="text" onClick={() => setPending(null)}>
                      Hủy
                    </Button>
                  </span>
                ) : null}
              </Alert>
            ) : (
              <Alert tone="success">{`Mọi mã trích dẫn (${citations.data.cited_count}) đều có trong danh mục.`}</Alert>
            )
          ) : null}
          <span className="flex flex-wrap gap-2">
            <Button disabled={!assessmentId || citations.isPending} onClick={() => citations.mutate()}>
              Kiểm mã trích dẫn
            </Button>
            <Button
              variant="primary"
              disabled={!assessmentId || citations.isPending || report.isPending}
              onClick={() => void exportReport('docx')}
            >
              Xuất báo cáo Word
            </Button>
            <Button
              disabled={!assessmentId || citations.isPending || report.isPending}
              onClick={() => void exportReport('pdf')}
            >
              Xuất báo cáo PDF
            </Button>
          </span>
        </section>
      ) : null}
    </Page>
  );
}
