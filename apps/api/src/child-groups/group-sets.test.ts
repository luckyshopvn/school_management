import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { GroupSetsReader, parseGroupSetInput } from './group-sets.js';

// Bộ nhóm dùng chung (DT-28 phần 28a, YCTD-271): kiểm tra dữ liệu gửi lên, xem trước và lưu bộ nhóm theo năng lực và cân
// bằng giới, chia lại lưu trữ bộ cũ, chuyển nhóm, nhóm trưởng, công cụ lớp học 23b dùng bộ nhóm, phụ huynh xem nhóm của con.
// Học sinh, giáo viên là dữ liệu giả
const CLASS_ID = '00000000-0000-4000-8000-000000000001';

describe('Kiểm tra dữ liệu bộ nhóm', () => {
  it('CT-28a-7: thiếu lớp, cách chia lạ, chia tay thiếu nhóm, theo năng lực thiếu môn, nguồn hoạt động chưa có đều báo lỗi', () => {
    const fieldsOf = (body: Record<string, unknown>) => {
      try {
        parseGroupSetInput(body);
        return [];
      } catch (error) {
        return ((error as { details?: Array<{ field: string }> }).details ?? []).map((detail) => detail.field);
      }
    };
    assert.deepEqual(fieldsOf({}), ['class_id']);
    assert.ok(fieldsOf({ class_id: CLASS_ID, method: 'theo-y-thich' }).includes('method'));
    assert.ok(fieldsOf({ class_id: CLASS_ID, method: 'manual' }).includes('groups'));
    assert.ok(fieldsOf({ class_id: CLASS_ID, method: 'ability_mixed' }).includes('subject_id'));
    assert.ok(fieldsOf({ class_id: CLASS_ID, ability_source: 'activity' }).includes('ability_source'));
    assert.ok(fieldsOf({ class_id: CLASS_ID, value: 0 }).includes('value'));
    assert.ok(fieldsOf({ class_id: CLASS_ID, apart: [[CLASS_ID, CLASS_ID]] }).includes('apart'));
    assert.ok(
      fieldsOf({
        class_id: CLASS_ID,
        groups: [
          { name: 'A', child_ids: [] },
          { name: 'A', child_ids: [] },
        ],
      }).includes('groups[1].name'),
    );
    const parsed = parseGroupSetInput({
      class_id: CLASS_ID,
      groups: [{ name: ' Nhóm 1 ', child_ids: [CLASS_ID, CLASS_ID] }],
    });
    assert.equal(parsed.method, 'manual', 'gửi kèm nhóm mà không ghi cách chia là chia tay');
    assert.deepEqual(parsed.groups, [{ name: 'Nhóm 1', child_ids: [CLASS_ID], leader_child_id: null }]);
  });
});

describe('Điểm cuối bộ nhóm', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  let outsider: LoggedInUser;
  let parent: LoggedInUser;
  let otherParent: LoggedInUser;
  let unitId = '';
  let classId = '';
  let mathId = '';
  const children: string[] = [];
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, token: string, body?: unknown) => sendJson(method, url(path), token, body);

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
        code: 'THCS-28A',
        name: 'Trường THCS thử',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    const current = await api('GET', '/school-levels', principal.accessToken);
    const levels = (current.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'MN' || code === 'THCS',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', principal.accessToken, { levels })).status, 200);
    assert.equal(
      (await api('POST', '/grade-levels/templates', principal.accessToken, { school_level: 'THCS' })).status,
      200,
    );
    assert.equal(
      (await api('POST', '/subjects/templates', principal.accessToken, { school_level: 'THCS' })).status,
      200,
    );
    const subjects = (await api('GET', '/subjects?school_level=THCS', principal.accessToken)).body as unknown as Array<
      Record<string, unknown>
    >;
    mathId = (subjects.find((row) => row.code === 'THCS-TOAN')?.id as string) ?? '';
    teacher = await environment.loginAs('VT-07', unitId);
    outsider = await environment.loginAs('VT-07', unitId);
    parent = await environment.loginAs('VT-14', unitId);
    otherParent = await environment.loginAs('VT-14', unitId);
    classId = (
      await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: unitId,
          academic_year_id: academicYearId,
          code: '7A',
          name: 'Lớp 7A',
          grade_level: 'K7',
          school_level: 'THCS',
          max_size: 45,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    const assigned = await api('POST', `/classes/${classId}/staff-assignments`, principal.accessToken, {
      staff_user_id: teacher.userId,
      assignment_role: 'homeroom',
    });
    assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME-28A', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    // Mười hai học sinh, sáu nam sáu nữ; điểm Toán học kỳ I từ 9,5 giảm dần
    for (let index = 0; index < 12; index += 1) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: `Học sinh ${String(index + 1).padStart(2, '0')}`,
          dob: '2013-03-01',
          gender: index % 2 === 0 ? 'male' : 'female',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'granted',
          status: 'active',
          enroll_date: '2026-09-05',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      children.push(child.id);
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classId, from_date: '2026-09-05', order_number: index + 1 })
        .execute();
      const score = 9.5 - index * 0.5;
      await schoolYear
        .insertInto('score_entries')
        .values(
          (['regular', 'mid', 'final'] as const).map((kind) => ({
            class_id: classId,
            child_id: child.id,
            subject_id: mathId,
            term_type: 'first_term' as const,
            kind,
            score,
            updated_by: principal.userId,
            updated_by_name: 'Hiệu trưởng',
          })),
        )
        .execute();
    }
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Phụ huynh 01', phone: `09${Date.now() % 100_000_000}`, user_id: parent.userId })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('child_guardians')
      .values({
        child_id: children[0] ?? '',
        guardian_id: guardian.id,
        relationship_item_id: relationship.id,
        is_primary: true,
      })
      .execute();
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment?.close();
  });

  const child = (index: number) => children[index] ?? '';

  it('CT-28a-8: xem trước theo năng lực có cân bằng giới: nhóm đều, không lộ năng lực, cùng hạt cùng kết quả; người ngoài bị chặn', async () => {
    const body = {
      class_id: classId,
      subject_id: mathId,
      method: 'ability_mixed',
      by: 'count',
      value: 3,
      seed: 42,
      balance_gender: true,
      apart: [[child(0), child(1)]],
    };
    const preview = await api('POST', '/group-sets/preview', teacher.accessToken, body);
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    const groups = preview.body.groups as Array<{ name: string; child_ids: string[] }>;
    assert.deepEqual(
      groups.map((group) => group.child_ids.length),
      [4, 4, 4],
    );
    assert.deepEqual(preview.body.violations, []);
    assert.ok(!JSON.stringify(preview.body).includes('ability'), 'không trả mức năng lực');
    // Mỗi nhóm có đúng một trong bốn bạn giỏi nhất... trừ khi bốn bạn chia ba nhóm: tổng điểm các nhóm gần nhau
    const scoreOf = (id: string) => 9.5 - children.indexOf(id) * 0.5;
    const totals = groups.map((group) => group.child_ids.reduce((total, id) => total + scoreOf(id), 0));
    assert.ok(Math.max(...totals) - Math.min(...totals) <= 1.5, totals.join(', '));
    for (const group of groups) {
      const males = group.child_ids.filter((id) => children.indexOf(id) % 2 === 0).length;
      assert.equal(males, 2, 'mỗi nhóm hai nam hai nữ');
    }
    const again = await api('POST', '/group-sets/preview', teacher.accessToken, body);
    assert.deepEqual(again.body.groups, preview.body.groups);
    assert.equal((await api('POST', '/group-sets/preview', outsider.accessToken, body)).status, 403);
    assert.equal(
      (await api('POST', '/group-sets/preview', teacher.accessToken, { ...body, ability_source: 'activity' })).status,
      400,
    );
  });

  it('CT-28a-9: lưu bộ nhóm, xem danh sách và chi tiết; chia lại lưu trữ bộ cũ; nhóm của bộ không hiện ở 4.1.6', async () => {
    const created = await api('POST', '/group-sets', teacher.accessToken, {
      class_id: classId,
      subject_id: mathId,
      method: 'random',
      by: 'size',
      value: 4,
      seed: 3,
      leader_mode: 'rotate',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.purpose, 'subject');
    assert.equal(created.body.can_edit, true);
    const groups = created.body.groups as Array<{
      child_ids: string[];
      leader_child_id: string | null;
      members: unknown[];
    }>;
    assert.equal(groups.length, 3);
    assert.ok(
      groups.every((group) => group.leader_child_id === group.child_ids[0]),
      'luân phiên bắt đầu từ bạn đầu',
    );
    // Tham số chỉ có cách chia, không có mã hay mức năng lực của học sinh nào
    const params = JSON.stringify(created.body.params);
    assert.ok(children.every((id) => !params.includes(id)));
    assert.equal((created.body.params as { ability_source: unknown }).ability_source, null);

    const resplit = await api('POST', '/group-sets', teacher.accessToken, {
      class_id: classId,
      subject_id: mathId,
      method: 'gender_balanced',
      by: 'count',
      value: 2,
      replaces_id: created.body.id,
    });
    assert.equal(resplit.status, 201, JSON.stringify(resplit.body));
    const active = await api('GET', `/group-sets?class_id=${classId}`, teacher.accessToken);
    assert.deepEqual(
      (active.body as unknown as Array<{ id: string }>).map((row) => row.id),
      [resplit.body.id],
    );
    const all = await api('GET', `/group-sets?class_id=${classId}&include_archived=true`, principal.accessToken);
    const archived = (all.body as unknown as Array<{ id: string; status: string }>).find(
      (row) => row.id === created.body.id,
    );
    assert.equal(archived?.status, 'archived');
    assert.equal(
      ((await api('GET', `/group-sets/${created.body.id}`, teacher.accessToken)).body.groups as unknown[]).length,
      3,
      'bộ cũ giữ nguyên nhóm',
    );
    assert.equal(
      (await api('PATCH', `/group-sets/${created.body.id}`, teacher.accessToken, { name: 'Đổi tên' })).status,
      400,
      'bộ đã lưu trữ không sửa được',
    );
    const legacy = await api('GET', '/child-groups', principal.accessToken);
    assert.equal(legacy.status, 200);
    assert.deepEqual(legacy.body, [], 'nhóm thuộc bộ không lẫn vào danh sách nhóm 4.1.6');
    assert.equal((await api('GET', `/group-sets?class_id=${classId}`, outsider.accessToken)).status, 403);
  });

  it('CT-28a-10: chuyển nhóm, đặt và luân phiên nhóm trưởng có lịch sử; chỉ người lập hoặc Ban Giám hiệu sửa', async () => {
    const created = await api('POST', '/group-sets', teacher.accessToken, {
      class_id: classId,
      purpose: 'activity',
      name: 'Dự án môi trường',
      groups: [
        { name: 'Xanh', child_ids: [child(0), child(1), child(2)], leader_child_id: child(1) },
        { name: 'Sạch', child_ids: [child(3), child(4)] },
      ],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const [green, clean] = created.body.groups as Array<{ id: string }>;
    const moved = await api('POST', `/group-sets/${created.body.id}/move`, teacher.accessToken, {
      child_id: child(1),
      to_group_id: clean?.id,
    });
    assert.equal(moved.status, 200, JSON.stringify(moved.body));
    const afterMove = moved.body.groups as Array<{ id: string; child_ids: string[]; leader_child_id: string | null }>;
    assert.equal(
      afterMove.find((group) => group.id === green?.id)?.leader_child_id,
      null,
      'chuyển đi thì thôi nhóm trưởng',
    );
    assert.ok(afterMove.find((group) => group.id === clean?.id)?.child_ids.includes(child(1)));
    const leader = await api('POST', `/group-sets/${created.body.id}/groups/${clean?.id}/leader`, teacher.accessToken, {
      child_id: child(3),
    });
    assert.equal(leader.status, 200);
    assert.equal(
      (
        await api('POST', `/group-sets/${created.body.id}/groups/${clean?.id}/leader`, teacher.accessToken, {
          child_id: child(0),
        })
      ).status,
      400,
      'nhóm trưởng phải trong nhóm',
    );
    const rotated = await api('POST', `/group-sets/${created.body.id}/leaders`, principal.accessToken, {
      mode: 'rotate',
    });
    assert.equal(rotated.status, 200, JSON.stringify(rotated.body));
    const cleanAfter = (
      rotated.body.groups as Array<{ id: string; child_ids: string[]; leader_child_id: string }>
    ).find((group) => group.id === clean?.id);
    const order = cleanAfter?.child_ids ?? [];
    assert.equal(cleanAfter?.leader_child_id, order[(order.indexOf(child(3)) + 1) % order.length]);
    const role = await schoolYear
      .selectFrom('child_group_members')
      .select(['child_id', 'role'])
      .where('group_id', '=', clean?.id ?? '')
      .where('role', '=', 'leader')
      .execute();
    assert.deepEqual(
      role.map((row) => row.child_id),
      [cleanAfter?.leader_child_id],
    );
    const events = await schoolYear
      .selectFrom('child_group_member_events')
      .select('event')
      .where('group_set_id', '=', created.body.id as string)
      .execute();
    assert.ok(events.some((row) => row.event === 'moved'));
    assert.ok(events.some((row) => row.event === 'leader_set'));
    const otherTeacher = await environment.loginAs('VT-07', unitId);
    await schoolYear
      .insertInto('class_staff_assignments')
      .values({
        class_id: classId,
        staff_user_id: otherTeacher.userId,
        staff_name: 'Giáo viên Toán 7A',
        assignment_role: 'subject',
        subject_name: 'Toán',
        subject_id: mathId,
        from_date: '2026-09-05',
      })
      .execute();
    assert.equal(
      (await api('POST', `/group-sets/${created.body.id}/leaders`, otherTeacher.accessToken, { mode: 'random' }))
        .status,
      403,
      'giáo viên khác của lớp xem được nhưng không sửa bộ của người khác',
    );
    assert.equal((await api('GET', `/group-sets/${created.body.id}`, otherTeacher.accessToken)).status, 200);
  });

  it('CT-28a-11: công cụ lớp học lưu bản chia thành bộ classroom, chọn được bộ sẵn có; hàm đọc ổn định cho phần khác', async () => {
    const groups = [
      { name: 'Nhóm 1', child_ids: [child(0), child(1)] },
      { name: 'Nhóm 2', child_ids: [child(2)] },
    ];
    const saved = await api('PUT', `/classroom-tools/classes/${classId}/grouping`, teacher.accessToken, { groups });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(saved.body.groups, groups);
    const again = await api('PUT', `/classroom-tools/classes/${classId}/grouping`, teacher.accessToken, { groups });
    assert.equal(again.status, 200);
    const reader = new GroupSetsReader();
    const classroomSets = await reader.activeSets(schoolYear, { classId, purpose: 'classroom' });
    assert.equal(classroomSets.length, 1, 'bản chia không đổi thì không tạo bộ mới');
    const source = (await api('GET', `/group-sets?class_id=${classId}&purpose=activity`, teacher.accessToken))
      .body as unknown as Array<{ id: string }>;
    const sourceSet = await api('GET', `/group-sets/${source[0]?.id}`, teacher.accessToken);
    const picked = (sourceSet.body.groups as Array<{ name: string; child_ids: string[] }>).map(
      ({ name, child_ids }) => ({ name, child_ids }),
    );
    const chosen = await api('PUT', `/classroom-tools/classes/${classId}/grouping`, teacher.accessToken, {
      groups: picked,
      group_set_id: source[0]?.id,
    });
    assert.equal(chosen.status, 200, JSON.stringify(chosen.body));
    assert.deepEqual(chosen.body.groups, picked);
    const sets = await reader.activeSets(schoolYear, { classId, purpose: 'classroom' });
    assert.equal(sets.length, 1, 'bộ classroom cũ lưu trữ');
    const row = await schoolYear
      .selectFrom('group_sets')
      .select('params')
      .where('id', '=', sets[0]?.id ?? '')
      .executeTakeFirstOrThrow();
    assert.equal((row.params as { source_group_set_id?: string }).source_group_set_id, source[0]?.id);
    const legacy = await schoolYear
      .selectFrom('classroom_groupings')
      .select('groups')
      .where('class_id', '=', classId)
      .where('owner_user_id', '=', teacher.userId)
      .executeTakeFirstOrThrow();
    assert.equal((legacy.groups as unknown[]).length, picked.length, 'bảng cũ vẫn ghi song song');
    const ofSet = await reader.groupsOfSet(schoolYear, sets[0]?.id ?? '');
    assert.deepEqual(
      ofSet.map((group) => group.name),
      picked.map((group) => group.name),
    );
    assert.deepEqual(await reader.childIdsOfGroup(schoolYear, ofSet[0]?.id ?? ''), ofSet[0]?.child_ids);
    const mine = await reader.groupsOfChild(schoolYear, child(0));
    assert.ok(mine.some((entry) => entry.group_set_id === sets[0]?.id));
  });

  it('CT-28a-12: phụ huynh thấy nhóm của con (tên nhóm, nhóm trưởng, bạn trong nhóm), không thấy cách chia; phụ huynh khác bị chặn', async () => {
    const mine = await api('GET', `/group-sets/children/${child(0)}`, parent.accessToken);
    assert.equal(mine.status, 200, JSON.stringify(mine.body));
    const entries = mine.body as unknown as Array<Record<string, unknown>>;
    assert.ok(entries.length > 0);
    assert.ok(
      entries.every((entry) => Array.isArray(entry.members) && (entry.members as string[]).includes('Học sinh 01')),
    );
    assert.ok(!JSON.stringify(entries).includes('method') && !JSON.stringify(entries).includes('params'));
    assert.equal((await api('GET', `/group-sets/children/${child(0)}`, otherParent.accessToken)).status, 403);
    assert.equal((await api('GET', `/group-sets/children/${child(0)}`, teacher.accessToken)).status, 200);
  });
});
