import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import { messageOf, NO_LEVEL_MESSAGE, ScopeFilters, useExamScope } from './exam-filters.js';
import {
  COGNITIVE_LABELS,
  createTopic,
  downloadFile,
  importQuestions,
  listQuestions,
  listTopics,
  questionAction,
  questionStats,
  QUESTION_STATUS_LABELS,
  QUESTION_TYPE_LABELS,
  saveQuestion,
  type CognitiveLevel,
  type Question,
  type QuestionType,
} from './exams-api.js';

// 8.1 Ngân hàng câu hỏi (DT-21 phần 22g1, YCTD-168): chọn môn, khối; chủ đề; danh sách câu (lọc chủ đề, mức, dạng, trạng
// thái, tìm chữ); soạn, sửa câu theo dạng (nhiều lựa chọn, đúng sai, trả lời ngắn, tự luận); gửi thẩm định, duyệt, trả lại,
// ngừng dùng; nhập Excel theo mẫu; thống kê số câu dùng được theo chủ đề, mức
interface Draft {
  id: string | null;
  topic_id: string;
  cognitive_level: CognitiveLevel;
  question_type: QuestionType;
  content: string;
  options: string[];
  answer: string;
  guidance: string;
  score: string;
}

const EMPTY: Draft = {
  id: null,
  topic_id: '',
  cognitive_level: 'recognition',
  question_type: 'multiple_choice',
  content: '',
  options: ['', '', '', ''],
  answer: '',
  guidance: '',
  score: '1',
};

const draftOf = (question: Question): Draft => ({
  id: question.id,
  topic_id: question.topic_id ?? '',
  cognitive_level: question.cognitive_level,
  question_type: question.question_type,
  content: question.content,
  options: question.options.length > 0 ? question.options.map((option) => option.content) : ['', '', '', ''],
  answer: question.answer.join(', '),
  guidance: question.guidance ?? '',
  score: String(Number(question.score)),
});

export function QuestionBankPage() {
  const scope = useExamScope();
  const reviewer = useHasPermission(PERMISSION_CODES.examReview);
  const manager = useHasPermission(PERMISSION_CODES.examManage);
  const canReview = reviewer || manager;
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const [filter, setFilter] = useState({
    topic_id: '',
    cognitive_level: '',
    question_type: '',
    status: '',
    search: '',
  });
  const ready = Boolean(scope.subjectId && scope.grade);
  const topics = useQuery({
    queryKey: ['question-topics', scope.subjectId],
    queryFn: () => listTopics(scope.subjectId),
    enabled: Boolean(scope.subjectId),
  });
  const questions = useQuery({
    queryKey: ['questions', scope.subjectId, scope.grade, filter],
    queryFn: () => listQuestions({ subject_id: scope.subjectId, grade_level_code: scope.grade, ...filter }),
    enabled: ready,
  });
  const stats = useQuery({
    queryKey: ['question-stats', scope.subjectId, scope.grade],
    queryFn: () => questionStats(scope.subjectId, scope.grade),
    enabled: ready,
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['questions'] });
    await queryClient.invalidateQueries({ queryKey: ['question-stats'] });
    setToastMessage(message);
  };
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [topicName, setTopicName] = useState('');
  const addTopic = useMutation({
    mutationFn: () =>
      createTopic({ subject_id: scope.subjectId, grade_level_code: scope.grade || null, name: topicName }),
    onSuccess: async () => {
      setTopicName('');
      await queryClient.invalidateQueries({ queryKey: ['question-topics'] });
      setToastMessage('Đã thêm chủ đề');
    },
  });
  const save = useMutation({
    mutationFn: () => {
      const choice = draft.question_type === 'multiple_choice' || draft.question_type === 'true_false';
      return saveQuestion(draft.id, {
        school_level: scope.level,
        subject_id: scope.subjectId,
        grade_level_code: scope.grade,
        topic_id: draft.topic_id || null,
        cognitive_level: draft.cognitive_level,
        question_type: draft.question_type,
        content: draft.content,
        options: choice ? draft.options.map((option) => option.trim()).filter(Boolean) : [],
        answer:
          draft.question_type === 'essay'
            ? []
            : draft.answer
                .split(',')
                .map((part) => part.trim())
                .filter(Boolean),
        guidance: draft.guidance || null,
        score: Number(draft.score.replace(',', '.')),
      });
    },
    onSuccess: async () => {
      setDraft(EMPTY);
      await refresh('Đã lưu câu hỏi');
    },
  });
  const act = useMutation({
    mutationFn: (input: { id: string; action: 'submit' | 'review' | 'retire'; body?: unknown; message: string }) =>
      questionAction(input.id, input.action, input.body),
    onSuccess: async (_data, input) => refresh(input.message),
  });
  const [file, setFile] = useState<File>();
  const upload = useMutation({
    mutationFn: () => importQuestions(scope.level ?? 'THCS', file as File),
    onSuccess: async (result) => {
      if (result.errors.length === 0) await refresh(`Đã nhập ${result.imported} câu hỏi`);
    },
  });
  const choice = draft.question_type === 'multiple_choice' || draft.question_type === 'true_false';

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/question-bank')}</h1>
        {!scope.level ? (
          <Alert tone="info">{NO_LEVEL_MESSAGE}</Alert>
        ) : (
          <>
            <ScopeFilters scope={scope} />
            {act.error ? <Alert tone="danger">{messageOf(act.error)}</Alert> : null}
            {ready ? (
              <>
                <section className="flex flex-col gap-2" aria-label="Chủ đề">
                  <h2 className="text-section-title font-semibold text-text">Chủ đề</h2>
                  <p className="text-content text-text">
                    {(topics.data ?? []).map((topic) => topic.name).join('; ') || 'Chưa có chủ đề.'}
                  </p>
                  {canReview ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="text-label font-medium text-text">
                        Tên chủ đề
                        <input
                          aria-label="Tên chủ đề"
                          className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                          value={topicName}
                          onChange={(event) => setTopicName(event.target.value)}
                        />
                      </label>
                      <Button disabled={!topicName.trim() || addTopic.isPending} onClick={() => addTopic.mutate()}>
                        Thêm chủ đề
                      </Button>
                    </div>
                  ) : null}
                </section>
                <section className="flex flex-col gap-3" aria-label="Soạn câu hỏi">
                  <h2 className="text-section-title font-semibold text-text">
                    {draft.id ? 'Sửa câu hỏi' : 'Soạn câu hỏi'}
                  </h2>
                  {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="text-label font-medium text-text">
                      Chủ đề
                      <select
                        aria-label="Chủ đề của câu"
                        className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                        value={draft.topic_id}
                        onChange={(event) => setDraft({ ...draft, topic_id: event.target.value })}
                      >
                        <option value="">Chưa phân chủ đề</option>
                        {(topics.data ?? []).map((topic) => (
                          <option key={topic.id} value={topic.id}>
                            {topic.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-label font-medium text-text">
                      Mức nhận thức
                      <select
                        aria-label="Mức nhận thức"
                        className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                        value={draft.cognitive_level}
                        onChange={(event) =>
                          setDraft({ ...draft, cognitive_level: event.target.value as CognitiveLevel })
                        }
                      >
                        {Object.entries(COGNITIVE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-label font-medium text-text">
                      Dạng câu hỏi
                      <select
                        aria-label="Dạng câu hỏi"
                        className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                        value={draft.question_type}
                        onChange={(event) => setDraft({ ...draft, question_type: event.target.value as QuestionType })}
                      >
                        {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-label font-medium text-text">
                      Điểm
                      <input
                        aria-label="Điểm của câu"
                        className={`mt-2 block w-24 ${FORM_CONTROL_CLASS}`}
                        value={draft.score}
                        onChange={(event) => setDraft({ ...draft, score: event.target.value })}
                      />
                    </label>
                  </div>
                  <label className="text-label font-medium text-text">
                    Nội dung (công thức ghi dạng chữ)
                    <textarea
                      aria-label="Nội dung câu hỏi"
                      className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
                      rows={3}
                      value={draft.content}
                      onChange={(event) => setDraft({ ...draft, content: event.target.value })}
                    />
                  </label>
                  {choice ? (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {draft.options.map((option, index) => {
                        const key = draft.question_type === 'multiple_choice' ? 'ABCD'[index] : 'abcd'[index];
                        return (
                          <label key={index} className="text-label font-medium text-text">
                            {draft.question_type === 'multiple_choice' ? `Lựa chọn ${key}` : `Ý ${key}`}
                            <input
                              aria-label={draft.question_type === 'multiple_choice' ? `Lựa chọn ${key}` : `Ý ${key}`}
                              className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
                              value={option}
                              onChange={(event) =>
                                setDraft({
                                  ...draft,
                                  options: draft.options.map((item, position) =>
                                    position === index ? event.target.value : item,
                                  ),
                                })
                              }
                            />
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                  {draft.question_type !== 'essay' ? (
                    <label className="text-label font-medium text-text">
                      {draft.question_type === 'multiple_choice'
                        ? 'Đáp án (khoá đúng, ví dụ B)'
                        : draft.question_type === 'true_false'
                          ? 'Đáp án (Đ hoặc S từng ý, ví dụ Đ, S, S, Đ)'
                          : 'Đáp án (đáp số chấp nhận, cách nhau dấu phẩy)'}
                      <input
                        aria-label="Đáp án"
                        className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                        value={draft.answer}
                        onChange={(event) => setDraft({ ...draft, answer: event.target.value })}
                      />
                    </label>
                  ) : null}
                  <label className="text-label font-medium text-text">
                    Hướng dẫn chấm{draft.question_type === 'essay' ? ' (bắt buộc với tự luận)' : ''}
                    <textarea
                      aria-label="Hướng dẫn chấm"
                      className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
                      rows={2}
                      value={draft.guidance}
                      onChange={(event) => setDraft({ ...draft, guidance: event.target.value })}
                    />
                  </label>
                  <div className="flex gap-2">
                    <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
                      Lưu câu hỏi
                    </Button>
                    {draft.id ? <Button onClick={() => setDraft(EMPTY)}>Soạn câu mới</Button> : null}
                  </div>
                </section>
                <section className="flex flex-col gap-3" aria-label="Danh sách câu hỏi">
                  <h2 className="text-section-title font-semibold text-text">Câu hỏi</h2>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="text-label font-medium text-text">
                      Trạng thái
                      <select
                        aria-label="Lọc trạng thái"
                        className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                        value={filter.status}
                        onChange={(event) => setFilter({ ...filter, status: event.target.value })}
                      >
                        <option value="">Tất cả</option>
                        {Object.entries(QUESTION_STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-label font-medium text-text">
                      Tìm
                      <input
                        aria-label="Tìm câu hỏi"
                        className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                        value={filter.search}
                        onChange={(event) => setFilter({ ...filter, search: event.target.value })}
                      />
                    </label>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-content" aria-label="Câu hỏi">
                      <thead className="text-left text-label font-medium text-text-secondary">
                        <tr>
                          <th className="px-3 py-2">Nội dung</th>
                          <th className="px-3 py-2">Chủ đề</th>
                          <th className="px-3 py-2">Mức</th>
                          <th className="px-3 py-2">Dạng</th>
                          <th className="px-3 py-2">Trạng thái</th>
                          <th className="px-3 py-2">Người soạn</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {(questions.data ?? []).map((question) => (
                          <tr key={question.id} className="border-t border-border align-top">
                            <td className="px-3 py-2">
                              {question.content}
                              {question.review_note ? (
                                <span className="block text-label text-danger">Thẩm định: {question.review_note}</span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2">{question.topic_name ?? ''}</td>
                            <td className="px-3 py-2">{COGNITIVE_LABELS[question.cognitive_level]}</td>
                            <td className="px-3 py-2">{QUESTION_TYPE_LABELS[question.question_type]}</td>
                            <td className="px-3 py-2">
                              <StatusBadge
                                tone={question.status === 'approved' ? 'success' : 'neutral'}
                                label={QUESTION_STATUS_LABELS[question.status] ?? question.status}
                              />
                            </td>
                            <td className="px-3 py-2">{question.author_name}</td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex flex-wrap justify-end gap-1">
                                <Button variant="text" onClick={() => setDraft(draftOf(question))}>
                                  Sửa
                                </Button>
                                {question.status === 'draft' ? (
                                  <Button
                                    variant="text"
                                    onClick={() =>
                                      act.mutate({ id: question.id, action: 'submit', message: 'Đã gửi thẩm định' })
                                    }
                                  >
                                    Gửi thẩm định
                                  </Button>
                                ) : null}
                                {canReview && question.status === 'review' ? (
                                  <>
                                    <Button
                                      variant="text"
                                      onClick={() =>
                                        act.mutate({
                                          id: question.id,
                                          action: 'review',
                                          body: { decision: 'approve' },
                                          message: 'Đã duyệt câu hỏi',
                                        })
                                      }
                                    >
                                      Duyệt
                                    </Button>
                                    <Button
                                      variant="text"
                                      onClick={() => {
                                        const note = window.prompt('Lý do trả lại');
                                        if (note) {
                                          act.mutate({
                                            id: question.id,
                                            action: 'review',
                                            body: { decision: 'return', note },
                                            message: 'Đã trả lại câu hỏi',
                                          });
                                        }
                                      }}
                                    >
                                      Trả lại
                                    </Button>
                                  </>
                                ) : null}
                                {canReview && question.status !== 'retired' ? (
                                  <Button
                                    variant="text"
                                    onClick={() =>
                                      act.mutate({
                                        id: question.id,
                                        action: 'retire',
                                        message: 'Đã ngừng dùng câu hỏi',
                                      })
                                    }
                                  >
                                    Ngừng dùng
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {questions.data && questions.data.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-3 py-2 text-text-secondary">
                              Chưa có câu hỏi.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="flex flex-col gap-2" aria-label="Thống kê câu dùng được">
                  <h2 className="text-section-title font-semibold text-text">Thống kê câu dùng được</h2>
                  <ul className="text-content">
                    {(stats.data ?? []).map((row, index) => (
                      <li key={index}>
                        {row.topic_name ?? 'Chưa phân chủ đề'} · {COGNITIVE_LABELS[row.cognitive_level]} ·{' '}
                        {QUESTION_TYPE_LABELS[row.question_type]}: {row.count} câu
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="flex flex-col gap-2" aria-label="Nhập câu hỏi từ Excel">
                  <h2 className="text-section-title font-semibold text-text">Nhập câu hỏi từ Excel</h2>
                  {upload.error ? <Alert tone="danger">{messageOf(upload.error)}</Alert> : null}
                  {upload.data && upload.data.errors.length > 0 ? (
                    <Alert tone="danger">
                      Tệp có {upload.data.errors.length} lỗi, chưa nhập:{' '}
                      {upload.data.errors
                        .slice(0, 10)
                        .map(
                          (error) => `dòng ${error.row}${error.column ? ` (${error.column})` : ''}: ${error.message}`,
                        )
                        .join('; ')}
                    </Alert>
                  ) : null}
                  <div className="flex flex-wrap items-end gap-2">
                    <Button
                      onClick={() =>
                        void downloadFile(
                          `/api/v1/questions/import-template?school_level=${scope.level}`,
                          'mau-cau-hoi.xlsx',
                        )
                      }
                    >
                      Tải mẫu Excel
                    </Button>
                    <input
                      type="file"
                      accept=".xlsx"
                      aria-label="Tệp câu hỏi"
                      className="text-label"
                      onChange={(event) => setFile(event.target.files?.[0])}
                    />
                    <Button disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
                      Nhập Excel
                    </Button>
                  </div>
                </section>
              </>
            ) : (
              <Alert tone="info">Chọn môn và khối để xem ngân hàng câu hỏi.</Alert>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
