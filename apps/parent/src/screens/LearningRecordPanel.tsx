import { useEffect, useState } from 'react';
import { COMPLETION_OUTCOME_LABELS, type CompletionOutcome } from '@school-management/shared';
import { Alert, Button } from '@school-management/ui';
import { ApiError, fetchWithSession, requestJson } from '../session/api-client.js';

// Học bạ của con học Tiểu học (DT-20 phần 20e, YCTD-163): học bạ các năm Hiệu trưởng đã kí (tải PDF), khen thưởng đã duyệt
// (tải giấy khen có mã tra cứu), kết quả hoàn thành chương trình
interface ChildRecords {
  records: Array<{ id: string; academic_year_name: string; class_name: string; signed_at: string | null }>;
  awards: Array<{ id: string; title_name: string; lookup_code: string | null }>;
  completion: { outcome: CompletionOutcome; next_grade_level: string | null } | null;
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

async function download(path: string, fileName: string) {
  const response = await fetchWithSession(path);
  if (!response.ok) {
    throw new Error('Không tải được tệp');
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function LearningRecordPanel({ child }: { child: { id: string; full_name: string } }) {
  const [data, setData] = useState<ChildRecords>();
  const [errorMessage, setErrorMessage] = useState<string>();
  useEffect(() => {
    requestJson<ChildRecords>(`/api/v1/learning-records/children/${child.id}`)
      .then(setData)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, [child.id]);
  const run = (path: string, fileName: string) =>
    void download(path, fileName).catch((error: unknown) => setErrorMessage(messageOf(error)));
  return (
    <section className="flex flex-col gap-3" aria-label={`Học bạ của ${child.full_name}`}>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {data?.completion ? (
        <p className="text-content font-semibold">{COMPLETION_OUTCOME_LABELS[data.completion.outcome]}</p>
      ) : null}
      {data && data.records.length === 0 ? (
        <p className="text-content text-text-secondary">Chưa có học bạ đã được Hiệu trưởng kí.</p>
      ) : null}
      {data?.records.map((record) => (
        <div key={record.id} className="flex items-center justify-between gap-2 text-content">
          <span>
            Năm học {record.academic_year_name} · Lớp {record.class_name}
          </span>
          <Button
            onClick={() =>
              run(
                `/api/v1/learning-records/learning-records/${record.id}/file`,
                `hoc-ba-${record.academic_year_name}.pdf`,
              )
            }
          >
            Tải học bạ
          </Button>
        </div>
      ))}
      {data && data.awards.length > 0 ? (
        <ul className="flex flex-col gap-1 text-content" aria-label={`Khen thưởng của ${child.full_name}`}>
          {data.awards.map((award) => (
            <li key={award.id} className="flex items-center justify-between gap-2">
              <span>{award.title_name}</span>
              {award.lookup_code ? (
                <Button
                  onClick={() =>
                    run(`/api/v1/learning-records/awards/${award.id}/certificate`, `giay-khen-${award.lookup_code}.pdf`)
                  }
                >
                  Giấy khen
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
