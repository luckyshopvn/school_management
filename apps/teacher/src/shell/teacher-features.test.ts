import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classFeatures, gateUnitIds, globalFeatures, sortClassesByLevel } from './teacher-features.ts';

// Chức năng ở trang chủ và thanh bên khổ máy tính của ứng dụng giáo viên (YCTD-395). Bảng cấp giả lập theo
// packages/shared/src/level-features.ts cho các mục dùng ở đây
const LEVEL_FEATURES: Record<string, string[]> = {
  daily_attendance: ['MN', 'TH', 'THCS', 'THPT'],
  class_pickup: ['MN', 'TH'],
  daily_journal: ['MN'],
  daily_care: ['MN'],
  meal_report: ['MN'],
  student_scores: ['THCS', 'THPT'],
  student_assessment: ['TH'],
  boarding_meal: ['TH', 'THCS'],
  class_medication: ['MN', 'TH'],
  online_learning: ['TH', 'THCS', 'THPT'],
  period_timetable: ['TH', 'THCS', 'THPT'],
  period_attendance: ['THCS', 'THPT'],
};
const hasLevelFeature = (level: unknown, feature: string) =>
  (LEVEL_FEATURES[feature] ?? []).includes(String(level ?? 'MN'));
const ORDER = ['MN', 'TH', 'THCS', 'THPT'];

describe('Ứng dụng giáo viên: chức năng theo quyền và cấp lớp', () => {
  it('CT-2100: giáo viên chưa có lớp, không quyền riêng chỉ thấy việc cá nhân và thư viện', () => {
    const features = globalFeatures({ assignments: [], classes: [], aiTutorFlagCount: 0, hasLevelFeature });
    assert.deepEqual([...features].sort(), ['leave', 'library', 'payslips', 'work']);
  });

  it('CT-2101: quyền mở mục tương ứng; lớp THCS mở lịch dạy, sổ đầu bài, hộp công cụ', () => {
    const features = globalFeatures({
      assignments: [
        { org_unit_id: 'u1', permissions: ['P04.pickup.gate-confirm', 'P02.supervision.record'] },
        { org_unit_id: null, permissions: ['P04.gate-pass.record', 'P13.equipment.stocktake', 'P09.training.use'] },
      ],
      classes: [{ school_level: 'THCS' }],
      aiTutorFlagCount: 2,
      hasLevelFeature,
    });
    for (const key of [
      'gate',
      'gate-scan',
      'ai-tutor-flags',
      'stocktake',
      'training',
      'timetable',
      'classroom-tools',
      'classroom-mode',
      'supervision',
      'class-log',
    ] as const) {
      assert.ok(features.has(key), key);
    }
  });

  it('CT-2102: lớp học trực tuyến ẩn khi mọi lớp đều Mầm non, hiện khi chưa có lớp', () => {
    const teach = [{ org_unit_id: null, permissions: ['P02.learning.teach'] }];
    const preschool = globalFeatures({
      assignments: teach,
      classes: [{ school_level: 'MN' }],
      aiTutorFlagCount: 0,
      hasLevelFeature,
    });
    assert.equal(preschool.has('online-classes'), false);
    const noClass = globalFeatures({ assignments: teach, classes: undefined, aiTutorFlagCount: 0, hasLevelFeature });
    assert.equal(noClass.has('online-classes'), true);
  });

  it('CT-2103: chức năng của lớp theo cấp, đúng thứ tự trang chủ', () => {
    assert.deepEqual(classFeatures('MN', hasLevelFeature), [
      'attendance',
      'pickup',
      'journal',
      'care',
      'messages',
      'activity',
      'meal',
      'medication',
      'teaching',
    ]);
    assert.deepEqual(classFeatures('THCS', hasLevelFeature), [
      'attendance',
      'messages',
      'activity',
      'scores',
      'boarding',
      'teaching',
    ]);
  });

  it('CT-2104: đơn vị cổng bỏ phân công không gắn đơn vị; lớp nhiều cấp xếp theo cấp', () => {
    assert.deepEqual(
      gateUnitIds([
        { org_unit_id: null, permissions: ['P04.pickup.gate-confirm'] },
        { org_unit_id: 'u2', permissions: ['P04.pickup.gate-confirm'] },
      ]),
      ['u2'],
    );
    const classes = [
      { name: '10A', school_level: 'THPT' },
      { name: 'Lá 1', school_level: 'MN' },
      { name: '6A', school_level: 'THCS' },
    ];
    const order = (level: unknown) => ORDER.indexOf(String(level));
    assert.deepEqual(
      sortClassesByLevel(classes, order).map((item) => item.name),
      ['Lá 1', '6A', '10A'],
    );
    const sameLevel = [
      { name: '7B', school_level: 'THCS' },
      { name: '6A', school_level: 'THCS' },
    ];
    assert.equal(sortClassesByLevel(sameLevel, order), sameLevel);
  });
});
