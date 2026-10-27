import { useEffect, useState } from 'react';
import {
  LessonCourseProgress,
  LessonVideoList,
  type LessonCourseProgressData,
  type LessonVideo,
} from '@school-management/ui';
import { requestJson } from '../session/api-client.js';

// Khoá học ghi sẵn của chương trình gia sư mà con có đơn được duyệt (DT-27 phần 27d1, YCTD-254): cha mẹ xem bài video; 27d2
// (YCTD-261): tiến độ của con trong khoá (cha mẹ xem không tính là con đã xem)
interface CourseView {
  course: { id: string; title: string } | null;
  videos: LessonVideo[];
  progress?: LessonCourseProgressData;
}

export function ChildTutoringCourses({ childId, programIds }: { childId: string; programIds: string[] }) {
  const [courses, setCourses] = useState<CourseView[]>([]);
  const key = programIds.join(',');
  useEffect(() => {
    let active = true;
    const ids = key === '' ? [] : key.split(',');
    void Promise.all(
      ids.map((programId) =>
        requestJson<CourseView>(`/api/v1/children/${childId}/tutoring/programs/${programId}/course`).catch(() => null),
      ),
    ).then((rows) => {
      if (active) {
        setCourses(rows.filter((row): row is CourseView => row !== null && row.course !== null));
      }
    });
    return () => {
      active = false;
    };
  }, [childId, key]);
  if (courses.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-3">
      {courses.map((view) => (
        <div key={view.course?.id} className="flex flex-col gap-2">
          <LessonVideoList
            title={view.course?.title ?? ''}
            videos={view.videos}
            progress={view.progress?.videos}
            onView={async (activityId) =>
              (
                await requestJson<{ url: string }>(
                  `/api/v1/children/${childId}/tutoring/course-media/${activityId}/link`,
                  { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
                )
              ).url
            }
          />
          {view.progress ? <LessonCourseProgress progress={view.progress} /> : null}
        </div>
      ))}
    </div>
  );
}
