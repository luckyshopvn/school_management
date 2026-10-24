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
import {
  addDays,
  cardNumber,
  copyNumber,
  indicatorPassed,
  indicatorValues,
  lateFine,
  normalizeScannedCode,
  overdueDays,
  stocktakeResult,
} from './library-calc.js';

// Thư viện trường học (DT-22 phần 22a, YCTD-181); kịch bản CT-22a-1 đến CT-22a-7
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };

describe('Tính thuần của thư viện', () => {
  it('CT-22a-1: ngày hạn, phạt trễ hạn, số cấp, chỉ tiêu, kết quả kiểm kê', () => {
    assert.equal(addDays('2026-01-30', 3), '2026-02-02');
    assert.equal(overdueDays('2026-10-01', '2026-10-05'), 4);
    assert.equal(overdueDays('2026-10-05', '2026-10-01'), 0);
    assert.equal(lateFine(500, '2026-10-01', '2026-10-05'), 2000);
    assert.equal(lateFine(0, '2026-10-01', '2026-10-05'), 0);
    assert.equal(copyNumber(7), 'SH-000007');
    assert.equal(cardNumber(1234567), 'TV-1234567');
    assert.equal(normalizeScannedCode(' sh-000007\n'), 'SH-000007');
    const values = indicatorValues({
      students: 200,
      teachers: 10,
      textbookCopies: 300,
      referenceCopies: 100,
      teacherBookCopies: 40,
      totalCopies: 600,
      activeTitles: 150,
      digitalTitles: 5,
      readersWithLoan: 42,
    });
    assert.equal(values.textbooks_per_student, 1.5);
    assert.equal(values.reference_per_student, 0.5);
    assert.equal(values.teacher_books_per_teacher, 4);
    assert.equal(values.reader_rate, 20);
    assert.equal(indicatorValues({ ...{ students: 0, teachers: 0 }, textbookCopies: 1, referenceCopies: 0, teacherBookCopies: 0, totalCopies: 1, activeTitles: 1, digitalTitles: 0, readersWithLoan: 0 }).textbooks_per_student, null);
    assert.equal(indicatorPassed(1.5, 1), true);
    assert.equal(indicatorPassed(0.5, 1), false);
    assert.equal(indicatorPassed(1, null), null);
    assert.equal(indicatorPassed(null, 1), null);
    const result = stocktakeResult([
      { id: 'a', condition: 'good', onLoan: false, scanned: true },
      { id: 'b', condition: 'good', onLoan: false, scanned: false },
      { id: 'c', condition: 'good', onLoan: true, scanned: false },
      { id: 'd', condition: 'good', onLoan: true, scanned: true },
      { id: 'e', condition: 'damaged', onLoan: false, scanned: true },
      { id: 'f', condition: 'lost', onLoan: false, scanned: false },
    ]);
    assert.deepEqual(result, { found: 3, missing: ['b'], surplus: ['d'], damaged: ['e'] });
  });
});

describe('Thư viện trường học', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let unitId = '';
  const users: Record<string, LoggedInUser> = {};
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};
  const titles: Record<string, string> = {};
  const copies: Record<string, string[]> = {};
  const readers: Record<string, string> = {};
  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);

  const category = async (code: string) =>
    (await schoolYear.selectFrom('library_categories').select('id').where('code', '=', code).executeTakeFirstOrThrow()).id;

  async function addTitle(key: string, categoryCode: string, quantity: number, extra: Record<string, unknown> = {}) {
    const created = await api('POST', '/library/titles', principal.accessToken, {
      category_id: await category(categoryCode),
      title: `Ấn phẩm ${key}`,
      authors: 'Tác giả mẫu',
      ...extra,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    titles[key] = created.body.id as string;
    if (quantity > 0) {
      const made = await api('POST', `/library/titles/${titles[key]}/copies`, principal.accessToken, { quantity });
      assert.equal(made.status, 201, JSON.stringify(made.body));
      copies[key] = (made.body as unknown as Array<{ copy_no: string }>).map((copy) => copy.copy_no);
    }
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026-2027', {
      first_term: { start_date: addDays(vietnamToday, -60), end_date: addDays(vietnamToday, 90) },
      second_term: { start_date: addDays(vietnamToday, 95), end_date: addDays(vietnamToday, 200) },
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
    users.teacher = await environment.loginAs('VT-07', unitId);
    users.parent = await environment.loginAs('VT-14', unitId);
    users.otherParent = await environment.loginAs('VT-14', unitId);
    const current = await api('GET', '/school-levels', principal.accessToken);
    const levels = (current.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'MN' || code === 'TH',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', principal.accessToken, { levels })).status, 200);
    await api('POST', '/grade-levels', principal.accessToken, {
      code: 'MAM',
      name: 'Mầm',
      age_from_months: 36,
      age_to_months: 71,
    });
    await api('POST', '/grade-levels', principal.accessToken, { code: 'K1', name: 'Khối 1', school_level: 'TH' });
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
    for (const [key, classCode, parent] of [
      ['An', '1A', 'parent'],
      ['Binh', '1A', 'otherParent'],
      ['Chi', '1A', null],
      ['Dung', 'MAM-1', null],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: `Học sinh ${key}`,
          dob: '2019-03-01',
          gender: 'female',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'granted',
          status: 'active',
          enroll_date: addDays(vietnamToday, -60),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      children[key] = child.id;
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classes[classCode] ?? '', from_date: addDays(vietnamToday, -60) })
        .execute();
      if (parent) {
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
          .values({ child_id: child.id, guardian_id: guardian.id, relationship_item_id: relationship.id, is_primary: true })
          .execute();
      }
    }
    for (const [key, user] of [['GV', 'teacher'] as const]) {
      await schoolYear
        .insertInto('staff')
        .values({
          org_unit_id: unitId,
          code: `NV-${key}`,
          full_name: `Giáo viên ${key}`,
          start_date: addDays(vietnamToday, -400),
          user_id: users[user]?.userId ?? null,
        })
        .execute();
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-22a-2: ấn phẩm, bản sao cấp số liên tiếp; tìm theo từ khóa; phân quyền xem và quản lý', async () => {
    await addTitle('Toan1', 'SGK', 3, { grade_level: 'K1', school_level: 'TH' });
    await addTitle('Truyen', 'TRUYEN', 2);
    await addTitle('Bao', 'BAO', 1);
    assert.deepEqual(copies.Toan1, ['SH-000001', 'SH-000002', 'SH-000003']);
    assert.deepEqual(copies.Truyen, ['SH-000004', 'SH-000005']);
    const list = await api('GET', '/library/titles?query=Toan1', token('teacher'));
    assert.equal(list.status, 200, JSON.stringify(list.body));
    assert.equal(list.body.total, 1);
    const first = (list.body.items as Array<Record<string, unknown>>)[0] ?? {};
    assert.equal(first.copies_total, 3);
    assert.equal(first.copies_available, 3);
    // Giáo viên tra cứu được nhưng không ghi được
    const denied = await api('POST', '/library/titles', token('teacher'), { category_id: await category('SGK'), title: 'X' });
    assert.equal(denied.status, 403);
    assert.equal((await api('GET', '/library/titles', token('parent'))).status, 403);
    const invalid = await api('POST', `/library/titles/${titles.Toan1}/copies`, principal.accessToken, { quantity: 0 });
    assert.equal(invalid.status, 400);
  });

  it('CT-22a-3: đồng bộ thẻ cấp cho cán bộ và học sinh cấp có mượn, không cấp cho Mầm non; khóa thẻ', async () => {
    const synced = await api('POST', '/library/readers/sync', principal.accessToken);
    assert.equal(synced.status, 200, JSON.stringify(synced.body));
    assert.equal(synced.body.issued_staff, 1);
    assert.equal(synced.body.issued_students, 3);
    assert.equal(((await api('POST', '/library/readers/sync', principal.accessToken)).body as Record<string, number>).issued_students, 0);
    const list = await api('GET', '/library/readers?limit=50', principal.accessToken);
    const names = (list.body.items as Array<{ full_name: string; id: string }>).map((row) => row.full_name);
    assert.ok(!names.includes('Học sinh Dung'));
    for (const row of list.body.items as Array<{ full_name: string; id: string }>) {
      readers[row.full_name.replace('Học sinh ', '').replace('Giáo viên ', 'GV-')] = row.id;
    }
    const mam = await api('POST', '/library/readers', principal.accessToken, { child_id: children.Dung });
    assert.equal(errorOf(mam.body).code, 'ERR_RULE_VIOLATION', JSON.stringify(mam.body));
    const locked = await api('PATCH', `/library/readers/${readers.Chi}`, principal.accessToken, { status: 'locked' });
    assert.equal(locked.status, 400);
    const ok = await api('PATCH', `/library/readers/${readers.Chi}`, principal.accessToken, { status: 'locked', reason: 'Mất thẻ' });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const lend = await api('POST', '/library/loans', principal.accessToken, { reader_id: readers.Chi, copy_codes: [copies.Truyen?.[0]] });
    assert.equal(errorOf(lend.body).code, 'ERR_RULE_VIOLATION');
    assert.equal((await api('PATCH', `/library/readers/${readers.Chi}`, principal.accessToken, { status: 'active' })).status, 200);
  });

  it('CT-22a-4: mượn đúng quy định; quá hạn chặn mượn tiếp; trả tính phạt; gia hạn; sách đọc tại chỗ không cho mượn', async () => {
    const rules = await api('GET', '/library/settings', principal.accessToken);
    const body = {
      student_levels: ['TH', 'THCS', 'THPT'],
      hold_days: 3,
      rules: (rules.body.rules as Array<Record<string, number | string>>).map((rule) =>
        rule.reader_kind === 'student' ? { ...rule, max_items: 2, fine_per_day: 500 } : rule,
      ),
    };
    assert.equal((await api('PUT', '/library/settings', principal.accessToken, body)).status, 200);
    const [a, b, c] = copies.Truyen ?? [];
    const lent = await api('POST', '/library/loans', principal.accessToken, { reader_id: readers.An, copy_codes: [a] });
    assert.equal(lent.status, 201, JSON.stringify(lent.body));
    // Một bản chỉ một người mượn
    const again = await api('POST', '/library/loans', principal.accessToken, { reader_id: readers.Binh, copy_codes: [a] });
    assert.equal(errorOf(again.body).code, 'ERR_RULE_VIOLATION');
    // Vượt mức 2 bản
    const over = await api('POST', '/library/loans', principal.accessToken, {
      reader_id: readers.An,
      copy_codes: [b, copies.Toan1?.[0], c].filter(Boolean),
    });
    assert.equal(errorOf(over.body).code, 'ERR_RULE_VIOLATION');
    // Báo, tạp chí đọc tại chỗ
    const bao = await api('POST', '/library/loans', principal.accessToken, { reader_id: readers.Binh, copy_codes: [copies.Bao?.[0]] });
    assert.equal(errorOf(bao.body).code, 'ERR_RULE_VIOLATION');
    // Quá hạn 4 ngày: chặn mượn tiếp, trả bị phạt 4 × 500
    await schoolYear
      .updateTable('library_loans')
      .set({ loaned_on: addDays(vietnamToday, -18), due_on: addDays(vietnamToday, -4) })
      .execute();
    const blocked = await api('POST', '/library/loans', principal.accessToken, { reader_id: readers.An, copy_codes: [b] });
    assert.equal(errorOf(blocked.body).code, 'ERR_RULE_VIOLATION');
    const overdue = await api('GET', '/library/loans?status=overdue', principal.accessToken);
    assert.equal(overdue.body.total, 1);
    const reminded = await api('POST', '/library/loans/remind', principal.accessToken);
    assert.equal(reminded.status, 200, JSON.stringify(reminded.body));
    assert.equal(((await api('POST', '/library/loans/remind', principal.accessToken)).body as Record<string, number>).loans, 0);
    const returned = await api('POST', '/library/loans/return', principal.accessToken, { copy_code: a });
    assert.equal(returned.status, 200, JSON.stringify(returned.body));
    assert.equal(returned.body.fine_amount, 2000);
    assert.equal(returned.body.overdue_days, 4);
    // Gia hạn: mượn bản mới, gia hạn một lần, lần hai vượt mức
    const second = await api('POST', '/library/loans', principal.accessToken, { reader_id: readers.An, copy_codes: [b] });
    const loanId = (second.body.loans as Array<{ id: string }>)[0]?.id ?? '';
    assert.equal((await api('POST', `/library/loans/${loanId}/renew`, principal.accessToken)).status, 200);
    assert.equal(errorOf((await api('POST', `/library/loans/${loanId}/renew`, principal.accessToken)).body).code, 'ERR_RULE_VIOLATION');
    // Phụ huynh xem sách của con mình, không xem của con người khác
    const mine = await api('GET', `/library/children/${children.An}/loans`, token('parent'));
    assert.equal(mine.status, 200, JSON.stringify(mine.body));
    assert.equal((mine.body.loans as unknown[]).length, 1);
    assert.equal((await api('GET', `/library/children/${children.An}/loans`, token('otherParent'))).status, 403);
    assert.equal((await api('POST', '/library/loans/return', principal.accessToken, { copy_code: b })).status, 200);
  });

  it('CT-22a-5: đặt trước chỉ khi hết bản; trả về thì giữ cho người đầu hàng đợi; người khác không mượn được bản đang giữ', async () => {
    const [x, y] = copies.Truyen ?? [];
    assert.equal((await api('POST', '/library/loans', principal.accessToken, { reader_id: readers.An, copy_codes: [x] })).status, 201);
    assert.equal((await api('POST', '/library/loans', principal.accessToken, { reader_id: readers.An, copy_codes: [y] })).status, 201);
    // Còn bản ở các bản khác thì không cần đặt: Truyen có 2 bản đều đang mượn nên được đặt
    const reserved = await api('POST', '/library/reservations', principal.accessToken, {
      reader_id: readers.Binh,
      title_id: titles.Truyen,
    });
    assert.equal(reserved.status, 201, JSON.stringify(reserved.body));
    const duplicate = await api('POST', '/library/reservations', principal.accessToken, { reader_id: readers.Binh, title_id: titles.Truyen });
    assert.equal(errorOf(duplicate.body).code, 'ERR_RULE_VIOLATION');
    const noNeed = await api('POST', '/library/reservations', principal.accessToken, { reader_id: readers.Binh, title_id: titles.Toan1 });
    assert.equal(errorOf(noNeed.body).code, 'ERR_RULE_VIOLATION');
    const back = await api('POST', '/library/loans/return', principal.accessToken, { copy_code: x });
    assert.equal(back.body.reservation_for, 'Học sinh Binh');
    const held = await api('GET', '/library/reservations', principal.accessToken);
    const row = (held.body as unknown as Array<{ status: string; copy_no: string }>)[0];
    assert.equal(row?.status, 'ready');
    assert.equal(row?.copy_no, x);
    const stolen = await api('POST', '/library/loans', principal.accessToken, { reader_id: readers.Chi, copy_codes: [x] });
    assert.equal(errorOf(stolen.body).code, 'ERR_RULE_VIOLATION');
    // Người đặt mượn được bản giữ, lượt đặt đóng
    assert.equal((await api('POST', '/library/loans', principal.accessToken, { reader_id: readers.Binh, copy_codes: [x] })).status, 201);
    assert.equal(((await api('GET', '/library/reservations', principal.accessToken)).body as unknown as unknown[]).length, 0);
    // Báo mất đánh dấu bản mất
    const loans = await api('GET', '/library/loans?status=open&query=Binh', principal.accessToken);
    const lostId = (loans.body.items as Array<{ id: string }>)[0]?.id ?? '';
    const lost = await api('POST', `/library/loans/${lostId}/lost`, principal.accessToken, { note: 'Làm mất, đã hẹn bồi thường' });
    assert.equal(lost.body.status, 'lost');
    const condition = await schoolYear.selectFrom('library_copies').select('condition').where('copy_no', '=', x ?? '').executeTakeFirstOrThrow();
    assert.equal(condition.condition, 'lost');
    assert.equal((await api('POST', '/library/loans/return', principal.accessToken, { copy_code: y })).status, 200);
  });

  it('CT-22a-6: phát bộ sách giáo khoa cho lớp, báo thiếu bản; thu lại hàng loạt', async () => {
    const set = await api('POST', '/library/textbook-sets', principal.accessToken, {
      name: 'Bộ sách khối 1',
      grade_level: 'K1',
      title_ids: [titles.Toan1],
    });
    assert.equal(set.status, 201, JSON.stringify(set.body));
    const issued = await api('POST', '/library/textbooks/issue', principal.accessToken, { class_id: classes['1A'], set_id: set.body.id });
    assert.equal(issued.status, 200, JSON.stringify(issued.body));
    // Lớp 3 học sinh, kho có 3 bản Toan1
    assert.equal(issued.body.issued, 3);
    assert.deepEqual(issued.body.shortages, []);
    const again = await api('POST', '/library/textbooks/issue', principal.accessToken, { class_id: classes['1A'], set_id: set.body.id });
    assert.equal(again.body.issued, 0);
    const wrong = await api('POST', '/library/textbooks/issue', principal.accessToken, { class_id: classes['MAM-1'], set_id: set.body.id });
    assert.equal(errorOf(wrong.body).code, 'ERR_RULE_VIOLATION');
    const outstanding = await api('GET', `/library/textbooks/outstanding?class_id=${classes['1A']}`, principal.accessToken);
    assert.equal((outstanding.body as unknown as unknown[]).length, 3);
    // Sách giáo khoa cấp đầu năm không gia hạn
    const first = (outstanding.body as unknown as Array<{ id: string }>)[0]?.id ?? '';
    assert.equal(errorOf((await api('POST', `/library/loans/${first}/renew`, principal.accessToken)).body).code, 'ERR_RULE_VIOLATION');
    const collected = await api('POST', '/library/loans/return-many', principal.accessToken, {
      items: (outstanding.body as unknown as Array<{ id: string }>).map((item, index) => ({ loan_id: item.id, condition: index === 0 ? 'damaged' : 'good' })),
    });
    assert.equal(collected.status, 200, JSON.stringify(collected.body));
    assert.equal(collected.body.returned, 3);
    // Thêm học sinh vào lớp thì thiếu bản: 1 bản hỏng, 2 bản tốt, 1 học sinh mới
    const extra = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: unitId,
        full_name: 'Học sinh Em',
        dob: '2019-03-01',
        gender: 'male',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: randomUUID(),
        national_id_last4: '0000',
        photo_consent: 'granted',
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: extra.id, class_id: classes['1A'] ?? '', from_date: vietnamToday })
      .execute();
    const short = await api('POST', '/library/textbooks/issue', principal.accessToken, { class_id: classes['1A'], set_id: set.body.id });
    assert.equal(short.body.issued, 2);
    const shortages = short.body.shortages as Array<{ missing: number }>;
    assert.equal(shortages[0]?.missing, 2);
  });

  it('CT-22a-7: kiểm kê tìm bản thiếu, thừa, hỏng; xử lý bản thiếu; thanh lý; báo cáo và chỉ tiêu', async () => {
    const stocktake = await api('POST', '/library/stocktakes', principal.accessToken, { name: 'Kiểm kê cuối kỳ' });
    assert.equal(stocktake.status, 201, JSON.stringify(stocktake.body));
    const id = stocktake.body.id as string;
    // Quét 1 bản truyện (bản SH-000005) và 1 bản Toan1 đang cho mượn; không quét các bản còn lại
    const scanGood = await api('POST', `/library/stocktakes/${id}/scan`, principal.accessToken, { code: ' sh-000005 ' });
    assert.equal(scanGood.status, 200, JSON.stringify(scanGood.body));
    assert.equal((await api('POST', `/library/stocktakes/${id}/scan`, principal.accessToken, { code: 'SH-000005' })).body.duplicate, true);
    assert.equal((await api('POST', `/library/stocktakes/${id}/scan`, principal.accessToken, { code: 'SH-999999' })).status, 404);
    const early = await api('POST', `/library/stocktakes/${id}/resolve`, principal.accessToken, { copy_ids: [randomUUID()], action: 'lost', reason: 'x' });
    assert.equal(errorOf(early.body).code, 'ERR_RULE_VIOLATION');
    const closed = await api('POST', `/library/stocktakes/${id}/close`, principal.accessToken);
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    const missing = closed.body.missing as Array<{ id: string; copy_no: string }>;
    assert.ok(missing.length >= 1);
    assert.equal((await api('POST', `/library/stocktakes/${id}/scan`, principal.accessToken, { code: 'SH-000005' })).status, 422);
    const target = missing.find((item) => item.copy_no === copies.Bao?.[0]) ?? missing[0];
    const bad = await api('POST', `/library/stocktakes/${id}/resolve`, principal.accessToken, { copy_ids: [target?.id], action: 'dispose' });
    assert.equal(bad.status, 400);
    const resolved = await api('POST', `/library/stocktakes/${id}/resolve`, principal.accessToken, {
      copy_ids: [target?.id],
      action: 'dispose',
      reason: 'Sách cũ rách',
    });
    assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
    const gone = await schoolYear.selectFrom('library_copies').select('condition').where('id', '=', target?.id ?? '').executeTakeFirstOrThrow();
    assert.equal(gone.condition, 'disposed');
    // Báo cáo: có số liệu, chỉ tiêu chưa đặt ngưỡng thì chưa kết luận; đặt ngưỡng thì đạt hoặc không
    const overview = await api('GET', '/library/reports/overview', principal.accessToken);
    assert.equal(overview.status, 200, JSON.stringify(overview.body));
    assert.equal(overview.body.students, 3 + 1);
    const indicators = overview.body.indicators as Array<{ code: string; value: number | null; passed: boolean | null }>;
    const textbooks = indicators.find((item) => item.code === 'textbooks_per_student');
    assert.equal(textbooks?.passed, null);
    const settings = await api('GET', '/library/settings', principal.accessToken);
    const put = await api('PUT', '/library/settings', principal.accessToken, {
      student_levels: settings.body.student_levels,
      hold_days: settings.body.hold_days,
      rules: settings.body.rules,
      indicators: [{ code: 'textbooks_per_student', threshold: 10, enabled: true }],
    });
    assert.equal(put.status, 200, JSON.stringify(put.body));
    const after = await api('GET', '/library/reports/overview', principal.accessToken);
    assert.equal((after.body.indicators as Array<{ code: string; passed: boolean | null }>).find((item) => item.code === 'textbooks_per_student')?.passed, false);
    assert.equal((await api('GET', '/library/reports/overview', token('teacher'))).status, 403);
    const exported = await api('GET', '/library/reports/export?type=bad', principal.accessToken);
    assert.equal(exported.status, 400);
  });
  it('CT-22a-8: mở năm học mới chép kho thư viện, giữ mã phân loại, bản đang mượn; số đăng ký cá biệt chạy tiếp', async () => {
    const before = {
      categories: await schoolYear.selectFrom('library_categories').select(['id', 'code']).orderBy('code').execute(),
      copies: (await schoolYear.selectFrom('library_copies').select('id').execute()).length,
      titles: (await schoolYear.selectFrom('library_titles').select('id').execute()).length,
      readers: (await schoolYear.selectFrom('library_readers').select('id').execute()).length,
      open: (await schoolYear.selectFrom('library_loans').select('id').where('status', '=', 'open').execute()).length,
      closed: (await schoolYear.selectFrom('library_loans').select('id').where('status', '!=', 'open').execute()).length,
    };
    assert.ok(before.open > 0 && before.closed > 0);
    const created = await api('POST', '/academic-years', principal.accessToken, { name: '2027–2028' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const newYearId = created.body.id as string;
    const calendar = await api('PUT', `/academic-years/${newYearId}/calendar`, principal.accessToken, {
      first_term: { start_date: '2027-09-06', end_date: '2028-01-14' },
      second_term: { start_date: '2028-01-17', end_date: '2028-05-26' },
      summer_term: null,
    });
    assert.equal(calendar.status, 200, JSON.stringify(calendar.body));
    const opened = await api('POST', `/academic-years/${newYearId}/open`, principal.accessToken);
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', newYearId)
      .executeTakeFirstOrThrow();
    const next = createDatabase<SchoolYearDatabase>(replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name));
    try {
      assert.deepEqual(await next.selectFrom('library_categories').select(['id', 'code']).orderBy('code').execute(), before.categories);
      assert.equal((await next.selectFrom('library_copies').select('id').execute()).length, before.copies);
      assert.equal((await next.selectFrom('library_titles').select('id').execute()).length, before.titles);
      assert.equal((await next.selectFrom('library_readers').select('id').execute()).length, before.readers);
      assert.equal((await next.selectFrom('library_loans').select('id').execute()).length, before.open);
      const settings = await next.selectFrom('library_settings').select('student_levels').executeTakeFirstOrThrow();
      assert.deepEqual(settings.student_levels, ['TH', 'THCS', 'THPT']);
      const rule = await next.selectFrom('library_loan_rules').select('max_items').where('reader_kind', '=', 'student').executeTakeFirstOrThrow();
      assert.equal(rule.max_items, 2);
      // Năm mới là năm đang dùng: thêm bản sao thì số đăng ký chạy tiếp, không trùng
      const made = await api('POST', `/library/titles/${titles.Truyen}/copies`, principal.accessToken, { quantity: 1 });
      assert.equal(made.status, 201, JSON.stringify(made.body));
      const maxBefore = Math.max(...Object.values(copies).flat().map((code) => Number(code.slice(3))));
      assert.equal((made.body as unknown as Array<{ copy_no: string }>)[0]?.copy_no, `SH-${String(maxBefore + 1).padStart(6, '0')}`);
    } finally {
      await next.destroy();
    }
  });
});
