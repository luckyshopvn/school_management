import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { Clock, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely } from 'kysely';
import { randomUUID } from 'node:crypto';
import type { CurrentUser } from '../authentication/current-user.js';
import { ChildrenService } from '../children/children.service.js';
import { ClassCapacity } from '../classes/class-capacity.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { ChildDataProtection } from '../common/child-data-protection.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { assertStudentCapacity } from '../common/plan-limits.js';
import { notFoundError } from '../common/request-fields.js';
import { buildTableFile } from '../exports/table-file.js';
import { FileStorage } from '../files/file-storage.js';
import type { RowError } from '../imports/excel.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { buildMoetChildFile, loadMoetChildRows } from './moet-child-file.js';
import { inScope, logExportedFile, studentEditScope, VIETNAM_DATE } from './student-records-common.js';
import { StudentTransfersService } from './student-transfers.js';
import {
  generatePackageCode,
  generateTransferPassword,
  jsonPart,
  OPTIONAL_TRANSFER_PART_LABELS,
  openTransferPackage,
  readJsonPart,
  sealTransferPackage,
  TRANSFER_PACKAGE_EXTENSION,
  transferPackageRule,
  type OpenedTransferPackage,
  type OptionalTransferPart,
} from './transfer-package-rules.js';

// Lập và tiếp nhận gói chuyển trường, lát L1 (YCTD-390; BR-480 đến BR-483). Trường đi: Hiệu trưởng lập gói cho đề nghị chuyển đi
// chờ duyệt hoặc đã duyệt; gói có phần bắt buộc của hồ sơ chuyển trường (hồ sơ, tệp 82 cột có số định danh, học bạ đã ký, kết quả
// năm học đang học, nhu cầu đặc biệt, môn lựa chọn) và phần thêm phụ huynh đã đồng ý (sức khỏe, khen thưởng). Trường đến: Hiệu
// trưởng xem trước gói, chọn lớp, tiếp nhận; hồ sơ tạo bằng đường tiếp nhận tệp 82 cột có sẵn rồi chuyển thẳng sang Đang học
// (Q7 của đặc tả). Ở lát L1 gói đi bằng tệp; lát L2 thêm hộp thư nền tảng cho trường trong hệ thống

interface StudentSummary {
  full_name: string;
  dob: string | null;
  gender: string;
  moet_student_code: string | null;
  national_id_last4: string | null;
  class_name: string | null;
  grade_level: string | null;
  school_level: string | null;
  guardians: Array<{ full_name: string; relationship: string; phone: string | null }>;
}

interface LearningRecordPart {
  academic_year_name: string;
  class_name: string;
  grade_level: string;
  school_level: string;
  status: string;
  signer_name: string | null;
  signed_at: string | null;
  content: Record<string, unknown>;
  pdf: string | null;
}

interface HealthPart {
  blood_type: string | null;
  has_allergies: boolean | null;
  allergies: string | null;
  chronic_conditions: string | null;
  latest_measurement: { measured_on: string; height_cm: string | null; weight_kg: string | null } | null;
}

export interface TransferPackagePreview {
  package_code: string;
  created_at: string;
  source_school: { name: string; code: string | null };
  transfer_date: string;
  reason: string | null;
  approved_by_name: string;
  student: StudentSummary;
  parts: Array<{ path: string; label: string; bytes: number }>;
  learning_records: Array<{ academic_year_name: string; class_name: string; signed: boolean }>;
  consent: TransferPackageManifestConsent;
  already_received: boolean;
  existing_child: { id: string; full_name: string } | null;
}

type TransferPackageManifestConsent = OpenedTransferPackage['manifest']['consent'];

const partLabel = (path: string): string => {
  if (path === 'hoc-sinh.json') return 'Hồ sơ học sinh';
  if (path === 'ho-so-82-cot.xlsx') return 'Tệp hồ sơ theo mẫu 82 cột của Bộ (có số định danh)';
  if (path.startsWith('hoc-ba/') && path.endsWith('.pdf')) return 'Học bạ đã ký (PDF)';
  if (path.startsWith('hoc-ba/')) return 'Học bạ (dữ liệu)';
  if (path === 'ket-qua-nam-hoc.json') return 'Kết quả năm học đang học';
  if (path === 'nhu-cau-dac-biet.json') return 'Nhu cầu đặc biệt, kế hoạch giáo dục cá nhân';
  if (path === 'mon-lua-chon.json') return 'Môn học lựa chọn';
  if (path === 'suc-khoe.json') return OPTIONAL_TRANSFER_PART_LABELS['suc-khoe'];
  if (path === 'khen-thuong.json') return OPTIONAL_TRANSFER_PART_LABELS['khen-thuong'];
  return path;
};

const formatDate = (value: string | null) => (value ? value.split('-').reverse().join('/') : '');

@Injectable()
export class TransferPackagesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly protection: ChildDataProtection,
    private readonly fileStorage: FileStorage,
    private readonly transfers: StudentTransfersService,
    private readonly children: ChildrenService,
    private readonly capacity: ClassCapacity,
    private readonly clock: Clock,
  ) {}

  private async school(database: Kysely<SchoolYearDatabase>) {
    const root = await database
      .selectFrom('org_units')
      .select(['name', 'code'])
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    return { name: root?.name ?? 'Trường', code: root?.code ?? null };
  }

  // ---------- Trường đi: lập gói

  async build(
    currentUser: CurrentUser,
    transferId: string,
    input: { optionalParts: OptionalTransferPart[]; consentRecorded: boolean; applicationReceived: boolean },
    ipAddress: string | null,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const transfer = await database
      .selectFrom('student_transfers')
      .selectAll()
      .where('id', '=', transferId)
      .executeTakeFirst();
    if (!transfer) {
      throw notFoundError('Không tìm thấy hồ sơ chuyển trường', 'student_transfer');
    }
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.childApprove, transfer.org_unit_id);
    if (transfer.direction !== 'out' || !transfer.child_id || !['pending', 'approved'].includes(transfer.status)) {
      throw transferPackageRule('Chỉ lập gói cho đề nghị chuyển đi đang chờ duyệt hoặc đã duyệt');
    }
    // Hồ sơ bắt buộc chỉ gửi theo đơn xin chuyển trường của cha mẹ hoặc người giám hộ (BR-481)
    if (!input.applicationReceived) {
      throw validationError([
        { field: 'application_received', message: 'Chỉ lập gói khi đã nhận đơn xin chuyển trường của cha mẹ' },
      ]);
    }
    if (input.optionalParts.length > 0 && !input.consentRecorded) {
      throw validationError([
        { field: 'consent_recorded', message: 'Phần thêm chỉ gửi khi đã có đồng ý của phụ huynh' },
      ]);
    }
    const childId = transfer.child_id;
    const [moetRow] = await loadMoetChildRows(database, this.protection, [childId]);
    if (!moetRow) {
      throw notFoundError('Không tìm thấy hồ sơ học sinh', 'child');
    }
    const createdAt = this.clock.now();
    const files = new Map<string, Buffer>();
    const student = await this.studentSummary(database, childId);
    files.set('hoc-sinh.json', jsonPart(student));
    files.set('ho-so-82-cot.xlsx', await buildMoetChildFile([moetRow.values]));

    const records = await database
      .selectFrom('learning_records')
      .selectAll()
      .where('child_id', '=', childId)
      .orderBy('academic_year_name')
      .execute();
    let recordIndex = 0;
    for (const record of records) {
      const part: LearningRecordPart = {
        academic_year_name: record.academic_year_name,
        class_name: record.class_name,
        grade_level: record.grade_level,
        school_level: record.school_level,
        status: record.status,
        signer_name: record.signer_name,
        signed_at: record.signed_at?.toISOString() ?? null,
        content: record.content,
        pdf: null,
      };
      if (record.status === 'signed') {
        recordIndex += 1;
        if (record.signed_storage_key) {
          part.pdf = `hoc-ba/${recordIndex}.pdf`;
          files.set(part.pdf, await this.fileStorage.get(record.signed_storage_key));
        }
        files.set(`hoc-ba/${recordIndex}.json`, jsonPart(part));
      } else {
        // Học bạ chưa ký là kết quả của năm học đang học (chuyển giữa năm): gửi như bảng tổng hợp kết quả
        files.set('ket-qua-nam-hoc.json', jsonPart(part));
      }
    }
    const child = await database
      .selectFrom('children')
      .select(['special_needs_note'])
      .where('id', '=', childId)
      .executeTakeFirstOrThrow();
    if (child.special_needs_note?.trim()) {
      files.set('nhu-cau-dac-biet.json', jsonPart({ special_needs_note: child.special_needs_note }));
    }
    const electives = await database
      .selectFrom('child_elective_subjects')
      .innerJoin('subjects', 'subjects.id', 'child_elective_subjects.subject_id')
      .select(['subjects.code', 'subjects.name'])
      .where('child_elective_subjects.child_id', '=', childId)
      .orderBy('subjects.name')
      .execute();
    if (electives.length > 0) {
      files.set('mon-lua-chon.json', jsonPart(electives));
    }
    if (input.optionalParts.includes('suc-khoe')) {
      files.set('suc-khoe.json', jsonPart(await this.healthPart(database, childId)));
    }
    if (input.optionalParts.includes('khen-thuong')) {
      const awards = await database
        .selectFrom('student_awards')
        .innerJoin('classes', 'classes.id', 'student_awards.class_id')
        .select([
          'student_awards.title_name',
          'student_awards.achievement',
          'student_awards.decided_at',
          'classes.name as class_name',
        ])
        .where('student_awards.child_id', '=', childId)
        .where('student_awards.status', '=', 'approved')
        .orderBy('student_awards.decided_at')
        .execute();
      files.set(
        'khen-thuong.json',
        jsonPart(awards.map((award) => ({ ...award, decided_at: award.decided_at?.toISOString() ?? null }))),
      );
    }

    const source = await this.school(database);
    const password = generateTransferPassword();
    const packageCode = generatePackageCode(createdAt);
    const consent = input.optionalParts.length
      ? {
          optional_parts: input.optionalParts,
          method: 'paper' as const,
          recorded_by_name: origin.actorName,
          recorded_at: createdAt.toISOString(),
        }
      : null;
    const sealed = sealTransferPackage(
      {
        package_code: packageCode,
        kind: 'chuyen-truong',
        created_at: createdAt.toISOString(),
        source_school: source,
        destination: {
          school_name: transfer.school_name,
          province_name: transfer.province_name,
          ward_name: transfer.ward_name,
        },
        transfer_date: transfer.transfer_date,
        reason: transfer.reason,
        approved_by_name: origin.actorName,
        student: { full_name: student.full_name, dob: student.dob, moet_student_code: student.moet_student_code },
        consent,
      },
      files,
      password,
    );
    const partsRecord = { parts: sealed.manifest.parts.map((part) => part.path), consent };
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('student_transfers')
        .set({
          package_code: packageCode,
          package_sha256: sealed.sha256,
          package_parts: JSON.stringify(partsRecord),
          package_created_at: createdAt,
          package_created_by_name: origin.actorName,
          updated_at: createdAt,
        })
        .where('id', '=', transfer.id)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: transfer.org_unit_id,
        entityName: 'student_transfers',
        entityId: transfer.id,
        action: 'update',
        before: { package_code: transfer.package_code },
        after: { package_code: packageCode, package_sha256: sealed.sha256, ...partsRecord },
      });
    });
    const packageFile = await logExportedFile(database, currentUser, {
      reportCode: 'student-transfer-package',
      fileName: `${packageCode}.${TRANSFER_PACKAGE_EXTENSION}`,
      buffer: sealed.body,
      rowCount: 1,
      orgUnitIds: [transfer.org_unit_id],
      filters: { transfer_id: transfer.id, package_code: packageCode, parts: partsRecord.parts },
      ipAddress,
      contentType: 'application/octet-stream',
    });
    const print = await this.printSheet(sealed.manifest, sealed.sha256, password, student);
    return {
      package_code: packageCode,
      package_sha256: sealed.sha256,
      password,
      parts: sealed.manifest.parts.map((part) => ({ path: part.path, label: partLabel(part.path), bytes: part.bytes })),
      package_file: { file_name: packageFile.fileName, content_base64: sealed.body.toString('base64') },
      print_file: { file_name: `${packageCode}-ban-in.pdf`, content_base64: print.toString('base64') },
    };
  }

  private async studentSummary(database: Kysely<SchoolYearDatabase>, childId: string): Promise<StudentSummary> {
    const child = await database
      .selectFrom('children')
      .select(['full_name', 'dob', 'gender', 'moet_student_code', 'national_id_last4'])
      .where('id', '=', childId)
      .executeTakeFirstOrThrow();
    const current = await database
      .selectFrom('class_enrollments')
      .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select(['classes.name', 'classes.grade_level', 'classes.school_level'])
      .where('class_enrollments.child_id', '=', childId)
      .orderBy('class_enrollments.from_date', 'desc')
      .executeTakeFirst();
    const guardians = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .innerJoin('catalog_items', 'catalog_items.id', 'child_guardians.relationship_item_id')
      .select(['guardians.full_name', 'guardians.phone', 'catalog_items.name as relationship'])
      .where('child_guardians.child_id', '=', childId)
      .orderBy('child_guardians.is_primary', 'desc')
      .execute();
    return {
      full_name: child.full_name,
      dob: child.dob,
      gender: child.gender,
      moet_student_code: child.moet_student_code,
      national_id_last4: child.national_id_last4,
      class_name: current?.name ?? null,
      grade_level: current?.grade_level ?? null,
      school_level: current?.school_level ?? null,
      guardians,
    };
  }

  private async healthPart(database: Kysely<SchoolYearDatabase>, childId: string): Promise<HealthPart> {
    const profile = await database
      .selectFrom('health_profiles')
      .select(['blood_type', 'has_allergies', 'allergies', 'chronic_conditions'])
      .where('child_id', '=', childId)
      .executeTakeFirst();
    const measurement = await database
      .selectFrom('health_measurements')
      .select(['measured_on', 'height_cm', 'weight_kg'])
      .where('child_id', '=', childId)
      .orderBy('measured_on', 'desc')
      .executeTakeFirst();
    return {
      blood_type: profile?.blood_type ?? null,
      has_allergies: profile?.has_allergies ?? null,
      allergies: profile?.allergies ?? null,
      chronic_conditions: profile?.chronic_conditions ?? null,
      latest_measurement: measurement
        ? {
            measured_on: measurement.measured_on,
            height_cm: measurement.height_cm === null ? null : String(measurement.height_cm),
            weight_kg: measurement.weight_kg === null ? null : String(measurement.weight_kg),
          }
        : null,
    };
  }

  // Bản in giao phụ huynh: mã gói, mật khẩu, mã băm để trường đến đối chiếu, danh sách phần; mật khẩu không lưu ở máy chủ
  private printSheet(
    manifest: OpenedTransferPackage['manifest'],
    sha256: string,
    password: string,
    student: StudentSummary,
  ): Promise<Buffer> {
    const rows = [
      { label: 'Mã gói', value: manifest.package_code },
      { label: 'Mật khẩu mở gói', value: password },
      { label: 'Mã băm SHA-256 của tệp gói', value: sha256 },
      { label: 'Học sinh', value: `${student.full_name} – ${formatDate(student.dob)}` },
      { label: 'Mã định danh Bộ', value: student.moet_student_code ?? 'Chưa có' },
      { label: 'Lớp', value: student.class_name ?? '' },
      { label: 'Trường chuyển đi', value: manifest.source_school.name },
      { label: 'Trường chuyển đến', value: manifest.destination.school_name },
      { label: 'Ngày chuyển', value: formatDate(manifest.transfer_date) },
      { label: 'Người duyệt', value: manifest.approved_by_name },
      ...manifest.parts.map((part) => ({ label: 'Phần trong gói', value: `${partLabel(part.path)} (${part.path})` })),
      {
        label: 'Hướng dẫn',
        value:
          'Nộp tệp gói cho trường đến cùng hồ sơ giấy (đơn, học bạ bản chính, giấy giới thiệu). Trường đến dùng School ' +
          'Management: Biến động học sinh, Nhập gói chuyển trường, nhập mật khẩu trên. Giữ bản in này như giấy tờ có ' +
          'thông tin cá nhân.',
      },
    ];
    return buildTableFile(
      'pdf',
      [
        {
          title: 'Gói chuyển trường',
          heading: ['GÓI HỒ SƠ CHUYỂN TRƯỜNG', `${student.full_name} – ${manifest.package_code}`],
          columns: [
            { key: 'label', label: 'Thông tin', width: 32 },
            { key: 'value', label: 'Nội dung', width: 68 },
          ],
          rows,
        },
      ],
      this.clock.now(),
    );
  }

  // ---------- Trường đến: xem trước, tiếp nhận

  async preview(currentUser: CurrentUser, body: Buffer, password: string): Promise<TransferPackagePreview> {
    const { database } = await this.currentSchoolYear.require();
    const opened = openTransferPackage(body, password);
    return this.describe(database, opened);
  }

  private async describe(database: Kysely<SchoolYearDatabase>, opened: OpenedTransferPackage) {
    const { manifest } = opened;
    const student = readJsonPart<StudentSummary>(opened, 'hoc-sinh.json');
    if (!student) {
      throw transferPackageRule('Gói thiếu hồ sơ học sinh');
    }
    const received = await database
      .selectFrom('student_transfers')
      .select('id')
      .where('direction', '=', 'in')
      .where('package_code', '=', manifest.package_code)
      .executeTakeFirst();
    const existing = student.moet_student_code
      ? await database
          .selectFrom('children')
          .select(['id', 'full_name'])
          .where('moet_student_code', '=', student.moet_student_code)
          .where('deleted_at', 'is', null)
          .executeTakeFirst()
      : undefined;
    const learningRecords = [...opened.files.keys()]
      .filter((path) => /^hoc-ba\/\d+\.json$/.test(path))
      .map((path) => readJsonPart<LearningRecordPart>(opened, path))
      .filter((record): record is LearningRecordPart => record !== null)
      .map((record) => ({
        academic_year_name: record.academic_year_name,
        class_name: record.class_name,
        signed: record.pdf !== null,
      }));
    return {
      package_code: manifest.package_code,
      created_at: manifest.created_at,
      source_school: manifest.source_school,
      transfer_date: manifest.transfer_date,
      reason: manifest.reason,
      approved_by_name: manifest.approved_by_name,
      student,
      parts: manifest.parts.map((part) => ({ path: part.path, label: partLabel(part.path), bytes: part.bytes })),
      learning_records: learningRecords,
      consent: manifest.consent,
      already_received: received !== undefined,
      existing_child: existing ?? null,
    };
  }

  async accept(
    currentUser: CurrentUser,
    accessToken: string,
    input: { body: Buffer; password: string; classId: string; fromDate: string; confirmOverCapacity: boolean },
    origin: ChangeOrigin,
  ): Promise<{ errors: RowError[]; transfer_id: string | null; child_id: string | null }> {
    const { database } = await this.currentSchoolYear.require();
    const opened = openTransferPackage(input.body, input.password);
    const description = await this.describe(database, opened);
    if (description.already_received) {
      throw transferPackageRule('Gói này đã được tiếp nhận');
    }
    if (description.existing_child) {
      throw transferPackageRule('Học sinh đã có hồ sơ ở trường (trùng mã định danh Bộ); không tiếp nhận lại');
    }
    const targetClass = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id', 'max_size'])
      .where('id', '=', input.classId)
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!targetClass) {
      throw notFoundError('Lớp không tồn tại hoặc đã ngừng', 'class');
    }
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.childApprove, targetClass.org_unit_id);
    // Kiểm gói dịch vụ, sĩ số trước khi tạo hồ sơ để không để lại hồ sơ nháp khi lớp đã đủ
    await assertStudentCapacity(database, 1);
    await this.capacity.assert(database, targetClass, input.confirmOverCapacity);

    const { manifest } = opened;
    const received = await this.transfers.receive(
      currentUser,
      accessToken,
      {
        orgUnitId: targetClass.org_unit_id,
        place: {
          school_name: manifest.source_school.name.slice(0, 200),
          province_name: null,
          ward_name: null,
          transfer_date: input.fromDate,
          reason: manifest.reason,
        },
        fileName: `${manifest.package_code}-ho-so-82-cot.xlsx`,
        body: opened.files.get('ho-so-82-cot.xlsx') as Buffer,
      },
      origin,
    );
    const [created] = received.transfers;
    if (received.errors.length > 0 || !created) {
      return { errors: received.errors, transfer_id: null, child_id: null };
    }
    const childId = created.child_id;
    const health = readJsonPart<HealthPart>(opened, 'suc-khoe.json');
    const specialNeeds = readJsonPart<{ special_needs_note: string }>(opened, 'nhu-cau-dac-biet.json');
    const storedRecords: Array<{
      part: LearningRecordPart;
      kind: 'learning_record' | 'term_results';
      key: string | null;
    }> = [];
    for (const path of [...opened.files.keys()].filter((name) => /^hoc-ba\/\d+\.json$/.test(name)).sort()) {
      const part = readJsonPart<LearningRecordPart>(opened, path) as LearningRecordPart;
      let key: string | null = null;
      const pdf = part.pdf ? opened.files.get(part.pdf) : undefined;
      if (pdf) {
        key = `received-learning-records/${randomUUID()}.pdf`;
        await this.fileStorage.put(key, pdf, 'application/pdf');
      }
      storedRecords.push({ part, kind: 'learning_record', key });
    }
    const termResults = readJsonPart<LearningRecordPart>(opened, 'ket-qua-nam-hoc.json');
    if (termResults) {
      storedRecords.push({ part: termResults, kind: 'term_results', key: null });
    }
    const receivedData = {
      source_school: manifest.source_school,
      approved_by_name: manifest.approved_by_name,
      consent: manifest.consent,
      special_needs_note: specialNeeds?.special_needs_note ?? null,
      electives: readJsonPart<Array<{ code: string; name: string }>>(opened, 'mon-lua-chon.json') ?? [],
      awards: readJsonPart<unknown[]>(opened, 'khen-thuong.json') ?? [],
      health,
    };
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('student_transfers')
        .set({
          package_code: manifest.package_code,
          package_sha256: opened.sha256,
          package_parts: JSON.stringify({ parts: manifest.parts.map((part) => part.path), consent: manifest.consent }),
          partner_school_code: manifest.source_school.code,
          received_data: JSON.stringify(receivedData),
          updated_at: this.clock.now(),
        })
        .where('id', '=', created.id)
        .execute();
      if (specialNeeds?.special_needs_note) {
        await transaction
          .updateTable('children')
          .set({ special_needs_note: specialNeeds.special_needs_note.slice(0, 1000), updated_at: this.clock.now() })
          .where('id', '=', childId)
          .execute();
      }
      if (health) {
        const values = {
          blood_type: health.blood_type,
          has_allergies: health.has_allergies,
          allergies: health.allergies,
          chronic_conditions: health.chronic_conditions,
        };
        const profile = await transaction
          .selectFrom('health_profiles')
          .select('id')
          .where('child_id', '=', childId)
          .executeTakeFirst();
        if (profile) {
          await transaction.updateTable('health_profiles').set(values).where('id', '=', profile.id).execute();
        } else {
          await transaction
            .insertInto('health_profiles')
            .values({ child_id: childId, ...values, created_by: origin.actorUserId })
            .execute();
        }
      }
      for (const record of storedRecords) {
        await transaction
          .insertInto('received_learning_records')
          .values({
            transfer_id: created.id,
            child_id: childId,
            package_code: manifest.package_code,
            source_school_name: manifest.source_school.name,
            kind: record.kind,
            academic_year_name: record.part.academic_year_name,
            class_name: record.part.class_name,
            grade_level: record.part.grade_level,
            school_level: record.part.school_level,
            content: JSON.stringify(record.part.content),
            storage_key: record.key,
            file_sha256: record.part.pdf
              ? (manifest.parts.find((part) => part.path === record.part.pdf)?.sha256 ?? null)
              : null,
            signer_name: record.part.signer_name,
            signed_at: record.part.signed_at ? new Date(record.part.signed_at) : null,
          })
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: targetClass.org_unit_id,
        entityName: 'student_transfers',
        entityId: created.id,
        action: 'update',
        before: null,
        after: {
          package_code: manifest.package_code,
          package_sha256: opened.sha256,
          source_school: manifest.source_school,
          learning_records: storedRecords.length,
        },
      });
    });
    await this.children.admitTransferred(
      currentUser,
      accessToken,
      childId,
      { classId: targetClass.id, confirmOverCapacity: true, fromDate: input.fromDate },
      origin,
    );
    return { errors: [], transfer_id: created.id, child_id: childId };
  }

  // ---------- Học bạ nhận từ trường khác (chỉ đọc)

  async receivedLearningRecords(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertChildInScope(database, currentUser, childId);
    return database
      .selectFrom('received_learning_records')
      .select([
        'id',
        'kind',
        'academic_year_name',
        'class_name',
        'grade_level',
        'school_level',
        'source_school_name',
        'package_code',
        'signer_name',
        'signed_at',
        'created_at',
      ])
      .select((expression) => expression('storage_key', 'is not', null).as('has_file'))
      .where('child_id', '=', childId)
      .orderBy('academic_year_name')
      .execute();
  }

  async receivedLearningRecordFile(currentUser: CurrentUser, recordId: string) {
    const { database } = await this.currentSchoolYear.require();
    const record = await database
      .selectFrom('received_learning_records')
      .select(['child_id', 'storage_key', 'academic_year_name', 'package_code'])
      .where('id', '=', recordId)
      .executeTakeFirst();
    if (!record || !record.storage_key) {
      throw notFoundError('Không có tệp học bạ', 'received_learning_record');
    }
    await this.assertChildInScope(database, currentUser, record.child_id);
    return {
      fileName: `hoc-ba-${record.academic_year_name.replace(/[^0-9-]/g, '')}-${record.package_code}.pdf`,
      pdf: await this.fileStorage.get(record.storage_key),
    };
  }

  private async assertChildInScope(database: Kysely<SchoolYearDatabase>, currentUser: CurrentUser, childId: string) {
    const child = await database
      .selectFrom('children')
      .select('org_unit_id')
      .where('id', '=', childId)
      .executeTakeFirst();
    const scope = await studentEditScope(this.organizationScopes, currentUser);
    if (!child || !inScope(scope, child.org_unit_id)) {
      throw notFoundError('Hồ sơ không tồn tại hoặc nằm ngoài phạm vi của bạn', 'child');
    }
  }

  today() {
    return VIETNAM_DATE.format(this.clock.now());
  }
}
