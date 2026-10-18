import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  TextField,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import { AppShell } from '../pages/AppShell.js';
import { FormButtons, FormPanel } from '../pages/FormPanel.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { matchesSearch } from '../pages/grid-search.js';
import { menuPageTitle } from '../pages/page-title.js';
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
// mục khảo sát; góp ý; trao đổi với phụ huynh; phiếu đồ bị mất; bình luận bị báo cần xử lý. Giao diện chung theo Sở (DT-15
// phần 15f3, YCTD-115): các danh sách là lưới dữ liệu chung (khóa `polls`, `survey-templates`, `interaction-feedbacks`,
// `lost-items`, `reported-comments`); lập bình chọn và mẫu khảo sát bằng biểu mẫu theo khối có nút Ghi; xử lý từng dòng mở
// ngay dưới dòng. Trao đổi với phụ huynh là khung trò chuyện nên giữ bố cục cũ
type Tab = 'polls' | 'templates' | 'feedbacks' | 'messages' | 'lost' | 'comments';
type Notify = (message: string) => void;
const filterClass = `mt-1 ${FORM_CONTROL_CLASS}`;
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
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/interactions')}</h1>
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

const POLL_COLUMNS: Array<DataGridColumn<Poll>> = [
  { id: 'title', header: 'Tiêu đề', alwaysVisible: true, className: 'font-medium', cell: (poll) => poll.title },
  { id: 'poll_type', header: 'Loại', cell: (poll) => POLL_TYPE_LABELS[poll.poll_type] },
  { id: 'audience', header: 'Đối tượng', hiddenByDefault: true, cell: (poll) => AUDIENCE_LABELS[poll.audience] },
  { id: 'time', header: 'Thời gian', cell: (poll) => `${formatTime(poll.start_at)} – ${formatTime(poll.end_at)}` },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (poll) => `${POLL_STATUS_LABELS[poll.status]}${poll.results_published_at ? ', đã công bố kết quả' : ''}`,
  },
  { id: 'response_count', header: 'Số phiếu', cell: (poll) => poll.response_count ?? '' },
];

function PollForm({
  orgUnitId,
  onSaved,
  onCancel,
}: {
  orgUnitId: string | undefined;
  onSaved(): void;
  onCancel(): void;
}) {
  const [pollType, setPollType] = useState<PollType>('poll');
  const [title, setTitle] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [classId, setClassId] = useState('');
  const [audience, setAudience] = useState<Poll['audience']>('guardians');
  const [startAt, setStartAt] = useState(() => toLocalInput(new Date()));
  const [endAt, setEndAt] = useState(() => toLocalInput(new Date(Date.now() + 7 * 86_400_000)));
  const [anonymous, setAnonymous] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const classes = useQuery({
    queryKey: ['classes', orgUnitId],
    queryFn: () => listClasses(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId),
  });
  const templates = useQuery({
    queryKey: ['survey-templates'],
    queryFn: () => requestJson<SurveyTemplate[]>('/api/v1/survey-templates'),
  });
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
    onSuccess: onSaved,
  });
  return (
    <form
      aria-label="Lập bình chọn"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <FormBlock title="Lập bình chọn, biểu quyết hoặc khảo sát">
        <FormRow label="Loại">
          <select
            className={FORM_CONTROL_CLASS}
            value={pollType}
            onChange={(event) => setPollType(event.target.value as PollType)}
          >
            {Object.entries(POLL_TYPE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Tiêu đề">
          <input className={FORM_CONTROL_CLASS} value={title} onChange={(event) => setTitle(event.target.value)} />
        </FormRow>
        <FormRow label="Đối tượng">
          <select
            className={FORM_CONTROL_CLASS}
            value={audience}
            onChange={(event) => setAudience(event.target.value as Poll['audience'])}
          >
            {Object.entries(AUDIENCE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Lớp (để trống là cả đơn vị)">
          <select className={FORM_CONTROL_CLASS} value={classId} onChange={(event) => setClassId(event.target.value)}>
            <option value="">Cả đơn vị</option>
            {(classes.data ?? [])
              .filter((item) => item.status === 'active')
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </FormRow>
        <FormRow label="Bắt đầu">
          <input
            type="datetime-local"
            className={FORM_CONTROL_CLASS}
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
          />
        </FormRow>
        <FormRow label="Kết thúc">
          <input
            type="datetime-local"
            className={FORM_CONTROL_CLASS}
            value={endAt}
            onChange={(event) => setEndAt(event.target.value)}
          />
        </FormRow>
        {pollType === 'survey' ? (
          <FormRow label="Mẫu khảo sát">
            <select
              className={FORM_CONTROL_CLASS}
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
            >
              <option value="">Chọn mẫu trong danh mục khảo sát</option>
              {(templates.data ?? []).map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </FormRow>
        ) : (
          <FormRow label="Phương án (mỗi dòng một phương án)">
            <textarea
              rows={3}
              className={FORM_CONTROL_CLASS}
              value={optionsText}
              onChange={(event) => setOptionsText(event.target.value)}
            />
          </FormRow>
        )}
        <FormRow label="Ẩn danh">
          <label className="flex items-center gap-2 text-content text-text">
            <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} />
            Ẩn danh người trả lời
          </label>
        </FormRow>
      </FormBlock>
      <FormButtons
        busy={create.isPending}
        disabled={!orgUnitId || title === '' || (pollType === 'survey' && !templateId)}
        onCancel={onCancel}
      />
    </form>
  );
}

// Kết quả của một bình chọn, mở ngay dưới dòng của bình chọn
function PollResultsView({ pollId }: { pollId: string }) {
  const results = useQuery({
    queryKey: ['poll-results', pollId],
    queryFn: () => requestJson<PollResults>(`/api/v1/polls/${pollId}/results`),
  });
  if (results.error) {
    return <Alert tone="danger">{messageOf(results.error)}</Alert>;
  }
  if (!results.data) {
    return null;
  }
  return (
    <section aria-label="Kết quả" className="flex flex-col gap-2">
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
  );
}

function PollsTab({ onDone }: { onDone: Notify }) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('polls');
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [creating, setCreating] = useState(false);
  const [resultsOf, setResultsOf] = useState<string>();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<PollType | ''>('');
  const [statusFilter, setStatusFilter] = useState<Poll['status'] | ''>('');
  const polls = useQuery({
    queryKey: ['polls', orgUnitId],
    queryFn: () => requestJson<Poll[]>(`/api/v1/polls?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['polls'] });
    await queryClient.invalidateQueries({ queryKey: ['poll-results'] });
    onDone(message);
  };
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'publish' | 'close' | 'publish-results' }) =>
      postJson<Poll>(`/api/v1/polls/${id}/${action}`, {}),
    onSuccess: (_poll, { action }) =>
      refresh(action === 'publish' ? 'Đã mở và báo đối tượng' : action === 'close' ? 'Đã đóng' : 'Đã công bố kết quả'),
  });
  const error = [polls.error, act.error, grid.error].find(Boolean);
  const rows = (polls.data ?? []).filter(
    (poll) =>
      (typeFilter === '' || poll.poll_type === typeFilter) &&
      (statusFilter === '' || poll.status === statusFilter) &&
      matchesSearch(search, poll.title),
  );
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
      {creating ? (
        <FormPanel>
          <PollForm
            orgUnitId={orgUnitId}
            onCancel={() => setCreating(false)}
            onSaved={() => {
              setCreating(false);
              void refresh('Đã lập bản nháp, bấm Mở để gửi tới đối tượng');
            }}
          />
        </FormPanel>
      ) : null}
      <DataGrid
        label="Bình chọn và khảo sát"
        columns={POLL_COLUMNS}
        rows={rows}
        getRowId={(poll) => poll.id}
        getRowLabel={(poll) => poll.title}
        loading={Boolean(orgUnitId) && polls.isPending}
        emptyText="Đơn vị chưa có bình chọn, biểu quyết hay khảo sát."
        search={{ label: 'Tìm theo tiêu đề', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Lọc theo loại
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
                className={filterClass}
              >
                <option value="">Tất cả</option>
                {Object.entries(POLL_TYPE_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-label font-medium text-text">
              Lọc theo trạng thái
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                className={filterClass}
              >
                <option value="">Tất cả</option>
                {Object.entries(POLL_STATUS_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        toolbar={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Thêm mới
          </Button>
        }
        rowActions={(poll) => (
          <span className="flex flex-wrap justify-end gap-2">
            {poll.status === 'draft' ? (
              <Button onClick={() => act.mutate({ id: poll.id, action: 'publish' })}>Mở</Button>
            ) : null}
            {poll.status === 'open' ? (
              <Button variant="text" onClick={() => act.mutate({ id: poll.id, action: 'close' })}>
                Đóng
              </Button>
            ) : null}
            {poll.status !== 'draft' ? (
              <Button variant="text" onClick={() => setResultsOf(resultsOf === poll.id ? undefined : poll.id)}>
                Kết quả
              </Button>
            ) : null}
            {poll.status !== 'draft' && !poll.results_published_at ? (
              <Button variant="text" onClick={() => act.mutate({ id: poll.id, action: 'publish-results' })}>
                Công bố kết quả
              </Button>
            ) : null}
          </span>
        )}
        activeRowId={resultsOf}
        renderRowDetail={(poll) => (resultsOf === poll.id ? <PollResultsView pollId={poll.id} /> : null)}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}

const TEMPLATE_COLUMNS: Array<DataGridColumn<SurveyTemplate>> = [
  { id: 'name', header: 'Tên mẫu', alwaysVisible: true, className: 'font-medium', cell: (template) => template.name },
  { id: 'description', header: 'Mô tả', hiddenByDefault: true, cell: (template) => template.description ?? '' },
  { id: 'questions', header: 'Số câu hỏi', cell: (template) => template.questions.length },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (template) => (template.status === 'active' ? 'Đang dùng' : 'Ngừng dùng'),
  },
];

type DraftQuestion = TemplateQuestion & { optionsText: string };

function TemplateForm({ onSaved, onCancel }: { onSaved(): void; onCancel(): void }) {
  const [name, setName] = useState('');
  const [questions, setQuestions] = useState<DraftQuestion[]>([
    { question_text: '', answer_type: 'rating', is_required: true, options: [], optionsText: '' },
  ]);
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
    onSuccess: onSaved,
  });
  const update = (index: number, change: Partial<DraftQuestion>) =>
    setQuestions((current) => current.map((item, position) => (position === index ? { ...item, ...change } : item)));
  return (
    <form
      aria-label="Thêm mẫu khảo sát"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <FormBlock title="Thêm mẫu khảo sát">
        <FormRow label="Tên mẫu">
          <input className={FORM_CONTROL_CLASS} value={name} onChange={(event) => setName(event.target.value)} />
        </FormRow>
      </FormBlock>
      {questions.map((question, index) => (
        <FormBlock key={index} title={`Câu hỏi ${index + 1}`}>
          <FormRow label={`Câu hỏi ${index + 1}`}>
            <input
              className={FORM_CONTROL_CLASS}
              value={question.question_text}
              onChange={(event) => update(index, { question_text: event.target.value })}
            />
          </FormRow>
          <FormRow label="Loại trả lời">
            <select
              className={FORM_CONTROL_CLASS}
              value={question.answer_type}
              onChange={(event) => update(index, { answer_type: event.target.value as AnswerType })}
            >
              {Object.entries(ANSWER_TYPE_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </FormRow>
          {question.answer_type === 'single_choice' || question.answer_type === 'multiple_choice' ? (
            <FormRow label="Phương án (cách nhau bởi dấu ;)">
              <input
                className={FORM_CONTROL_CLASS}
                value={question.optionsText}
                onChange={(event) => update(index, { optionsText: event.target.value })}
              />
            </FormRow>
          ) : null}
        </FormBlock>
      ))}
      <FormButtons busy={create.isPending} disabled={name === ''} onCancel={onCancel}>
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
      </FormButtons>
    </form>
  );
}

function TemplatesTab({ onDone }: { onDone: Notify }) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('survey-templates');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SurveyTemplate['status'] | ''>('');
  const templates = useQuery({
    queryKey: ['survey-templates', 'all'],
    queryFn: () => requestJson<SurveyTemplate[]>('/api/v1/survey-templates?include_inactive=true'),
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['survey-templates'] });
    onDone(message);
  };
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'inactive' }) =>
      postJson(`/api/v1/survey-templates/${id}/status`, { status }),
    onSuccess: () => refresh('Đã cập nhật mẫu khảo sát'),
  });
  const error = [templates.error, setStatus.error, grid.error].find(Boolean);
  const rows = (templates.data ?? []).filter(
    (template) =>
      (statusFilter === '' || template.status === statusFilter) &&
      matchesSearch(search, template.name, template.description),
  );
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {creating ? (
        <FormPanel>
          <TemplateForm
            onCancel={() => setCreating(false)}
            onSaved={() => {
              setCreating(false);
              void refresh('Đã thêm mẫu khảo sát');
            }}
          />
        </FormPanel>
      ) : null}
      <DataGrid
        label="Danh mục khảo sát"
        columns={TEMPLATE_COLUMNS}
        rows={rows}
        getRowId={(template) => template.id}
        getRowLabel={(template) => `mẫu ${template.name}`}
        loading={templates.isPending}
        emptyText="Chưa có mẫu khảo sát."
        search={{ label: 'Tìm theo tên mẫu', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Lọc theo trạng thái
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                className={filterClass}
              >
                <option value="">Tất cả</option>
                <option value="active">Đang dùng</option>
                <option value="inactive">Ngừng dùng</option>
              </select>
            </label>
          </div>
        }
        toolbar={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Thêm mới
          </Button>
        }
        rowActions={(template) => (
          <Button
            variant="text"
            onClick={() =>
              setStatus.mutate({ id: template.id, status: template.status === 'active' ? 'inactive' : 'active' })
            }
          >
            {template.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}
          </Button>
        )}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}

const FEEDBACK_COLUMNS: Array<DataGridColumn<Feedback>> = [
  {
    id: 'created_at',
    header: 'Thời gian',
    alwaysVisible: true,
    cell: (feedback) => formatTime(feedback.created_at),
  },
  {
    id: 'category',
    header: 'Loại góp ý',
    cell: (feedback) => FEEDBACK_CATEGORY_LABELS[feedback.category] ?? feedback.category,
  },
  { id: 'submitter_name', header: 'Người gửi', cell: (feedback) => feedback.submitter_name },
  { id: 'child_name', header: 'Học sinh', cell: (feedback) => feedback.child_name ?? '' },
  { id: 'content', header: 'Nội dung', cell: (feedback) => feedback.content },
  { id: 'status', header: 'Trạng thái', cell: (feedback) => FEEDBACK_STATUS_LABELS[feedback.status] },
  { id: 'handling_note', header: 'Kết quả', cell: (feedback) => feedback.handling_note ?? '' },
];

// Ghi xử lý một góp ý, mở ngay dưới dòng của góp ý
function FeedbackHandling({ feedback, onDone }: { feedback: Feedback; onDone: Notify }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState<string>();
  const handle = useMutation({
    mutationFn: (status: 'in_progress' | 'resolved') =>
      postJson(`/api/v1/feedbacks/${feedback.id}/handle`, { status, handling_note: note ?? null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['feedbacks'] });
      onDone('Đã ghi xử lý góp ý');
    },
  });
  return (
    <div className="flex flex-col gap-3" role="group" aria-label="Xử lý góp ý">
      {handle.error ? <Alert tone="danger">{messageOf(handle.error)}</Alert> : null}
      <FormBlock title="Xử lý góp ý">
        <FormRow label="Kết quả xử lý">
          <input className={FORM_CONTROL_CLASS} value={note ?? ''} onChange={(event) => setNote(event.target.value)} />
        </FormRow>
      </FormBlock>
      <div className="flex flex-wrap gap-2">
        <Button variant="text" disabled={handle.isPending} onClick={() => handle.mutate('in_progress')}>
          Đang xử lý
        </Button>
        <Button disabled={handle.isPending} onClick={() => handle.mutate('resolved')}>
          Ghi kết quả
        </Button>
      </div>
    </div>
  );
}

function FeedbacksTab({ onDone }: { onDone: Notify }) {
  const grid = useGridSettings('interaction-feedbacks');
  const [handlingId, setHandlingId] = useState<string>();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Feedback['status'] | ''>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const feedbacks = useQuery({
    queryKey: ['feedbacks'],
    queryFn: () => requestJson<Feedback[]>('/api/v1/feedbacks'),
  });
  const error = feedbacks.error ?? grid.error;
  const rows = (feedbacks.data ?? []).filter(
    (feedback) =>
      (statusFilter === '' || feedback.status === statusFilter) &&
      (categoryFilter === '' || feedback.category === categoryFilter) &&
      matchesSearch(search, feedback.submitter_name, feedback.child_name, feedback.content),
  );
  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <DataGrid
        label="Góp ý"
        columns={FEEDBACK_COLUMNS}
        rows={rows}
        getRowId={(feedback) => feedback.id}
        getRowLabel={(feedback) => `góp ý của ${feedback.submitter_name}`}
        loading={feedbacks.isPending}
        emptyText="Chưa có góp ý."
        search={{ label: 'Tìm theo người gửi, học sinh, nội dung', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Lọc theo loại góp ý
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className={filterClass}
              >
                <option value="">Tất cả</option>
                {Object.entries(FEEDBACK_CATEGORY_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-label font-medium text-text">
              Lọc theo trạng thái
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                className={filterClass}
              >
                <option value="">Tất cả</option>
                {Object.entries(FEEDBACK_STATUS_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        rowActions={(feedback) =>
          feedback.status === 'resolved' ? null : (
            <Button variant="text" onClick={() => setHandlingId(handlingId === feedback.id ? undefined : feedback.id)}>
              Xử lý
            </Button>
          )
        }
        activeRowId={handlingId}
        renderRowDetail={(feedback) =>
          handlingId === feedback.id && feedback.status !== 'resolved' ? (
            <FeedbackHandling key={feedback.id} feedback={feedback} onDone={onDone} />
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}

// Trao đổi với phụ huynh: danh sách luồng bên trái, tin nhắn và ô trả lời bên phải; là khung trò chuyện nên giữ bố cục
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

const LOST_COLUMNS: Array<DataGridColumn<LostItem>> = [
  { id: 'code', header: 'Mã', alwaysVisible: true, className: 'font-medium', cell: (item) => item.code },
  {
    id: 'child',
    header: 'Học sinh / lớp',
    cell: (item) => [item.child_name, item.class_name].filter(Boolean).join(' / '),
  },
  {
    id: 'description',
    header: 'Mô tả',
    cell: (item) => `${item.report_type === 'found' ? 'Nhặt được: ' : ''}${item.description}`,
  },
  { id: 'noticed_on', header: 'Ngày phát hiện', cell: (item) => item.noticed_on },
  { id: 'status', header: 'Trạng thái', cell: (item) => LOST_STATUS_LABELS[item.status] },
  { id: 'found_note', header: 'Ghi chú tìm thấy', hiddenByDefault: true, cell: (item) => item.found_note ?? '' },
  { id: 'result_note', header: 'Kết quả', cell: (item) => item.result_note ?? '' },
];

// Đánh dấu tìm thấy, đã trả hoặc không tìm thấy một phiếu đồ bị mất, mở ngay dưới dòng của phiếu
function LostItemHandling({ item, onDone }: { item: LostItem; onDone: Notify }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState<string>();
  const act = useMutation({
    mutationFn: (action: 'found' | 'returned' | 'not_found') =>
      action === 'found'
        ? postJson(`/api/v1/lost-items/${item.id}/found`, { found_note: note ?? null })
        : postJson(`/api/v1/lost-items/${item.id}/close`, { result: action, result_note: note ?? null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lost-items'] });
      onDone('Đã cập nhật phiếu đồ bị mất');
    },
  });
  return (
    <div className="flex flex-col gap-3" role="group" aria-label={`Xử lý phiếu ${item.code}`}>
      {act.error ? <Alert tone="danger">{messageOf(act.error)}</Alert> : null}
      <FormBlock title={`Xử lý phiếu ${item.code}`}>
        <FormRow label="Ghi chú">
          <input className={FORM_CONTROL_CLASS} value={note ?? ''} onChange={(event) => setNote(event.target.value)} />
        </FormRow>
      </FormBlock>
      <div className="flex flex-wrap gap-2">
        {item.status === 'reported' ? (
          <Button variant="text" disabled={act.isPending} onClick={() => act.mutate('found')}>
            Đã tìm thấy
          </Button>
        ) : null}
        <Button disabled={act.isPending} onClick={() => act.mutate('returned')}>
          Đã trả
        </Button>
        <Button variant="text" disabled={act.isPending} onClick={() => act.mutate('not_found')}>
          Không tìm thấy
        </Button>
      </div>
    </div>
  );
}

function LostItemsTab({ onDone }: { onDone: Notify }) {
  const grid = useGridSettings('lost-items');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [handlingId, setHandlingId] = useState<string>();
  const items = useQuery({
    queryKey: ['lost-items', status],
    queryFn: () => requestJson<LostItem[]>(`/api/v1/lost-items${status ? `?status=${status}` : ''}`),
  });
  const error = items.error ?? grid.error;
  const open = (item: LostItem) => item.status === 'reported' || item.status === 'found';
  const rows = (items.data ?? []).filter((item) =>
    matchesSearch(search, item.code, item.child_name, item.class_name, item.description),
  );
  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <DataGrid
        label="Đồ bị mất"
        columns={LOST_COLUMNS}
        rows={rows}
        getRowId={(item) => item.id}
        getRowLabel={(item) => `phiếu ${item.code}`}
        loading={items.isPending}
        emptyText="Không có phiếu đồ bị mất."
        search={{ label: 'Tìm theo mã, học sinh, lớp, mô tả', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Trạng thái
              <select value={status} onChange={(event) => setStatus(event.target.value)} className={filterClass}>
                <option value="">Tất cả</option>
                {Object.entries(LOST_STATUS_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        rowActions={(item) =>
          open(item) ? (
            <Button variant="text" onClick={() => setHandlingId(handlingId === item.id ? undefined : item.id)}>
              Xử lý
            </Button>
          ) : null
        }
        activeRowId={handlingId}
        renderRowDetail={(item) =>
          handlingId === item.id && open(item) ? <LostItemHandling key={item.id} item={item} onDone={onDone} /> : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}

const COMMENT_COLUMNS: Array<DataGridColumn<InteractionComment>> = [
  {
    id: 'author_name',
    header: 'Người viết',
    alwaysVisible: true,
    className: 'font-medium',
    cell: (comment) => comment.author_name,
  },
  { id: 'content', header: 'Nội dung', cell: (comment) => comment.content },
  { id: 'created_at', header: 'Thời gian', hiddenByDefault: true, cell: (comment) => formatTime(comment.created_at) },
  {
    id: 'reported_at',
    header: 'Bị báo lúc',
    hiddenByDefault: true,
    cell: (comment) => (comment.reported_at ? formatTime(comment.reported_at) : ''),
  },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (comment) => (comment.is_hidden ? `Đã ẩn: ${comment.hide_reason ?? ''}` : 'Đang hiện'),
  },
  {
    id: 'moderations',
    header: 'Số lần xử lý',
    cell: (comment) => (comment.moderations?.length ? `${comment.moderations.length} lần xử lý` : ''),
  },
];

// Ẩn, hiện lại hoặc ghi chú xử lý một bình luận bị báo, mở ngay dưới dòng của bình luận
function CommentModeration({ comment, onDone }: { comment: InteractionComment; onDone: Notify }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const moderate = useMutation({
    mutationFn: (action: 'hide' | 'restore' | 'note') =>
      postJson(`/api/v1/interaction-comments/${comment.id}/moderate`, { action, reason }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reported-comments'] });
      onDone('Đã ghi xử lý bình luận');
    },
  });
  return (
    <div className="flex flex-col gap-3" role="group" aria-label="Xử lý bình luận">
      {moderate.error ? <Alert tone="danger">{messageOf(moderate.error)}</Alert> : null}
      <FormBlock title="Xử lý bình luận">
        <FormRow label="Lý do xử lý">
          <input className={FORM_CONTROL_CLASS} value={reason} onChange={(event) => setReason(event.target.value)} />
        </FormRow>
      </FormBlock>
      <div className="flex flex-wrap gap-2">
        {comment.is_hidden ? (
          <Button variant="text" disabled={moderate.isPending} onClick={() => moderate.mutate('restore')}>
            Hiện lại
          </Button>
        ) : (
          <Button disabled={moderate.isPending} onClick={() => moderate.mutate('hide')}>
            Ẩn bình luận
          </Button>
        )}
        <Button variant="text" disabled={moderate.isPending} onClick={() => moderate.mutate('note')}>
          Ghi chú xử lý
        </Button>
      </div>
    </div>
  );
}

function CommentsTab({ onDone }: { onDone: Notify }) {
  const grid = useGridSettings('reported-comments');
  const [search, setSearch] = useState('');
  const [handlingId, setHandlingId] = useState<string>();
  const comments = useQuery({
    queryKey: ['reported-comments'],
    queryFn: () => requestJson<InteractionComment[]>('/api/v1/interaction-comments/reported'),
  });
  const error = comments.error ?? grid.error;
  const rows = (comments.data ?? []).filter((comment) => matchesSearch(search, comment.author_name, comment.content));
  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <DataGrid
        label="Bình luận cần xử lý"
        columns={COMMENT_COLUMNS}
        rows={rows}
        getRowId={(comment) => comment.id}
        getRowLabel={(comment) => `bình luận của ${comment.author_name}`}
        loading={comments.isPending}
        emptyText="Không có bình luận bị báo."
        search={{ label: 'Tìm theo người viết, nội dung', value: search, onChange: setSearch }}
        rowActions={(comment) => (
          <Button variant="text" onClick={() => setHandlingId(handlingId === comment.id ? undefined : comment.id)}>
            Xử lý
          </Button>
        )}
        activeRowId={handlingId}
        renderRowDetail={(comment) =>
          handlingId === comment.id ? <CommentModeration key={comment.id} comment={comment} onDone={onDone} /> : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}
