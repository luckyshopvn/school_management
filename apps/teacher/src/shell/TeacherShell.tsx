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

// Thanh bên khổ máy tính của ứng dụng giáo viên (YCTD-395, bản mẫu tai_lieu/ban_mau/yctd-395): Trang chủ; các lớp và chức năng của
// lớp đang chọn; nhóm Giảng dạy, Rèn luyện, Cá nhân, Cổng trường; Đăng xuất. Cùng điều kiện quyền, cấp lớp với trang chủ
const ICON_PATHS: Record<ClassFeature | GlobalFeature | 'home' | 'class' | 'logout', string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  class: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  attendance: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  pickup:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  journal: 'M6 3h12v18H6zM9 7h6M9 11h6M9 15h4',
  care: 'M12 21s-7-4.4-9.3-9A5 5 0 0 1 12 6a5 5 0 0 1 9.3 6c-2.3 4.6-9.3 9-9.3 9z',
  messages: 'M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z',
  activity: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5h.01',
  meal: 'M4 3v8a3 3 0 0 0 6 0V3M7 3v18M17 3c-2 0-3 2-3 5s1 4 3 4v9',
  scores: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5M9 8h7M9 12h5',
  assessment: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  boarding: 'M3 20V10l9-6 9 6v10M9 20v-6h6v6',
  medication: 'M10.5 20.5a5 5 0 0 1-7-7l7-7a5 5 0 0 1 7 7zM8.5 8.5l7 7',
  teaching: 'M3 4h18M4 4v11h16V4M12 15v5M8 20h8',
  timetable: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  'class-log': 'M6 3h12v18H6zM9 7h6M9 11h6M9 15h4',
  'classroom-tools': 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z',
  'classroom-mode': 'M3 4h18v12H3zM8 20h8M12 16v4',
  'online-classes': 'M3 6h12v12H3zM15 10l6-3v10l-6-3',
  supervision: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  'ai-tutor-flags': 'M5 21V4M5 4h11l-2 4 2 4H5',
  leave: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  payslips: 'M3 7h18v12H3zM3 7l3-3h12l3 3M16 13h2',
  work: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  training: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5',
  library: 'M5 4h4v16H5zM10 4h4v16h-4zM15 5l3.5-1 3 15-3.5 1z',
  gate: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  'gate-scan': 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2',
  stocktake: 'M21 8l-9-5-9 5 9 5zM3 8v8l9 5 9-5V8M12 13v8',
  logout: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l-5-5 5-5M5 12h12',
};

function Icon({ name }: { name: keyof typeof ICON_PATHS }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

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
