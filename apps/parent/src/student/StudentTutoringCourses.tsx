import { useCallback, useEffect, useState } from 'react';
import {
  LessonCourseProgress,
  LessonVideoList,
  type LessonCourseProgressData,
  type LessonVideo,
} from '@school-management/ui';
import { requestStudentJson } from './student-api.js';

// Khoá học ghi sẵn của chương trình gia sư mà học sinh được ghi danh (DT-27 phần 27d1, YCTD-254; kênh student): xem bài video. 27d2
// (YCTD-261): tiến độ của em, trình phát báo phần trăm đã xem
interface StudentCourse {
  program_id: string;
  program_name: string;
  course: { id: string; title: string } | null;
  videos: LessonVideo[];
  progress?: LessonCourseProgressData;
}

const post = <T,>(path: string, body: unknown = {}) =>
  requestStudentJson<T>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

export function StudentTutoringCourses() {
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const load = useCallback(() => {
    requestStudentJson<StudentCourse[]>('/api/v1/student/tutoring/courses')
      .then(setCourses)
      .catch(() => setCourses([]));
  }, []);
  useEffect(load, [load]);
  if (courses.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-3" aria-label="Khoá học gia sư">
      <h2 className="text-section-title font-semibold">Khoá học gia sư</h2>
      {courses.map((row) => (
        <div key={row.program_id} className="flex flex-col gap-2">
          <LessonVideoList
            title={row.course?.title ?? row.program_name}
            videos={row.videos}
            progress={row.progress?.videos}
            onView={async (activityId) =>
              (await post<{ url: string }>(`/api/v1/student/tutoring/course-media/${activityId}/link`)).url
            }
            onProgress={async (activityId, percent) => {
              const result = await post<{ status: string }>(
                `/api/v1/student/tutoring/course-media/${activityId}/progress`,
                { percent },
              );
              if (result.status === 'completed') {
                load();
              }
            }}
          />
          {row.progress ? <LessonCourseProgress progress={row.progress} /> : null}
        </div>
      ))}
    </section>
  );
}
