import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import { AppShell } from '../pages/AppShell.js';
import { requestJson } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  ANSWER_TYPE_LABELS,
  AUDIENCE_LABELS,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_STATUS_LABELS,
  formatTime,
  LOST_STATUS_LABELS,
  messageOf,
  POLL_STATUS_LABELS,
  POLL_TYPE_LABELS,
  postJson,
  type AnswerType,
  type Feedback,
  type InteractionComment,
  type LostItem,
  type Message,
  type MessageThread,
  type Poll,
  type PollResults,
  type PollType,
  type SurveyTemplate,
  type TemplateQuestion,
} from './interactions-api.js';

// MH-25 Tương tác với phụ huynh (P15-01 đến P15-06, P02-11; YCTD-79): bình chọn, biểu quyết, khảo sát và kết quả; danh
// mục khảo sát; góp ý; trao đổi với phụ huynh; phiếu đồ bị mất; bình luận bị báo cần xử lý
type Tab = 'polls' | 'templates' | 'feedbacks' | 'messages' | 'lost' | 'comments';
type Notify = (message: string) => void;
const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const textareaClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const toLocalInput = (date: Date) => {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
};

export function InteractionsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.interactionManage);
  const canMessage = useHasPermission(PERMISSION_CODES.messageSend);
  const canLostItems = useHasPermission(PERMISSION_CODES.lostItemManage);
  const tabs: Array<[Tab, string, boolean]> = [
    ['polls', 'Bình chọn và khảo sát', canManage],
    ['templates', 'Danh mục khảo sát', canManage],
    ['feedbacks', 'Góp ý', canManage],
    ['messages', 'Trao đổi', canMessage],
    ['lost', 'Đồ bị mất', canLostItems],
    ['comments', 'Bình luận cần xử lý', canManage],
  ];
  const visible = tabs.filter(([, , allowed]) => allowed);
  const [chosen, setChosen] = useState<Tab>();
  const tab = chosen ?? visible[0]?.[0];
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">Tương tác với phụ huynh</h1>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tương tác">
          {visible.map(([code, label]) => (
            <Button
              key={code}
              role="tab"
              aria-selected={tab === code}
              variant={tab === code ? 'secondary' : 'text'}
              onClick={() => setChosen(code)}
            >
              {label}
            </Button>
          ))}
        </div>
        {tab === 'polls' ? <PollsTab onDone={setToastMessage} /> : null}
        {tab === 'templates' ? <TemplatesTab onDone={setToastMessage} /> : null}
        {tab === 'feedbacks' ? <FeedbacksTab onDone={setToastMessage} /> : null}
        {tab === 'messages' ? <MessagesTab onDone={setToastMessage} /> : null}
        {tab === 'lost' ? <LostItemsTab onDone={setToastMessage} /> : null}
        {tab === 'comments' ? <CommentsTab onDone={setToastMessage} /> : null}
        {visible.length === 0 ? <Alert tone="info">Bạn chưa có quyền dùng chức năng tương tác.</Alert> : null}
      </div>
    </AppShell>
  );
}

function PollsTab({ onDone }: { onDone: Notify }) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [pollType, setPollType] = useState<PollType>('poll');
  const [title, setTitle] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [classId, setClassId] = useState('');
  const [audience, setAudience] = useState<Poll['audience']>('guardians');
  const [startAt, setStartAt] = useState(() => toLocalInput(new Date()));
  const [endAt, setEndAt] = useState(() => toLocalInput(new Date(Date.now() + 7 * 86_400_000)));
  const [anonymous, setAnonymous] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [resultsOf, setResultsOf] = useState('');
  const polls = useQuery({
    queryKey: ['polls', orgUnitId],
    queryFn: () => requestJson<Poll[]>(`/api/v1/polls?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const classes = useQuery({
    queryKey: ['classes', orgUnitId],
    queryFn: () => listClasses(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId),
  });
  const templates = useQuery({
    queryKey: ['survey-templates'],
    queryFn: () => requestJson<SurveyTemplate[]>('/api/v1/survey-templates'),
  });
  const results = useQuery({
    queryKey: ['poll-results', resultsOf],
    queryFn: () => requestJson<PollResults>(`/api/v1/polls/${resultsOf}/results`),
    enabled: Boolean(resultsOf),
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['polls'] });
    await queryClient.invalidateQueries({ queryKey: ['poll-results'] });
    onDone(message);
  };
  const create = useMutation({
    mutationFn: () =>
      postJson<Poll>('/api/v1/polls', {
        org_unit_id: orgUnitId,
        poll_type: pollType,
        title,
        class_id: classId || null,
        audience,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        is_anonymous: anonymous,
        options:
          pollType === 'survey'
            ? undefined
            : optionsText
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean),
        survey_template_id: pollType === 'survey' ? templateId : undefined,
      }),
    onSuccess: () => {
      setTitle('');
      setOptionsText('');
      return refresh('Đã lập bản nháp, bấm Mở để gửi tới đối tượng');
    },
  });
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'publish' | 'close' | 'publish-results' }) =>
      postJson<Poll>(`/api/v1/polls/${id}/${action}`, {}),
    onSuccess: (_poll, { action }) =>
      refresh(action === 'publish' ? 'Đã mở và báo đối tượng' : action === 'close' ? 'Đã đóng' : 'Đã công bố kết quả'),
  });
  const error = [polls.error, create.error, act.error, results.error].find(Boolean);
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
      <form
        aria-label="Lập bình chọn"
        className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <label className="text-label font-medium text-text">
          Loại
          <select
            value={pollType}
            onChange={(event) => setPollType(event.target.value as PollType)}
            className={selectClass}
          >
            {Object.entries(POLL_TYPE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <TextField label="Tiêu đề" value={title} onChange={(event) => setTitle(event.target.value)} />
        <label className="text-label font-medium text-text">
          Đối tượng
          <select
            value={audience}
            onChange={(event) => setAudience(event.target.value as Poll['audience'])}
            className={selectClass}
          >
            {Object.entries(AUDIENCE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Lớp (để trống là cả đơn vị)
          <select value={classId} onChange={(event) => setClassId(event.target.value)} className={selectClass}>
            <option value="">Cả đơn vị</option>
            {(classes.data ?? [])
              .filter((item) => item.status === 'active')
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </label>
        <TextField
          label="Bắt đầu"
          type="datetime-local"
          value={startAt}
          onChange={(event) => setStartAt(event.target.value)}
        />
        <TextField
          label="Kết thúc"
          type="datetime-local"
          value={endAt}
          onChange={(event) => setEndAt(event.target.value)}
        />
        {pollType === 'survey' ? (
          <label className="text-label font-medium text-text">
            Mẫu khảo sát
            <select value={templateId} onChange={(event) => setTemplateId(event.target.value)} className={selectClass}>
              <option value="">Chọn mẫu trong danh mục khảo sát</option>
              {(templates.data ?? []).map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="text-label font-medium text-text md:col-span-2">
            Phương án (mỗi dòng một phương án)
            <textarea
              rows={3}
              value={optionsText}
              onChange={(event) => setOptionsText(event.target.value)}
              className={textareaClass}
            />
          </label>
        )}
        <label className="flex items-center gap-2 text-label font-medium text-text">
          <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} />
          Ẩn danh người trả lời
        </label>
        <div className="flex items-end">
          <Button
            type="submit"
            variant="primary"
            disabled={create.isPending || !orgUnitId || title === '' || (pollType === 'survey' && !templateId)}
          >
            Lập bản nháp
          </Button>
        </div>
      </form>
      <table className="w-full text-content">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Tiêu đề</th>
            <th>Loại</th>
            <th>Thời gian</th>
            <th>Trạng thái</th>
            <th>Số phiếu</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(polls.data ?? []).map((poll) => (
            <tr key={poll.id} className="border-t border-border">
              <td className="py-2">{poll.title}</td>
              <td>{POLL_TYPE_LABELS[poll.poll_type]}</td>
              <td>
                {formatTime(poll.start_at)} – {formatTime(poll.end_at)}
              </td>
              <td>
                {POLL_STATUS_LABELS[poll.status]}
                {poll.results_published_at ? ', đã công bố kết quả' : ''}
              </td>
              <td>{poll.response_count ?? ''}</td>
              <td className="flex flex-wrap gap-2 py-2">
                {poll.status === 'draft' ? (
                  <Button onClick={() => act.mutate({ id: poll.id, action: 'publish' })}>Mở</Button>
                ) : null}
                {poll.status === 'open' ? (
                  <Button variant="text" onClick={() => act.mutate({ id: poll.id, action: 'close' })}>
                    Đóng
                  </Button>
                ) : null}
                {poll.status !== 'draft' ? (
                  <Button variant="text" onClick={() => setResultsOf(poll.id)}>
                    Kết quả
                  </Button>
                ) : null}
                {poll.status !== 'draft' && !poll.results_published_at ? (
                  <Button variant="text" onClick={() => act.mutate({ id: poll.id, action: 'publish-results' })}>
                    Công bố kết quả
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {results.data ? (
        <section aria-label="Kết quả" className="flex flex-col gap-2 rounded-lg bg-card p-4">
          <h2 className="text-section-title font-semibold text-text">Kết quả: {results.data.response_count} phiếu</h2>
          {results.data.questions.map((question) => (
            <div key={question.id}>
              <p className="font-medium text-text">{question.question_text}</p>
              <ul className="text-content text-text">
                {question.options.map((option) => (
                  <li key={option.id}>
                    {option.label}: {option.count}
                  </li>
                ))}
                {question.average !== null ? <li>Điểm trung bình: {question.average}</li> : null}
                {question.texts.map((text, index) => (
                  <li key={index}>“{text}”</li>
                ))}
              </ul>
            </div>
          ))}
          {results.data.respondents ? (
            <p className="text-content text-text-secondary">
              Người đã trả lời: {results.data.respondents.map((respondent) => respondent.name ?? 'Nhân sự').join(', ')}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function TemplatesTab({ onDone }: { onDone: Notify }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [questions, setQuestions] = useState<Array<TemplateQuestion & { optionsText: string }>>([
    { question_text: '', answer_type: 'rating', is_required: true, options: [], optionsText: '' },
  ]);
  const templates = useQuery({
    queryKey: ['survey-templates', 'all'],
    queryFn: () => requestJson<SurveyTemplate[]>('/api/v1/survey-templates?include_inactive=true'),
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['survey-templates'] });
    onDone(message);
  };
  const create = useMutation({
    mutationFn: () =>
      postJson<SurveyTemplate>('/api/v1/survey-templates', {
        name,
        questions: questions.map(({ optionsText, ...question }) => ({
          ...question,
          options: optionsText
            .split(';')
            .map((option) => option.trim())
            .filter(Boolean),
        })),
      }),
    onSuccess: () => {
      setName('');
      setQuestions([{ question_text: '', answer_type: 'rating', is_required: true, options: [], optionsText: '' }]);
      return refresh('Đã thêm mẫu khảo sát');
    },
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'inactive' }) =>
      postJson(`/api/v1/survey-templates/${id}/status`, { status }),
    onSuccess: () => refresh('Đã cập nhật mẫu khảo sát'),
  });
  const update = (index: number, change: Partial<TemplateQuestion & { optionsText: string }>) =>
    setQuestions((current) => current.map((item, position) => (position === index ? { ...item, ...change } : item)));
  const error = [templates.error, create.error, setStatus.error].find(Boolean);
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <form
        aria-label="Thêm mẫu khảo sát"
        className="flex flex-col gap-3 rounded-lg bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <TextField label="Tên mẫu" value={name} onChange={(event) => setName(event.target.value)} />
        {questions.map((question, index) => (
          <div key={index} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <TextField
              label={`Câu hỏi ${index + 1}`}
              value={question.question_text}
              onChange={(event) => update(index, { question_text: event.target.value })}
            />
            <label className="text-label font-medium text-text">
              Loại trả lời
              <select
                value={question.answer_type}
                onChange={(event) => update(index, { answer_type: event.target.value as AnswerType })}
                className={selectClass}
              >
                {Object.entries(ANSWER_TYPE_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {question.answer_type === 'single_choice' || question.answer_type === 'multiple_choice' ? (
              <TextField
                label="Phương án (cách nhau bởi dấu ;)"
                value={question.optionsText}
                onChange={(event) => update(index, { optionsText: event.target.value })}
              />
            ) : (
              <div />
            )}
          </div>
        ))}
        <div className="flex gap-2">
          <Button
            variant="text"
            onClick={() =>
              setQuestions((current) => [
                ...current,
                { question_text: '', answer_type: 'single_choice', is_required: true, options: [], optionsText: '' },
              ])
            }
          >
            Thêm câu hỏi
          </Button>
          <Button type="submit" variant="primary" disabled={create.isPending || name === ''}>
            Lưu mẫu
          </Button>
        </div>
      </form>
      <ul className="flex flex-col gap-2 text-content text-text">
        {(templates.data ?? []).map((template) => (
          <li key={template.id} className="flex items-center gap-3">
            <span>
              {template.name} ({template.questions.length} câu hỏi,{' '}
              {template.status === 'active' ? 'đang dùng' : 'ngừng dùng'})
            </span>
            <Button
              variant="text"
              onClick={() =>
                setStatus.mutate({ id: template.id, status: template.status === 'active' ? 'inactive' : 'active' })
              }
            >
              {template.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeedbacksTab({ onDone }: { onDone: Notify }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const feedbacks = useQuery({
    queryKey: ['feedbacks'],
    queryFn: () => requestJson<Feedback[]>('/api/v1/feedbacks'),
  });
  const handle = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'in_progress' | 'resolved' }) =>
      postJson(`/api/v1/feedbacks/${id}/handle`, { status, handling_note: notes[id] ?? null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['feedbacks'] });
      onDone('Đã ghi xử lý góp ý');
    },
  });
  const error = [feedbacks.error, handle.error].find(Boolean);
  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {(feedbacks.data ?? []).map((feedback) => (
        <article key={feedback.id} className="flex flex-col gap-2 rounded-lg bg-card p-4" aria-label="Góp ý">
          <p className="text-label text-text-secondary">
            {FEEDBACK_CATEGORY_LABELS[feedback.category] ?? feedback.category} · {feedback.submitter_name}
            {feedback.child_name ? ` (phụ huynh ${feedback.child_name})` : ''} · {formatTime(feedback.created_at)} ·{' '}
            {FEEDBACK_STATUS_LABELS[feedback.status]}
          </p>
          <p className="text-content text-text">{feedback.content}</p>
          {feedback.status === 'resolved' ? (
            <p className="text-content text-text-secondary">Kết quả: {feedback.handling_note}</p>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <TextField
                label="Kết quả xử lý"
                value={notes[feedback.id] ?? ''}
                onChange={(event) => setNotes((current) => ({ ...current, [feedback.id]: event.target.value }))}
              />
              <Button variant="text" onClick={() => handle.mutate({ id: feedback.id, status: 'in_progress' })}>
                Đang xử lý
              </Button>
              <Button onClick={() => handle.mutate({ id: feedback.id, status: 'resolved' })}>Ghi kết quả</Button>
            </div>
          )}
        </article>
      ))}
      {feedbacks.data?.length === 0 ? <p className="text-content text-text-secondary">Chưa có góp ý.</p> : null}
    </div>
  );
}

function MessagesTab({ onDone }: { onDone: Notify }) {
  const queryClient = useQueryClient();
  const [threadId, setThreadId] = useState('');
  const [content, setContent] = useState('');
  const threads = useQuery({
    queryKey: ['message-threads'],
    queryFn: () => requestJson<MessageThread[]>('/api/v1/message-threads'),
  });
  const messages = useQuery({
    queryKey: ['messages', threadId],
    queryFn: async () => {
      const result = await requestJson<{ messages: Message[] }>(`/api/v1/message-threads/${threadId}/messages`);
      await postJson(`/api/v1/message-threads/${threadId}/read`, {});
      return result.messages;
    },
    enabled: Boolean(threadId),
  });
  const send = useMutation({
    mutationFn: () => postJson(`/api/v1/message-threads/${threadId}/messages`, { content }),
    onSuccess: async () => {
      setContent('');
      await queryClient.invalidateQueries({ queryKey: ['messages'] });
      await queryClient.invalidateQueries({ queryKey: ['message-threads'] });
      onDone('Đã gửi tin nhắn');
    },
  });
  const error = [threads.error, messages.error, send.error].find(Boolean);
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <ul className="flex flex-col gap-2" aria-label="Luồng trao đổi">
        {(threads.data ?? []).map((thread) => (
          <li key={thread.id}>
            <Button variant={thread.id === threadId ? 'secondary' : 'text'} onClick={() => setThreadId(thread.id)}>
              {thread.child_name}
              {thread.class_name ? ` (${thread.class_name})` : ''} · {thread.guardian_name ?? 'Phụ huynh'}
              {thread.unread_count ? ` · ${thread.unread_count} chưa đọc` : ''}
            </Button>
          </li>
        ))}
        {threads.data?.length === 0 ? <li className="text-content text-text-secondary">Chưa có trao đổi.</li> : null}
      </ul>
      {threadId ? (
        <section className="flex flex-col gap-2 md:col-span-2" aria-label="Tin nhắn">
          {(messages.data ?? []).map((message) => (
            <p key={message.id} className="rounded-lg bg-card p-3 text-content text-text">
              <span className="font-medium">{message.sender_name}</span>{' '}
              <span className="text-text-secondary">({formatTime(message.sent_at)})</span>: {message.content}
            </p>
          ))}
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              send.mutate();
            }}
          >
            <TextField label="Trả lời" value={content} onChange={(event) => setContent(event.target.value)} />
            <Button type="submit" variant="primary" disabled={send.isPending || content.trim() === ''}>
              Gửi
            </Button>
          </form>
        </section>
      ) : null}
    </div>
  );
}

function LostItemsTab({ onDone }: { onDone: Notify }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const items = useQuery({
    queryKey: ['lost-items', status],
    queryFn: () => requestJson<LostItem[]>(`/api/v1/lost-items${status ? `?status=${status}` : ''}`),
  });
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'found' | 'returned' | 'not_found' }) =>
      action === 'found'
        ? postJson(`/api/v1/lost-items/${id}/found`, { found_note: notes[id] ?? null })
        : postJson(`/api/v1/lost-items/${id}/close`, { result: action, result_note: notes[id] ?? null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lost-items'] });
      onDone('Đã cập nhật phiếu đồ bị mất');
    },
  });
  const error = [items.error, act.error].find(Boolean);
  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <label className="text-label font-medium text-text">
        Trạng thái
        <select value={status} onChange={(event) => setStatus(event.target.value)} className={selectClass}>
          <option value="">Tất cả</option>
          {Object.entries(LOST_STATUS_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <table className="w-full text-content">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Mã</th>
            <th>Trẻ / lớp</th>
            <th>Mô tả</th>
            <th>Ngày phát hiện</th>
            <th>Trạng thái</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(items.data ?? []).map((item) => (
            <tr key={item.id} className="border-t border-border">
              <td className="py-2">{item.code}</td>
              <td>{[item.child_name, item.class_name].filter(Boolean).join(' / ')}</td>
              <td>
                {item.report_type === 'found' ? 'Nhặt được: ' : ''}
                {item.description}
              </td>
              <td>{item.noticed_on}</td>
              <td>{LOST_STATUS_LABELS[item.status]}</td>
              <td className="flex flex-wrap items-end gap-2 py-2">
                {item.status === 'reported' || item.status === 'found' ? (
                  <>
                    <TextField
                      label="Ghi chú"
                      value={notes[item.id] ?? ''}
                      onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                    />
                    {item.status === 'reported' ? (
                      <Button variant="text" onClick={() => act.mutate({ id: item.id, action: 'found' })}>
                        Đã tìm thấy
                      </Button>
                    ) : null}
                    <Button onClick={() => act.mutate({ id: item.id, action: 'returned' })}>Đã trả</Button>
                    <Button variant="text" onClick={() => act.mutate({ id: item.id, action: 'not_found' })}>
                      Không tìm thấy
                    </Button>
                  </>
                ) : (
                  (item.result_note ?? '')
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CommentsTab({ onDone }: { onDone: Notify }) {
  const queryClient = useQueryClient();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const comments = useQuery({
    queryKey: ['reported-comments'],
    queryFn: () => requestJson<InteractionComment[]>('/api/v1/interaction-comments/reported'),
  });
  const moderate = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'hide' | 'restore' | 'note' }) =>
      postJson(`/api/v1/interaction-comments/${id}/moderate`, { action, reason: reasons[id] ?? '' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reported-comments'] });
      onDone('Đã ghi xử lý bình luận');
    },
  });
  const error = [comments.error, moderate.error].find(Boolean);
  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {(comments.data ?? []).map((comment) => (
        <article key={comment.id} className="flex flex-col gap-2 rounded-lg bg-card p-4" aria-label="Bình luận">
          <p className="text-content text-text">
            <span className="font-medium">{comment.author_name}</span>: {comment.content}
          </p>
          <p className="text-label text-text-secondary">
            {comment.is_hidden ? `Đã ẩn: ${comment.hide_reason ?? ''}` : 'Đang hiện'}
            {comment.moderations?.length ? ` · ${comment.moderations.length} lần xử lý` : ''}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <TextField
              label="Lý do xử lý"
              value={reasons[comment.id] ?? ''}
              onChange={(event) => setReasons((current) => ({ ...current, [comment.id]: event.target.value }))}
            />
            {comment.is_hidden ? (
              <Button variant="text" onClick={() => moderate.mutate({ id: comment.id, action: 'restore' })}>
                Hiện lại
              </Button>
            ) : (
              <Button onClick={() => moderate.mutate({ id: comment.id, action: 'hide' })}>Ẩn bình luận</Button>
            )}
            <Button variant="text" onClick={() => moderate.mutate({ id: comment.id, action: 'note' })}>
              Ghi chú xử lý
            </Button>
          </div>
        </article>
      ))}
      {comments.data?.length === 0 ? (
        <p className="text-content text-text-secondary">Không có bình luận bị báo.</p>
      ) : null}
    </div>
  );
}
