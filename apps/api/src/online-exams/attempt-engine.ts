import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { Clock } from '@school-management/server';
import { ANSWER_SAVE_GRACE_SECONDS, type ExamSubmitReason } from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import {
  gradeSheet,
  type GradedQuestion,
  type QuestionResult,
  type TrueFalseRule,
} from '../exam-grading/grading-rules.js';
import type { QuestionType, VariantItem } from '../exams/exam-rules.js';
import type { QuestionSnapshot } from '../exams/exams.js';
import { answersForGrading, countedAttempt, type AttemptScore } from './online-exam-rules.js';

// Lõi chấm và chốt lượt làm bài trực tuyến (DT-23 phần 23a, YCTD-211), dùng chung cho phía học sinh và phía giáo viên:
// - chấm lượt bằng hàm chấm của 22g2 (một cách chấm duy nhất): trắc nghiệm, đúng sai, trả lời ngắn tự chấm; câu tự luận chờ giáo
//   viên nhập điểm (`essay_marks`), chưa đủ điểm thì điểm tổng để trống;
// - chốt lượt khi học sinh nộp, hết giờ, quá số lần rời bài, hoặc giáo viên nộp thay; lượt quá hạn không ai mở được chốt khi học
//   sinh mở lại hoặc giáo viên mở màn hình theo dõi (chưa có việc nền riêng);
// - đưa lượt được tính vào phiếu chấm của 22g2 (THCS, THPT): tạo bài kiểm tra của lớp nếu lớp chưa có, ghi phiếu nguồn `online`;
//   phiếu đã khoá điểm, hoặc giáo viên đã sửa tay (nguồn khác `online`) thì không ghi đè; điểm vào sổ điểm chỉ qua luồng 22g2
//   (khoá điểm rồi giáo viên xác nhận chuyển), không ghi thẳng
export type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export interface ExamContent {
  questions: GradedQuestion[];
  snapshots: Map<string, QuestionSnapshot>;
  variants: Array<{ code: string; items: VariantItem[] }>;
}

export interface VariantTypes {
  byNumber: Record<number, QuestionType>;
  trueFalseCounts: Record<number, number>;
  byId: Record<string, QuestionType>;
}

export interface AttemptGrade {
  objective: number;
  essay: number;
  total: number | null;
  max: number;
  results: QuestionResult[];
  needsMarking: boolean;
}

export function variantTypes(variant: { items: VariantItem[] }, content: ExamContent): VariantTypes {
  const byNumber: Record<number, QuestionType> = {};
  const trueFalseCounts: Record<number, number> = {};
  const byId: Record<string, QuestionType> = {};
  for (const item of variant.items) {
    const snapshot = content.snapshots.get(item.question_id);
    if (!snapshot) {
      continue;
    }
    byNumber[item.number] = snapshot.question_type;
    byId[item.question_id] = snapshot.question_type;
    if (snapshot.question_type === 'true_false') {
      trueFalseCounts[item.number] = snapshot.options.length;
    }
  }
  return { byNumber, trueFalseCounts, byId };
}

export function gradeAttempt(
  content: ExamContent,
  variantCode: string,
  answers: Record<string, string[]>,
  essayMarks: Record<string, number>,
  rule: TrueFalseRule,
): AttemptGrade {
  const variant = content.variants.find((row) => row.code === variantCode);
  const max = Math.round(content.questions.reduce((sum, question) => sum + question.score, 0) * 100) / 100;
  if (!variant) {
    return { objective: 0, essay: 0, total: null, max, results: [], needsMarking: false };
  }
  const types = variantTypes(variant, content);
  const graded = gradeSheet(
    variant.items,
    content.questions,
    {
      answers: answersForGrading(answers, types.byNumber),
      essay: Object.fromEntries(Object.entries(essayMarks).map(([id, mark]) => [id, { first: mark, second: null }])),
    },
    { rule, doubleMarking: false, tolerance: 1 },
  );
  return {
    objective: graded.objective,
    essay: graded.essay,
    total: graded.missing_essay > 0 ? null : graded.total,
    max,
    results: graded.results,
    needsMarking: graded.missing_essay > 0,
  };
}

@Injectable()
export class AttemptEngine {
  constructor(private readonly clock: Clock) {}

  async loadContent(database: Executor, examId: string): Promise<ExamContent> {
    const [rows, variants] = await Promise.all([
      database
        .selectFrom('exam_questions')
        .select(['question_id', 'order_no', 'score', 'snapshot'])
        .where('exam_id', '=', examId)
        .orderBy('order_no')
        .execute(),
      database
        .selectFrom('exam_variants')
        .select(['code', 'items'])
        .where('exam_id', '=', examId)
        .orderBy('code')
        .execute(),
    ]);
    const snapshots = new Map(rows.map((row) => [row.question_id, row.snapshot as QuestionSnapshot]));
    const questions: GradedQuestion[] = rows.map((row) => {
      const snapshot = row.snapshot as QuestionSnapshot;
      return {
        question_id: row.question_id,
        question_type: snapshot.question_type,
        cognitive_level: snapshot.cognitive_level,
        topic_name: snapshot.topic_name,
        score: Number(row.score),
      };
    });
    return { questions, snapshots, variants: variants as Array<{ code: string; items: VariantItem[] }> };
  }

  // Chốt các lượt quá hạn (cộng thời gian chờ mạng) của một bài giao hoặc một học sinh
  async finalizeExpired(
    database: Kysely<SchoolYearDatabase>,
    scope: { assignmentId?: string; childId?: string } = {},
  ): Promise<number> {
    const now = this.clock.now();
    let query = database
      .selectFrom('exam_attempts')
      .select(['id', 'deadline_at'])
      .where('status', '=', 'in_progress')
      .where('deadline_at', '<', new Date(now.getTime() - ANSWER_SAVE_GRACE_SECONDS * 1000));
    if (scope.assignmentId) {
      query = query.where('assignment_id', '=', scope.assignmentId);
    }
    if (scope.childId) {
      query = query.where('child_id', '=', scope.childId);
    }
    const rows = await query.execute();
    for (const row of rows) {
      await this.finalize(database, row.id, 'timeout', row.deadline_at);
    }
    return rows.length;
  }

  // Chốt một lượt: chấm, ghi điểm, đóng lượt, đưa vào phiếu chấm. Gọi lại với lượt đã nộp thì không làm gì
  async finalize(
    database: Kysely<SchoolYearDatabase>,
    attemptId: string,
    reason: ExamSubmitReason,
    submittedAt: Date = this.clock.now(),
  ): Promise<boolean> {
    const closed = await database.transaction().execute(async (transaction) => {
      const attempt = await transaction
        .selectFrom('exam_attempts')
        .selectAll()
        .where('id', '=', attemptId)
        .forUpdate()
        .executeTakeFirst();
      if (!attempt || attempt.status === 'submitted') {
        return false;
      }
      const assignment = await transaction
        .selectFrom('exam_assignments')
        .select(['exam_id', 'true_false_rule'])
        .where('id', '=', attempt.assignment_id)
        .executeTakeFirstOrThrow();
      const content = await this.loadContent(transaction, assignment.exam_id);
      const grade = gradeAttempt(
        content,
        attempt.variant_code,
        attempt.answers as Record<string, string[]>,
        attempt.essay_marks as Record<string, number>,
        assignment.true_false_rule,
      );
      await transaction
        .updateTable('exam_attempts')
        .set({
          status: 'submitted',
          submitted_at: submittedAt,
          submit_reason: reason,
          objective_score: grade.objective,
          essay_score: grade.needsMarking ? null : grade.essay,
          total_score: grade.total,
          max_score: grade.max,
          results: JSON.stringify(grade.results),
          needs_marking: grade.needsMarking,
          updated_at: this.clock.now(),
        })
        .where('id', '=', attemptId)
        .execute();
      return true;
    });
    if (closed) {
      await this.syncSheet(database, attemptId);
    }
    return closed;
  }

  // Chấm lại lượt đã nộp sau khi giáo viên nhập điểm tự luận
  async regrade(database: Kysely<SchoolYearDatabase>, attemptId: string): Promise<void> {
    await database.transaction().execute(async (transaction) => {
      const attempt = await transaction
        .selectFrom('exam_attempts')
        .selectAll()
        .where('id', '=', attemptId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const assignment = await transaction
        .selectFrom('exam_assignments')
        .select(['exam_id', 'true_false_rule'])
        .where('id', '=', attempt.assignment_id)
        .executeTakeFirstOrThrow();
      const content = await this.loadContent(transaction, assignment.exam_id);
      const grade = gradeAttempt(
        content,
        attempt.variant_code,
        attempt.answers as Record<string, string[]>,
        attempt.essay_marks as Record<string, number>,
        assignment.true_false_rule,
      );
      await transaction
        .updateTable('exam_attempts')
        .set({
          objective_score: grade.objective,
          essay_score: grade.needsMarking ? null : grade.essay,
          total_score: grade.total,
          max_score: grade.max,
          results: JSON.stringify(grade.results),
          needs_marking: grade.needsMarking,
          updated_at: this.clock.now(),
        })
        .where('id', '=', attemptId)
        .execute();
    });
    await this.syncSheet(database, attemptId);
  }

  // Đưa lượt được tính của học sinh vào phiếu chấm của bài kiểm tra lớp (22g2); chỉ THCS, THPT có sổ điểm theo luồng 22g2
  async syncSheet(database: Kysely<SchoolYearDatabase>, attemptId: string): Promise<void> {
    const attempt = await database
      .selectFrom('exam_attempts')
      .selectAll()
      .where('id', '=', attemptId)
      .executeTakeFirst();
    if (!attempt || attempt.status !== 'submitted') {
      return;
    }
    const assignment = await database
      .selectFrom('exam_assignments')
      .innerJoin('exams', 'exams.id', 'exam_assignments.exam_id')
      .select([
        'exam_assignments.id',
        'exam_assignments.exam_id',
        'exam_assignments.attempt_policy',
        'exam_assignments.term_type',
        'exam_assignments.score_kind',
        'exam_assignments.score_seq',
        'exam_assignments.true_false_rule',
        'exam_assignments.absent_policy',
        'exam_assignments.created_by',
        'exam_assignments.created_by_name',
        'exams.school_level',
        'exams.grade_level_code',
        'exams.subject_id',
      ])
      .where('exam_assignments.id', '=', attempt.assignment_id)
      .executeTakeFirstOrThrow();
    if (assignment.school_level !== 'THCS' && assignment.school_level !== 'THPT') {
      return;
    }
    const enrollment = await database
      .selectFrom('class_enrollments')
      .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select(['classes.id as class_id', 'classes.school_level', 'classes.grade_level'])
      .where('class_enrollments.child_id', '=', attempt.child_id)
      .where('class_enrollments.is_current', '=', true)
      .executeTakeFirst();
    if (
      !enrollment ||
      enrollment.school_level !== assignment.school_level ||
      enrollment.grade_level !== assignment.grade_level_code
    ) {
      return;
    }
    const attempts = await database
      .selectFrom('exam_attempts')
      .select(['id', 'status', 'submitted_at', 'total_score', 'objective_score'])
      .where('assignment_id', '=', attempt.assignment_id)
      .where('child_id', '=', attempt.child_id)
      .execute();
    const scores: AttemptScore[] = attempts.map((row) => ({
      id: row.id,
      status: row.status,
      submitted_at: row.submitted_at,
      total: row.total_score === null ? null : Number(row.total_score),
      objective: row.objective_score === null ? null : Number(row.objective_score),
    }));
    if (countedAttempt(scores, assignment.attempt_policy)?.id !== attempt.id) {
      return;
    }
    const content = await this.loadContent(database, assignment.exam_id);
    const variant = content.variants.find((row) => row.code === attempt.variant_code);
    const types = variant ? variantTypes(variant, content) : null;
    // Phiếu của 22g2 chỉ giữ câu trả lời trắc nghiệm; bài tự luận của học sinh nằm ở lượt làm
    const objectiveAnswers = Object.fromEntries(
      Object.entries(attempt.answers as Record<string, string[]>).filter(
        ([number]) => types?.byNumber[Number(number)] !== 'essay',
      ),
    );
    const essayMarks = attempt.essay_marks as Record<string, number>;
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .insertInto('exam_sessions')
        .values({
          exam_id: assignment.exam_id,
          class_id: enrollment.class_id,
          subject_id: assignment.subject_id,
          term_type: assignment.term_type,
          score_kind: assignment.score_kind,
          score_seq: assignment.score_kind === 'regular' ? assignment.score_seq : 1,
          true_false_rule: assignment.true_false_rule,
          absent_policy: assignment.absent_policy,
          created_by: assignment.created_by,
          created_by_name: assignment.created_by_name,
        })
        .onConflict((conflict) => conflict.columns(['exam_id', 'class_id']).doNothing())
        .execute();
      const session = await transaction
        .selectFrom('exam_sessions')
        .select(['id', 'status'])
        .where('exam_id', '=', assignment.exam_id)
        .where('class_id', '=', enrollment.class_id)
        .executeTakeFirstOrThrow();
      const existing = await transaction
        .selectFrom('exam_sheets')
        .select(['source'])
        .where('session_id', '=', session.id)
        .where('child_id', '=', attempt.child_id)
        .executeTakeFirst();
      if (session.status !== 'grading' || (existing && existing.source !== 'online')) {
        await transaction
          .updateTable('exam_attempts')
          .set({ sheet_synced: false })
          .where('id', '=', attempt.id)
          .execute();
        return;
      }
      const values = {
        variant_code: attempt.variant_code,
        absent: false,
        answers: JSON.stringify(objectiveAnswers),
        essay: JSON.stringify(
          Object.fromEntries(Object.entries(essayMarks).map(([id, mark]) => [id, { first: mark, second: null }])),
        ),
        objective_score: attempt.objective_score === null ? null : Number(attempt.objective_score),
        essay_score: attempt.essay_score === null ? null : Number(attempt.essay_score),
        total_score: attempt.total_score === null ? null : Number(attempt.total_score),
        results: JSON.stringify(attempt.results),
        needs_review: false,
        source: 'online' as const,
        attempt_id: attempt.id,
        updated_by: null,
        updated_by_name: 'Thi trực tuyến',
        updated_at: now,
      };
      await transaction
        .insertInto('exam_sheets')
        .values({ ...values, session_id: session.id, child_id: attempt.child_id })
        .onConflict((conflict) => conflict.columns(['session_id', 'child_id']).doUpdateSet(values))
        .execute();
      await transaction.updateTable('exam_sessions').set({ updated_at: now }).where('id', '=', session.id).execute();
      await transaction.updateTable('exam_attempts').set({ sheet_synced: true }).where('id', '=', attempt.id).execute();
    });
  }
}
