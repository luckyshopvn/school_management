import { requestJson } from '../../session/api-client.js';
import type { GameQuestion, GameQuestionType } from './game-logic.ts';

// Gọi máy chủ cho trò chơi kiến thức và thẻ đáp án giấy (DT-23 phần 23c, YCTD-213); giao diện không chứa quy tắc nghiệp vụ (QU-09)
const BASE = '/api/v1/classroom-games';

export type GameKind = 'crossword' | 'wheel' | 'quiz_rounds' | 'answer_cards';

export interface GameCatalog {
  class_id: string;
  class_name: string;
  grade_level: string;
  subjects: Array<{
    id: string;
    name: string;
    counts: Partial<Record<GameQuestionType, number>>;
    topics: Array<{ id: string; name: string; count: number }>;
  }>;
}

export interface GameAnswer {
  question_id: string;
  child_id: string | null;
  group_name: string | null;
  answer: string | null;
  correct: boolean | null;
}

export interface GameSessionPayload {
  client_id: string;
  class_id: string;
  kind: GameKind;
  title: string;
  started_at: string;
  finished_at: string;
  config: Record<string, unknown>;
  group_scores: Record<string, number>;
  question_ids: string[];
  answers: GameAnswer[];
}

export interface GameSessionSummary {
  id: string;
  kind: GameKind;
  title: string;
  question_count: number;
  group_scores: Record<string, number>;
  finished_at: string;
  recorded_by_name: string;
}

export const fetchCatalog = (classId: string) => requestJson<GameCatalog>(`${BASE}/classes/${classId}/catalog`);

export function fetchQuestions(
  classId: string,
  filter: { subjectId: string; topicId?: string; cognitiveLevel?: string; types: GameQuestionType[]; limit: number },
) {
  const query = new URLSearchParams({
    subject_id: filter.subjectId,
    types: filter.types.join(','),
    limit: String(filter.limit),
  });
  if (filter.topicId) query.set('topic_id', filter.topicId);
  if (filter.cognitiveLevel) query.set('cognitive_level', filter.cognitiveLevel);
  return requestJson<{ items: GameQuestion[] }>(`${BASE}/classes/${classId}/questions?${query.toString()}`);
}

export const saveGameSession = (payload: GameSessionPayload) =>
  requestJson<{ id: string; duplicate: boolean }>(`${BASE}/sessions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const fetchGameSessions = (classId: string) =>
  requestJson<{ items: GameSessionSummary[] }>(`${BASE}/classes/${classId}/sessions`);
