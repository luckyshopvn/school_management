import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, StatusBadge, type StatusTone } from '@school-management/ui';
import { StudentAssignmentView } from './StudentAssignmentView.js';
import { StudentSpaceDiscussions } from './StudentDiscussions.js';
import { ScormPlayer } from './ScormPlayer.js';
import { fetchStudentFile, requestStudentJson, StudentApiError } from './student-api.js';
import { RecognitionList, type RecognitionView } from '../screens/RecognitionList.js';

// Học sinh tự học ở lớp học trực tuyến (DT-28 phần 28b, YCTD-272, sau khi 23a gộp kênh student): các lớp đã mở cho em, hoạt
// động đã giao kèm hạn, trạng thái, lý do còn khóa; mở hoạt động thì máy chủ ghi đã xem (hoạt động "xem xong" thì hoàn thành);
// nội quy dạy học trực tuyến (Thông tư 09/2021/TT-BGDĐT Điều 15) để em xác nhận đã đọc. Nội dung trang hiện dạng chữ thuần
interface ActivityView {
  id: string;
  kind: string;
  kind_label: string;
  title: string;
  lesson_label: string | null;
  instructions: string | null;
  due_at: string | null;
  open: boolean;
  locked_reasons: string[];
  status: string;
}

interface StudentLearning {
  rules: { id: string; version: number; content: string; acknowledged_at: string | null } | null;
  spaces: Array<{
    id: string;
    title: string;
    summary: { required: number; done: number; overdue: number; percent: number };
    sections: Array<{ id: string; title: string; activities: ActivityView[] }>;
  }>;
}

interface OpenedActivity {
  id: string;
  title: string;
  instructions: string | null;
  body: string | null;
  url: string | null;
  resource: { id: string; title: string; description: string | null } | null;
}

const NOT_STARTED = { label: 'Chưa làm', tone: 'neutral' as StatusTone };
const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  not_started: NOT_STARTED,
  in_progress: { label: 'Đang làm', tone: 'warning' },
  completed: { label: 'Hoàn thành', tone: 'success' },
  passed: { label: 'Đạt', tone: 'success' },
  failed: { label: 'Chưa đạt', tone: 'danger' },
  excused: { label: 'Được miễn', tone: 'info' },
};

const messageOf = (error: unknown) =>
  error instanceof StudentApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';

const formatTime = (iso: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(iso),
  );

function ActivityContent({ activity, onClose }: { activity: OpenedActivity; onClose(): void }) {
  return (
    <section
      aria-label={`Nội dung ${activity.title}`}
      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
    >
      <h3 className="text-body font-semibold text-text">{activity.title}</h3>
      {activity.instructions ? <p className="text-label text-text-secondary">{activity.instructions}</p> : null}
      {activity.body ? <p className="whitespace-pre-wrap text-body text-text">{activity.body}</p> : null}
      {activity.url ? (
        <a className="text-body text-primary underline" href={activity.url} target="_blank" rel="noopener noreferrer">
          Mở liên kết
        </a>
      ) : null}
      {activity.resource ? (
        <p className="text-body text-text">
          Học liệu: <strong>{activity.resource.title}</strong>
          {activity.resource.description ? ` · ${activity.resource.description}` : ''}
        </p>
      ) : null}
      <Button onClick={onClose}>Đóng</Button>
    </section>
  );
}

export function StudentLearningPanel() {
  const [data, setData] = useState<StudentLearning>();
  const [opened, setOpened] = useState<OpenedActivity>();
  // Bài tập trực tuyến (DT-28 phần 28c) mở màn hình làm bài
  const [assignmentId, setAssignmentId] = useState<string>();
  // Thông báo lớp, diễn đàn, hỏi đáp (DT-28 phần 28e)
  const [discussion, setDiscussion] = useState<{ id: string; title: string }>();
  // Gói bài giảng SCORM (DT-28 phần 28h) mở trình phát trong khung cô lập
  const [scorm, setScorm] = useState<{ id: string; title: string }>();
  const [errorMessage, setErrorMessage] = useState<string>();

  // Huy hiệu, chứng nhận của em (DT-28 phần 28i)
  const loadRecognition = useCallback(() => requestStudentJson<RecognitionView>('/api/v1/student/recognition'), []);
  const downloadCertificate = useCallback(
    (certificateId: string) => fetchStudentFile(`/api/v1/student/recognition/certificates/${certificateId}/pdf`),
    [],
  );
  const load = useCallback(() => {
    requestStudentJson<StudentLearning>('/api/v1/student/learning')
      .then(setData)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, []);
  useEffect(load, [load]);

  async function open(activity: ActivityView) {
    try {
      setErrorMessage(undefined);
      const content = await requestStudentJson<OpenedActivity>(
        `/api/v1/student/learning/activities/${activity.id}/open`,
        {
          method: 'POST',
          body: '{}',
        },
      );
      if (activity.kind === 'assignment') {
        setAssignmentId(activity.id);
      } else if (activity.kind === 'scorm') {
        setScorm({ id: activity.id, title: activity.title });
      } else {
        setOpened(content);
      }
      load();
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  }

  async function acknowledge() {
    try {
      await requestStudentJson('/api/v1/student/learning/rules/acknowledge', { method: 'POST', body: '{}' });
      load();
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  }

  return (
    <section aria-label="Học trực tuyến" className="flex flex-col gap-3">
      <h2 className="text-label font-semibold text-text">Học trực tuyến</h2>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {data?.rules && !data.rules.acknowledged_at ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
          <h3 className="text-body font-semibold text-text">Nội quy học trực tuyến (bản {data.rules.version})</h3>
          <p className="whitespace-pre-wrap text-label text-text">{data.rules.content}</p>
          <Button onClick={() => void acknowledge()}>Em đã đọc nội quy</Button>
        </div>
      ) : null}
      {opened ? <ActivityContent activity={opened} onClose={() => setOpened(undefined)} /> : null}
      {scorm ? (
        <ScormPlayer
          activityId={scorm.id}
          title={scorm.title}
          onClose={() => {
            setScorm(undefined);
            load();
          }}
        />
      ) : null}
      {discussion ? (
        <StudentSpaceDiscussions
          spaceId={discussion.id}
          title={discussion.title}
          onClose={() => setDiscussion(undefined)}
        />
      ) : null}
      {assignmentId ? (
        <StudentAssignmentView
          activityId={assignmentId}
          onClose={() => {
            setAssignmentId(undefined);
            load();
          }}
        />
      ) : null}
      <RecognitionList label="Huy hiệu, chứng nhận của em" load={loadRecognition} download={downloadCertificate} />
      {data?.spaces.length === 0 ? <Alert tone="info">Hiện chưa có lớp học trực tuyến nào mở cho em.</Alert> : null}
      {data?.spaces.map((space) => (
        <article
          key={space.id}
          aria-label={space.title}
          className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <h3 className="text-body font-semibold text-text">{space.title}</h3>
          <div>
            <Button
              variant="secondary"
              aria-label={`Thảo luận ${space.title}`}
              onClick={() => setDiscussion({ id: space.id, title: space.title })}
            >
              Thông báo, thảo luận, hỏi đáp
            </Button>
          </div>
          <p className="text-label text-text-secondary">
            Đã xong {space.summary.done}/{space.summary.required} hoạt động bắt buộc ({space.summary.percent}%)
            {space.summary.overdue > 0 ? ` · ${space.summary.overdue} hoạt động quá hạn` : ''}
          </p>
          {space.sections.map((section) => (
            <div key={section.id} className="flex flex-col gap-1">
              <h4 className="text-label font-semibold text-text">{section.title}</h4>
              <ul className="flex flex-col gap-2">
                {section.activities.map((activity) => {
                  const status = STATUS[activity.status] ?? NOT_STARTED;
                  return (
                    <li key={activity.id} className="flex flex-wrap items-center gap-2 text-label text-text">
                      <span className="flex-1">
                        {activity.kind_label}: {activity.title}
                        {activity.due_at ? ` · hạn ${formatTime(activity.due_at)}` : ''}
                        {activity.open ? '' : ` · ${activity.locked_reasons.join('; ')}`}
                      </span>
                      <StatusBadge tone={status.tone} label={status.label} />
                      {activity.open ? (
                        <Button onClick={() => void open(activity)} aria-label={`Mở ${activity.title}`}>
                          Mở
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </article>
      ))}
    </section>
  );
}
