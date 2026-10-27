import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, LessonVideoList, type LessonVideo } from '@school-management/ui';
import { requestJson } from '../session/api-client.js';
import { messageOf } from './TutoringProgramsPage.js';

// Khoá học ghi sẵn của chương trình gia sư (DT-27 phần 27d1, YCTD-254): giáo viên dạy, Ban Giám hiệu tạo khoá (khoá tự chọn của lõi
// LMS 28b, soạn chương và bài ở Học trực tuyến), học sinh có đơn được duyệt được ghi danh; xem bài video. 27d2 (YCTD-261): tiến độ
// từng học sinh (hoạt động bắt buộc xong, quá hạn, phần trăm đã xem từng video)
interface CourseView {
  course: { id: string; title: string; enrolled: number } | null;
  videos: LessonVideo[];
}

interface ProgressView {
  videos: Array<{ activity_id: string; title: string }>;
  students: Array<{
    child_id: string;
    full_name: string;
    summary: { required: number; done: number; overdue: number; percent: number };
    videos: Record<string, { status: string; progress: number }>;
  }>;
}

const DONE = new Set(['completed', 'passed', 'excused']);

const post = <T,>(path: string) =>
  requestJson<T>(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });

export function ProgramCoursePanel({ programId, notify }: { programId: string; notify: (text: string) => void }) {
  const queryClient = useQueryClient();
  const view = useQuery({
    queryKey: ['tutoring-course', programId],
    queryFn: () => requestJson<CourseView>(`/api/v1/tutoring/programs/${programId}/course`),
  });
  const progress = useQuery({
    queryKey: ['tutoring-course-progress', programId],
    queryFn: () => requestJson<ProgressView>(`/api/v1/tutoring/programs/${programId}/course/progress`),
    enabled: Boolean(view.data?.course),
  });
  const attach = useMutation({
    mutationFn: () => post<CourseView>(`/api/v1/tutoring/programs/${programId}/course`),
    onSuccess: async () => {
      notify('Đã tạo khoá học ghi sẵn');
      await queryClient.invalidateQueries({ queryKey: ['tutoring-course', programId] });
      await queryClient.invalidateQueries({ queryKey: ['tutoring-course-progress', programId] });
    },
  });
  if (!view.data) {
    return view.error ? <Alert tone="danger">{messageOf(view.error)}</Alert> : null;
  }
  return (
    <section aria-label="Khoá học ghi sẵn của chương trình" className="flex flex-col gap-2">
      <h3 className="font-semibold">Khoá học ghi sẵn</h3>
      {attach.error ? <Alert tone="danger">{messageOf(attach.error)}</Alert> : null}
      {view.data.course ? (
        <>
          <p className="text-label text-text-secondary">
            {view.data.course.enrolled} học sinh được ghi danh theo đơn đã duyệt. Soạn chương và bài (video từ kho học
            liệu) ở Học trực tuyến, khoá &quot;{view.data.course.title}&quot;.
          </p>
          <LessonVideoList
            title={view.data.course.title}
            videos={view.data.videos}
            onView={async (activityId) =>
              (await post<{ url: string }>(`/api/v1/tutoring/course-media/${activityId}/link`)).url
            }
          />
          {progress.error ? <Alert tone="danger">{messageOf(progress.error)}</Alert> : null}
          {progress.data && progress.data.students.length > 0 ? (
            <table aria-label="Tiến độ học sinh của khoá" className="w-full text-content">
              <thead>
                <tr className="text-left text-text-secondary">
                  <th>Học sinh</th>
                  <th>Hoạt động bắt buộc</th>
                  <th>Quá hạn</th>
                  {progress.data.videos.map((video) => (
                    <th key={video.activity_id}>{video.title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {progress.data.students.map((student) => (
                  <tr key={student.child_id}>
                    <td>{student.full_name}</td>
                    <td>
                      {student.summary.done}/{student.summary.required} ({student.summary.percent}%)
                    </td>
                    <td>{student.summary.overdue}</td>
                    {progress.data.videos.map((video) => {
                      const watched = student.videos[video.activity_id];
                      return (
                        <td key={video.activity_id}>
                          {watched && DONE.has(watched.status) ? 'Xem xong' : `${watched?.progress ?? 0}%`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </>
      ) : (
        <Button onClick={() => attach.mutate()} disabled={attach.isPending}>
          Tạo khoá học ghi sẵn
        </Button>
      )}
    </section>
  );
}
