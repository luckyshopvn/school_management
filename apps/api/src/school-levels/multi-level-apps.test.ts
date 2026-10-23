import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { hasLevelFeature, levelOf, matchesAudienceLevels } from '@school-management/shared';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Cổng phụ huynh, ứng dụng giáo viên và tin tức theo cấp học (DT-19 phần 19e, YCTD-155): chức năng theo cấp, cấp của con ở
// danh sách con, tin tức có cấp nhận (người xem, người nhận, số người nhận trước khi công bố)
describe('Chức năng và tin tức theo cấp', () => {
  it('CT-19e-1: chức năng chỉ của Mầm non; cấp trống là Mầm non; tin không ghi cấp là mọi cấp, nhân sự không lọc cấp', () => {
    for (const feature of ['daily_attendance', 'daily_journal', 'daily_care', 'meal_report', 'growth'] as const) {
      assert.equal(hasLevelFeature('MN', feature), true, feature);
      assert.equal(hasLevelFeature('TH', feature), false, feature);
    }
    assert.equal(hasLevelFeature(null, 'final_year_record'), true);
    assert.equal(hasLevelFeature('THPT', 'final_year_record'), false);
    assert.equal(levelOf(undefined), 'MN');
    assert.equal(levelOf('DH'), 'MN');
    assert.equal(levelOf('THCS'), 'THCS');
    assert.equal(matchesAudienceLevels([], ['MN']), true);
    assert.equal(matchesAudienceLevels(['TH'], ['MN']), false);
    assert.equal(matchesAudienceLevels(['TH'], ['MN', 'TH']), true);
    assert.equal(matchesAudienceLevels(['TH'], null), true);
    assert.equal(matchesAudienceLevels(undefined, ['MN']), true);
  });
});

describe('Danh sách con và tin tức theo cấp nhận', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let unitId = '';
  const users: Record<string, LoggedInUser> = {};
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};
  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const titles = (body: unknown) => (body as Array<{ title: string }>).map((item) => item.title).sort();

  async function setEnabled(codes: string[]) {
    const current = await api('GET', '/school-levels', principal.accessToken);
    const levels = (current.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: codes.includes(code as string),
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    const saved = await api('PUT', '/school-levels', principal.accessToken, { levels });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026-2027', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', academicYearId)
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    unitId = (
      await api('POST', '/org-units', principal.accessToken, {
        code: 'TLC',
        name: 'Trường liên cấp',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    await setEnabled(['MN', 'TH']);
    users.manager = await environment.loginAs('VT-03', unitId);
    for (const name of ['parentBoth', 'parentPreschool', 'parentPrimary']) {
      users[name] = await environment.loginAs('VT-14', unitId);
    }
    assert.equal(
      (
        await api('POST', '/grade-levels', principal.accessToken, {
          code: 'MAM',
          name: 'Mầm',
          age_from_months: 36,
          age_to_months: 71,
        })
      ).status,
      201,
    );
    const primaryGrade = await api('POST', '/grade-levels', principal.accessToken, {
      code: 'K1',
      name: 'Khối 1',
      school_level: 'TH',
    });
    assert.equal(primaryGrade.status, 201, JSON.stringify(primaryGrade.body));
    for (const [code, grade, level] of [
      ['MAM-1', 'MAM', 'MN'],
      ['1A', 'K1', 'TH'],
    ] as const) {
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unitId,
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: grade,
            school_level: level,
            max_size: 30,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const [key, parent, classCode] of [
      ['BothPreschool', 'parentBoth', 'MAM-1'],
      ['BothPrimary', 'parentBoth', '1A'],
      ['Preschool', 'parentPreschool', 'MAM-1'],
      ['Primary', 'parentPrimary', '1A'],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: `Học sinh ${key}`,
          dob: '2020-03-01',
          gender: 'female',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'granted',
          status: 'active',
          enroll_date: '2026-09-05',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      children[key] = child.id;
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classes[classCode] ?? '', from_date: '2026-09-05' })
        .execute();
      const guardian = await schoolYear
        .insertInto('guardians')
        .values({
          full_name: `Phụ huynh ${key}`,
          phone: `090${Math.floor(Math.random() * 9_000_000 + 1_000_000)}`,
          user_id: users[parent]?.userId ?? null,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await schoolYear
        .insertInto('child_guardians')
        .values({
          child_id: child.id,
          guardian_id: guardian.id,
          relationship_item_id: relationship.id,
          is_primary: true,
        })
        .execute();
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-19e-2: phụ huynh có con ở hai cấp thấy đủ các con kèm cấp của lớp', async () => {
    const list = await api('GET', '/children?page_size=50&status=active', token('parentBoth'));
    assert.equal(list.status, 200, JSON.stringify(list.body));
    const items = list.body.items as Array<{ full_name: string; school_level: string | null }>;
    assert.deepEqual(items.map((item) => [item.full_name, item.school_level]).sort(), [
      ['Học sinh BothPreschool', 'MN'],
      ['Học sinh BothPrimary', 'TH'],
    ]);
  });

  it('CT-19e-3: số người nhận trước khi công bố theo phạm vi và cấp nhận; cấp chưa bật, mã sai bị từ chối', async () => {
    const count = async (body: Record<string, unknown>) => {
      const response = await api('POST', '/news-recipients/count', token('manager'), { org_unit_id: unitId, ...body });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      return response.body.recipient_count;
    };
    assert.equal(await count({}), 3);
    assert.equal(await count({ audience_levels: ['TH'] }), 2);
    assert.equal(await count({ audience_levels: ['MN'] }), 2);
    assert.equal(await count({ scope_type: 'class', scope_id: classes['1A'], audience_levels: ['MN'] }), 2);
    assert.equal(
      (
        await api('POST', '/news-recipients/count', token('manager'), {
          org_unit_id: unitId,
          audience_levels: ['THCS'],
        })
      ).status,
      400,
    );
    assert.equal(
      (await api('POST', '/news-recipients/count', token('manager'), { org_unit_id: unitId, audience_levels: 'TH' }))
        .status,
      400,
    );
    assert.equal(
      (await api('POST', '/news-recipients/count', token('parentBoth'), { org_unit_id: unitId })).status,
      403,
    );
  });

  it('CT-19e-4: tin có cấp nhận chỉ hiện và chỉ gửi tới phụ huynh có con học cấp đó; tin không ghi cấp như cũ', async () => {
    const create = async (title: string, body: Record<string, unknown>) => {
      const created = await api('POST', '/news', token('manager'), {
        org_unit_id: unitId,
        title,
        content: 'Nội dung',
        ...body,
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal((await api('POST', `/news/${created.body.id}/publish`, token('manager'))).status, 200);
      return created.body;
    };
    const primary = await create('Tin Tiểu học', { audience_levels: ['TH'] });
    assert.deepEqual(primary.audience_levels, ['TH']);
    const all = await create('Tin chung', {});
    assert.deepEqual(all.audience_levels, []);
    // Phạm vi lớp đã thuộc một cấp nên cấp nhận lưu trống
    const classNews = await create('Tin lớp 1A', {
      scope_type: 'class',
      scope_id: classes['1A'],
      audience_levels: ['MN'],
    });
    assert.deepEqual(classNews.audience_levels, []);

    assert.deepEqual(titles((await api('GET', '/news', token('parentPreschool'))).body), ['Tin chung']);
    assert.deepEqual(titles((await api('GET', '/news', token('parentPrimary'))).body), [
      'Tin Tiểu học',
      'Tin chung',
      'Tin lớp 1A',
    ]);
    assert.deepEqual(titles((await api('GET', '/news', token('parentBoth'))).body), [
      'Tin Tiểu học',
      'Tin chung',
      'Tin lớp 1A',
    ]);
    // Xem theo từng con: con Mầm non không thấy tin Tiểu học
    assert.deepEqual(titles((await api('GET', `/news?child_id=${children.BothPreschool}`, token('parentBoth'))).body), [
      'Tin chung',
    ]);
    assert.equal((await api('GET', `/news/${primary.id}`, token('parentPreschool'))).status, 403);
    assert.equal((await api('GET', `/news/${primary.id}`, token('parentPrimary'))).status, 200);
    // Nhân sự quản lý thấy mọi tin của đơn vị
    assert.equal(titles((await api('GET', `/news?org_unit_id=${unitId}`, token('manager'))).body).length, 3);

    const recipients = await schoolYear
      .selectFrom('notification_recipients')
      .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
      .select(['notification_recipients.user_id', 'notification_recipients.role_code'])
      .where('notifications.target_id', '=', primary.id as string)
      .execute();
    assert.deepEqual(
      recipients.map((row) => row.user_id).sort(),
      [users.parentBoth?.userId, users.parentPrimary?.userId].sort(),
    );
    // Tin không ghi cấp gửi theo vai trò phụ huynh của đơn vị như trước
    const generalRecipients = await schoolYear
      .selectFrom('notification_recipients')
      .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
      .select(['notification_recipients.role_code', 'notification_recipients.org_unit_id'])
      .where('notifications.target_id', '=', all.id as string)
      .execute();
    assert.deepEqual(generalRecipients, [{ role_code: 'VT-14', org_unit_id: unitId }]);

    const updated = await api('PATCH', `/news/${all.id}`, token('manager'), { audience_levels: ['DH'] });
    assert.equal(updated.status, 400);
  });
});
