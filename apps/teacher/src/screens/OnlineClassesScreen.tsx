import { useCallback, useEffect, useState } from 'react';
import { Alert, ApplicationHeader, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Lớp học trực tuyến của tôi (DT-28 phần 28b, YCTD-272): lớp học trực tuyến theo lớp, môn tự có từ phân công giảng dạy;
// giáo viên mở lớp cho học sinh, giao hoạt động, thêm nhanh một trang nội dung vào chương, xem tiến độ. Soạn đầy đủ (liên
// kết, học liệu, điều kiện mở, khoá mẫu) ở cổng quản trị, mục 9. Học tập trực tuyến
interface SpaceSummary {
  id: string;
  title: string;
  visible_to_students: boolean;
  activity_count: number;
}

interface SpaceDetail {
  space: SpaceSummary;
  can_teach: boolean;
  student_count: number;
  sections: Array<{ id: string; title: string }>;
  activities: Array<{
    id: string;
    section_id: string;
    title: string;
    kind_label: string;
    status: 'draft' | 'published';
  }>;
}

interface Progress {
  students: Array<{
    child_id: string;
    full_name: string;
    summary: { done: number; required: number; overdue: number };
  }>;
}

const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ');
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });

function SpaceView({ spaceId, onBack }: { spaceId: string; onBack(): void }) {
  const [detail, setDetail] = useState<SpaceDetail>();
  const [progress, setProgress] = useState<Progress>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const load = useCallback(() => {
    requestJson<SpaceDetail>(`/api/v1/learning/spaces/${spaceId}`)
      .then(setDetail)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
    requestJson<Progress>(`/api/v1/learning/spaces/${spaceId}/progress`)
      .then(setProgress)
      .catch(() => setProgress(undefined));
  }, [spaceId]);
  useEffect(load, [load]);
  const run = async (action: () => Promise<unknown>) => {
    setErrorMessage(undefined);
    try {
      await action();
      load();
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };
  const firstSection = detail?.sections[0];
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl">
      <div>
        <Button variant="text" onClick={onBack}>
          Quay lại
        </Button>
      </div>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {detail ? (
        <>
          <h1 className="text-page-title font-bold text-text">{detail.space.title}</h1>
          <p className="text-label text-text-secondary">{detail.student_count} học sinh</p>
          {detail.can_teach ? (
            <Button
              variant="primary"
              onClick={() =>
                void run(() =>
                  requestJson(`/api/v1/learning/spaces/${spaceId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ visible_to_students: !detail.space.visible_to_students }),
                  }),
                )
              }
            >
              {detail.space.visible_to_students ? 'Ẩn lớp với học sinh' : 'Mở lớp cho học sinh'}
            </Button>
          ) : null}
          {detail.sections.map((section) => (
            <section key={section.id} className="flex flex-col gap-2" aria-label={section.title}>
              <h2 className="text-section-title font-semibold text-text">{section.title}</h2>
              {detail.activities
                .filter((activity) => activity.section_id === section.id)
                .map((activity) => (
                  <div key={activity.id} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
                    <span className="text-content font-semibold">{activity.title}</span>
                    <span className="text-label text-text-secondary">
                      {activity.kind_label} · {activity.status === 'published' ? 'Đã giao' : 'Nháp'}
                    </span>
                    {detail.can_teach ? (
                      <div>
                        <Button
                          variant="text"
                          onClick={() =>
                            void run(() =>
                              requestJson(
                                `/api/v1/learning/activities/${activity.id}/publish`,
                                post({ published: activity.status !== 'published' }),
                              ),
                            )
                          }
                        >
                          {activity.status === 'published' ? 'Chuyển về nháp' : 'Giao cho học sinh'}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
            </section>
          ))}
          {detail.sections.length === 0 ? (
            <p className="text-content text-text-secondary">Chưa có chương nào. Thêm chương ở cổng quản trị.</p>
          ) : null}
          {detail.can_teach && firstSection ? (
            <form
              aria-label="Thêm trang nội dung"
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  await requestJson(
                    `/api/v1/learning/spaces/${spaceId}/activities`,
                    post({ section_id: firstSection.id, kind: 'page', title, settings: { body } }),
                  );
                  setTitle('');
                  setBody('');
                });
              }}
            >
              <h2 className="text-section-title font-semibold text-text">
                Thêm trang nội dung vào {firstSection.title}
              </h2>
              <label className="text-label font-medium text-text">
                Tên trang
                <input
                  className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label className="text-label font-medium text-text">
                Nội dung
                <textarea
                  className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
                  rows={4}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                />
              </label>
              <div>
                <Button type="submit" disabled={!title || !body}>
                  Thêm trang
                </Button>
              </div>
            </form>
          ) : null}
          {progress ? (
            <section className="flex flex-col gap-1" aria-label="Tiến độ học sinh">
              <h2 className="text-section-title font-semibold text-text">Tiến độ học sinh</h2>
              <ul className="flex flex-col gap-1 text-content">
                {progress.students.map((student) => (
                  <li key={student.child_id} className="rounded-lg border border-border bg-card p-3">
                    {student.full_name}: {student.summary.done}/{student.summary.required} hoạt động
                    {student.summary.overdue > 0 ? `, quá hạn ${student.summary.overdue}` : ''}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}

export function OnlineClassesScreen({ onBack }: { onBack(): void }) {
  const [spaces, setSpaces] = useState<SpaceSummary[]>();
  const [openId, setOpenId] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  useEffect(() => {
    if (openId) {
      return;
    }
    requestJson<SpaceSummary[]>('/api/v1/learning/spaces')
      .then(setSpaces)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, [openId]);
  return (
    <div className="min-h-screen">
      <ApplicationHeader title="Lớp học trực tuyến" />
      {openId ? (
        <SpaceView spaceId={openId} onBack={() => setOpenId(undefined)} />
      ) : (
        <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl">
          <div>
            <Button variant="text" onClick={onBack}>
              Quay lại
            </Button>
          </div>
          <h1 className="text-page-title font-bold text-text">Lớp học trực tuyến của tôi</h1>
          {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
          {spaces && spaces.length === 0 ? (
            <p className="text-content text-text-secondary">
              Chưa có lớp học trực tuyến. Lớp tự có khi bạn được phân công dạy môn.
            </p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {(spaces ?? []).map((space) => (
              <li key={space.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(space.id)}
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left"
                >
                  <span className="text-content font-semibold">{space.title}</span>
                  <span className="text-label text-text-secondary">
                    {space.activity_count} hoạt động · {space.visible_to_students ? 'Đã mở' : 'Đang ẩn'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </main>
      )}
    </div>
  );
}
