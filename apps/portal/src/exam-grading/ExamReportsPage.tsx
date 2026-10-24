import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { messageOf, NO_LEVEL_MESSAGE, useExamScope } from '../exams/exam-filters.js';
import { COGNITIVE_LABELS, downloadFile, QUESTION_TYPE_LABELS } from '../exams/exams-api.js';
import { lockedExams, readReport, type GroupRate } from './grading-api.js';

// 8.6 Báo cáo kết quả kiểm tra (DT-21 phần 22g2, YCTD-173): theo đề (tuỳ chọn một lớp), chỉ tính bài kiểm tra đã khoá: từng
// câu (độ khó, độ phân biệt), câu nên xem lại, chủ đề, mức nhận thức, từng lớp, phân bố điểm; xuất Excel, PDF
const percent = (value: number) => `${Math.round(value * 100)}%`;

function RateTable({ label, first, rows }: { label: string; first: string; rows: GroupRate[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-content" aria-label={label}>
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-3 py-2">{first}</th>
            <th className="px-3 py-2">Số câu</th>
            <th className="px-3 py-2">Điểm tối đa</th>
            <th className="px-3 py-2">Tỉ lệ điểm đạt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-border">
              <td className="px-3 py-2">{row.label ?? row.key}</td>
              <td className="px-3 py-2">{row.questions}</td>
              <td className="px-3 py-2">{row.max}</td>
              <td className="px-3 py-2">{percent(row.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ExamReportsPage() {
  const scope = useExamScope();
  const [examId, setExamId] = useState('');
  const [classId, setClassId] = useState('');
  const exams = useQuery({
    queryKey: ['locked-exams', scope.level],
    queryFn: () => lockedExams(scope.level ?? 'THCS'),
    enabled: Boolean(scope.level),
  });
  const report = useQuery({
    queryKey: ['exam-report', examId, classId],
    queryFn: () => readReport(examId, classId || undefined),
    enabled: Boolean(examId),
  });
  const data = report.data;
  const [classOptions, setClassOptions] = useState<Array<{ id: string; name: string }>>([]);
  if (data && !classId && classOptions.length !== data.classes.length) {
    setClassOptions(data.classes.map((row) => ({ id: row.class_id, name: row.class_name })));
  }
  const exportFile = (format: 'xlsx' | 'pdf') =>
    void downloadFile(
      `/api/v1/exam-grading/reports/${examId}/export?format=${format}${classId ? `&class_id=${classId}` : ''}`,
      `bao-cao-ket-qua-kiem-tra.${format}`,
    );
  const most = Math.max(1, ...(data?.distribution ?? []));
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/exam-reports')}</h1>
        {!scope.level ? (
          <Alert tone="info">{NO_LEVEL_MESSAGE}</Alert>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-label font-medium text-text">
                Đề
                <select
                  aria-label="Đề"
                  className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                  value={examId}
                  onChange={(event) => {
                    setExamId(event.target.value);
                    setClassId('');
                    setClassOptions([]);
                  }}
                >
                  <option value="">Chọn đề</option>
                  {(exams.data ?? []).map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.title} ({exam.subject_name} {exam.grade_level_code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-label font-medium text-text">
                Lớp
                <select
                  aria-label="Lớp"
                  className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                  value={classId}
                  onChange={(event) => setClassId(event.target.value)}
                >
                  <option value="">Mọi lớp</option>
                  {classOptions.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              {examId ? (
                <>
                  <Button onClick={() => exportFile('xlsx')}>Xuất Excel</Button>
                  <Button onClick={() => exportFile('pdf')}>Xuất PDF</Button>
                </>
              ) : null}
            </div>
            {report.error ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
            {data ? (
              <>
                <p className="text-content text-text">
                  {data.exam.subject_name} {data.exam.grade_level_code}: {data.papers} bài đã khoá; điểm trung bình{' '}
                  {data.average ?? '—'}
                </p>
                {data.papers === 0 ? (
                  <Alert tone="info">Chưa có bài kiểm tra đã khoá điểm của đề này ở lớp bạn được xem.</Alert>
                ) : null}
                <section className="flex flex-col gap-2" aria-label="Theo câu">
                  <h2 className="text-section-title font-semibold text-text">Theo câu</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-content" aria-label="Kết quả theo câu">
                      <thead className="text-left text-label font-medium text-text-secondary">
                        <tr>
                          <th className="px-3 py-2">Câu (mã đầu)</th>
                          <th className="px-3 py-2">Nội dung</th>
                          <th className="px-3 py-2">Dạng</th>
                          <th className="px-3 py-2">Mức</th>
                          <th className="px-3 py-2">Chủ đề</th>
                          <th className="px-3 py-2">Độ khó</th>
                          <th className="px-3 py-2">Độ phân biệt</th>
                          <th className="px-3 py-2">Nên xem lại</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.questions.map((row) => (
                          <tr key={row.question_id} className="border-t border-border">
                            <td className="px-3 py-2">{row.number}</td>
                            <td className="px-3 py-2">{row.content}</td>
                            <td className="px-3 py-2">{QUESTION_TYPE_LABELS[row.question_type]}</td>
                            <td className="px-3 py-2">{COGNITIVE_LABELS[row.cognitive_level]}</td>
                            <td className="px-3 py-2">{row.topic_name ?? ''}</td>
                            <td className="px-3 py-2">{row.attempts > 0 ? row.difficulty : ''}</td>
                            <td className="px-3 py-2">{row.discrimination ?? ''}</td>
                            <td className={`px-3 py-2 ${row.review ? 'text-danger' : ''}`}>{row.review ? 'Có' : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-label text-text-secondary">
                    Độ khó là tỉ lệ điểm đạt trung bình (0 đến 1); độ phân biệt so nhóm 27% bài cao nhất với 27% thấp
                    nhất (từ 10 bài). Câu nên xem lại khi độ khó dưới 0,2 hoặc trên 0,95, hoặc độ phân biệt dưới 0,2.
                  </p>
                </section>
                <section className="flex flex-col gap-2" aria-label="Theo chủ đề">
                  <h2 className="text-section-title font-semibold text-text">Theo chủ đề</h2>
                  <RateTable label="Kết quả theo chủ đề" first="Chủ đề" rows={data.topics} />
                </section>
                <section className="flex flex-col gap-2" aria-label="Theo mức nhận thức">
                  <h2 className="text-section-title font-semibold text-text">Theo mức nhận thức</h2>
                  <RateTable label="Kết quả theo mức nhận thức" first="Mức" rows={data.levels} />
                </section>
                <section className="flex flex-col gap-2" aria-label="Theo lớp">
                  <h2 className="text-section-title font-semibold text-text">Theo lớp</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-content" aria-label="Kết quả theo lớp">
                      <thead className="text-left text-label font-medium text-text-secondary">
                        <tr>
                          <th className="px-3 py-2">Lớp</th>
                          <th className="px-3 py-2">Giáo viên</th>
                          <th className="px-3 py-2">Số bài</th>
                          <th className="px-3 py-2">Trung bình</th>
                          <th className="px-3 py-2">Thấp nhất</th>
                          <th className="px-3 py-2">Cao nhất</th>
                          <th className="px-3 py-2">Tỉ lệ từ 5 điểm</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.classes.map((row) => (
                          <tr key={row.class_id} className="border-t border-border">
                            <td className="px-3 py-2">{row.class_name}</td>
                            <td className="px-3 py-2">{row.teacher}</td>
                            <td className="px-3 py-2">{row.papers}</td>
                            <td className="px-3 py-2">{row.average}</td>
                            <td className="px-3 py-2">{row.min}</td>
                            <td className="px-3 py-2">{row.max}</td>
                            <td className="px-3 py-2">{percent(row.pass_rate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="flex flex-col gap-2" aria-label="Phân bố điểm">
                  <h2 className="text-section-title font-semibold text-text">Phân bố điểm</h2>
                  <ul className="flex flex-col gap-1">
                    {data.distribution.map((count, index) => (
                      <li key={index} className="flex items-center gap-2 text-label text-text">
                        <span className="w-28">{index === 9 ? '9 đến 10' : `${index} đến dưới ${index + 1}`}</span>
                        <span
                          className="inline-block h-3 rounded bg-brand"
                          style={{ width: `${(count / most) * 240}px` }}
                          aria-hidden
                        />
                        <span>{count}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
