import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge } from '@school-management/ui';
import { ApiError, fetchWithSession, requestJson } from '../session/api-client.js';

// Huy hiệu, chứng nhận của lớp học trực tuyến (DT-28 phần 28i, YCTD-279): mỗi học sinh (xếp theo tên, không xếp hạng, không đếm)
// với huy hiệu đã có; giáo viên trao huy hiệu kèm lý do, thu hồi; khoá tự chọn có cột hoàn thành, cấp, tải, thu hồi chứng nhận.
// Trường chưa bật thì hiện dòng giải thích
interface Badge {
  id: string;
  kind: string;
  title: string;
  reason: string | null;
  awarded_by_name: string | null;
}

interface Certificate {
  id: string;
  code: string;
  issued_at: string;
}

interface Recognition {
  badges_enabled: boolean;
  certificates_enabled: boolean;
  can_teach: boolean;
  students: Array<{
    child_id: string;
    full_name: string;
    completed: boolean;
    badges: Badge[];
    certificate: Certificate | null;
  }>;
}

const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ';
const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });

export function RecognitionScreen({ spaceId, title, onBack }: { spaceId: string; title: string; onBack(): void }) {
  const [data, setData] = useState<Recognition>();
  const [awardFor, setAwardFor] = useState<string>();
  const [badgeTitle, setBadgeTitle] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const load = useCallback(() => {
    requestJson<Recognition>(`/api/v1/learning/spaces/${spaceId}/recognition`)
      .then(setData)
      .catch((error: unknown) => setMessage({ tone: 'danger', text: messageOf(error) }));
  }, [spaceId]);
  useEffect(load, [load]);
  const run = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      setMessage({ tone: 'success', text: done });
      load();
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    }
  };
  const download = async (certificate: Certificate) => {
    try {
      const response = await fetchWithSession(`/api/v1/learning/certificates/${certificate.id}/pdf`);
      if (!response.ok) throw new Error('Không tải được chứng nhận');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(await response.blob());
      link.download = `chung-nhan-${certificate.code.toLowerCase()}.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    }
  };
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl">
      <div>
        <Button variant="text" onClick={onBack}>
          Quay lại
        </Button>
      </div>
      <h1 className="text-page-title font-bold text-text">Huy hiệu, chứng nhận · {title}</h1>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {data && !data.badges_enabled && !data.certificates_enabled ? (
        <Alert tone="info">Trường chưa bật huy hiệu và chứng nhận (Ban Giám hiệu bật ở cổng quản trị).</Alert>
      ) : null}
      <ul className="flex flex-col gap-2" aria-label="Học sinh và huy hiệu">
        {(data?.students ?? []).map((student) => (
          <li
            key={student.child_id}
            aria-label={student.full_name}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-1 text-content font-semibold">{student.full_name}</span>
              {data?.certificates_enabled ? (
                <StatusBadge
                  tone={student.completed ? 'success' : 'neutral'}
                  label={student.completed ? 'Đã hoàn thành khoá' : 'Chưa hoàn thành'}
                />
              ) : null}
            </div>
            {data?.badges_enabled ? (
              <ul className="flex flex-wrap gap-2 text-label">
                {student.badges.map((badge) => (
                  <li key={badge.id} className="flex items-center gap-1 rounded-full border border-border px-2 py-1">
                    <span>{badge.title}</span>
                    {badge.reason ? <span className="text-text-secondary">({badge.reason})</span> : null}
                    {data.can_teach ? (
                      <Button
                        variant="text"
                        aria-label={`Thu hồi huy hiệu ${badge.title} của ${student.full_name}`}
                        onClick={() =>
                          void run(
                            () =>
                              requestJson(
                                `/api/v1/learning/badges/${badge.id}`,
                                json('DELETE', { reason: 'Giáo viên thu hồi' }),
                              ),
                            `Đã thu hồi huy hiệu ${badge.title}`,
                          )
                        }
                      >
                        Thu hồi
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {data?.can_teach ? (
              <div className="flex flex-wrap gap-2">
                {data.badges_enabled ? (
                  <Button
                    variant="secondary"
                    onClick={() => setAwardFor(awardFor === student.child_id ? undefined : student.child_id)}
                  >
                    Trao huy hiệu
                  </Button>
                ) : null}
                {data.certificates_enabled && student.completed && !student.certificate ? (
                  <Button
                    variant="primary"
                    onClick={() =>
                      void run(
                        () =>
                          requestJson(
                            `/api/v1/learning/spaces/${spaceId}/certificates`,
                            json('POST', { child_id: student.child_id }),
                          ),
                        `Đã cấp chứng nhận cho ${student.full_name}`,
                      )
                    }
                  >
                    Cấp chứng nhận
                  </Button>
                ) : null}
                {student.certificate ? (
                  <>
                    <span className="text-label text-text-secondary">Chứng nhận {student.certificate.code}</span>
                    <Button variant="text" onClick={() => void download(student.certificate as Certificate)}>
                      Tải chứng nhận
                    </Button>
                  </>
                ) : null}
              </div>
            ) : null}
            {awardFor === student.child_id ? (
              <form
                aria-label={`Trao huy hiệu cho ${student.full_name}`}
                className="flex flex-col gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    await requestJson(
                      `/api/v1/learning/spaces/${spaceId}/badges`,
                      json('POST', { child_id: student.child_id, title: badgeTitle, reason }),
                    );
                    setAwardFor(undefined);
                    setBadgeTitle('');
                    setReason('');
                  }, `Đã trao huy hiệu cho ${student.full_name}`);
                }}
              >
                <label className="text-label font-medium text-text">
                  Tên huy hiệu
                  <input
                    className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
                    value={badgeTitle}
                    onChange={(event) => setBadgeTitle(event.target.value)}
                  />
                </label>
                <label className="text-label font-medium text-text">
                  Lý do
                  <textarea
                    className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
                <div>
                  <Button type="submit" variant="primary" disabled={!badgeTitle.trim() || !reason.trim()}>
                    Trao
                  </Button>
                </div>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
