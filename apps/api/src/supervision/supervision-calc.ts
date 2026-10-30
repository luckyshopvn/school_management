// Phần tính không cần cơ sở dữ liệu của giám thị và rèn luyện từng học sinh, lát L1 (YCTD-391): bộ nội quy mặc định theo cấp,
// đổi một thời điểm sang thứ, ngày, giờ Việt Nam, và kiểm một phân công trực có phủ một khu vực ở một thời điểm hay không
export type SupervisionLevel = 'TH' | 'THCS' | 'THPT';
export type RuleKind = 'violation' | 'commendation';
export type ParentNotice = 'none' | 'immediate' | 'daily_digest';

export interface DefaultRuleItem {
  code: string;
  name: string;
  kind: RuleKind;
  parent_notice: ParentNotice;
}

// Bộ mặc định là gợi ý, trường sửa hoặc ngừng dùng được. Lỗi có thể gây hại cho học sinh khác (đánh nhau) và hút thuốc báo phụ
// huynh ngay; còn lại gộp vào tin cuối ngày. Tiểu học không có mục hút thuốc
const DEFAULT_RULE_ITEMS: Array<DefaultRuleItem & { levels?: SupervisionLevel[] }> = [
  { code: 'DI_MUON', name: 'Đi học muộn', kind: 'violation', parent_notice: 'daily_digest' },
  { code: 'TRANG_PHUC', name: 'Trang phục không đúng quy định', kind: 'violation', parent_notice: 'daily_digest' },
  { code: 'MAT_TRAT_TU', name: 'Gây mất trật tự', kind: 'violation', parent_notice: 'daily_digest' },
  { code: 'DIEN_THOAI', name: 'Dùng điện thoại không đúng quy định', kind: 'violation', parent_notice: 'daily_digest' },
  { code: 'XA_RAC', name: 'Xả rác, làm bẩn trường lớp', kind: 'violation', parent_notice: 'daily_digest' },
  { code: 'KHU_VUC_CAM', name: 'Vào khu vực không được phép', kind: 'violation', parent_notice: 'daily_digest' },
  { code: 'DANH_NHAU', name: 'Gây gổ, đánh nhau', kind: 'violation', parent_notice: 'immediate' },
  {
    code: 'HUT_THUOC',
    name: 'Hút thuốc lá, thuốc lá điện tử',
    kind: 'violation',
    parent_notice: 'immediate',
    levels: ['THCS', 'THPT'],
  },
  { code: 'GIUP_BAN', name: 'Giúp đỡ bạn', kind: 'commendation', parent_notice: 'daily_digest' },
  {
    code: 'TRA_CUA_ROI',
    name: 'Nhặt được của rơi trả lại người mất',
    kind: 'commendation',
    parent_notice: 'daily_digest',
  },
  { code: 'TICH_CUC', name: 'Tích cực trong hoạt động tập thể', kind: 'commendation', parent_notice: 'daily_digest' },
];

export function defaultRuleItems(level: SupervisionLevel): DefaultRuleItem[] {
  return DEFAULT_RULE_ITEMS.filter((item) => !item.levels || item.levels.includes(level)).map(
    ({ code, name, kind, parent_notice }) => ({ code, name, kind, parent_notice }),
  );
}

export interface LocalMoment {
  date: string;
  weekday: number;
  time: string;
}

// Thời điểm theo giờ Việt Nam: ngày YYYY-MM-DD, thứ (1 là thứ hai, 7 là chủ nhật), giờ HH:MM
export function vietnamMoment(at: Date): LocalMoment {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  );
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: weekdays.indexOf(parts.weekday ?? '') + 1,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export interface DutyWindow {
  zone_ids: string[];
  weekdays: number[];
  start_time: string;
  end_time: string;
  from_date: string | null;
  to_date: string | null;
}

// Phân công phủ khu vực ở thời điểm: đúng thứ, giờ trong [bắt đầu, kết thúc), ngày trong hiệu lực; danh sách khu vực trống là
// trực mọi khu vực
export function coversZone(window: DutyWindow, zoneId: string, moment: LocalMoment): boolean {
  if (!window.weekdays.includes(moment.weekday)) {
    return false;
  }
  if (moment.time < window.start_time || moment.time >= window.end_time) {
    return false;
  }
  if ((window.from_date && moment.date < window.from_date) || (window.to_date && moment.date > window.to_date)) {
    return false;
  }
  return window.zone_ids.length === 0 || window.zone_ids.includes(zoneId);
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isClockTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}
