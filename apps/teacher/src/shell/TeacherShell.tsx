import type { ReactNode } from 'react';
import { hasLevelFeature } from '@school-management/shared';
import { RoleNavigationShell, type RoleNavigationGroup, type RoleNavigationItem } from '@school-management/ui';
import { levelOrder, type MyClass } from '../screens/ClassesScreen.js';
import {
  classFeatures,
  globalFeatures,
  sortClassesByLevel,
  type ClassFeature,
  type GlobalFeature,
} from './teacher-features.js';
import type { TeacherFeatureState } from './use-teacher-features.js';
import { Icon } from './icons.js';

// Thanh bên khổ máy tính của ứng dụng giáo viên (YCTD-395, bản mẫu tai_lieu/ban_mau/yctd-395): Trang chủ; các lớp và chức năng của
// lớp đang chọn; nhóm Giảng dạy, Rèn luyện, Cá nhân, Cổng trường; Đăng xuất. Cùng điều kiện quyền, cấp lớp với trang chủ
export const CLASS_FEATURE_LABELS: Record<ClassFeature, string> = {
  attendance: 'Điểm danh',
  pickup: 'Đón trả',
  journal: 'Nhật ký',
  care: 'Chăm sóc và y tế',
  messages: 'Trao đổi',
  activity: 'Hoạt động',
  meal: 'Báo cơm',
  scores: 'Sổ điểm',
  assessment: 'Đánh giá',
  boarding: 'Bán trú',
  medication: 'Dặn thuốc',
  teaching: 'Giảng dạy',
};

export const GLOBAL_GROUPS: Array<[string, Array<[GlobalFeature, string]>]> = [
  [
    'Giảng dạy',
    [
      ['timetable', 'Lịch dạy của tôi'],
      ['class-log', 'Sổ đầu bài'],
      ['classroom-tools', 'Hộp công cụ'],
      ['classroom-mode', 'Chế độ lớp học'],
      ['online-classes', 'Lớp trực tuyến'],
    ],
  ],
  [
    'Rèn luyện',
    [
      ['supervision', 'Ghi nhận rèn luyện'],
      ['ai-tutor-flags', 'Cờ Gia sư AI'],
    ],
  ],
  [
    'Cá nhân',
    [
      ['leave', 'Chấm công, nghỉ phép'],
      ['payslips', 'Phiếu lương'],
      ['work', 'Công việc'],
      ['training', 'Bồi dưỡng'],
      ['library', 'Sách đang mượn'],
    ],
  ],
  [
    'Cổng trường',
    [
      ['gate', 'Xác nhận người đón'],
      ['gate-scan', 'Quét thẻ ra vào'],
      ['stocktake', 'Kiểm kê thiết bị'],
    ],
  ],
];

export interface TeacherShellProperties {
  features: TeacherFeatureState;
  // Màn đang mở: khóa chức năng (trang chủ là undefined) và lớp của màn nếu có
  currentScreen?: string;
  currentClassId?: string;
  selectedClass?: MyClass;
  location: string;
  onHome(): void;
  onSelectClass(myClass: MyClass): void;
  onOpenClassFeature(feature: ClassFeature, myClass: MyClass): void;
  onOpenFeature(feature: GlobalFeature): void;
  onLogout(): void;
  children: ReactNode;
}

export function TeacherShell({
  features,
  currentScreen,
  currentClassId,
  selectedClass,
  location,
  onHome,
  onSelectClass,
  onOpenClassFeature,
  onOpenFeature,
  onLogout,
  children,
}: TeacherShellProperties) {
  const classes = sortClassesByLevel(features.classes ?? [], levelOrder);
  const pendingFlags = features.aiTutorFlags?.pending_count ?? 0;
  const visible = globalFeatures({
    assignments: features.user?.assignments ?? [],
    classes: features.classes,
    aiTutorFlagCount: features.aiTutorFlags?.flags.length ?? 0,
    hasLevelFeature,
  });

  const groups: RoleNavigationGroup[] = [
    {
      key: 'home',
      items: [
        {
          key: 'home',
          label: 'Trang chủ',
          icon: <Icon name="home" />,
          current: currentScreen === undefined,
          onSelect: onHome,
        },
      ],
    },
  ];
  if (classes.length > 0) {
    groups.push({
      key: 'classes',
      label: 'Lớp',
      items: classes.map((myClass) => ({
        key: myClass.id,
        label: myClass.name,
        icon: <Icon name="class" />,
        selected: myClass.id === selectedClass?.id,
        onSelect: () => onSelectClass(myClass),
      })),
    });
  }
  if (selectedClass) {
    groups.push({
      key: 'class-features',
      nested: true,
      items: classFeatures(selectedClass.school_level, hasLevelFeature).map((feature) => ({
        key: feature,
        label: CLASS_FEATURE_LABELS[feature],
        icon: <Icon name={feature} />,
        current: currentScreen === feature && currentClassId === selectedClass.id,
        onSelect: () => onOpenClassFeature(feature, selectedClass),
      })),
    });
  }
  for (const [label, entries] of GLOBAL_GROUPS) {
    const items: RoleNavigationItem[] = entries
      .filter(([feature]) => visible.has(feature))
      .map(([feature, itemLabel]) => ({
        key: feature,
        label: itemLabel,
        icon: <Icon name={feature} />,
        current: currentScreen === feature,
        count: feature === 'ai-tutor-flags' ? pendingFlags : undefined,
        countLabel: feature === 'ai-tutor-flags' ? `${pendingFlags} cờ cần xử lý` : undefined,
        onSelect: () => onOpenFeature(feature),
      }));
    if (items.length > 0) {
      groups.push({ key: label, label, items });
    }
  }

  return (
    <RoleNavigationShell
      roleClassName="vai-giao-vien"
      applicationName="Giáo viên"
      applicationIcon={<Icon name="teaching" />}
      location={location}
      userName={features.user?.full_name}
      groups={groups}
      footer={[{ key: 'logout', label: 'Đăng xuất', icon: <Icon name="logout" />, onSelect: onLogout }]}
    >
      {children}
    </RoleNavigationShell>
  );
}
