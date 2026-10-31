// Chức năng giáo viên thấy ở trang chủ MG-01 và thanh bên khổ máy tính (YCTD-395): một chỗ quyết định theo quyền và cấp lớp để hai
// nơi không lệch nhau. Hàm thuần, không nhập gì, để kiểm thử đơn vị bằng node --test; kiểm tra cấp lớp truyền vào từ
// `hasLevelFeature` của @school-management/shared. Máy chủ vẫn kiểm tra quyền ở mọi yêu cầu
export interface FeatureAssignment {
  org_unit_id: string | null;
  permissions: string[];
}

export interface FeatureClass {
  school_level?: string;
}

// Các mục cấp lớp dùng ở đây, tên như LevelFeature của @school-management/shared
export type LevelFeatureName =
  | 'daily_attendance'
  | 'class_pickup'
  | 'daily_journal'
  | 'daily_care'
  | 'meal_report'
  | 'student_scores'
  | 'student_assessment'
  | 'boarding_meal'
  | 'class_medication'
  | 'online_learning'
  | 'period_timetable'
  | 'period_attendance';

export type HasLevelFeature = (level: unknown, feature: LevelFeatureName) => boolean;

export type GlobalFeature =
  | 'gate'
  | 'gate-scan'
  | 'ai-tutor-flags'
  | 'stocktake'
  | 'training'
  | 'online-classes'
  | 'timetable'
  | 'classroom-tools'
  | 'classroom-mode'
  | 'library'
  | 'supervision'
  | 'class-log'
  | 'leave'
  | 'payslips'
  | 'work';

export type ClassFeature =
  | 'attendance'
  | 'pickup'
  | 'journal'
  | 'care'
  | 'messages'
  | 'activity'
  | 'meal'
  | 'scores'
  | 'assessment'
  | 'boarding'
  | 'medication'
  | 'teaching';

// Thứ tự như nút của mỗi lớp ở trang chủ; mục không có cấp áp dụng cho mọi cấp
const CLASS_FEATURES: Array<[ClassFeature, LevelFeatureName | null]> = [
  ['attendance', 'daily_attendance'],
  ['pickup', 'class_pickup'],
  ['journal', 'daily_journal'],
  ['care', 'daily_care'],
  ['messages', null],
  ['activity', null],
  ['meal', 'meal_report'],
  ['scores', 'student_scores'],
  ['assessment', 'student_assessment'],
  ['boarding', 'boarding_meal'],
  ['medication', 'class_medication'],
  ['teaching', null],
];

// Đơn vị bảo vệ được xác nhận người đón tại cổng (MG-16)
export function gateUnitIds(assignments: FeatureAssignment[]): string[] {
  return assignments
    .filter((assignment) => assignment.permissions.includes('P04.pickup.gate-confirm'))
    .map((assignment) => assignment.org_unit_id)
    .filter((id): id is string => id !== null);
}

export function globalFeatures(input: {
  assignments: FeatureAssignment[];
  // undefined: chưa tải xong danh sách lớp
  classes: FeatureClass[] | undefined;
  aiTutorFlagCount: number;
  hasLevelFeature: HasLevelFeature;
}): Set<GlobalFeature> {
  const { assignments, classes = [], hasLevelFeature } = input;
  const can = (permission: string) => assignments.some((assignment) => assignment.permissions.includes(permission));
  const anyClass = (feature: LevelFeatureName) =>
    classes.some((myClass) => hasLevelFeature(myClass.school_level, feature));
  // Mục không hợp cấp (DT-29, YCTD-325): có lớp mà không lớp nào ở cấp của mục thì ẩn; chưa có lớp thì theo quyền
  const fitsSomeClass = (feature: LevelFeatureName) => classes.length === 0 || anyClass(feature);
  const features = new Set<GlobalFeature>(['library', 'leave', 'payslips', 'work']);
  const add = (feature: GlobalFeature, visible: boolean) => {
    if (visible) {
      features.add(feature);
    }
  };
  add('gate', gateUnitIds(assignments).length > 0);
  add('gate-scan', can('P04.gate-pass.record'));
  add('ai-tutor-flags', input.aiTutorFlagCount > 0);
  add('stocktake', can('P13.equipment.stocktake'));
  add('training', can('P09.training.use'));
  add('online-classes', can('P02.learning.teach') && fitsSomeClass('online_learning'));
  add('timetable', anyClass('period_timetable'));
  add('classroom-tools', classes.length > 0);
  add('classroom-mode', classes.length > 0);
  add('supervision', can('P02.supervision.record'));
  add('class-log', anyClass('period_attendance'));
  return features;
}

export function classFeatures(level: unknown, hasLevelFeature: HasLevelFeature): ClassFeature[] {
  return CLASS_FEATURES.filter(([, feature]) => feature === null || hasLevelFeature(level, feature)).map(
    ([key]) => key,
  );
}

// Trường nhiều cấp: lớp xếp theo thứ tự cấp, giữ thứ tự máy chủ trả trong cùng cấp
export function sortClassesByLevel<T extends FeatureClass>(classes: T[], levelOrder: (level: unknown) => number): T[] {
  const levels = new Set(classes.map((myClass) => levelOrder(myClass.school_level)));
  return levels.size > 1
    ? [...classes].sort((left, right) => levelOrder(left.school_level) - levelOrder(right.school_level))
    : classes;
}
