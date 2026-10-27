import { useEffect, useRef, useState } from 'react';
import { hasLevelFeature } from '@school-management/shared';
import { Alert, ApplicationHeader, Button } from '@school-management/ui';
import { requestJson } from '../session/api-client.js';
import { ClassroomToolsScreen } from '../tools/ClassroomToolsScreen.js';
import { AttendanceScreen } from './AttendanceScreen.js';
import { ClassLogScreen } from './ClassLogScreen.js';
import type { MyClass } from './ClassesScreen.js';
import {
  currentLesson,
  vietnamClock,
  type CurrentLesson,
  type PeriodSlot,
  type TimetableLesson,
} from './classroom-mode-logic.js';

// Chế độ lớp học trên máy tính bảng, màn hình lớn (DT-26 phần 26d, YCTD-234): khung trái là các lớp (chọn sẵn lớp của tiết đang dạy theo
// thời khoá biểu), khung phải chuyển giữa điểm danh, sổ đầu bài, công cụ lớp học (dùng lại các màn hình đã có). Điện thoại và máy tính
// bảng dọc xếp hai khung trên dưới; từ 1024 px hai khung cạnh nhau. Trình chiếu: chỉ hiện công cụ lớp học, chữ to, toàn màn hình, ẩn
// danh sách lớp, điểm danh, sổ đầu bài (thông tin riêng của học sinh). Giữ màn hình sáng khi trình duyệt cho phép
type Tab = 'attendance' | 'class-log' | 'tools';

interface MyTimetable {
  slots: Record<string, PeriodSlot[]>;
  lessons: TimetableLesson[];
}

interface WakeLockSentinelLike {
  release(): Promise<void>;
}

// Giữ màn hình sáng trong chế độ lớp học (Screen Wake Lock); trình duyệt không hỗ trợ thì bỏ qua
function useWakeLock() {
  useEffect(() => {
    const wakeLock = (
      navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } }
    ).wakeLock;
    if (!wakeLock) {
      return;
    }
    let sentinel: WakeLockSentinelLike | undefined;
    let active = true;
    const acquire = () => {
      if (document.visibilityState === 'visible') {
        wakeLock
          .request('screen')
          .then((lock) => {
            if (active) {
              sentinel = lock;
            } else {
              void lock.release();
            }
          })
          .catch(() => undefined);
      }
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', acquire);
      void sentinel?.release().catch(() => undefined);
    };
  }, []);
}

const TAB_LABELS: Record<Tab, string> = {
  attendance: 'Điểm danh',
  'class-log': 'Sổ đầu bài',
  tools: 'Công cụ lớp học',
};

export function ClassroomModeScreen({ classes, onBack }: { classes: MyClass[]; onBack(): void }) {
  const [selectedId, setSelectedId] = useState(classes[0]?.id);
  const [lesson, setLesson] = useState<CurrentLesson>();
  const [tab, setTab] = useState<Tab>();
  const [presenting, setPresenting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useWakeLock();

  // Lớp của tiết đang dạy (hoặc sắp tới) theo thời khoá biểu; trường chưa có thời khoá biểu thì giữ lớp đầu
  useEffect(() => {
    requestJson<MyTimetable>('/api/v1/timetables/mine')
      .then((timetable) => {
        const found = currentLesson(
          timetable.lessons,
          Object.values(timetable.slots ?? {}).flat(),
          vietnamClock(new Date()),
        );
        setLesson(found);
        const match = found ? classes.find((item) => item.name === found.lesson.class_name) : undefined;
        if (match) {
          setSelectedId(match.id);
        }
      })
      .catch(() => setLesson(undefined));
  }, [classes]);

  // Thoát toàn màn hình bằng phím Esc thì cũng thoát trình chiếu
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) {
        setPresenting(false);
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const selected = classes.find((item) => item.id === selectedId) ?? classes[0];
  if (!selected) {
    return null;
  }
  const tabs: Tab[] = [
    ...(hasLevelFeature(selected.school_level, 'daily_attendance') ? (['attendance'] as const) : []),
    ...(classes.some((item) => hasLevelFeature(item.school_level, 'period_attendance'))
      ? (['class-log'] as const)
      : []),
    'tools',
  ];
  const activeTab = tab && tabs.includes(tab) ? tab : (tabs[0] ?? 'tools');

  const startPresenting = () => {
    setTab('tools');
    setPresenting(true);
    void rootRef.current?.requestFullscreen?.().catch(() => undefined);
  };
  const stopPresenting = () => {
    setPresenting(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
  };

  // Một phần tử gốc cho cả hai trạng thái để toàn màn hình không bị thoát khi đổi nội dung
  return (
    <div ref={rootRef} className={presenting ? 'min-h-screen bg-card' : 'min-h-screen'}>
      {presenting ? (
        <div aria-label="Trình chiếu công cụ lớp học">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="text-section-title font-semibold text-text">{selected.name}</p>
            <Button onClick={stopPresenting}>Thoát trình chiếu</Button>
          </div>
          {/* Chữ và nút to gấp rưỡi để đọc được từ cuối lớp */}
          <div className="px-4 pb-6" style={{ zoom: 1.5 }}>
            <ClassroomToolsScreen classes={[selected]} initialClassId={selected.id} embedded />
          </div>
        </div>
      ) : (
        <>
          <ApplicationHeader title="Chế độ lớp học" />
          <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl lg:grid lg:max-w-none lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
            <nav aria-label="Lớp của tiết" className="flex flex-col gap-3 lg:sticky lg:top-4">
              <div>
                <Button variant="text" onClick={onBack}>
                  Lớp của tôi
                </Button>
              </div>
              {lesson ? (
                <Alert tone="info">
                  {lesson.when === 'now' ? 'Đang dạy' : 'Tiết tới'}: tiết {lesson.lesson.period_no} (
                  {lesson.slot.start_time}–{lesson.slot.end_time}) {lesson.lesson.subject_name}, lớp{' '}
                  {lesson.lesson.class_name}
                </Alert>
              ) : null}
              <ul className="flex flex-col gap-2 md:grid md:grid-cols-2 lg:flex">
                {classes.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={item.id === selected.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full rounded-xl border p-3 text-left text-content font-medium ${
                        item.id === selected.id
                          ? 'border-brand bg-selected text-text'
                          : 'border-border bg-card text-text'
                      }`}
                    >
                      {item.name}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            <section aria-label={`Lớp ${selected.name}`} className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <div role="tablist" aria-label="Việc trên lớp" className="flex flex-wrap gap-2">
                  {tabs.map((item) => (
                    <button
                      key={item}
                      type="button"
                      role="tab"
                      aria-selected={item === activeTab}
                      onClick={() => setTab(item)}
                      className={`rounded-lg px-4 py-2 text-label font-medium ${
                        item === activeTab
                          ? 'bg-brand-strong text-white'
                          : 'border border-border-strong bg-card text-text'
                      }`}
                    >
                      {TAB_LABELS[item]}
                    </button>
                  ))}
                </div>
                <Button className="ml-auto" onClick={startPresenting}>
                  Trình chiếu
                </Button>
              </div>
              <div role="tabpanel" aria-label={TAB_LABELS[activeTab]}>
                {activeTab === 'attendance' ? (
                  <AttendanceScreen key={selected.id} myClass={selected} onBack={onBack} embedded />
                ) : null}
                {activeTab === 'class-log' ? <ClassLogScreen onBack={onBack} embedded /> : null}
                {activeTab === 'tools' ? (
                  <ClassroomToolsScreen key={selected.id} classes={classes} initialClassId={selected.id} embedded />
                ) : null}
              </div>
            </section>
          </main>
        </>
      )}
    </div>
  );
}
