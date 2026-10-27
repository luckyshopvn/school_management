import { useEffect, useState } from 'react';
import { LessonVideoList, type LessonVideo } from '@school-management/ui';
import { requestStudentJson } from './student-api.js';

// Khoá học ghi sẵn của chương trình gia sư mà học sinh được ghi danh (DT-27 phần 27d1, YCTD-254; kênh student): xem bài video
interface StudentCourse {
  program_id: string;
  program_name: string;
  course: { id: string; title: string } | null;
  videos: LessonVideo[];
}

export function StudentTutoringCourses() {
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  useEffect(() => {
    requestStudentJson<StudentCourse[]>('/api/v1/student/tutoring/courses')
      .then(setCourses)
      .catch(() => setCourses([]));
  }, []);
  if (courses.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-3" aria-label="Khoá học gia sư">
      <h2 className="text-section-title font-semibold">Khoá học gia sư</h2>
      {courses.map((row) => (
        <LessonVideoList
          key={row.program_id}
          title={row.course?.title ?? row.program_name}
          videos={row.videos}
          onView={async (activityId) =>
            (
              await requestStudentJson<{ url: string }>(`/api/v1/student/tutoring/course-media/${activityId}/link`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: '{}',
              })
            ).url
          }
        />
      ))}
    </section>
  );
}
