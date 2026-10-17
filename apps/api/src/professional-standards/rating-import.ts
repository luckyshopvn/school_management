import { Injectable } from '@nestjs/common';
import type { ProfessionalLevel, ProfessionalStandardType, SchoolYearDatabase } from '@school-management/database';
import { Clock } from '@school-management/server';
import type { Kysely, Transaction } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import type { ImportCatalog, ImportColumn, RowError, SheetRow } from '../imports/excel.js';
import { foldText } from '../imports/moet-columns.js';
import { ProfessionalStandardsService } from './professional-standards.js';
import { LEVEL_LABELS, PROFESSIONAL_LEVELS } from './standard-rating.js';

// Nhập mức đánh giá chuẩn nghề nghiệp từ Excel (DT-16 phần 16f, mục 3.2 của Sở: file mẫu, file mẫu kèm dữ liệu). Mỗi dòng
// là phiếu của một nhân sự (theo mã nhân sự và loại chuẩn); cột "Tiêu chí 1" đến "Tiêu chí 20" là mức của người đánh giá cho
// tiêu chí theo thứ tự trên phiếu (Tốt, Khá, Đạt, Chưa đạt; để trống là giữ mức đang có). Cùng quy tắc với đánh giá trên màn
// hình: chỉ phiếu nhân sự đã gửi tự đánh giá, chưa chốt; người nhập phải được đánh giá phiếu đó. Cột "Chốt phiếu" ghi "x" thì
// chốt phiếu sau khi ghi khi mọi tiêu chí đã có mức (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11)
export const RATING_CRITERION_COLUMNS = 20;

const criterionKey = (position: number) => `criterion_${position}`;

export const PROFESSIONAL_RATING_COLUMNS: ImportColumn[] = [
  { key: 'staff_code', header: 'Mã nhân sự', note: 'Mã nhân sự của trường, bắt buộc' },
  { key: 'full_name', header: 'Họ tên', note: 'Để đối chiếu; ghi thì phải khớp hồ sơ' },
  { key: 'standard_type', header: 'Loại chuẩn', note: 'Giáo viên hoặc Hiệu trưởng, bắt buộc' },
  ...Array.from({ length: RATING_CRITERION_COLUMNS }, (_, index) => ({
    key: criterionKey(index + 1),
    header: `Tiêu chí ${index + 1}`,
    note: 'Tốt, Khá, Đạt hoặc Chưa đạt; tiêu chí theo thứ tự trên phiếu (xem trang Danh mục); để trống là giữ mức đang có',
  })),
  { key: 'comment', header: 'Nhận xét', note: 'Nhận xét chung của người đánh giá, tối đa 2000 ký tự' },
  { key: 'finalize', header: 'Chốt phiếu', note: 'Ghi x để chốt phiếu khi mọi tiêu chí đã có mức' },
];

const STANDARD_LABELS: Record<ProfessionalStandardType, string> = { teacher: 'Giáo viên', principal: 'Hiệu trưởng' };
const MAXIMUM_COMMENT = 2000;

export interface RatingImportPlan {
  evaluationId: string;
  orgUnitId: string;
  ratings: Array<{ criterionId: string; rating: ProfessionalLevel }>;
  comment: string | null | undefined;
  finalize: boolean;
}

type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

function standardOf(value: string | undefined): ProfessionalStandardType | null {
  const folded = foldText(value ?? '');
  if (folded === 'giao vien' || folded === 'teacher') {
    return 'teacher';
  }
  if (folded === 'hieu truong' || folded === 'principal' || folded === 'can bo quan ly') {
    return 'principal';
  }
  return null;
}

function levelOf(value: string): ProfessionalLevel | null {
  const folded = foldText(value);
  return PROFESSIONAL_LEVELS.find((level) => foldText(LEVEL_LABELS[level]) === folded || level === folded) ?? null;
}

@Injectable()
export class ProfessionalRatingImports {
  constructor(
    private readonly standards: ProfessionalStandardsService,
    private readonly clock: Clock,
  ) {}

  private async evaluations(database: Executor, currentUser: CurrentUser) {
    const scope = await this.standards.readerScope(currentUser);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      return [];
    }
    return database
      .selectFrom('professional_evaluations')
      .innerJoin('staff', 'staff.id', 'professional_evaluations.staff_id')
      .select([
        'professional_evaluations.id',
        'professional_evaluations.staff_id',
        'professional_evaluations.org_unit_id',
        'professional_evaluations.standard_type',
        'professional_evaluations.status',
        'professional_evaluations.assessor_comment',
        'staff.code as staff_code',
        'staff.full_name',
      ])
      .$if(!scope.wholeSchool, (query) =>
        query.where('professional_evaluations.org_unit_id', 'in', scope.orgUnitIds),
      )
      .orderBy('staff.full_name')
      .execute();
  }

  // Trang Danh mục của tệp mẫu và "Tra cứu danh mục": loại chuẩn, mức đánh giá, tiêu chí theo thứ tự của từng loại chuẩn
  async catalogs(database: Executor): Promise<ImportCatalog[]> {
    const criteria = await database
      .selectFrom('professional_criteria')
      .select(['standard_type', 'code', 'name'])
      .where('status', '=', 'active')
      .orderBy('standard_type')
      .orderBy('order_no')
      .execute();
    const byType = (type: ProfessionalStandardType) =>
      criteria
        .filter((criterion) => criterion.standard_type === type)
        .map((criterion, index) => ({ code: `Tiêu chí ${index + 1}`, name: criterion.name, note: criterion.code }));
    return [
      {
        key: 'standard_types',
        title: 'Loại chuẩn',
        column: 'Loại chuẩn',
        items: (Object.keys(STANDARD_LABELS) as ProfessionalStandardType[]).map((type) => ({
          code: STANDARD_LABELS[type],
          name: type === 'teacher' ? 'Chuẩn nghề nghiệp giáo viên mầm non' : 'Chuẩn hiệu trưởng',
        })),
      },
      {
        key: 'levels',
        title: 'Mức đánh giá',
        column: 'Tiêu chí 1 đến Tiêu chí 20',
        items: [...PROFESSIONAL_LEVELS].reverse().map((level) => ({ code: LEVEL_LABELS[level], name: LEVEL_LABELS[level] })),
      },
      { key: 'teacher_criteria', title: 'Tiêu chí chuẩn giáo viên', column: 'Tiêu chí 1…', items: byType('teacher') },
      { key: 'principal_criteria', title: 'Tiêu chí chuẩn hiệu trưởng', column: 'Tiêu chí 1…', items: byType('principal') },
    ];
  }

  // "Tải file mẫu kèm dữ liệu": phiếu chưa chốt trong phạm vi người tải, kèm mức người đánh giá đang có
  async templateRows(database: Executor, currentUser: CurrentUser): Promise<Array<Record<string, unknown>>> {
    const evaluations = (await this.evaluations(database, currentUser)).filter((row) => row.status !== 'finalized');
    if (evaluations.length === 0) {
      return [];
    }
    const items = await database
      .selectFrom('professional_evaluation_items')
      .select(['evaluation_id', 'assessor_rating'])
      .where(
        'evaluation_id',
        'in',
        evaluations.map((row) => row.id),
      )
      .orderBy('evaluation_id')
      .orderBy('order_no')
      .execute();
    return evaluations.map((evaluation) => {
      const own = items.filter((item) => item.evaluation_id === evaluation.id);
      return {
        staff_code: evaluation.staff_code,
        full_name: evaluation.full_name,
        standard_type: STANDARD_LABELS[evaluation.standard_type],
        ...Object.fromEntries(
          own.map((item, index) => [criterionKey(index + 1), item.assessor_rating ? LEVEL_LABELS[item.assessor_rating] : '']),
        ),
        comment: evaluation.assessor_comment ?? '',
      };
    });
  }

  async validate(
    database: Executor,
    currentUser: CurrentUser,
    rows: SheetRow[],
    errors: RowError[],
  ): Promise<RatingImportPlan[]> {
    const evaluations = await this.evaluations(database, currentUser);
    const items =
      evaluations.length === 0
        ? []
        : await database
            .selectFrom('professional_evaluation_items')
            .select(['evaluation_id', 'criterion_id', 'assessor_rating'])
            .where(
              'evaluation_id',
              'in',
              evaluations.map((row) => row.id),
            )
            .orderBy('evaluation_id')
            .orderBy('order_no')
            .execute();
    const seen = new Set<string>();
    const plans: RatingImportPlan[] = [];
    for (const { row, values } of rows) {
      const before = errors.length;
      const fail = (column: string, message: string) => errors.push({ row, column, message });
      const standardType = standardOf(values.standard_type);
      if (!standardType) {
        fail('Loại chuẩn', 'Ghi Giáo viên hoặc Hiệu trưởng');
      }
      const code = values.staff_code ?? '';
      const evaluation = evaluations.find(
        (item) => item.staff_code === code && (!standardType || item.standard_type === standardType),
      );
      if (!evaluation) {
        if (standardType) {
          fail('Mã nhân sự', 'Không có phiếu đánh giá của nhân sự này với loại chuẩn đã ghi trong phạm vi của bạn');
        }
        continue;
      }
      if (seen.has(evaluation.id)) {
        fail('Mã nhân sự', 'Trùng với dòng khác trong tệp');
        continue;
      }
      seen.add(evaluation.id);
      if (values.full_name && foldText(values.full_name) !== foldText(evaluation.full_name)) {
        fail('Họ tên', `Không khớp hồ sơ (${evaluation.full_name})`);
      }
      if (evaluation.status === 'finalized') {
        fail('Mã nhân sự', 'Phiếu đã chốt, không sửa được');
      } else if (evaluation.status !== 'self_submitted') {
        fail('Mã nhân sự', 'Nhân sự chưa gửi tự đánh giá, chưa đánh giá được');
      } else if (
        !(await this.standards.canAssess(currentUser, database, {
          staffId: evaluation.staff_id,
          orgUnitId: evaluation.org_unit_id,
          standardType: evaluation.standard_type,
        }))
      ) {
        fail('Mã nhân sự', 'Bạn không được đánh giá phiếu này');
      }
      const own = items.filter((item) => item.evaluation_id === evaluation.id);
      const ratings: RatingImportPlan['ratings'] = [];
      for (let position = 1; position <= RATING_CRITERION_COLUMNS; position += 1) {
        const raw = values[criterionKey(position)] ?? '';
        if (!raw) {
          continue;
        }
        const item = own[position - 1];
        const level = levelOf(raw);
        if (!item) {
          fail(`Tiêu chí ${position}`, `Phiếu chỉ có ${own.length} tiêu chí`);
        } else if (!level) {
          fail(`Tiêu chí ${position}`, 'Ghi Tốt, Khá, Đạt hoặc Chưa đạt');
        } else {
          ratings.push({ criterionId: item.criterion_id, rating: level });
        }
      }
      const comment = values.comment === undefined ? undefined : values.comment || null;
      if (comment && comment.length > MAXIMUM_COMMENT) {
        fail('Nhận xét', `Tối đa ${MAXIMUM_COMMENT} ký tự`);
      }
      const finalize = ['x', 'co', '1'].includes(foldText(values.finalize ?? ''));
      if (finalize) {
        const rated = new Set([
          ...own.filter((item) => item.assessor_rating).map((item) => item.criterion_id),
          ...ratings.map((rating) => rating.criterionId),
        ]);
        if (rated.size < own.length) {
          fail('Chốt phiếu', `Còn ${own.length - rated.size} tiêu chí chưa có mức, chưa chốt được`);
        }
      }
      if (errors.length === before) {
        plans.push({ evaluationId: evaluation.id, orgUnitId: evaluation.org_unit_id, ratings, comment, finalize });
      }
    }
    return plans;
  }

  // Ghi mức của người đánh giá; phiếu có "Chốt phiếu" chốt sau khi ghi bằng đúng thao tác chốt của màn hình
  async commit(
    database: Kysely<SchoolYearDatabase>,
    currentUser: CurrentUser,
    plans: RatingImportPlan[],
    jobId: string,
    origin: ChangeOrigin,
    markCommitted: (transaction: Transaction<SchoolYearDatabase>) => Promise<void>,
  ): Promise<void> {
    await database.transaction().execute(async (transaction) => {
      for (const plan of plans) {
        for (const rating of plan.ratings) {
          await transaction
            .updateTable('professional_evaluation_items')
            .set({ assessor_rating: rating.rating })
            .where('evaluation_id', '=', plan.evaluationId)
            .where('criterion_id', '=', rating.criterionId)
            .execute();
        }
        await transaction
          .updateTable('professional_evaluations')
          .set({
            ...(plan.comment !== undefined ? { assessor_comment: plan.comment } : {}),
            updated_at: this.clock.now(),
          })
          .where('id', '=', plan.evaluationId)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: plan.orgUnitId,
          entityName: 'professional_evaluation_items',
          entityId: plan.evaluationId,
          action: 'update',
          before: null,
          after: { assessor: plan.ratings, comment: plan.comment, import_job_id: jobId },
        });
      }
      await markCommitted(transaction);
    });
    for (const plan of plans.filter((item) => item.finalize)) {
      await this.standards.finalize(currentUser, plan.evaluationId, origin);
    }
  }
}
