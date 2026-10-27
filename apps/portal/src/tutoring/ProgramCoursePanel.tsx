import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, LessonVideoList, type LessonVideo } from '@school-management/ui';
import { requestJson } from '../session/api-client.js';
import { messageOf } from './TutoringProgramsPage.js';

// Khoá học ghi sẵn của chương trình gia sư (DT-27 phần 27d1, YCTD-254): giáo viên dạy, Ban Giám hiệu tạo khoá (khoá tự chọn của lõi
// LMS 28b, soạn chương và bài ở Học trực tuyến), học sinh có đơn được duyệt được ghi danh; xem bài video. Tiến độ ở 27d2
interface CourseView {
  course: { id: string; title: string; enrolled: number } | null;
  videos: LessonVideo[];
}

const post = <T,>(path: string) =>
  requestJson<T>(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });

export function ProgramCoursePanel({ programId, notify }: { programId: string; notify: (text: string) => void }) {
  const queryClient = useQueryClient();
  const view = useQuery({
    queryKey: ['tutoring-course', programId],
    queryFn: () => requestJson<CourseView>(`/api/v1/tutoring/programs/${programId}/course`),
  });
  const attach = useMutation({
    mutationFn: () => post<CourseView>(`/api/v1/tutoring/programs/${programId}/course`),
    onSuccess: async () => {
      notify('Đã tạo khoá học ghi sẵn');
      await queryClient.invalidateQueries({ queryKey: ['tutoring-course', programId] });
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
        </>
      ) : (
        <Button onClick={() => attach.mutate()} disabled={attach.isPending}>
          Tạo khoá học ghi sẵn
        </Button>
      )}
    </section>
  );
}
