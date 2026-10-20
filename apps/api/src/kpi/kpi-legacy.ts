import { randomUUID } from 'node:crypto';
import { rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Body, Controller, HttpCode, Injectable, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { KpiTaskStatus } from '@school-management/database';
import { validationError } from '@school-management/server';
import type { KpiRuleConfig } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import type { RequestBody } from '../common/request-fields.js';
import { criteriaFor, round2 } from './kpi-engine.js';
import { KPI_PERMISSIONS, kpiRule, KpiSupport, type Executor } from './kpi-support.js';

// Chuyển dữ liệu từ hệ thống KPI cũ (DT-18 phần 18d, YCTD-139): đọc tệp sao lưu (cơ sở dữ liệu SQLite, nút "Tải bản sao
// lưu" của hệ thống cũ) do người dùng tải lên lúc chạy; không có tệp dữ liệu nào của hệ thống cũ trong kho mã. Chuyển kỳ,
// danh mục công việc chuẩn, việc của từng người và kết quả đánh giá sang bộ quy tắc 1. Người ở hệ thống cũ được ghép với hồ sơ
// nhân sự theo họ tên (không phân biệt hoa thường, khoảng trắng); không ghép được thì bỏ qua và báo lại. Xem trước trả số lượng
// mà không ghi; chạy lại không nhân đôi dữ liệu (theo mã gốc của hệ thống cũ)
const MAXIMUM_BACKUP_BYTES = 100 * 1024 * 1024;
const SQLITE_SIGNATURE = 'SQLite format 3\u0000';
const LEGACY_RULE_SET = 'BQT-1';

interface LegacyRow {
  [key: string]: string | number | null;
}

export interface LegacyImportResult {
  preview: boolean;
  periods: number;
  catalog_items: number;
  tasks: number;
  evaluations: number;
  profiles: number;
  unmatched_people: string[];
  skipped_tasks: number;
}

const normalize = (text: string | number | null | undefined) =>
  String(text ?? '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('vi');
const text = (value: string | number | null | undefined) =>
  value === null || value === undefined ? null : String(value);
const numberOf = (value: string | number | null | undefined, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const dateOf = (value: string | number | null | undefined) => {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? ''));
  return match ? match[1]! : null;
};
// Trục cũ ghi TRUC_1..TRUC_6, bộ quy tắc 1 ghi 1..6
const axisOf = (value: string | number | null | undefined) => /(\d)/.exec(String(value ?? ''))?.[1] ?? '1';

function tableRows(source: DatabaseSync, table: string): LegacyRow[] {
  const exists = source.prepare(`select name from sqlite_master where type = 'table' and name = ?`).get(table);
  return exists ? (source.prepare(`select * from ${table}`).all() as LegacyRow[]) : [];
}

@Injectable()
export class KpiLegacyImportService {
  constructor(private readonly support: KpiSupport) {}

  async run(
    currentUser: CurrentUser,
    body: Buffer,
    preview: boolean,
    origin: ChangeOrigin,
  ): Promise<LegacyImportResult> {
    if (body.length > MAXIMUM_BACKUP_BYTES) {
      throw validationError([{ field: 'file', message: 'Tệp sao lưu tối đa 100 MB' }]);
    }
    if (body.subarray(0, 16).toString('latin1') !== SQLITE_SIGNATURE) {
      throw validationError([{ field: 'file', message: 'Tệp không phải tệp sao lưu của hệ thống KPI cũ (SQLite)' }]);
    }
    const scope = await this.support.scope(currentUser, KPI_PERMISSIONS.configure);
    if (!scope.wholeSchool) {
      throw kpiRule('Chỉ người cấu hình toàn trường chuyển dữ liệu từ hệ thống cũ');
    }
    // Thư viện SQLite đọc tệp theo đường dẫn; tệp tạm tên ngẫu nhiên, xóa ngay sau khi đọc
    const path = join(tmpdir(), `kpi-legacy-${randomUUID()}.db`);
    writeFileSync(path, body, { mode: 0o600 });
    let data: Record<string, LegacyRow[]>;
    try {
      const source = new DatabaseSync(path, { readOnly: true });
      try {
        data = Object.fromEntries(
          ['periods', 'standard_tasks', 'users', 'assigned_tasks', 'evaluations'].map((table) => [
            table,
            tableRows(source, table),
          ]),
        );
      } finally {
        source.close();
      }
    } catch {
      throw validationError([{ field: 'file', message: 'Không đọc được tệp sao lưu' }]);
    } finally {
      rmSync(path, { force: true });
    }
    const database = await this.support.database();
    return database
      .transaction()
      .execute(async (transaction) => {
        const result = await this.apply(transaction, data, origin);
        if (preview) {
          // Xem trước: chạy đủ các bước rồi bỏ toàn bộ thay đổi
          throw new PreviewRollback(result);
        }
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'kpi_legacy_import',
          entityId: origin.actorUserId,
          action: 'create',
          before: null,
          after: result,
        });
        return result;
      })
      .catch((error: unknown) => {
        if (error instanceof PreviewRollback) {
          return { ...error.result, preview: true };
        }
        throw error;
      });
  }

  private async apply(
    database: Executor,
    data: Record<string, LegacyRow[]>,
    origin: ChangeOrigin,
  ): Promise<LegacyImportResult> {
    const ruleSet = await database
      .selectFrom('kpi_rule_sets')
      .innerJoin('kpi_rule_set_versions', 'kpi_rule_set_versions.rule_set_id', 'kpi_rule_sets.id')
      .select(['kpi_rule_sets.id', 'kpi_rule_set_versions.id as version_id'])
      .where('kpi_rule_sets.code', '=', LEGACY_RULE_SET)
      .where('kpi_rule_set_versions.status', '=', 'published')
      .orderBy('kpi_rule_set_versions.version_no', 'desc')
      .executeTakeFirst();
    if (!ruleSet) {
      throw kpiRule('Chưa có bộ quy tắc 1 đã ban hành để nhận dữ liệu cũ');
    }
    const config = await this.support.config(database, ruleSet.version_id);
    const result: LegacyImportResult = {
      preview: false,
      periods: 0,
      catalog_items: 0,
      tasks: 0,
      evaluations: 0,
      profiles: 0,
      unmatched_people: [],
      skipped_tasks: 0,
    };

    // Người: ghép theo họ tên với hồ sơ nhân sự đang làm việc, chỉ khi tên là duy nhất
    const staff = await database
      .selectFrom('staff')
      .select(['id', 'full_name', 'org_unit_id'])
      .where('status', '=', 'active')
      .execute();
    const byName = new Map<string, Array<(typeof staff)[number]>>();
    for (const row of staff) {
      byName.set(normalize(row.full_name), [...(byName.get(normalize(row.full_name)) ?? []), row]);
    }
    const people = new Map<string, (typeof staff)[number]>();
    for (const user of data.users ?? []) {
      if (user.role === 'admin') {
        continue;
      }
      const matches = byName.get(normalize(user.full_name)) ?? [];
      if (matches.length === 1) {
        people.set(String(user.id), matches[0]!);
        const created = await database
          .insertInto('kpi_profiles')
          .values({
            staff_id: matches[0]!.id,
            rule_set_id: ruleSet.id,
            subject_group: user.role === 'cbql' ? 'leader' : 'staff',
            created_by: origin.actorUserId,
          })
          .onConflict((conflict) => conflict.column('staff_id').doNothing())
          .returning('id')
          .executeTakeFirst();
        if (created) {
          result.profiles += 1;
        }
      } else {
        result.unmatched_people.push(String(user.full_name ?? user.username ?? user.id));
      }
    }

    // Kỳ
    const periods = new Map<string, { id: string; locked: boolean }>();
    for (const period of data.periods ?? []) {
      const legacyId = String(period.id);
      const existing = await database
        .selectFrom('kpi_periods')
        .select(['id', 'status'])
        .where('legacy_id', '=', legacyId)
        .executeTakeFirst();
      if (existing) {
        periods.set(legacyId, { id: existing.id, locked: existing.status === 'locked' });
        continue;
      }
      const start = dateOf(period.start_date) ?? this.support.today();
      const end = dateOf(period.end_date) ?? start;
      const created = await database
        .insertInto('kpi_periods')
        .values({
          code: `CU-${String(period.code ?? legacyId)
            .replace(/[^A-Za-z0-9._-]/g, '-')
            .toUpperCase()}`.slice(0, 30),
          name: String(period.name ?? period.code ?? legacyId).slice(0, 200),
          period_type: 'quarter',
          start_date: start <= end ? start : end,
          end_date: start <= end ? end : start,
          legacy_id: legacyId,
          created_by: origin.actorUserId,
        })
        .onConflict((conflict) => conflict.column('code').doNothing())
        .returning('id')
        .executeTakeFirst();
      if (!created) {
        continue;
      }
      await database
        .insertInto('kpi_period_rule_versions')
        .values({ period_id: created.id, rule_set_id: ruleSet.id, rule_set_version_id: ruleSet.version_id })
        .execute();
      periods.set(legacyId, { id: created.id, locked: numberOf(period.is_locked) === 1 });
      result.periods += 1;
    }

    // Danh mục công việc chuẩn (danh mục chung của trường)
    const catalog = new Map<string, string>();
    for (const item of data.standard_tasks ?? []) {
      const legacyId = String(item.id);
      const existing = await database
        .selectFrom('kpi_catalog_items')
        .select('id')
        .where('legacy_id', '=', legacyId)
        .executeTakeFirst();
      if (existing) {
        catalog.set(legacyId, existing.id);
        continue;
      }
      const created = await database
        .insertInto('kpi_catalog_items')
        .values({
          rule_set_id: ruleSet.id,
          code: `CU-${result.catalog_items + 1}-${legacyId.slice(0, 8)}`
            .toUpperCase()
            .replace(/[^A-Z0-9._-]/g, '-')
            .slice(0, 30),
          name: String(item.task_name ?? '').slice(0, 1000) || '(Không có tên)',
          output_result: text(item.output_result)?.slice(0, 500) ?? null,
          axis_code: axisOf(item.axis_code),
          task_type: config.task_types[0]!.code,
          difficulty_code: this.difficulty(config, numberOf(item.difficulty_weight, 1)).code,
          expected_evidence: text(item.expected_evidence)?.slice(0, 500) ?? null,
          status: item.status === 'Hoạt động' || item.status === null ? 'active' : 'inactive',
          legacy_id: legacyId,
          created_by: origin.actorUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      catalog.set(legacyId, created.id);
      result.catalog_items += 1;
    }

    // Việc của từng người
    const touched = new Set<string>();
    for (const task of data.assigned_tasks ?? []) {
      const period = periods.get(String(task.period_id));
      const person = people.get(String(task.user_id));
      if (!period || !person) {
        result.skipped_tasks += 1;
        continue;
      }
      const legacyId = String(task.id);
      const existing = await database
        .selectFrom('kpi_tasks')
        .select('id')
        .where('legacy_id', '=', legacyId)
        .executeTakeFirst();
      if (existing) {
        continue;
      }
      const graded = task.status === 'approved';
      const status: KpiTaskStatus = graded ? 'graded' : task.status === 'rejected' ? 'rejected' : 'in_progress';
      const difficulty = this.difficulty(config, numberOf(task.difficulty_weight, 1));
      const deadline = dateOf(task.deadline) ?? dateOf(task.created_at) ?? this.support.today();
      const quality = numberOf(task.quality_pct, 0) * 100;
      const qualityCode = [...config.quality_levels].sort(
        (left, right) => Math.abs(left.percent - quality) - Math.abs(right.percent - quality),
      )[0]?.code;
      await database
        .insertInto('kpi_tasks')
        .values({
          period_id: period.id,
          staff_id: person.id,
          org_unit_id: person.org_unit_id,
          catalog_item_id: catalog.get(String(task.standard_task_id)) ?? null,
          name: String(task.task_name ?? '').slice(0, 1000) || '(Không có tên)',
          output_result: text(task.output_result)?.slice(0, 500) ?? null,
          axis_code: axisOf(task.axis_code),
          task_type: config.task_types[0]!.code,
          standard_score: config.task_types[0]!.standard_score,
          difficulty_code: difficulty.code,
          difficulty_weight: difficulty.weight,
          origin: 'legacy',
          in_plan: task.origin !== 'arising',
          status,
          deadline,
          original_deadline: dateOf(task.original_deadline) ?? deadline,
          assigned_by_name: 'Hệ thống KPI cũ',
          actual_finish_date: dateOf(task.actual_finish_date),
          evidence_text: text(task.evidence_text)?.slice(0, 2000) ?? null,
          document_number: text(task.document_number)?.slice(0, 200) ?? null,
          ...(graded
            ? {
                progress_percent: round2(numberOf(task.progress_pct, 0) * 100),
                quality_code: qualityCode ?? null,
                task_percent: round2(
                  (numberOf(task.progress_pct, 0) * 100 * config.weights.progress + quality * config.weights.quality) /
                    (config.weights.progress + config.weights.quality || 1),
                ),
                execution_score: numberOf(task.execution_score),
                converted_score: numberOf(task.converted_score),
                bonus_score: numberOf(task.bonus_score),
                bonus_approved: numberOf(task.bonus_score) > 0,
                graded_at: this.support.clock.now(),
                graded_by_name: 'Hệ thống KPI cũ',
              }
            : {}),
          grader_comment: text(task.cbql_comment)?.slice(0, 1000) ?? null,
          legacy_id: legacyId,
          created_by: origin.actorUserId,
        })
        .execute();
      touched.add(`${period.id}:${person.id}`);
      result.tasks += 1;
    }

    // Kết quả đánh giá: tiêu chí chung đánh dấu đảm bảo lần lượt đến đúng số điểm phần tiêu chí chung của hệ thống cũ
    const rankOf = (label: string | number | null | undefined) =>
      config.ranks.find((rank) => normalize(rank.label) === normalize(label))?.code ?? null;
    for (const evaluation of data.evaluations ?? []) {
      const period = periods.get(String(evaluation.period_id));
      const person = people.get(String(evaluation.user_id));
      if (!period || !person) {
        continue;
      }
      const existing = await database
        .selectFrom('kpi_evaluations')
        .select('id')
        .where('period_id', '=', period.id)
        .where('staff_id', '=', person.id)
        .executeTakeFirst();
      if (existing) {
        continue;
      }
      const group =
        (data.users ?? []).find((user) => String(user.id) === String(evaluation.user_id))?.role === 'cbql'
          ? 'leader'
          : 'staff';
      const created = await database
        .insertInto('kpi_evaluations')
        .values({
          period_id: period.id,
          staff_id: person.id,
          org_unit_id: person.org_unit_id,
          rule_set_version_id: ruleSet.version_id,
          subject_group: group,
          status: evaluation.superior_rank ? 'concluded' : evaluation.status === 'submitted' ? 'submitted' : 'draft',
          self_rank: rankOf(evaluation.rank_proposed),
          superior_rank: rankOf(evaluation.superior_rank),
          superior_comment: text(evaluation.superior_comment)?.slice(0, 2000) ?? null,
          advisory_rank: rankOf(evaluation.advisory_rank),
          advisory_comment: text(evaluation.advisory_comment)?.slice(0, 2000) ?? null,
          final_rank: period.locked ? (rankOf(evaluation.superior_rank) ?? rankOf(evaluation.rank_proposed)) : null,
          legacy_id: String(evaluation.id),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      let remaining = numberOf(evaluation.part1_score);
      const items = criteriaFor(config, group);
      if (items.length > 0) {
        await database
          .insertInto('kpi_evaluation_criteria')
          .values(
            items.map((item) => {
              const satisfied = remaining >= item.max_score;
              remaining -= satisfied ? item.max_score : 0;
              return {
                evaluation_id: created.id,
                criterion_code: item.code,
                max_score: item.max_score,
                self_satisfied: satisfied,
                note: 'Chuyển từ hệ thống KPI cũ',
              };
            }),
          )
          .execute();
      }
      touched.add(`${period.id}:${person.id}`);
      result.evaluations += 1;
    }
    for (const key of touched) {
      const [periodId, staffId] = key.split(':') as [string, string];
      await this.support.recompute(database, periodId, staffId);
    }
    // Kỳ đã chốt ở hệ thống cũ thì khóa sau khi chuyển xong
    for (const period of periods.values()) {
      if (period.locked) {
        await database
          .updateTable('kpi_periods')
          .set({
            status: 'locked',
            locked_at: this.support.clock.now(),
            locked_by_name: 'Hệ thống KPI cũ',
            lock_note: 'Kỳ đã chốt ở hệ thống KPI cũ',
          })
          .where('id', '=', period.id)
          .where('status', '=', 'open')
          .execute();
      }
    }
    return result;
  }

  private difficulty(config: KpiRuleConfig, weight: number) {
    return [...config.difficulty_levels].sort(
      (left, right) => Math.abs(left.weight - weight) - Math.abs(right.weight - weight),
    )[0]!;
  }
}

class PreviewRollback extends Error {
  constructor(readonly result: LegacyImportResult) {
    super('Xem trước, không ghi');
  }
}

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

@Controller('kpi/legacy-import')
export class KpiLegacyImportController {
  constructor(private readonly legacy: KpiLegacyImportService) {}

  @Post()
  @HttpCode(200)
  @RequirePermission(KPI_PERMISSIONS.configure)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_BACKUP_BYTES, files: 1 } }))
  run(
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!file || file.size === 0) {
      throw validationError([{ field: 'file', message: 'Bắt buộc chọn tệp sao lưu của hệ thống KPI cũ' }]);
    }
    return this.legacy.run(currentUser, file.buffer, body?.preview !== 'false', originOf(request, currentUser));
  }
}
