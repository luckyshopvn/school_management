import type { RatingCode, ScoreConfig, SchoolLevelCode } from '@school-management/shared';
import { ApiError, requestJson } from '../session/api-client.js';

// Gọi các điểm cuối sổ điểm THCS, THPT theo Thông tư 22/2021 (DT-21 phần 21c, YCTD-170)
export type TermType = 'first_term' | 'second_term';
export type RatingTerm = TermType | 'year';

export interface ScoreSubject {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  periods_per_week: number;
  mode: 'score' | 'comment';
  is_elective: boolean;
  required_regular: number;
}

export interface ScoreOverview {
  class: { id: string; name: string; school_level: SchoolLevelCode; grade_level: string };
  access: { manage: boolean; homeroom: boolean; subject_ids: string[] };
  subjects: ScoreSubject[];
  terms: Array<{ term_type: TermType; deadline: string | null; locked: { locked_by_name: string } | null }>;
  config: ScoreConfig;
}

export interface ScoreRow {
  child_id: string;
  full_name: string;
  regular: number[];
  mid: number | null;
  final: number | null;
  average: number | null;
  result: 'pass' | 'fail' | null;
  comment: string | null;
  sources: string[];
}

export interface ScoreSheet {
  term_type: TermType;
  subject: ScoreSubject;
  locked: { locked_by_name: string } | null;
  deadline: string | null;
  can_edit: boolean;
  rows: ScoreRow[];
}

export interface ScoreEntryInput {
  child_id: string;
  regular: Array<number | null>;
  mid: number | null;
  final: number | null;
  result: 'pass' | 'fail' | null;
  comment: string | null;
}

export interface ScoreSummary {
  term_type: RatingTerm;
  locked: { locked_by_name: string } | null;
  can_rate: boolean;
  subjects: Array<{ subject_id: string; subject_code: string; subject_name: string; mode: 'score' | 'comment' }>;
  rows: Array<{
    child_id: string;
    full_name: string;
    subjects: Array<{ subject_id: string; average: number | null; passed: 'pass' | 'fail' | null }>;
    suggested: RatingCode | null;
    learning: RatingCode | null;
    conduct: RatingCode | null;
    comment: string | null;
  }>;
}

export interface ScoreLockRow {
  class_id: string;
  class_name: string;
  locked_by_name: string | null;
  locked_at: string | null;
}

const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });

export const messageOf = (error: unknown): string =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

export const readScoreOverview = (classId: string): Promise<ScoreOverview> =>
  requestJson(`/api/v1/scores/classes/${classId}`);
export const readScoreSheet = (classId: string, subjectId: string, term: TermType): Promise<ScoreSheet> =>
  requestJson(`/api/v1/scores/classes/${classId}/subjects/${subjectId}?term_type=${term}`);
export const saveScoreSheet = (
  classId: string,
  subjectId: string,
  term: TermType,
  entries: ScoreEntryInput[],
): Promise<ScoreSheet> =>
  requestJson(`/api/v1/scores/classes/${classId}/subjects/${subjectId}`, json('PUT', { term_type: term, entries }));
export const readScoreSummary = (classId: string, term: RatingTerm): Promise<ScoreSummary> =>
  requestJson(`/api/v1/scores/classes/${classId}/summary?term_type=${term}`);
export const saveScoreRatings = (
  classId: string,
  term: RatingTerm,
  entries: Array<{ child_id: string; learning: RatingCode | null; conduct: RatingCode | null; comment: string | null }>,
): Promise<ScoreSummary> =>
  requestJson(`/api/v1/scores/classes/${classId}/ratings`, json('PUT', { term_type: term, entries }));
export const readScoreLocks = (
  term: TermType,
  level: SchoolLevelCode,
): Promise<{ term_type: TermType; classes: ScoreLockRow[] }> =>
  requestJson(`/api/v1/scores/locks?term_type=${term}&school_level=${level}`);
export const lockScores = (term: TermType, level: SchoolLevelCode, classIds?: string[]) =>
  requestJson('/api/v1/scores/locks', json('POST', { term_type: term, school_level: level, class_ids: classIds }));
export const unlockScores = (term: TermType, classId: string, reason: string) =>
  requestJson('/api/v1/scores/locks/unlock', json('POST', { term_type: term, class_id: classId, reason }));
export const readScoreConfig = (
  level: SchoolLevelCode,
): Promise<{ school_level: SchoolLevelCode; config: ScoreConfig }> =>
  requestJson(`/api/v1/scores/config?school_level=${level}`);
export const saveScoreConfig = (level: SchoolLevelCode, config: ScoreConfig) =>
  requestJson('/api/v1/scores/config', json('PUT', { school_level: level, config }));
