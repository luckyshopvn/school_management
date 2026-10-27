import type { SchoolYearDatabase } from '@school-management/database';
import { ruleViolationError } from '@school-management/server';
import { PROCTOR_CONSENT_SCOPE_LABELS, needsParentConsent, type ProctorConsentScope } from '@school-management/shared';
import type { Kysely } from 'kysely';

type Database = Kysely<SchoolYearDatabase>;

// Giám thị camera (DT-23 phần 23e, YCTD-215): các loại giám sát bài giao bật
export function proctorScopes(assignment: { proctor_live: boolean; proctor_record: boolean }): ProctorConsentScope[] {
  const scopes: ProctorConsentScope[] = [];
  if (assignment.proctor_live) {
    scopes.push('live');
  }
  if (assignment.proctor_record) {
    scopes.push('record');
  }
  return scopes;
}

// Các loại đồng ý còn hiệu lực của một học sinh
export async function activeConsents(database: Database, childId: string): Promise<ProctorConsentScope[]> {
  const rows = await database
    .selectFrom('exam_proctor_consents')
    .select('scope')
    .where('child_id', '=', childId)
    .where('revoked_at', 'is', null)
    .execute();
  return rows.map((row) => row.scope);
}

// Trước khi vào thi có xem trực tiếp hoặc ghi hình: học sinh xác nhận đã đọc thông báo; học sinh dưới 16 tuổi (hoặc chưa rõ ngày
// sinh) còn cần cha mẹ đồng ý từng loại đang bật. Thiếu thì không vào được, giáo viên giao bài không bật giám sát hoặc nhà trường
// ghi nhận đồng ý
export async function assertProctorConsent(
  database: Database,
  student: { childId: string },
  assignment: { proctor_live: boolean; proctor_record: boolean },
  noticeAcknowledged: boolean,
  today: string,
  ruleCode: string,
): Promise<boolean> {
  const scopes = proctorScopes(assignment);
  if (scopes.length === 0) {
    return false;
  }
  if (!noticeAcknowledged) {
    throw ruleViolationError(
      ruleCode,
      'Bài thi này có giám sát bằng camera; hãy đọc thông báo và xác nhận trước khi vào thi',
      [{ field: 'proctor_notice', message: 'required' }],
    );
  }
  const child = await database
    .selectFrom('children')
    .select('dob')
    .where('id', '=', student.childId)
    .executeTakeFirstOrThrow();
  if (needsParentConsent(child.dob === null ? null : String(child.dob), today)) {
    const granted = await activeConsents(database, student.childId);
    const missing = scopes.filter((scope) => !granted.includes(scope));
    if (missing.length > 0) {
      throw ruleViolationError(
        ruleCode,
        `Cần cha mẹ đồng ý trước khi vào thi: ${missing.map((scope) => PROCTOR_CONSENT_SCOPE_LABELS[scope]).join('; ')}`,
        missing.map((scope) => ({ field: 'proctor_consent', message: scope })),
      );
    }
  }
  return true;
}
