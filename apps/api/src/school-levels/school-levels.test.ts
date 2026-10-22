import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { schoolLevelContextLabel, visibleSchoolLevels } from '@school-management/shared';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { parseSchoolLevelsInput } from './school-levels.js';

// Nền cấp học của trường (DT-19 phần 19a, YCTD-151): bảng school_levels, SchoolLevelResolver, phạm vi cấp của người dùng,
// ô ngữ cảnh và website đọc cấp từ một nguồn
const DEFAULT_LEVELS = [
  { code: 'MN', is_enabled: true, order_no: 1, display_name: 'Mầm non', learner_term: 'Trẻ', context_label: 'Cấp MN' },
  {
    code: 'TH',
    is_enabled: false,
    order_no: 2,
    display_name: 'Tiểu học',
    learner_term: 'Học sinh',
    context_label: 'Cấp TH',
  },
  {
    code: 'THCS',
    is_enabled: false,
    order_no: 3,
    display_name: 'Trung học cơ sở',
    learner_term: 'Học sinh',
    context_label: 'Cấp THCS',
  },
  {
    code: 'THPT',
    is_enabled: false,
    order_no: 4,
    display_name: 'Trung học phổ thông',
    learner_term: 'Học sinh',
    context_label: 'Cấp THPT',
  },
];

const fieldsOf = (body: Record<string, unknown>) =>
  (((body.error ?? {}) as { details?: Array<{ field: string }> }).details ?? []).map((detail) => detail.field).sort();

describe('Kiểm tra dữ liệu cấp học và hàm cấp dùng chung', () => {
  it('CT-19a-1: gửi đủ bốn cấp, mỗi cấp một lần; thứ tự 1 đến 99 không trùng; tên bắt buộc; phải bật ít nhất một cấp', () => {
    assert.deepEqual(
      parseSchoolLevelsInput({
        levels: DEFAULT_LEVELS.map((level) => ({ ...level, display_name: ` ${level.display_name} ` })),
      }),
      DEFAULT_LEVELS,
    );
    const invalid = (levels: unknown) => () => parseSchoolLevelsInput({ levels });
    assert.throws(invalid(undefined), { code: 'ERR_VALIDATION' });
    assert.throws(invalid(DEFAULT_LEVELS.slice(0, 3)), { code: 'ERR_VALIDATION' });
    assert.throws(invalid([...DEFAULT_LEVELS.slice(0, 3), { ...DEFAULT_LEVELS[0] }]), { code: 'ERR_VALIDATION' });
    assert.throws(invalid([...DEFAULT_LEVELS.slice(0, 3), { ...DEFAULT_LEVELS[3], code: 'DH' }]), {
      code: 'ERR_VALIDATION',
    });
    assert.throws(invalid([...DEFAULT_LEVELS.slice(0, 3), { ...DEFAULT_LEVELS[3], order_no: 1 }]), {
      code: 'ERR_VALIDATION',
    });
    assert.throws(invalid([...DEFAULT_LEVELS.slice(0, 3), { ...DEFAULT_LEVELS[3], order_no: 100 }]), {
      code: 'ERR_VALIDATION',
    });
    assert.throws(invalid([...DEFAULT_LEVELS.slice(0, 3), { ...DEFAULT_LEVELS[3], display_name: ' ' }]), {
      code: 'ERR_VALIDATION',
    });
    assert.throws(invalid([...DEFAULT_LEVELS.slice(0, 3), { ...DEFAULT_LEVELS[3], context_label: 'a'.repeat(31) }]), {
      code: 'ERR_VALIDATION',
    });
    assert.throws(invalid(DEFAULT_LEVELS.map((level) => ({ ...level, is_enabled: false }))), {
      code: 'ERR_RULE_VIOLATION',
      ruleCode: 'BR-147',
    });
  });

  it('CT-19a-2: phạm vi cấp trống là mọi cấp đang bật; có phạm vi thì chỉ cấp vừa bật vừa thuộc phạm vi; nhãn ô ngữ cảnh', () => {
    assert.deepEqual(visibleSchoolLevels(['MN'], []), ['MN']);
    assert.deepEqual(visibleSchoolLevels(['MN', 'TH'], ['TH']), ['TH']);
    assert.deepEqual(visibleSchoolLevels(['MN'], ['TH']), []);
    assert.equal(schoolLevelContextLabel([{ context_label: 'Cấp MN' }]), 'Cấp MN');
    assert.equal(
      schoolLevelContextLabel([{ context_label: 'Cấp TH' }, { context_label: 'Cấp THCS' }]),
      'Cấp TH, Cấp THCS',
    );
    assert.equal(schoolLevelContextLabel([]), 'Cấp MN');
  });
});

describe('Điểm cuối cấp học của trường và phạm vi cấp của người dùng', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase> | undefined;
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const identityUrl = (path: string) => `${environment.identity.baseUrl}${path}`;
  const levelsOf = (body: Record<string, unknown>) =>
    (body.levels as Array<Record<string, unknown>>).map(
      ({ code, is_enabled, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled,
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    teacher = await environment.loginAs('VT-07', null);
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment.close();
  });

  it('CT-19a-3: trường hiện có tự nhận cấp Mầm non; mọi người đọc được, chỉ Hiệu trưởng sửa; ô ngữ cảnh "Cấp MN"', async () => {
    const list = await sendJson('GET', url('/school-levels'), teacher.accessToken);
    assert.equal(list.status, 200);
    assert.deepEqual(levelsOf(list.body), DEFAULT_LEVELS);
    assert.deepEqual(list.body.user_levels, ['MN']);
    assert.equal((await sendJson('GET', url('/school-levels'), undefined)).status, 401);
    assert.equal(
      (await sendJson('PUT', url('/school-levels'), teacher.accessToken, { levels: DEFAULT_LEVELS })).status,
      403,
    );
    const context = await sendJson('GET', url('/portal-context'), teacher.accessToken);
    assert.equal(context.body.education_level, 'Cấp MN');
    const website = await sendJson('GET', url('/website/settings'), principal.accessToken);
    assert.deepEqual(website.body.school_levels, ['MN']);
  });

  it('CT-19a-4: bật Tiểu học: ô ngữ cảnh, website đọc cấp mới; ghi nhật ký; không tắt hết; tắt cấp có lớp chỉ ẩn', async () => {
    const yearId = await openTestAcademicYear(environment, principal.accessToken, '2026-2027', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    const yearDatabase = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', yearId)
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, yearDatabase.database_name),
    );

    const withPrimary = DEFAULT_LEVELS.map((level) =>
      level.code === 'TH' ? { ...level, is_enabled: true, display_name: 'Tiểu học (liên cấp)' } : level,
    );
    const saved = await sendJson('PUT', url('/school-levels'), principal.accessToken, { levels: withPrimary });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(levelsOf(saved.body), withPrimary);
    assert.deepEqual(saved.body.user_levels, ['MN', 'TH']);
    const context = await sendJson('GET', url('/portal-context'), teacher.accessToken);
    assert.equal(context.body.education_level, 'Cấp MN, Cấp TH');
    const website = await sendJson('GET', url('/website/settings'), principal.accessToken);
    assert.deepEqual(website.body.school_levels, ['MN', 'TH']);

    const audit = await schoolYear
      .selectFrom('audit_logs')
      .select(['entity_name', 'action', 'actor_user_id'])
      .where('entity_name', '=', 'school_levels')
      .execute();
    assert.deepEqual(audit, [{ entity_name: 'school_levels', action: 'update', actor_user_id: principal.userId }]);

    const allOff = await sendJson('PUT', url('/school-levels'), principal.accessToken, {
      levels: DEFAULT_LEVELS.map((level) => ({ ...level, is_enabled: false })),
    });
    assert.equal(allOff.status, 422);
    const duplicateOrder = await sendJson('PUT', url('/school-levels'), principal.accessToken, {
      levels: DEFAULT_LEVELS.map((level) => ({ ...level, order_no: 1 })),
    });
    assert.equal(duplicateOrder.status, 400);
    assert.deepEqual(fieldsOf(duplicateOrder.body), ['levels']);

    // Tắt Mầm non khi đang có lớp: được (chỉ ẩn), lớp giữ nguyên; số lớp hiện để cảnh báo
    const root = await sendJson('POST', url('/org-units'), principal.accessToken, {
      code: 'MN-19A',
      name: 'Trường kiểm thử cấp học',
      unit_type: 'truong_chinh',
    });
    assert.equal(root.status, 201, JSON.stringify(root.body));
    await schoolYear
      .insertInto('classes')
      .values({
        org_unit_id: root.body.id as string,
        academic_year_id: yearId,
        code: 'LOP-19A',
        name: 'Lớp kiểm thử',
        grade_level: 'mau_giao_lon',
        max_size: 30,
      })
      .execute();
    const hidden = await sendJson('PUT', url('/school-levels'), principal.accessToken, {
      levels: withPrimary.map((level) => (level.code === 'MN' ? { ...level, is_enabled: false } : level)),
    });
    assert.equal(hidden.status, 200, JSON.stringify(hidden.body));
    const mn = (hidden.body.levels as Array<Record<string, unknown>>).find((level) => level.code === 'MN');
    assert.deepEqual([mn?.is_enabled, mn?.class_count], [false, 1]);
    const classes = await schoolYear.selectFrom('classes').select('code').execute();
    assert.deepEqual(classes, [{ code: 'LOP-19A' }]);
    assert.equal((await sendJson('GET', url('/portal-context'), teacher.accessToken)).body.education_level, 'Cấp TH');

    const restored = await sendJson('PUT', url('/school-levels'), principal.accessToken, { levels: DEFAULT_LEVELS });
    assert.equal(restored.status, 200);
    assert.equal((await sendJson('GET', url('/portal-context'), teacher.accessToken)).body.education_level, 'Cấp MN');
  });

  it('CT-19a-5: phạm vi cấp của người dùng: trống là mọi cấp, chỉ thu hẹp; người quản lý tài khoản đặt, có nhật ký', async () => {
    const enable = await sendJson('PUT', url('/school-levels'), principal.accessToken, {
      levels: DEFAULT_LEVELS.map((level) => (level.code === 'TH' ? { ...level, is_enabled: true } : level)),
    });
    assert.equal(enable.status, 200);

    const empty = await sendJson('GET', identityUrl(`/users/${teacher.userId}/school-levels`), principal.accessToken);
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body, { school_levels: [] });
    assert.deepEqual((await sendJson('GET', url('/school-levels'), teacher.accessToken)).body.user_levels, [
      'MN',
      'TH',
    ]);

    assert.equal(
      (
        await sendJson('PUT', identityUrl(`/users/${teacher.userId}/school-levels`), principal.accessToken, {
          school_levels: ['DH'],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await sendJson('PUT', identityUrl(`/users/${principal.userId}/school-levels`), teacher.accessToken, {
          school_levels: ['MN'],
        })
      ).status,
      403,
    );
    const scoped = await sendJson('PUT', identityUrl(`/users/${teacher.userId}/school-levels`), principal.accessToken, {
      school_levels: ['TH', 'TH', 'MN'],
    });
    assert.equal(scoped.status, 200, JSON.stringify(scoped.body));
    assert.deepEqual(scoped.body, { school_levels: ['MN', 'TH'] });
    const onlyPrimary = await sendJson(
      'PUT',
      identityUrl(`/users/${teacher.userId}/school-levels`),
      principal.accessToken,
      {
        school_levels: ['TH'],
      },
    );
    assert.deepEqual(onlyPrimary.body, { school_levels: ['TH'] });

    const me = await sendJson('GET', identityUrl('/auth/me'), teacher.accessToken);
    assert.deepEqual(me.body.school_levels, ['TH']);
    assert.deepEqual((await sendJson('GET', url('/school-levels'), teacher.accessToken)).body.user_levels, ['TH']);
    // Quyền hiện có giữ nguyên: giáo viên vẫn đọc ngữ cảnh, danh sách cấp
    assert.equal((await sendJson('GET', url('/portal-context'), teacher.accessToken)).status, 200);

    // Cấp trong phạm vi bị tắt thì người dùng không còn cấp nào để xem
    await sendJson('PUT', url('/school-levels'), principal.accessToken, { levels: DEFAULT_LEVELS });
    assert.deepEqual((await sendJson('GET', url('/school-levels'), teacher.accessToken)).body.user_levels, []);

    const audit = await environment.identity.database
      .selectFrom('identity_audit_logs')
      .select(['entity_name', 'entity_id', 'action'])
      .where('entity_name', '=', 'user_school_levels')
      .where('entity_id', '=', teacher.userId)
      .execute();
    assert.equal(audit.length, 2);
    assert.ok(audit.every((entry) => entry.entity_id === teacher.userId && entry.action === 'update'));

    const cleared = await sendJson(
      'PUT',
      identityUrl(`/users/${teacher.userId}/school-levels`),
      principal.accessToken,
      {
        school_levels: [],
      },
    );
    assert.deepEqual(cleared.body, { school_levels: [] });
    assert.deepEqual((await sendJson('GET', url('/school-levels'), teacher.accessToken)).body.user_levels, ['MN']);
  });
});
