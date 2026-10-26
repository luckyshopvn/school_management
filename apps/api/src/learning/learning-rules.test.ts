import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import type { FieldError } from '@school-management/server';
import { activityKind, hostAllowed } from './learning-activity-kinds.js';
import {
  diffTeachers,
  evaluateOpenRules,
  parseOpenRules,
  planClassSpaces,
  replaceAllowed,
  resultFromCompletion,
  sectionDone,
  summarizeProgress,
  weeklyPlan,
  type ResultSnapshot,
} from './learning-rules.js';
import { parseTemplateContent, planTemplateApply } from './learning-template-rules.js';

// Hàm thuần của lõi hệ thống quản lý học tập (DT-28 phần 28b, YCTD-272): sinh lớp học trực tuyến từ phân công, điều kiện mở,
// hoàn thành, tiến độ, kế hoạch theo tuần, quyết định dạy thay thế, khoá học mẫu. Dữ liệu giả
describe('Lõi hệ thống quản lý học tập: hàm thuần', () => {
  it('CT-28b-1: lớp học trực tuyến sinh từ phân công; cặp chỉ có trong thời khoá biểu lấy giáo viên của tiết; bỏ Mầm non', () => {
    const classes = [
      { id: 'c7', name: 'Lớp 7A', school_level: 'THCS', grade_level: 'K7' },
      { id: 'mn', name: 'Lớp Mầm 1', school_level: 'MN', grade_level: null },
    ];
    const subjects = [
      { id: 'toan', name: 'Toán' },
      { id: 'van', name: 'Ngữ văn' },
    ];
    const planned = planClassSpaces(
      classes,
      subjects,
      [
        { class_id: 'c7', subject_id: 'toan', staff_user_id: 'u1', staff_name: 'Cô Lan' },
        { class_id: 'mn', subject_id: 'toan', staff_user_id: 'u9', staff_name: 'Cô Mầm' },
      ],
      [
        { class_id: 'c7', subject_id: 'toan', teacher_user_id: 'u2', teacher_name: 'Thầy Dạy thay' },
        { class_id: 'c7', subject_id: 'van', teacher_user_id: 'u3', teacher_name: 'Cô Hoa' },
        { class_id: 'c7', subject_id: 'van', teacher_user_id: null, teacher_name: null },
      ],
    );
    assert.deepEqual(
      planned.map((space) => ({
        title: space.title,
        teachers: space.teachers.map((teacher) => `${teacher.user_id}:${teacher.source}`),
      })),
      [
        { title: 'Ngữ văn - Lớp 7A', teachers: ['u3:timetable'] },
        { title: 'Toán - Lớp 7A', teachers: ['u1:assignment'] },
      ],
    );
    assert.deepEqual(
      diffTeachers(
        [
          { user_id: 'u1', source: 'assignment' },
          { user_id: 'u5', source: 'assignment' },
          { user_id: 'u6', source: 'manual' },
        ],
        [
          { user_id: 'u1', user_name: 'Cô Lan', source: 'assignment' },
          { user_id: 'u7', user_name: 'Cô Mới', source: 'assignment' },
        ],
      ),
      { add: [{ user_id: 'u7', user_name: 'Cô Mới', source: 'assignment' }], remove: ['u5'] },
      'giáo viên thêm tay giữ nguyên, người không còn phân công thì bỏ',
    );
  });

  it('CT-28b-2: điều kiện mở theo hoạt động trước, chương, điểm, ngày, nhóm; tất cả hoặc một trong; nêu lý do khi khóa', () => {
    const first = randomUUID();
    const section = randomUUID();
    const group = randomUUID();
    const errors: FieldError[] = [];
    const rules = parseOpenRules(
      {
        mode: 'all',
        rules: [
          { type: 'after_activity', activity_id: first },
          { type: 'min_score', activity_id: first, score: 6.5 },
          { type: 'from_date', at: '2026-11-01T00:00:00+07:00' },
        ],
      },
      'open_rules',
      errors,
    );
    assert.deepEqual(errors, []);
    const results = new Map<string, ResultSnapshot>([[first, { status: 'passed', score: 7 }]]);
    const context = {
      now: new Date('2026-11-02T00:00:00Z'),
      results,
      activityTitles: new Map([[first, 'Bài 1']]),
      sectionDone: () => false,
      sectionTitles: new Map([[section, 'Chương 1']]),
      groupIds: new Set<string>(),
    };
    assert.deepEqual(evaluateOpenRules(rules, context), { open: true, reasons: [] });
    results.set(first, { status: 'failed', score: 4 });
    const locked = evaluateOpenRules(rules, context);
    assert.equal(locked.open, false);
    assert.deepEqual(locked.reasons, ['Hoàn thành "Bài 1" để mở', 'Đạt từ 6.5 điểm ở "Bài 1" để mở']);
    const anyRules = parseOpenRules(
      {
        mode: 'any',
        rules: [
          { type: 'after_section', section_id: section },
          { type: 'in_group', group_id: group },
        ],
      },
      'open_rules',
      errors,
    );
    assert.equal(evaluateOpenRules(anyRules, context).open, false);
    assert.equal(evaluateOpenRules(anyRules, { ...context, groupIds: new Set([group]) }).open, true);
    assert.equal(evaluateOpenRules(null, context).open, true, 'không có điều kiện thì mở');
    for (const bad of [
      { mode: 'some', rules: [] },
      { rules: [{ type: 'x' }] },
      { rules: Array.from({ length: 11 }, () => ({ type: 'from_date', at: '2026-01-01' })) },
    ]) {
      const badErrors: FieldError[] = [];
      parseOpenRules(bad, 'open_rules', badErrors);
      assert.ok(badErrors.length > 0, JSON.stringify(bad));
    }
  });

  it('CT-28b-3: hoàn thành theo cách tính; tiến độ, quá hạn, chương xong chỉ tính hoạt động bắt buộc', () => {
    assert.equal(resultFromCompletion('view', { viewed: true }), 'completed');
    assert.equal(resultFromCompletion('view', { progress: 40 }), 'in_progress');
    assert.equal(resultFromCompletion('submit', { submitted: true }), 'completed');
    assert.equal(resultFromCompletion('pass', { score: 5 }), 'passed');
    assert.equal(resultFromCompletion('pass', { score: 6, passScore: 7 }), 'failed');
    assert.equal(resultFromCompletion('pass', {}), 'not_started');
    const now = new Date('2026-11-10T00:00:00Z');
    const activities = [
      { id: 'a', section_id: 's1', required: true, due_at: new Date('2026-11-01T00:00:00Z') },
      { id: 'b', section_id: 's1', required: true, due_at: null },
      { id: 'c', section_id: 's1', required: false, due_at: new Date('2026-11-01T00:00:00Z') },
      { id: 'd', section_id: 's2', required: true, due_at: new Date('2026-11-20T00:00:00Z') },
    ];
    const results = new Map<string, ResultSnapshot>([
      ['b', { status: 'completed', score: null }],
      ['d', { status: 'excused', score: null }],
    ]);
    assert.deepEqual(summarizeProgress(activities, results, now), { required: 3, done: 2, overdue: 1, percent: 67 });
    assert.equal(sectionDone('s1', activities, results), false);
    assert.equal(sectionDone('s2', activities, results), true);
  });

  it('CT-28b-4: dạy thay thế chỉ khi có quyết định còn hiệu lực cho lớp; quyết định không ghi lớp là toàn trường', () => {
    const decisions = [
      { status: 'active' as const, class_ids: ['c7'], starts_on: '2026-11-02', ends_on: '2026-11-08' },
      { status: 'revoked' as const, class_ids: [], starts_on: '2026-11-01', ends_on: '2026-12-31' },
    ];
    assert.equal(replaceAllowed(decisions, 'c7', '2026-11-05'), true);
    assert.equal(replaceAllowed(decisions, 'c7', '2026-11-09'), false, 'hết hạn');
    assert.equal(replaceAllowed(decisions, 'c8', '2026-11-05'), false, 'lớp khác');
    assert.equal(replaceAllowed(decisions, null, '2026-11-05'), false, 'quyết định thu hồi không tính');
    assert.equal(
      replaceAllowed(
        [{ status: 'active', class_ids: [], starts_on: '2026-11-01', ends_on: '2026-11-30' }],
        null,
        '2026-11-05',
      ),
      true,
    );
  });

  it('CT-28b-5: kế hoạch dạy học trực tuyến theo tuần lấy tuần của hoạt động, không có thì của chương, tuần trống cuối cùng', () => {
    const weeks = weeklyPlan(
      [
        { id: 's1', title: 'Chương 1', position: 1, planned_week: 3 },
        { id: 's2', title: 'Chương 2', position: 2, planned_week: null },
      ],
      [
        {
          id: 'a',
          section_id: 's1',
          title: 'Đọc',
          kind: 'page',
          position: 1,
          planned_week: null,
          teaching_mode: 'support',
          status: 'published',
          due_at: null,
        },
        {
          id: 'b',
          section_id: 's1',
          title: 'Xem',
          kind: 'resource',
          position: 2,
          planned_week: 4,
          teaching_mode: 'replace',
          status: 'draft',
          due_at: null,
        },
        {
          id: 'c',
          section_id: 's2',
          title: 'Liên kết',
          kind: 'link',
          position: 1,
          planned_week: null,
          teaching_mode: 'support',
          status: 'draft',
          due_at: null,
        },
      ],
    );
    assert.deepEqual(
      weeks.map((week) => [week.week, week.items.map((item) => item.title)]),
      [
        [3, ['Đọc']],
        [4, ['Xem']],
        [null, ['Liên kết']],
      ],
    );
  });

  it('CT-28b-6: danh mục loại hoạt động kiểm phần cài đặt; liên kết chỉ https, tên miền theo danh sách trường', () => {
    const errors: FieldError[] = [];
    assert.deepEqual(activityKind('page')?.parseSettings({ body: ' Đọc trang 12 ' }, 'settings', errors), {
      body: 'Đọc trang 12',
    });
    assert.deepEqual(activityKind('link')?.parseSettings({ url: 'https://hoc.example.vn/bai-1' }, 'settings', errors), {
      url: 'https://hoc.example.vn/bai-1',
      host: 'hoc.example.vn',
    });
    assert.deepEqual(errors, []);
    for (const [kind, settings] of [
      ['page', { body: '' }],
      ['link', { url: 'http://khong-an-toan.vn' }],
      ['resource', { resource_id: 'x' }],
    ] as const) {
      const kindErrors: FieldError[] = [];
      activityKind(kind)?.parseSettings(settings, 'settings', kindErrors);
      assert.ok(kindErrors.length > 0, kind);
    }
    assert.equal(activityKind('assignment'), null, 'loại của phần sau chưa đăng ký thì không dùng được');
    assert.equal(hostAllowed('hoc.example.vn', ['example.vn']), true);
    assert.equal(hostAllowed('example.vn.evil.com', ['example.vn']), false);
    assert.equal(hostAllowed('hoc.example.vn', []), false);
  });

  it('CT-28b-7: khoá mẫu kiểm khoá trùng, loại hoạt động; đẩy xuống lớp thêm mới, cập nhật, giữ hoạt động giáo viên đã sửa', () => {
    const errors: FieldError[] = [];
    const content = parseTemplateContent(
      {
        sections: [
          {
            key: 'chuong-1',
            title: 'Chương 1. Số hữu tỉ',
            planned_week: 1,
            items: [
              { key: 'doc-1', kind: 'page', title: 'Đọc hiểu', settings: { body: 'Nội dung' } },
              {
                key: 'lk-1',
                kind: 'link',
                title: 'Luyện tập',
                settings: { url: 'https://hoc.example.vn' },
                planned_week: 2,
              },
            ],
          },
        ],
      },
      errors,
    );
    assert.deepEqual(errors, []);
    assert.equal(content.sections[0]?.items[0]?.completion_rule, 'view');
    const badErrors: FieldError[] = [];
    parseTemplateContent(
      { sections: [{ key: 'a', title: 'A', items: [{ key: 'a', kind: 'assignment', title: 'B' }] }] },
      badErrors,
    );
    assert.deepEqual(
      badErrors.map((error) => error.field),
      ['content.sections[0].items[0].key', 'content.sections[0].items[0].kind'],
    );
    const plan = planTemplateApply(
      content,
      [{ id: 's-local', template_section_key: 'chuong-1' }],
      [
        { id: 'a-local', template_item_key: 'doc-1', edited_locally: true },
        { id: 'a-own', template_item_key: null, edited_locally: true },
      ],
    );
    assert.equal(plan.createSections.length, 0);
    assert.deepEqual(
      plan.createItems.map((item) => item.item.key),
      ['lk-1'],
    );
    assert.equal(plan.updateItems.length, 0);
    assert.equal(plan.keptLocal, 1);
    const fresh = planTemplateApply(content, [], []);
    assert.equal(fresh.createSections.length, 1);
    assert.equal(fresh.createItems.length, 2);
  });
});
