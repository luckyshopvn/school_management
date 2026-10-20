import { Controller, Get, Injectable, Param, Query, Req, Res } from '@nestjs/common';
import { ApplicationError, validationError, type FieldError } from '@school-management/server';
import {
  KPI_EVALUATION_STATUS_LABELS,
  KPI_FORM_LABELS,
  KPI_SCHOOL_LEVELS,
  KPI_SCORING_MODE_LABELS,
  type KpiFormCode,
  type KpiRuleConfig,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { isUuid } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { buildTableFile, CONTENT_TYPES, type TableFileSheet } from '../exports/table-file.js';
import { fileStamp } from '../facilities/facilities-workbook.js';
import { buildDocumentPdf, buildDocx, DOCX_TYPE, PDF_TYPE, type DocumentBlock } from './kpi-documents.js';
import { round2 } from './kpi-engine.js';
import { KpiEvaluationsService } from './kpi-evaluations.js';
import { check, inScope, KPI_PERMISSIONS, KpiSupport, num, type Executor } from './kpi-support.js';

// Mẫu báo cáo của phân hệ KPI (DT-18 phần 18d, YCTD-139), sinh từ cấu hình của phiên bản quy tắc:
// - Bảng tính điểm KPI (Excel, PDF): việc theo trục, điểm chuẩn, hệ số độ khó, tiến độ, kết quả, điểm quy đổi, A, B;
// - Bản tự đánh giá, xếp loại của cá nhân (Word, PDF): phần tiêu chí chung theo nhóm đối tượng, phần kết quả nhiệm vụ, mức tự
//   đề xuất, nhận xét của cấp có thẩm quyền;
// - Bảng tổng hợp kết quả đánh giá, xếp loại của đơn vị (Excel, PDF, Word);
// - Phiếu theo dõi, đánh giá tháng có ví dụ tính điểm và Phiếu xếp loại chất lượng năm (Word, PDF) của bộ quy tắc theo thang
//   mức; Quy chế đánh giá, xếp loại của đơn vị (Word) sinh từ cấu hình, theo cấp học;
// - Sổ trách nhiệm chấm, duyệt của người quản lý (Excel).
// Mọi lần xuất ghi nhật ký xuất (BR-74); việc mật chỉ in "(Nội dung mật)"
type DocumentFormat = 'docx' | 'pdf';
type SheetFormat = 'xlsx' | 'pdf';

interface ExportedDocument {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  logId: string;
}

const pct = (value: number | null | undefined) => (value === null || value === undefined ? '' : `${value}%`);
const score = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value));
const taskName = (task: { name: string; is_confidential: boolean }) =>
  task.is_confidential ? '(Nội dung mật)' : task.name;

function readFormat<Format extends string>(value: string | undefined, allowed: Format[], fallback: Format): Format {
  if (value === undefined) {
    return fallback;
  }
  if (!allowed.includes(value as Format)) {
    throw validationError([{ field: 'format', message: `Định dạng là ${allowed.join(', ')}` }]);
  }
  return value as Format;
}

@Injectable()
export class KpiReportsService {
  constructor(
    private readonly support: KpiSupport,
    private readonly evaluations: KpiEvaluationsService,
  ) {}

  private async schoolName(database: Executor): Promise<string> {
    const root = await database
      .selectFrom('org_units')
      .select('name')
      .where('parent_id', 'is', null)
      .orderBy('created_at')
      .executeTakeFirst();
    return root?.name ?? '';
  }

  private async log(
    database: Executor,
    currentUser: CurrentUser,
    input: {
      reportCode: string;
      filters: Record<string, unknown>;
      units: string[];
      rowCount: number;
      fileName: string;
      ipAddress: string | null;
    },
  ): Promise<string> {
    const log = await database
      .insertInto('export_logs')
      .values({
        user_id: currentUser.id,
        actor_name: currentUser.description.full_name,
        report_code: input.reportCode,
        filters_data: JSON.stringify(input.filters),
        org_unit_ids: input.units,
        row_count: input.rowCount,
        contains_personal_data: true,
        file_name: input.fileName,
        ip_address: input.ipAddress,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return log.id;
  }

  private async document(
    blocks: DocumentBlock[],
    format: DocumentFormat,
    title: string,
    landscape = false,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    return format === 'docx'
      ? { buffer: buildDocx(blocks, { title, landscape }), contentType: DOCX_TYPE }
      : { buffer: await buildDocumentPdf(blocks, { title, landscape }), contentType: PDF_TYPE };
  }

  private header(schoolName: string, date: Date): DocumentBlock {
    const day = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    })
      .formatToParts(date)
      .reduce<Record<string, string>>((parts, part) => ({ ...parts, [part.type]: part.value }), {});
    return {
      kind: 'header',
      left: [schoolName.toUpperCase(), ''],
      right: [
        'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
        'Độc lập - Tự do - Hạnh phúc',
        `..., ngày ${day.day} tháng ${day.month} năm ${day.year}`,
      ],
    };
  }

  private async evaluationFor(currentUser: CurrentUser, evaluationId: string) {
    return this.evaluations.read(currentUser, evaluationId);
  }

  // Bảng tính điểm KPI của một người
  async taskSheet(
    currentUser: CurrentUser,
    evaluationId: string,
    format: SheetFormat,
    ipAddress: string | null,
  ): Promise<ExportedDocument> {
    const database = await this.support.database();
    const detail = await this.evaluationFor(currentUser, evaluationId);
    const now = this.support.clock.now();
    const config = detail.config;
    const levelLabel = (task: (typeof detail.tasks)[number]) =>
      config.scoring_mode === 'progress_quality'
        ? (config.quality_levels.find((level) => level.code === task.quality_code)?.percent ?? '') + ''
        : (config.result_levels.find((level) => level.code === task.result_code)?.label ?? '');
    const rows: Array<Record<string, unknown>> = [];
    for (const axis of config.axes) {
      const tasks = detail.tasks.filter((task) => task.axis_code === axis.code);
      if (tasks.length === 0) {
        continue;
      }
      rows.push({ name: `Trục ${axis.code}: ${axis.name}` });
      for (const task of tasks) {
        rows.push({
          name: taskName(task),
          output_result: task.is_confidential ? '' : (task.output_result ?? ''),
          origin: task.in_plan ? 'Đầu kỳ' : 'Phát sinh',
          deadline: task.deadline,
          finished: task.actual_finish_date ?? '',
          standard_score: task.standard_score,
          difficulty: pct(round2(task.difficulty_weight * 100)),
          max_converted: task.max_converted,
          progress: pct(task.progress_percent),
          quality: levelLabel(task),
          execution: score(task.execution_score),
          converted: score(task.converted_score),
          exceeded: task.exceeded ? 'x' : '',
          document_number: task.document_number ?? '',
        });
      }
    }
    rows.push({ name: `Tổng điểm quy đổi tối đa A: ${detail.plan_max}` });
    rows.push({ name: `Tổng điểm quy đổi thực tế B: ${detail.actual_total}` });
    rows.push({
      name: `Điểm KPI công việc = min(${config.task_part_max}; ${config.task_part_max} × B / A) = ${detail.task_score}`,
    });
    rows.push({ name: `Điểm thưởng: ${detail.bonus_score}` });
    const sheet: TableFileSheet = {
      title: 'Bảng tính điểm KPI',
      heading: [
        'BẢNG TÍNH ĐIỂM KPI',
        `Họ và tên: ${detail.full_name} — Đơn vị: ${detail.org_unit_name}`,
        `Kỳ: ${detail.period_name} — ${detail.rule_set_name} (phiên bản ${detail.version_no})`,
      ],
      columns: [
        { key: 'name', label: 'Tên công việc', width: 48 },
        { key: 'output_result', label: 'Kết quả đầu ra', width: 24 },
        { key: 'origin', label: 'Loại', width: 10 },
        { key: 'deadline', label: 'Hạn', width: 12 },
        { key: 'finished', label: 'Hoàn thành', width: 12 },
        { key: 'standard_score', label: 'Điểm chuẩn', width: 10 },
        { key: 'difficulty', label: 'Hệ số độ khó', width: 10 },
        { key: 'max_converted', label: 'Điểm quy đổi tối đa', width: 12 },
        { key: 'progress', label: 'Tiến độ', width: 9 },
        {
          key: 'quality',
          label: config.scoring_mode === 'progress_quality' ? 'Kết quả (%)' : 'Mức đánh giá',
          width: 14,
        },
        { key: 'execution', label: 'Điểm thực hiện', width: 10 },
        { key: 'converted', label: 'Điểm quy đổi thực tế', width: 12 },
        { key: 'exceeded', label: 'Vượt yêu cầu', width: 8 },
        { key: 'document_number', label: 'Số ký hiệu văn bản', width: 20 },
      ],
      rows,
    };
    const fileName = `bang-tinh-diem-kpi-${fileStamp(now)}.${format}`;
    const buffer = await buildTableFile(format, [sheet], now);
    const logId = await this.log(database, currentUser, {
      reportCode: 'kpi-task-sheet',
      filters: { evaluation_id: evaluationId },
      units: [detail.org_unit_id],
      rowCount: detail.tasks.length,
      fileName,
      ipAddress,
    });
    return { buffer, fileName, contentType: CONTENT_TYPES[format], logId };
  }

  // Bản tự đánh giá, xếp loại của cá nhân theo nhóm đối tượng (lãnh đạo, quản lý hoặc cán bộ)
  async selfEvaluation(
    currentUser: CurrentUser,
    evaluationId: string,
    format: DocumentFormat,
    ipAddress: string | null,
  ): Promise<ExportedDocument> {
    const database = await this.support.database();
    const detail = await this.evaluationFor(currentUser, evaluationId);
    const config = detail.config;
    const now = this.support.clock.now();
    const rankText = (code: string | null) => config.ranks.find((rank) => rank.code === code)?.label ?? '';
    const criteriaRows: string[][] = [];
    const boldRows: number[] = [];
    for (const group of detail.criteria) {
      boldRows.push(criteriaRows.length);
      const groupMax = group.items.reduce((sum, item) => sum + item.max_score, 0);
      const groupScore = group.items.reduce((sum, item) => sum + item.score, 0);
      criteriaRows.push([group.code, group.title, '', '', String(groupMax), String(groupScore), '']);
      for (const item of group.items) {
        const satisfied = item.superior_satisfied ?? item.self_satisfied;
        criteriaRows.push([
          item.code,
          item.title,
          satisfied ? 'x' : '',
          satisfied ? '' : 'x',
          String(item.max_score),
          String(item.score),
          item.note ?? '',
        ]);
      }
    }
    boldRows.push(criteriaRows.length);
    criteriaRows.push(['', 'Tổng (A)', '', '', String(config.general_max), String(detail.general_score), '']);
    const blocks: DocumentBlock[] = [
      this.header(await this.schoolName(database), now),
      { kind: 'title', text: 'BẢN TỰ ĐÁNH GIÁ, XẾP LOẠI CỦA CÁ NHÂN', subtitle: detail.period_name },
      { kind: 'paragraph', text: `Họ và tên: ${detail.full_name}` },
      { kind: 'paragraph', text: `Chức vụ: ${detail.job_title_name ?? ''}` },
      { kind: 'paragraph', text: `Đơn vị công tác: ${detail.org_unit_name}` },
      { kind: 'heading', text: 'I. Tự đánh giá kết quả thực hiện nhiệm vụ' },
      { kind: 'heading', text: `A. NHÓM TIÊU CHÍ CHUNG (${config.general_max} ĐIỂM)` },
      {
        kind: 'table',
        header: ['TT', 'Tiêu chí / Nội dung', 'Đảm bảo', 'Không đảm bảo', 'Điểm tối đa', 'Điểm đạt', 'Ghi chú'],
        rows: criteriaRows,
        widths: [5, 55, 7, 8, 8, 8, 9],
        boldRows,
      },
      { kind: 'heading', text: `B. KẾT QUẢ THỰC HIỆN NHIỆM VỤ ĐƯỢC GIAO (${config.task_part_max} ĐIỂM)` },
      {
        kind: 'paragraph',
        text: `Các trục kết quả: ${config.axes.map((axis) => `(${axis.code}) ${axis.name}`).join('; ')}.`,
        align: 'justify',
      },
      {
        kind: 'table',
        header: ['Nội dung', 'Điểm tối đa', 'Điểm đạt được'],
        rows: [
          [
            `Tổng (B) = Điểm KPI đã tính tại bảng tính điểm (A = ${detail.plan_max}; B = ${detail.actual_total})`,
            String(config.task_part_max),
            String(detail.task_score),
          ],
          ['Điểm thưởng', String(config.bonus.max_total), String(detail.bonus_score)],
          ['TỔNG (A + B + thưởng)', String(config.total_max), String(detail.total_score)],
        ],
        widths: [70, 15, 15],
        boldRows: [2],
      },
      { kind: 'heading', text: `II. Tự đề xuất xếp loại mức chất lượng: ${rankText(detail.self_rank)}` },
      {
        kind: 'paragraph',
        text: `(Theo ${config.ranks.length} mức: ${config.ranks.map((rank) => rank.label).join(', ')})`,
        italic: true,
      },
      ...(detail.self_comment ? [{ kind: 'paragraph' as const, text: detail.self_comment }] : []),
      {
        kind: 'signatures',
        right: { title: 'CÁ NHÂN TỰ ĐÁNH GIÁ', note: '(Ký, ghi rõ họ tên)', name: detail.full_name },
      },
      { kind: 'heading', text: 'III. Nhận xét, đánh giá của cấp có thẩm quyền' },
      { kind: 'paragraph', text: `- Chấm điểm: ${detail.status === 'concluded' ? detail.total_score : '...'}` },
      { kind: 'paragraph', text: `- Đề xuất xếp loại: ${rankText(detail.superior_rank) || '...'}` },
      ...(detail.superior_comment
        ? [{ kind: 'paragraph' as const, text: `- Nhận xét: ${detail.superior_comment}` }]
        : []),
      {
        kind: 'signatures',
        right: {
          title: 'XÁC NHẬN CỦA CẤP CÓ THẨM QUYỀN',
          note: '(Ký, ghi rõ họ tên và đóng dấu)',
          name: detail.superior_by_name ?? '',
        },
      },
    ];
    const built = await this.document(blocks, format, 'Bản tự đánh giá, xếp loại của cá nhân');
    const fileName = `ban-tu-danh-gia-${fileStamp(now)}.${format}`;
    const logId = await this.log(database, currentUser, {
      reportCode: 'kpi-self-evaluation',
      filters: { evaluation_id: evaluationId, format },
      units: [detail.org_unit_id],
      rowCount: 1,
      fileName,
      ipAddress,
    });
    return { ...built, fileName, logId };
  }

  // Phiếu theo dõi, đánh giá tháng: chỉ báo, mức, điểm từng chỉ báo và ví dụ tính điểm
  async monthlySheet(
    currentUser: CurrentUser,
    evaluationId: string,
    format: DocumentFormat,
    ipAddress: string | null,
  ): Promise<ExportedDocument> {
    const database = await this.support.database();
    const detail = await this.evaluationFor(currentUser, evaluationId);
    const config = detail.config;
    const now = this.support.clock.now();
    const levelText = (code: string | null) =>
      config.result_levels.find((level) => level.code === code)?.label ??
      config.quality_levels.find((level) => level.code === code)?.label ??
      '';
    const graded = detail.tasks.filter((task) => task.converted_score !== null);
    const example = graded[0];
    const blocks: DocumentBlock[] = [
      this.header(await this.schoolName(database), now),
      { kind: 'title', text: 'PHIẾU THEO DÕI, ĐÁNH GIÁ THÁNG', subtitle: detail.period_name },
      { kind: 'paragraph', text: `Họ và tên: ${detail.full_name} — Đơn vị: ${detail.org_unit_name}` },
      { kind: 'paragraph', text: `Bộ quy tắc: ${detail.rule_set_name} (phiên bản ${detail.version_no})` },
      { kind: 'heading', text: '1. Kết quả từng chỉ báo công việc' },
      {
        kind: 'table',
        header: ['TT', 'Chỉ báo công việc', 'Hạn', 'Mức đánh giá', 'Tỷ lệ', 'Điểm tối đa', 'Điểm đạt'],
        rows: detail.tasks.map((task, index) => [
          String(index + 1),
          taskName(task),
          task.deadline,
          levelText(task.result_code ?? task.quality_code),
          pct(task.task_percent),
          String(task.max_converted),
          score(task.converted_score),
        ]),
        widths: [5, 45, 10, 16, 8, 8, 8],
      },
      { kind: 'heading', text: '2. Tổng hợp điểm' },
      {
        kind: 'table',
        header: ['Nội dung', 'Điểm'],
        rows: [
          ['Tiêu chí chung', String(detail.general_score)],
          [
            `Kết quả thực hiện nhiệm vụ = min(${config.task_part_max}; ${config.task_part_max} × ${detail.actual_total} / ${detail.plan_max})`,
            String(detail.task_score),
          ],
          ['Điểm thưởng', String(detail.bonus_score)],
          ['Tổng điểm', String(detail.total_score)],
        ],
        widths: [80, 20],
        boldRows: [3],
      },
      { kind: 'heading', text: '3. Ví dụ tính điểm' },
      {
        kind: 'paragraph',
        text: example
          ? `Chỉ báo "${taskName(example)}": điểm chuẩn ${example.standard_score} × tỷ lệ ${example.task_percent}% = ${example.execution_score} điểm thực hiện; × hệ số ${example.difficulty_weight} = ${example.converted_score} điểm quy đổi (tối đa ${example.max_converted}).`
          : `Mỗi chỉ báo: điểm chuẩn × tỷ lệ của mức đánh giá (${config.result_levels.map((level) => `${level.label} ${level.percent}%`).join('; ')}) = điểm thực hiện; điểm thực hiện × hệ số độ khó = điểm quy đổi.`,
        align: 'justify',
      },
      {
        kind: 'paragraph',
        text: `Mức đề xuất theo điểm: ${config.ranks.find((rank) => rank.code === detail.suggested_rank)?.label ?? ''}`,
      },
      {
        kind: 'signatures',
        left: { title: 'NGƯỜI ĐƯỢC ĐÁNH GIÁ', note: '(Ký, ghi rõ họ tên)', name: detail.full_name },
        right: { title: 'NGƯỜI ĐÁNH GIÁ', note: '(Ký, ghi rõ họ tên)', name: detail.superior_by_name ?? '' },
      },
    ];
    const built = await this.document(blocks, format, 'Phiếu theo dõi, đánh giá tháng');
    const fileName = `phieu-danh-gia-thang-${fileStamp(now)}.${format}`;
    const logId = await this.log(database, currentUser, {
      reportCode: 'kpi-monthly-sheet',
      filters: { evaluation_id: evaluationId, format },
      units: [detail.org_unit_id],
      rowCount: detail.tasks.length,
      fileName,
      ipAddress,
    });
    return { ...built, fileName, logId };
  }

  // Phiếu xếp loại chất lượng năm: các kỳ tháng trong khoảng ngày của kỳ năm, điểm trung bình, mức đề xuất theo ngưỡng
  async annualSheet(
    currentUser: CurrentUser,
    yearPeriodId: string,
    staffId: string,
    format: DocumentFormat,
    ipAddress: string | null,
  ): Promise<ExportedDocument> {
    const database = await this.support.database();
    const year = await this.support.period(database, yearPeriodId);
    const months = await database
      .selectFrom('kpi_evaluations')
      .innerJoin('kpi_periods', 'kpi_periods.id', 'kpi_evaluations.period_id')
      .select([
        'kpi_evaluations.id',
        'kpi_periods.name',
        'kpi_periods.start_date',
        'kpi_evaluations.total_score',
        'kpi_evaluations.final_rank',
        'kpi_evaluations.superior_rank',
        'kpi_evaluations.suggested_rank',
        'kpi_evaluations.rule_set_version_id',
      ])
      .where('kpi_evaluations.staff_id', '=', staffId)
      .where('kpi_periods.period_type', '=', 'month')
      .where('kpi_periods.start_date', '>=', year.start_date)
      .where('kpi_periods.end_date', '<=', year.end_date)
      .orderBy('kpi_periods.start_date')
      .execute();
    const staff = await this.support.staff(database, staffId);
    const own = await this.support.findOwnStaff(database, currentUser);
    if (own?.id !== staffId) {
      const scopes = await Promise.all([
        this.support.scope(currentUser, KPI_PERMISSIONS.manage),
        this.support.scope(currentUser, KPI_PERMISSIONS.advise),
      ]);
      if (!scopes.some((scope) => inScope(scope, staff.org_unit_id))) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không xem được phiếu của người này');
      }
    }
    const yearEvaluation = await database
      .selectFrom('kpi_evaluations')
      .select(['rule_set_version_id', 'final_rank', 'superior_rank', 'total_score'])
      .where('period_id', '=', yearPeriodId)
      .where('staff_id', '=', staffId)
      .executeTakeFirst();
    const versionId = yearEvaluation?.rule_set_version_id ?? months.at(-1)?.rule_set_version_id;
    const config = versionId ? await this.support.config(database, versionId) : undefined;
    const average = months.length
      ? round2(months.reduce((sum, row) => sum + num(row.total_score), 0) / months.length)
      : 0;
    const rankText = (code: string | null | undefined) => config?.ranks.find((rank) => rank.code === code)?.label ?? '';
    const byScore = config
      ? [...config.ranks]
          .sort((left, right) => right.min_score - left.min_score)
          .find((rank) => average >= rank.min_score)
      : undefined;
    const now = this.support.clock.now();
    const blocks: DocumentBlock[] = [
      this.header(await this.schoolName(database), now),
      { kind: 'title', text: 'PHIẾU XẾP LOẠI CHẤT LƯỢNG VIÊN CHỨC', subtitle: year.name },
      { kind: 'paragraph', text: `Họ và tên: ${staff.full_name}` },
      { kind: 'heading', text: '1. Kết quả đánh giá các tháng' },
      {
        kind: 'table',
        header: ['Tháng', 'Tổng điểm', 'Mức xếp loại tháng'],
        rows: months.map((row) => [
          row.name,
          String(num(row.total_score)),
          rankText(row.final_rank ?? row.superior_rank ?? row.suggested_rank),
        ]),
        widths: [40, 20, 40],
      },
      { kind: 'paragraph', text: `Điểm trung bình các tháng: ${average} (${months.length} tháng)` },
      { kind: 'paragraph', text: `Mức theo điểm trung bình: ${byScore?.label ?? ''}` },
      ...(yearEvaluation
        ? [
            {
              kind: 'paragraph' as const,
              text: `Kết quả đánh giá kỳ năm: ${num(yearEvaluation.total_score)} điểm — ${rankText(yearEvaluation.final_rank ?? yearEvaluation.superior_rank)}`,
            },
          ]
        : []),
      { kind: 'heading', text: '2. Xếp loại chất lượng' },
      { kind: 'paragraph', text: `Mức xếp loại: ${rankText(yearEvaluation?.final_rank) || byScore?.label || ''}` },
      {
        kind: 'signatures',
        left: { title: 'VIÊN CHỨC', note: '(Ký, ghi rõ họ tên)', name: staff.full_name },
        right: { title: 'THỦ TRƯỞNG ĐƠN VỊ', note: '(Ký, ghi rõ họ tên và đóng dấu)' },
      },
    ];
    const built = await this.document(blocks, format, 'Phiếu xếp loại chất lượng năm');
    const fileName = `phieu-xep-loai-nam-${fileStamp(now)}.${format}`;
    const logId = await this.log(database, currentUser, {
      reportCode: 'kpi-annual-sheet',
      filters: { period_id: yearPeriodId, staff_id: staffId, format },
      units: [staff.org_unit_id],
      rowCount: months.length,
      fileName,
      ipAddress,
    });
    return { ...built, fileName, logId };
  }

  // Phạm vi xem tổng hợp: người tham mưu, người quản lý, người cấu hình
  private async summaryScope(currentUser: CurrentUser) {
    const scopes = await Promise.all(
      [KPI_PERMISSIONS.advise, KPI_PERMISSIONS.manage, KPI_PERMISSIONS.configure].map((code) =>
        this.support.scope(currentUser, code),
      ),
    );
    return {
      wholeSchool: scopes.some((scope) => scope.wholeSchool),
      orgUnitIds: [...new Set(scopes.flatMap((scope) => scope.orgUnitIds))],
    };
  }

  async summaryRows(currentUser: CurrentUser, periodId: string, orgUnitId: string | null) {
    const database = await this.support.database();
    const scope = await this.summaryScope(currentUser);
    if (orgUnitId && !inScope(scope, orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
    let query = database
      .selectFrom('kpi_evaluations')
      .innerJoin('staff', 'staff.id', 'kpi_evaluations.staff_id')
      .innerJoin('org_units', 'org_units.id', 'kpi_evaluations.org_unit_id')
      .leftJoin('job_titles', 'job_titles.id', 'staff.job_title_id')
      .selectAll('kpi_evaluations')
      .select([
        'staff.full_name',
        'staff.code as staff_code',
        'org_units.name as org_unit_name',
        'job_titles.name as job_title_name',
      ])
      .where('kpi_evaluations.period_id', '=', periodId)
      .orderBy('org_units.name')
      .orderBy('kpi_evaluations.total_score', 'desc');
    if (orgUnitId) {
      query = query.where('kpi_evaluations.org_unit_id', '=', orgUnitId);
    } else if (!scope.wholeSchool) {
      query = query.where(
        'kpi_evaluations.org_unit_id',
        'in',
        scope.orgUnitIds.length ? scope.orgUnitIds : ['00000000-0000-0000-0000-000000000000'],
      );
    }
    const rows = await query.execute();
    const configs = new Map<string, KpiRuleConfig>();
    for (const row of rows) {
      if (!configs.has(row.rule_set_version_id)) {
        configs.set(row.rule_set_version_id, await this.support.config(database, row.rule_set_version_id));
      }
    }
    return rows.map((row) => {
      const config = configs.get(row.rule_set_version_id);
      const label = (code: string | null) => config?.ranks.find((rank) => rank.code === code)?.label ?? '';
      return {
        id: row.id,
        staff_id: row.staff_id,
        full_name: row.full_name,
        staff_code: row.staff_code,
        job_title_name: row.job_title_name,
        org_unit_id: row.org_unit_id,
        org_unit_name: row.org_unit_name,
        status: row.status,
        status_label: KPI_EVALUATION_STATUS_LABELS[row.status] ?? row.status,
        general_score: num(row.general_score),
        task_score: num(row.task_score),
        bonus_score: num(row.bonus_score),
        total_score: num(row.total_score),
        suggested_rank: label(row.suggested_rank),
        self_rank: label(row.self_rank),
        superior_rank: label(row.superior_rank),
        advisory_rank: label(row.advisory_rank),
        final_rank: label(row.final_rank),
      };
    });
  }

  async unitSummary(
    currentUser: CurrentUser,
    periodId: string,
    orgUnitId: string | null,
    format: 'xlsx' | 'pdf' | 'docx',
    ipAddress: string | null,
  ): Promise<ExportedDocument> {
    const database = await this.support.database();
    const period = await this.support.period(database, periodId);
    const rows = await this.summaryRows(currentUser, periodId, orgUnitId);
    const now = this.support.clock.now();
    const columns = [
      { key: 'full_name', label: 'Họ và tên', width: 26 },
      { key: 'job_title_name', label: 'Chức vụ', width: 18 },
      { key: 'org_unit_name', label: 'Đơn vị', width: 20 },
      { key: 'general_score', label: 'Tiêu chí chung', width: 10 },
      { key: 'task_score', label: 'Điểm KPI công việc', width: 10 },
      { key: 'bonus_score', label: 'Điểm thưởng', width: 9 },
      { key: 'total_score', label: 'Tổng điểm', width: 9 },
      { key: 'self_rank', label: 'Tự xếp loại', width: 20 },
      { key: 'superior_rank', label: 'Cấp trên đánh giá', width: 20 },
      { key: 'advisory_rank', label: 'Tham mưu đề xuất', width: 20 },
      { key: 'final_rank', label: 'Kết quả xếp loại', width: 20 },
    ];
    const title = 'BẢNG TỔNG HỢP KẾT QUẢ ĐÁNH GIÁ, XẾP LOẠI';
    let built: { buffer: Buffer; contentType: string };
    if (format === 'docx') {
      built = await this.document(
        [
          this.header(await this.schoolName(database), now),
          { kind: 'title', text: title, subtitle: period.name },
          {
            kind: 'table',
            header: ['STT', ...columns.map((column) => column.label)],
            rows: rows.map((row, index) => [
              String(index + 1),
              ...columns.map((column) => String((row as Record<string, unknown>)[column.key] ?? '')),
            ]),
            widths: [4, ...columns.map((column) => column.width)],
          },
          {
            kind: 'signatures',
            left: { title: 'NGƯỜI LẬP BẢNG' },
            right: { title: 'THỦ TRƯỞNG ĐƠN VỊ', note: '(Ký, ghi rõ họ tên và đóng dấu)' },
          },
        ],
        'docx',
        title,
        true,
      );
    } else {
      built = {
        buffer: await buildTableFile(
          format,
          [{ title: 'Tổng hợp xếp loại', heading: [title, period.name], numbered: true, columns, rows }],
          now,
        ),
        contentType: CONTENT_TYPES[format],
      };
    }
    const fileName = `tong-hop-xep-loai-${fileStamp(now)}.${format}`;
    const logId = await this.log(database, currentUser, {
      reportCode: 'kpi-unit-summary',
      filters: { period_id: periodId, org_unit_id: orgUnitId, format },
      units: [...new Set(rows.map((row) => row.org_unit_id))],
      rowCount: rows.length,
      fileName,
      ipAddress,
    });
    return { ...built, fileName, logId };
  }

  // Sổ trách nhiệm chấm, duyệt: số việc duyệt, chấm đúng hạn, quá hạn, để hệ thống tự xử lý của từng người quản lý
  async managerActions(currentUser: CurrentUser, periodId: string) {
    const database = await this.support.database();
    const scope = await this.summaryScope(currentUser);
    let query = database
      .selectFrom('kpi_manager_actions')
      .leftJoin('staff', 'staff.id', 'kpi_manager_actions.manager_staff_id')
      .leftJoin('org_units', 'org_units.id', 'staff.org_unit_id')
      .select([
        'kpi_manager_actions.manager_staff_id',
        'kpi_manager_actions.manager_name',
        'org_units.name as org_unit_name',
        'kpi_manager_actions.action',
        (eb) => eb.fn.countAll<string>().as('total'),
        (eb) =>
          eb.fn
            .count<string>('kpi_manager_actions.id')
            .filterWhere('kpi_manager_actions.on_time', '=', true)
            .as('on_time'),
        (eb) =>
          eb.fn
            .count<string>('kpi_manager_actions.id')
            .filterWhere('kpi_manager_actions.automatic', '=', true)
            .as('automatic'),
      ])
      .where('kpi_manager_actions.period_id', '=', periodId)
      .groupBy([
        'kpi_manager_actions.manager_staff_id',
        'kpi_manager_actions.manager_name',
        'org_units.name',
        'kpi_manager_actions.action',
      ])
      .orderBy('kpi_manager_actions.manager_name');
    if (!scope.wholeSchool) {
      query = query.where(
        'staff.org_unit_id',
        'in',
        scope.orgUnitIds.length ? scope.orgUnitIds : ['00000000-0000-0000-0000-000000000000'],
      );
    }
    const rows = await query.execute();
    return rows.map((row) => ({
      manager_staff_id: row.manager_staff_id,
      manager_name: row.manager_name ?? 'Chưa xác định người quản lý',
      org_unit_name: row.org_unit_name,
      action: row.action,
      action_label: row.action === 'approve' ? 'Duyệt, xác nhận việc' : 'Chấm việc',
      total: Number(row.total),
      on_time: Number(row.on_time),
      late: Number(row.total) - Number(row.on_time),
      automatic: Number(row.automatic),
    }));
  }

  async managerActionsFile(
    currentUser: CurrentUser,
    periodId: string,
    ipAddress: string | null,
  ): Promise<ExportedDocument> {
    const database = await this.support.database();
    const period = await this.support.period(database, periodId);
    const rows = await this.managerActions(currentUser, periodId);
    const now = this.support.clock.now();
    const fileName = `trach-nhiem-cham-duyet-${fileStamp(now)}.xlsx`;
    const buffer = await buildTableFile(
      'xlsx',
      [
        {
          title: 'Trách nhiệm chấm, duyệt',
          heading: ['SỔ THEO DÕI TRÁCH NHIỆM CHẤM, DUYỆT CỦA NGƯỜI QUẢN LÝ', period.name],
          numbered: true,
          columns: [
            { key: 'manager_name', label: 'Người quản lý', width: 26 },
            { key: 'org_unit_name', label: 'Đơn vị', width: 22 },
            { key: 'action_label', label: 'Việc phải làm', width: 22 },
            { key: 'total', label: 'Tổng số', width: 10 },
            { key: 'on_time', label: 'Đúng hạn', width: 10 },
            { key: 'late', label: 'Quá hạn', width: 10 },
            { key: 'automatic', label: 'Hệ thống tự xử lý do quá hạn', width: 16 },
          ],
          rows,
        },
      ],
      now,
    );
    const logId = await this.log(database, currentUser, {
      reportCode: 'kpi-manager-actions',
      filters: { period_id: periodId },
      units: [],
      rowCount: rows.length,
      fileName,
      ipAddress,
    });
    return { buffer, fileName, contentType: CONTENT_TYPES.xlsx, logId };
  }

  // Quy chế đánh giá, xếp loại của đơn vị sinh từ cấu hình của phiên bản quy tắc, theo cấp học; trường sửa tiếp trên tệp Word
  async regulation(
    currentUser: CurrentUser,
    versionId: string,
    schoolLevel: string | null,
    ipAddress: string | null,
  ): Promise<ExportedDocument> {
    const database = await this.support.database();
    const config = await this.support.config(database, versionId);
    const version = await database
      .selectFrom('kpi_rule_set_versions')
      .innerJoin('kpi_rule_sets', 'kpi_rule_sets.id', 'kpi_rule_set_versions.rule_set_id')
      .select(['kpi_rule_sets.name', 'kpi_rule_set_versions.version_no'])
      .where('kpi_rule_set_versions.id', '=', versionId)
      .executeTakeFirstOrThrow();
    const levelLabel = KPI_SCHOOL_LEVELS.find((level) => level.value === schoolLevel)?.label;
    const positions = config.job_positions.filter(
      (position) => !schoolLevel || position.levels.includes(schoolLevel as never),
    );
    const now = this.support.clock.now();
    const schoolName = await this.schoolName(database);
    let article = 0;
    const articleBlock = (title: string, lines: string[]): DocumentBlock[] => {
      article += 1;
      return [
        { kind: 'paragraph', text: `Điều ${article}. ${title}`, bold: true },
        ...lines.map((text) => ({ kind: 'paragraph' as const, text, align: 'justify' as const })),
      ];
    };
    const levelsText =
      config.scoring_mode === 'progress_quality'
        ? [
            `Điểm thực hiện = điểm chuẩn × (${config.weights.progress}% tiến độ + ${config.weights.quality}% kết quả), không vượt điểm chuẩn.`,
            `Tiến độ: ${config.progress_levels.map((level) => `${level.label} ${level.percent}%`).join('; ')}.`,
            `Kết quả: ${config.quality_levels.map((level) => `${level.percent}% — ${level.label}`).join('; ')}.`,
          ]
        : [
            `Mỗi chỉ báo chấm theo thang ${config.result_levels.length} mức: ${config.result_levels.map((level) => `${level.label} (${level.percent / 100})`).join('; ')}.`,
            'Điểm thực hiện = điểm chuẩn × tỷ lệ của mức, không vượt điểm chuẩn.',
          ];
    const blocks: DocumentBlock[] = [
      {
        kind: 'header',
        left: [schoolName.toUpperCase(), ''],
        right: ['CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'Độc lập - Tự do - Hạnh phúc', ''],
      },
      {
        kind: 'title',
        text: 'QUY CHẾ',
        subtitle: `Đánh giá, xếp loại chất lượng${levelLabel ? ` (cấp ${levelLabel})` : ''}`,
      },
      {
        kind: 'paragraph',
        text: `(Bản mẫu sinh từ ${version.name}, phiên bản ${version.version_no}; đơn vị rà soát, bổ sung trước khi ban hành)`,
        italic: true,
        align: 'center',
      },
      { kind: 'heading', text: 'Chương I. QUY ĐỊNH CHUNG' },
      ...articleBlock('Phạm vi điều chỉnh và đối tượng áp dụng', [
        `Quy chế này quy định việc đánh giá, xếp loại chất lượng theo ${KPI_SCORING_MODE_LABELS[config.scoring_mode].toLowerCase()} tại ${schoolName}.`,
        `Đối tượng: ${config.subject_groups.map((group) => group.label).join('; ')}.`,
      ]),
      ...articleBlock('Nguyên tắc đánh giá', [
        'Đánh giá khách quan, công khai, dựa trên kết quả, sản phẩm công việc và minh chứng; không ai tự chấm, tự kết luận cho chính mình.',
      ]),
      { kind: 'heading', text: 'Chương II. TIÊU CHÍ ĐÁNH GIÁ' },
      ...articleBlock(`Nhóm tiêu chí chung (${config.general.max} điểm)`, [
        'Mỗi tiêu chí đảm bảo được điểm tối đa, không đảm bảo được 0 điểm.',
        ...config.general.groups.flatMap((group) => [
          `${group.code}. ${group.title}`,
          ...group.items.map(
            (item) =>
              `${item.code}. ${item.title} (${item.max_score} điểm; ${item.subject_groups
                .map((code) => config.subject_groups.find((entry) => entry.code === code)?.label ?? code)
                .join(', ')})`,
          ),
        ]),
      ]),
      ...articleBlock(`Kết quả thực hiện nhiệm vụ (${config.task_part.max} điểm)`, [
        `Các trục, mảng công việc: ${config.axes.map((axis) => `${axis.code} — ${axis.name}`).join('; ')}.`,
        ...(positions.length
          ? [
              `Vị trí việc làm: ${positions.map((position) => `${position.label}${position.is_manager ? ' (viên chức quản lý)' : ''}`).join('; ')}.`,
            ]
          : []),
        ...(schoolLevel && config.indicator_targets[schoolLevel as never]
          ? [
              `Số chỉ báo công việc của cấp học: ${config.indicator_targets[schoolLevel as never]} chỉ báo (Phụ lục kèm theo).`,
            ]
          : []),
      ]),
      { kind: 'heading', text: 'Chương III. CÁCH TÍNH ĐIỂM' },
      ...articleBlock('Điểm từng việc', [
        `Loại công việc: ${config.task_types.map((type) => `${type.name} (điểm chuẩn ${type.standard_score})`).join('; ')}.`,
        `Hệ số độ khó: ${config.difficulty_levels.map((level) => level.label).join('; ')}.`,
        ...levelsText,
        'Điểm quy đổi = hệ số độ khó × điểm thực hiện, làm tròn 2 chữ số, không vượt điểm quy đổi tối đa.',
      ]),
      ...articleBlock('Điểm kết quả thực hiện nhiệm vụ trong kỳ', [
        `A là tổng điểm quy đổi tối đa của danh mục đầu kỳ đã xác nhận; B là tổng điểm quy đổi thực tế, gồm cả việc phát sinh. Điểm = min(${config.task_part.max}; ${config.task_part.max} × B / A).`,
      ]),
      ...articleBlock('Điểm thưởng', [
        `Mỗi việc nổi trội, sáng kiến được cấp có thẩm quyền xác nhận cộng ${config.bonus.rate_percent}% điểm quy đổi của việc đó; tổng điểm thưởng tối đa ${config.bonus.max_total} điểm; tổng điểm không vượt ${config.total_max}.`,
      ]),
      { kind: 'heading', text: 'Chương IV. XẾP LOẠI' },
      ...articleBlock('Mức xếp loại', [
        ...[...config.ranks]
          .sort((left, right) => right.min_score - left.min_score)
          .map(
            (rank) =>
              `${rank.label}: từ ${rank.min_score} điểm${rank.require_all_on_time ? ', 100% việc đúng hạn' : ''}${rank.min_exceeding_percent !== undefined ? `, ít nhất ${rank.min_exceeding_percent}% việc vượt yêu cầu` : ''}${rank.max_zero_progress_percent !== undefined ? `, số việc có tiến độ 0% không quá ${rank.max_zero_progress_percent}%` : ''}.`,
          ),
        `Tỷ lệ xếp loại xuất sắc không quá ${config.excellent_quota.percent}%${config.excellent_quota.by_group ? ', xét riêng trong từng nhóm đối tượng' : ''}.`,
      ]),
      ...articleBlock('Trường hợp loại trừ', [
        `Người thuộc một trong các trường hợp sau xếp mức thấp nhất: ${config.exclusions.map((item) => item.label).join('; ')}.`,
      ]),
      { kind: 'heading', text: 'Chương V. QUY TRÌNH VÀ THỜI HẠN' },
      ...articleBlock('Đăng ký, giao và xác nhận việc', [
        `Cấp có thẩm quyền duyệt việc đăng ký, người được giao xác nhận việc trong ${config.deadlines.approval_days} ngày; quá hạn thì việc tự vào danh mục.`,
        `Người được giao được chuyển trả việc tối đa ${config.deadlines.max_returns} lần, phải ghi lý do.`,
      ]),
      ...articleBlock('Tự đánh giá và đánh giá của cấp trên', [
        `Cấp trên chấm trong ${config.deadlines.grading_days} ngày kể từ khi cá nhân nộp kết quả tự đánh giá; quá hạn thì lấy kết quả tự đánh giá. Việc chấm, duyệt đúng hạn được ghi lại làm căn cứ đánh giá trách nhiệm của người quản lý.`,
      ]),
      ...articleBlock('Tổng hợp, biểu quyết và công bố', [
        'Bộ phận tham mưu tổng hợp, đề xuất mức xếp loại; tập thể lãnh đạo biểu quyết; thủ trưởng đơn vị khóa kỳ và công bố kết quả.',
      ]),
      { kind: 'heading', text: 'Chương VI. TỔ CHỨC THỰC HIỆN' },
      ...articleBlock('Hiệu lực', [
        'Quy chế có hiệu lực kể từ ngày ký. Trong quá trình thực hiện, nếu có vướng mắc, các bộ phận phản ánh để sửa đổi, bổ sung.',
      ]),
      { kind: 'signatures', right: { title: 'THỦ TRƯỞNG ĐƠN VỊ', note: '(Ký, ghi rõ họ tên và đóng dấu)' } },
    ];
    const fileName = `quy-che-danh-gia-${fileStamp(now)}.docx`;
    const buffer = buildDocx(blocks, { title: 'Quy chế đánh giá, xếp loại' });
    const logId = await this.log(database, currentUser, {
      reportCode: 'kpi-regulation',
      filters: { rule_set_version_id: versionId, school_level: schoolLevel },
      units: [],
      rowCount: 0,
      fileName,
      ipAddress,
    });
    return { buffer, fileName, contentType: DOCX_TYPE, logId };
  }

  forms(config: KpiRuleConfig): Array<{ code: KpiFormCode; label: string }> {
    return config.forms.map((code) => ({ code, label: KPI_FORM_LABELS[code] }));
  }
}

function send(response: Response, file: ExportedDocument) {
  response.setHeader('content-type', file.contentType);
  response.setHeader('content-disposition', `attachment; filename="${file.fileName}"`);
  response.setHeader('x-export-log-id', file.logId);
  response.setHeader('cache-control', 'no-store');
  response.send(file.buffer);
}

const ALL_KPI = [
  KPI_PERMISSIONS.participate,
  KPI_PERMISSIONS.manage,
  KPI_PERMISSIONS.advise,
  KPI_PERMISSIONS.vote,
  KPI_PERMISSIONS.configure,
];

@Controller('kpi/reports')
export class KpiReportsController {
  constructor(private readonly reports: KpiReportsService) {}

  @Get('evaluations/:id/task-sheet')
  @RequirePermission(...ALL_KPI)
  async taskSheet(
    @Param('id', uuidParameter('Mã phiếu không hợp lệ')) evaluationId: string,
    @Query('format') format: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const chosen = readFormat<SheetFormat>(format, ['xlsx', 'pdf'], 'xlsx');
    send(response, await this.reports.taskSheet(currentUser, evaluationId, chosen, request.ip ?? null));
  }

  @Get('evaluations/:id/self-evaluation')
  @RequirePermission(...ALL_KPI)
  async selfEvaluation(
    @Param('id', uuidParameter('Mã phiếu không hợp lệ')) evaluationId: string,
    @Query('format') format: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const chosen = readFormat<DocumentFormat>(format, ['docx', 'pdf'], 'docx');
    send(response, await this.reports.selfEvaluation(currentUser, evaluationId, chosen, request.ip ?? null));
  }

  @Get('evaluations/:id/monthly-sheet')
  @RequirePermission(...ALL_KPI)
  async monthlySheet(
    @Param('id', uuidParameter('Mã phiếu không hợp lệ')) evaluationId: string,
    @Query('format') format: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const chosen = readFormat<DocumentFormat>(format, ['docx', 'pdf'], 'docx');
    send(response, await this.reports.monthlySheet(currentUser, evaluationId, chosen, request.ip ?? null));
  }

  @Get('periods/:id/annual-sheet')
  @RequirePermission(...ALL_KPI)
  async annualSheet(
    @Param('id', uuidParameter('Mã kỳ không hợp lệ')) periodId: string,
    @Query('staff_id') staffId: string | undefined,
    @Query('format') format: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (!isUuid(staffId)) {
      errors.push({ field: 'staff_id', message: 'Chọn nhân sự' });
    }
    check(errors);
    const chosen = readFormat<DocumentFormat>(format, ['docx', 'pdf'], 'docx');
    send(response, await this.reports.annualSheet(currentUser, periodId, staffId!, chosen, request.ip ?? null));
  }

  @Get('periods/:id/summary')
  @RequirePermission(KPI_PERMISSIONS.advise, KPI_PERMISSIONS.manage, KPI_PERMISSIONS.configure)
  summary(
    @Param('id', uuidParameter('Mã kỳ không hợp lệ')) periodId: string,
    @Query('org_unit_id') orgUnitId: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (orgUnitId !== undefined && !isUuid(orgUnitId)) {
      throw validationError([{ field: 'org_unit_id', message: 'Mã không hợp lệ' }]);
    }
    return this.reports.summaryRows(currentUser, periodId, orgUnitId ?? null);
  }

  @Get('periods/:id/unit-summary')
  @RequirePermission(KPI_PERMISSIONS.advise, KPI_PERMISSIONS.manage, KPI_PERMISSIONS.configure)
  async unitSummary(
    @Param('id', uuidParameter('Mã kỳ không hợp lệ')) periodId: string,
    @Query('org_unit_id') orgUnitId: string | undefined,
    @Query('format') format: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (orgUnitId !== undefined && !isUuid(orgUnitId)) {
      throw validationError([{ field: 'org_unit_id', message: 'Mã không hợp lệ' }]);
    }
    const chosen = readFormat<'xlsx' | 'pdf' | 'docx'>(format, ['xlsx', 'pdf', 'docx'], 'xlsx');
    send(
      response,
      await this.reports.unitSummary(currentUser, periodId, orgUnitId ?? null, chosen, request.ip ?? null),
    );
  }

  @Get('periods/:id/manager-actions')
  @RequirePermission(KPI_PERMISSIONS.advise, KPI_PERMISSIONS.manage, KPI_PERMISSIONS.configure)
  managerActions(
    @Param('id', uuidParameter('Mã kỳ không hợp lệ')) periodId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.reports.managerActions(currentUser, periodId);
  }

  @Get('periods/:id/manager-actions/export')
  @RequirePermission(KPI_PERMISSIONS.advise, KPI_PERMISSIONS.manage, KPI_PERMISSIONS.configure)
  async managerActionsFile(
    @Param('id', uuidParameter('Mã kỳ không hợp lệ')) periodId: string,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    send(response, await this.reports.managerActionsFile(currentUser, periodId, request.ip ?? null));
  }

  @Get('regulation')
  @RequirePermission(KPI_PERMISSIONS.configure, KPI_PERMISSIONS.advise)
  async regulation(
    @Query('rule_set_version_id') versionId: string | undefined,
    @Query('school_level') schoolLevel: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (!isUuid(versionId)) {
      errors.push({ field: 'rule_set_version_id', message: 'Chọn phiên bản bộ quy tắc' });
    }
    if (schoolLevel !== undefined && !KPI_SCHOOL_LEVELS.some((level) => level.value === schoolLevel)) {
      errors.push({ field: 'school_level', message: 'Cấp học là MN, TH, THCS hoặc THPT' });
    }
    check(errors);
    send(response, await this.reports.regulation(currentUser, versionId!, schoolLevel ?? null, request.ip ?? null));
  }
}
