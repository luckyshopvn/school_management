import type { AttendanceStatus, PeriodAttendanceStatus } from '@school-management/database';

// Trạng thái mặc định của một học sinh ở tiết chưa ghi điểm danh (YCTD-350, Eric chốt ngày 2026-10-28): Tiểu học, THCS,
// THPT điểm danh đầu ngày, điểm danh theo tiết lấy theo đó; giáo viên của tiết vẫn sửa được (điểm danh lại, về sớm có phép).
// Ngày chưa điểm danh đầu ngày thì như trước: có báo vắng của phụ huynh là vắng có phép, không có là có mặt. Về sớm ở điểm
// danh đầu ngày vẫn là có mặt (đi muộn và về sớm là đi muộn) vì chưa biết về từ tiết nào; giáo viên tiết sau sửa thành vắng
export type PeriodStatusSource = 'daily' | 'absence' | 'default';

const FROM_DAILY: Record<AttendanceStatus, PeriodAttendanceStatus> = {
  present: 'present',
  late: 'late',
  early_leave: 'present',
  late_and_early_leave: 'late',
  absent_notified: 'absent_excused',
  absent_unnotified: 'absent_unexcused',
};

export function periodDefault(
  dailyStatus: AttendanceStatus | null,
  hasAbsenceReport: boolean,
): { status: PeriodAttendanceStatus; source: PeriodStatusSource } {
  if (dailyStatus) {
    return { status: FROM_DAILY[dailyStatus], source: 'daily' };
  }
  return hasAbsenceReport ? { status: 'absent_excused', source: 'absence' } : { status: 'present', source: 'default' };
}
