import { useEffect, useState } from 'react';
import { hasLevelFeature, levelOf, SCHOOL_LEVELS, schoolLevelTerms } from '@school-management/shared';
import { Alert, ApplicationHeader, Button } from '@school-management/ui';
import { ApiError, fetchCurrentUser, requestJson } from '../session/api-client.js';
import { useSession } from '../session/session.js';
import { CheckInCard } from './CheckInCard.js';
import { NotificationsPanel } from './NotificationsPanel.js';

// MG-01 Lớp của tôi hôm nay: các lớp đang được phân công (YCTD-44); bảo vệ mở xác nhận người đón tại cổng (MG-16)
export interface MyClass {
  id: string;
  name: string;
  org_unit_id: string;
  enrolled_count: number;
  staff: Array<{ staff_user_id: string; assignment_role: 'homeroom' | 'subject' }>;
  // Cấp của lớp (DT-19 phần 19e); máy chủ cũ không trả là Mầm non
  school_level?: string;
}

// Giáo viên dạy, chủ nhiệm lớp ở nhiều cấp thấy lớp xếp theo cấp, có tên cấp; mỗi lớp chỉ có chức năng của cấp mình: điểm
// danh theo ngày, nhật ký, chăm sóc hằng ngày, báo cơm là nghiệp vụ Mầm non nên chỉ ở lớp Mầm non (DT-19 phần 19e)
function levelLabel(level: unknown): string {
  const code = levelOf(level);
  return SCHOOL_LEVELS.find((item) => item.value === code)?.label ?? code;
}

function ClassSummary({ myClass, showLevel }: { myClass: MyClass; showLevel: boolean }) {
  const learner = schoolLevelTerms([{ code: levelOf(myClass.school_level) }]).learner.toLocaleLowerCase('vi');
  return (
    <>
      <span className="text-content font-semibold">
        {myClass.name}
        {showLevel ? (
          <span className="ml-2 text-label text-text-secondary">{levelLabel(myClass.school_level)}</span>
        ) : null}
      </span>
      <span className="text-label text-text-secondary">
        {myClass.enrolled_count} {learner}
      </span>
    </>
  );
}

export function ClassesScreen({
  onOpen,
  onOpenPickup,
  onOpenJournal,
  onOpenCare,
  onOpenTeaching,
  onOpenMessages,
  onOpenActivity,
  onOpenMealReport,
  onOpenBoarding,
  onOpenAssessment,
  onOpenScores,
  onOpenMedication,
  onOpenGate,
  onOpenLeave,
  onOpenPayslips,
  onOpenWork,
  onOpenStocktake,
  onOpenTimetable,
  onOpenClassLog,
}: {
  onOpen(myClass: MyClass): void;
  onOpenPickup(myClass: MyClass): void;
  onOpenJournal(myClass: MyClass): void;
  onOpenCare(myClass: MyClass): void;
  onOpenTeaching(myClass: MyClass): void;
  onOpenMessages(myClass: MyClass): void;
  onOpenActivity(myClass: MyClass): void;
  onOpenMealReport(myClass: MyClass): void;
  onOpenBoarding(myClass: MyClass): void;
  onOpenAssessment(myClass: MyClass): void;
  onOpenScores(myClass: MyClass): void;
  onOpenMedication(myClass: MyClass): void;
  onOpenGate(orgUnitIds: string[]): void;
  onOpenLeave(): void;
  onOpenPayslips(): void;
  onOpenWork(): void;
  onOpenStocktake(): void;
  onOpenTimetable(): void;
  onOpenClassLog(): void;
}) {
  const session = useSession();
  const [classes, setClasses] = useState<MyClass[]>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [gateUnitIds, setGateUnitIds] = useState<string[]>([]);
  // Quét QR kiểm kê thiết bị (DT-18 phần 18g)
  const [canStocktake, setCanStocktake] = useState(false);

  useEffect(() => {
    fetchCurrentUser()
      .then((user) => {
        setGateUnitIds(
          user.assignments
            .filter((assignment) => assignment.permissions.includes('P04.pickup.gate-confirm'))
            .map((assignment) => assignment.org_unit_id)
            .filter((id): id is string => id !== null),
        );
        setCanStocktake(
          user.assignments.some((assignment) => assignment.permissions.includes('P13.equipment.stocktake')),
        );
      })
      .catch(() => setGateUnitIds([]));
    requestJson<MyClass[]>('/api/v1/classes?mine=true&status=active')
      .then(setClasses)
      .catch((error: unknown) =>
        setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ'),
      );
  }, []);

  const levels = new Set((classes ?? []).map((myClass) => levelOf(myClass.school_level)));
  const multiLevel = levels.size > 1;
  // Trường nhiều cấp: lớp xếp theo thứ tự cấp, giữ thứ tự máy chủ trả trong cùng cấp
  const order = (myClass: MyClass) => SCHOOL_LEVELS.findIndex((item) => item.value === levelOf(myClass.school_level));
  const sortedClasses = multiLevel
    ? [...(classes ?? [])].sort((left, right) => order(left) - order(right))
    : (classes ?? []);

  return (
    <div className="min-h-screen">
      <ApplicationHeader title="Ứng dụng giáo viên" />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        <NotificationsPanel />
        <CheckInCard onOpenLeave={onOpenLeave} onOpenPayslips={onOpenPayslips} onOpenWork={onOpenWork} />
        <h1 className="text-page-title font-bold text-text">Lớp của tôi</h1>
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        {gateUnitIds.length > 0 ? (
          <Button variant="primary" onClick={() => onOpenGate(gateUnitIds)}>
            Xác nhận người đón tại cổng
          </Button>
        ) : null}
        {canStocktake ? <Button onClick={onOpenStocktake}>Kiểm kê thiết bị</Button> : null}
        {/* Lịch dạy theo thời khoá biểu (DT-20 phần 22c1): giáo viên có lớp cấp phổ thông */}
        {(classes ?? []).some((myClass) => hasLevelFeature(myClass.school_level, 'period_timetable')) ? (
          <Button onClick={onOpenTimetable}>Lịch dạy của tôi</Button>
        ) : null}
        {/* Sổ đầu bài, điểm danh theo tiết (DT-20 phần 20d) */}
        {(classes ?? []).some((myClass) => hasLevelFeature(myClass.school_level, 'period_attendance')) ? (
          <Button onClick={onOpenClassLog}>Sổ đầu bài</Button>
        ) : null}
        {classes && classes.length === 0 && gateUnitIds.length === 0 ? (
          <p className="text-content text-text-secondary">Bạn chưa được phân công lớp nào.</p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {sortedClasses.map((myClass) => (
            <li key={myClass.id} className="flex flex-col gap-1">
              {hasLevelFeature(myClass.school_level, 'daily_attendance') ? (
                <button
                  type="button"
                  onClick={() => onOpen(myClass)}
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left"
                >
                  <ClassSummary myClass={myClass} showLevel={multiLevel} />
                </button>
              ) : (
                <div className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4">
                  <ClassSummary myClass={myClass} showLevel={multiLevel} />
                </div>
              )}
              <Button aria-label={`Đón trả lớp ${myClass.name}`} onClick={() => onOpenPickup(myClass)}>
                Đón trả
              </Button>
              {hasLevelFeature(myClass.school_level, 'daily_journal') ? (
                <Button aria-label={`Nhật ký lớp ${myClass.name}`} onClick={() => onOpenJournal(myClass)}>
                  Nhật ký
                </Button>
              ) : null}
              {hasLevelFeature(myClass.school_level, 'daily_care') ? (
                <Button aria-label={`Chăm sóc lớp ${myClass.name}`} onClick={() => onOpenCare(myClass)}>
                  Chăm sóc và y tế
                </Button>
              ) : null}
              <Button aria-label={`Trao đổi lớp ${myClass.name}`} onClick={() => onOpenMessages(myClass)}>
                Trao đổi và đồ bị mất
              </Button>
              <Button aria-label={`Hoạt động lớp ${myClass.name}`} onClick={() => onOpenActivity(myClass)}>
                Hoạt động và hình ảnh
              </Button>
              {hasLevelFeature(myClass.school_level, 'meal_report') ? (
                <Button aria-label={`Báo cơm lớp ${myClass.name}`} onClick={() => onOpenMealReport(myClass)}>
                  Báo cơm
                </Button>
              ) : null}
              {hasLevelFeature(myClass.school_level, 'student_scores') ? (
                <Button aria-label={`Sổ điểm lớp ${myClass.name}`} onClick={() => onOpenScores(myClass)}>
                  Sổ điểm
                </Button>
              ) : null}
              {hasLevelFeature(myClass.school_level, 'student_assessment') ? (
                <Button aria-label={`Đánh giá lớp ${myClass.name}`} onClick={() => onOpenAssessment(myClass)}>
                  Đánh giá học sinh
                </Button>
              ) : null}
              {hasLevelFeature(myClass.school_level, 'boarding_meal') ? (
                <Button aria-label={`Bán trú lớp ${myClass.name}`} onClick={() => onOpenBoarding(myClass)}>
                  Bán trú
                </Button>
              ) : null}
              <Button aria-label={`Dặn thuốc lớp ${myClass.name}`} onClick={() => onOpenMedication(myClass)}>
                Dặn thuốc
              </Button>
              <Button aria-label={`Giảng dạy lớp ${myClass.name}`} onClick={() => onOpenTeaching(myClass)}>
                Giảng dạy
              </Button>
            </li>
          ))}
        </ul>
        <div>
          <Button onClick={() => void session.logout()}>Đăng xuất</Button>
        </div>
      </main>
    </div>
  );
}
