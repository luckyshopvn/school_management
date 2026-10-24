import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ENABLED_RESOURCE_VISIBILITIES,
  LEARNING_RESOURCE_REPORT_KIND_LABELS,
  LEARNING_RESOURCE_STATUS_LABELS,
  PERMISSION_CODES,
  RESOURCE_VERSION_KIND_LABELS,
  RESOURCE_VISIBILITY_LABELS,
  type LearningResourceReportKind,
  type ResourceVisibility,
} from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge } from '@school-management/ui';
import { messageOf } from '../archives/archive-ui.js';
import { Page, useToast } from '../directives/directive-ui.js';
import { useHasPermission } from '../session/permissions.js';
import {
  addResourceLink,
  createCollection,
  createResource,
  deleteCollection,
  downloadResource,
  exportCollection,
  handleResourceReport,
  listCollections,
  listResourceReports,
  readCollection,
  readResource,
  readResourceCatalog,
  readResourceStatistics,
  reportResource,
  reviewResource,
  saveResourceLicense,
  saveResourceTopic,
  saveResourceType,
  searchResources,
  setCollectionItems,
  setResourceLifecycle,
  submitResource,
  uploadResourceFile,
  type LearningResource,
  type ResourceInput,
} from './learning-resources-api.js';

// Kho học liệu số (DT-22 phần 22h1, YCTD-183): 1. Tìm học liệu, 2. Học liệu của tôi, 3. Duyệt học liệu, 4. Bộ sưu tập, 5. Báo
// lỗi học liệu, 6. Thống kê kho, 7. Danh mục kho
const cell = 'px-3 py-2';
const head = 'text-left text-label font-medium text-text-secondary';
const LEVELS = [
  { value: 'MN', label: 'Mầm non' },
  { value: 'TH', label: 'Tiểu học' },
  { value: 'THCS', label: 'Trung học cơ sở' },
  { value: 'THPT', label: 'Trung học phổ thông' },
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-label font-medium text-text">
      {label}
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label={title}>
      <h2 className="text-section-title font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}

const statusTone = (status: LearningResource['status']) =>
  status === 'published'
    ? 'success'
    : status === 'returned' || status === 'hidden'
      ? 'danger'
      : status === 'retired'
        ? 'neutral'
        : 'info';

function useCatalog() {
  return useQuery({ queryKey: ['resource-catalog'], queryFn: readResourceCatalog });
}

function ResourceTable({ label, rows, onOpen }: { label: string; rows: LearningResource[]; onOpen(id: string): void }) {
  return (
    <table className="w-full text-content" aria-label={label}>
      <thead className={head}>
        <tr>
          <th className={cell}>Tiêu đề</th>
          <th className={cell}>Loại</th>
          <th className={cell}>Môn, khối</th>
          <th className={cell}>Giấy phép</th>
          <th className={cell}>Người đóng góp</th>
          <th className={cell}>Trạng thái</th>
          <th className={cell} />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-t border-border">
            <td className={cell}>{row.title}</td>
            <td className={cell}>{row.type_name}</td>
            <td className={cell}>{[row.subject_name, row.grade_level_code].filter(Boolean).join(', ')}</td>
            <td className={cell}>{row.license_name ?? 'Chưa chọn'}</td>
            <td className={cell}>{row.owner_name}</td>
            <td className={cell}>
              <StatusBadge tone={statusTone(row.status)} label={LEARNING_RESOURCE_STATUS_LABELS[row.status]} />
            </td>
            <td className={`${cell} text-right`}>
              <Button variant="text" onClick={() => onOpen(row.id)}>
                Mở
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Chi tiết học liệu: metadata, phiên bản (tải), lịch sử duyệt, báo lỗi; người sở hữu tải tệp, thêm liên kết, gửi duyệt,
// ngừng dùng; người duyệt duyệt, trả lại; thủ kho ẩn tạm, mở lại
function ResourceDetailPanel({ id, onMessage }: { id: string; onMessage(message: string): void }) {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.learningResourceManage);
  const detail = useQuery({ queryKey: ['resource', id], queryFn: () => readResource(id) });
  const [file, setFile] = useState<File>();
  const [link, setLink] = useState({ url: '', title: '' });
  const [note, setNote] = useState('');
  const [report, setReport] = useState<{ kind: LearningResourceReportKind; description: string }>({
    kind: 'content',
    description: '',
  });
  const [lessonPlan, setLessonPlan] = useState<unknown>();
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['resource'] });
    await queryClient.invalidateQueries({ queryKey: ['resources'] });
    onMessage(message);
  };
  const upload = useMutation({
    mutationFn: () => uploadResourceFile(id, file as File),
    onSuccess: () => {
      setFile(undefined);
      return refresh('Đã tải tệp lên, thành phiên bản mới');
    },
  });
  const addLink = useMutation({
    mutationFn: () => addResourceLink(id, link.url, link.title || null),
    onSuccess: () => {
      setLink({ url: '', title: '' });
      return refresh('Đã thêm liên kết, thành phiên bản mới');
    },
  });
  const submit = useMutation({
    mutationFn: () => submitResource(id),
    onSuccess: () => refresh('Đã gửi duyệt học liệu'),
  });
  const review = useMutation({
    mutationFn: (decision: 'approve' | 'return') => reviewResource(id, decision, note || null),
    onSuccess: (_data, decision) => {
      setNote('');
      return refresh(decision === 'approve' ? 'Đã duyệt học liệu' : 'Đã trả lại học liệu');
    },
  });
  const lifecycle = useMutation({
    mutationFn: (action: 'hide' | 'restore' | 'retire') => setResourceLifecycle(id, action, null),
    onSuccess: () => refresh('Đã đổi trạng thái học liệu'),
  });
  const sendReport = useMutation({
    mutationFn: () => reportResource(id, report.kind, report.description),
    onSuccess: () => {
      setReport({ kind: 'content', description: '' });
      onMessage('Đã gửi báo lỗi tới thủ kho');
    },
  });
  const download = useMutation({
    mutationFn: (versionNo: number) => downloadResource(id, versionNo),
    onSuccess: (result) => {
      if (result.kind === 'link' && result.url) {
        window.open(result.url, '_blank', 'noopener,noreferrer');
      } else if (result.kind === 'lesson_plan') {
        setLessonPlan(result.lesson_plan);
      }
    },
  });
  const data = detail.data;
  if (!data) {
    return detail.error ? <Alert tone="danger">{messageOf(detail.error)}</Alert> : null;
  }
  const resource = data.resource;
  const editable =
    resource.is_owner && !['pending_unit', 'pending_school', 'retired', 'hidden'].includes(resource.status);
  const error =
    upload.error ??
    addLink.error ??
    submit.error ??
    review.error ??
    lifecycle.error ??
    sendReport.error ??
    download.error;
  return (
    <Section title={`Học liệu ${resource.title}`}>
      <p className="text-content">
        {resource.type_name} · {RESOURCE_VISIBILITY_LABELS[resource.visibility]} ·{' '}
        {LEARNING_RESOURCE_STATUS_LABELS[resource.status]}
        {resource.needs_school_review ? ' · cần Ban Giám hiệu duyệt' : ''} · {data.views} lượt xem, {data.downloads}{' '}
        lượt tải
      </p>
      <p className="text-content text-text-secondary">
        Giấy phép: {resource.license_name ?? 'chưa chọn'}
        {resource.license_source ? ` (${resource.license_source})` : ''} · Người chịu trách nhiệm:{' '}
        {resource.responsible_name ?? resource.owner_name}
        {resource.keywords.length ? ` · Từ khoá: ${resource.keywords.join(', ')}` : ''}
      </p>
      {resource.return_note ? <Alert tone="danger">Bị trả lại: {resource.return_note}</Alert> : null}
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <table className="w-full text-content" aria-label="Phiên bản">
        <thead className={head}>
          <tr>
            <th className={cell}>Phiên bản</th>
            <th className={cell}>Dạng</th>
            <th className={cell}>Nội dung</th>
            <th className={cell} />
          </tr>
        </thead>
        <tbody>
          {data.versions.map((version) => (
            <tr key={version.id} className="border-t border-border">
              <td className={cell}>
                {version.version_no}
                {version.version_no === resource.published_version ? ' (đang công bố)' : ''}
              </td>
              <td className={cell}>{RESOURCE_VERSION_KIND_LABELS[version.kind]}</td>
              <td className={cell}>{version.file_name ?? version.link_title ?? version.url ?? ''}</td>
              <td className={`${cell} text-right`}>
                <Button variant="text" onClick={() => download.mutate(version.version_no)}>
                  {version.kind === 'link' ? 'Mở liên kết' : 'Tải về'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {lessonPlan ? (
        <pre className="whitespace-pre-wrap rounded-lg border border-border p-3 text-content">
          {JSON.stringify(lessonPlan, null, 2)}
        </pre>
      ) : null}
      {editable ? (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Tệp học liệu">
            <input
              type="file"
              className={FORM_CONTROL_CLASS}
              onChange={(event) => setFile(event.target.files?.[0] ?? undefined)}
            />
          </Field>
          <Button disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
            Tải tệp lên
          </Button>
          <Field label="Địa chỉ liên kết">
            <input
              className={FORM_CONTROL_CLASS}
              value={link.url}
              onChange={(event) => setLink({ ...link, url: event.target.value })}
            />
          </Field>
          <Field label="Tiêu đề liên kết">
            <input
              className={FORM_CONTROL_CLASS}
              value={link.title}
              onChange={(event) => setLink({ ...link, title: event.target.value })}
            />
          </Field>
          <Button disabled={!link.url} onClick={() => addLink.mutate()}>
            Thêm liên kết
          </Button>
          <Button variant="primary" disabled={submit.isPending} onClick={() => submit.mutate()}>
            Gửi duyệt
          </Button>
        </div>
      ) : null}
      {resource.can_review ? (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Ý kiến duyệt">
            <input className={FORM_CONTROL_CLASS} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          <Button variant="primary" onClick={() => review.mutate('approve')}>
            Duyệt
          </Button>
          <Button onClick={() => review.mutate('return')}>Trả lại</Button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {(resource.is_owner || canManage) && resource.status !== 'retired' ? (
          <Button variant="text" onClick={() => lifecycle.mutate('retire')}>
            Ngừng dùng
          </Button>
        ) : null}
        {canManage && resource.status !== 'hidden' && resource.status !== 'retired' ? (
          <Button variant="text" onClick={() => lifecycle.mutate('hide')}>
            Ẩn tạm
          </Button>
        ) : null}
        {canManage && resource.status === 'hidden' ? (
          <Button variant="text" onClick={() => lifecycle.mutate('restore')}>
            Mở lại
          </Button>
        ) : null}
      </div>
      {data.events.length > 0 ? (
        <ul className="list-disc pl-6 text-content" aria-label="Lịch sử duyệt">
          {data.events.map((event, index) => (
            <li key={index}>
              {new Date(event.created_at).toLocaleString('vi-VN')}: {event.actor_name} – {event.action}
              {event.note ? ` (${event.note})` : ''}
            </li>
          ))}
        </ul>
      ) : null}
      {!resource.is_owner ? (
        <form
          aria-label="Báo lỗi học liệu"
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            sendReport.mutate();
          }}
        >
          <Field label="Loại lỗi">
            <select
              aria-label="Loại lỗi"
              className={FORM_CONTROL_CLASS}
              value={report.kind}
              onChange={(event) => setReport({ ...report, kind: event.target.value as LearningResourceReportKind })}
            >
              {(Object.keys(LEARNING_RESOURCE_REPORT_KIND_LABELS) as LearningResourceReportKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {LEARNING_RESOURCE_REPORT_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mô tả lỗi">
            <input
              className={FORM_CONTROL_CLASS}
              value={report.description}
              onChange={(event) => setReport({ ...report, description: event.target.value })}
            />
          </Field>
          <Button type="submit" disabled={!report.description}>
            Gửi báo lỗi
          </Button>
        </form>
      ) : null}
    </Section>
  );
}

// ---- 1. Tìm học liệu ----

export function ResourceSearchPage() {
  const { toast, setToast, close } = useToast();
  const catalog = useCatalog();
  const [filter, setFilter] = useState({ q: '', type_id: '', school_level: '', subject_code: '' });
  const [applied, setApplied] = useState(filter);
  const [opened, setOpened] = useState<string>();
  const results = useQuery({ queryKey: ['resources', 'search', applied], queryFn: () => searchResources(applied) });
  return (
    <Page path="/learning-resources" toast={toast} onToastClose={close}>
      <form
        className="flex flex-wrap items-end gap-3"
        aria-label="Tìm học liệu"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied(filter);
        }}
      >
        <Field label="Từ khoá">
          <input
            className={FORM_CONTROL_CLASS}
            value={filter.q}
            onChange={(event) => setFilter({ ...filter, q: event.target.value })}
          />
        </Field>
        <Field label="Loại học liệu">
          <select
            aria-label="Loại học liệu"
            className={FORM_CONTROL_CLASS}
            value={filter.type_id}
            onChange={(event) => setFilter({ ...filter, type_id: event.target.value })}
          >
            <option value="">Mọi loại</option>
            {(catalog.data?.types ?? []).map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cấp học">
          <select
            aria-label="Cấp học"
            className={FORM_CONTROL_CLASS}
            value={filter.school_level}
            onChange={(event) => setFilter({ ...filter, school_level: event.target.value })}
          >
            <option value="">Mọi cấp</option>
            {LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Môn học">
          <select
            aria-label="Môn học"
            className={FORM_CONTROL_CLASS}
            value={filter.subject_code}
            onChange={(event) => setFilter({ ...filter, subject_code: event.target.value })}
          >
            <option value="">Mọi môn</option>
            {(catalog.data?.subjects ?? []).map((subject) => (
              <option key={subject.code} value={subject.code}>
                {subject.name} ({subject.school_level})
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" variant="primary">
          Tìm
        </Button>
      </form>
      {results.error ? <Alert tone="danger">{messageOf(results.error)}</Alert> : null}
      <ResourceTable label="Kết quả tìm học liệu" rows={results.data ?? []} onOpen={setOpened} />
      {opened ? <ResourceDetailPanel key={opened} id={opened} onMessage={setToast} /> : null}
    </Page>
  );
}

// ---- 2. Học liệu của tôi ----

const EMPTY: ResourceInput = {
  title: '',
  description: null,
  type_id: '',
  school_level: null,
  grade_level_code: null,
  subject_code: null,
  topic_id: null,
  week_no: null,
  keywords: [],
  author_name: null,
  license_id: null,
  license_source: null,
  origin: null,
  responsible_name: null,
  visibility: 'school',
};

function ResourceForm({ onCreated }: { onCreated(id: string, message: string): void }) {
  const queryClient = useQueryClient();
  const catalog = useCatalog();
  const [form, setForm] = useState<ResourceInput>(EMPTY);
  const [keywords, setKeywords] = useState('');
  const create = useMutation({
    mutationFn: () =>
      createResource({
        ...form,
        keywords: keywords
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      }),
    onSuccess: async (resource) => {
      setForm(EMPTY);
      setKeywords('');
      await queryClient.invalidateQueries({ queryKey: ['resources'] });
      onCreated(resource.id, `Đã tạo học liệu ${resource.title}`);
    },
  });
  const text = (key: keyof ResourceInput) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value || null });
  const license = catalog.data?.licenses.find((item) => item.id === form.license_id);
  return (
    <form
      aria-label="Thêm học liệu"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Tiêu đề">
          <input
            className={FORM_CONTROL_CLASS}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </Field>
        <Field label="Loại học liệu">
          <select
            aria-label="Loại học liệu"
            className={FORM_CONTROL_CLASS}
            value={form.type_id}
            onChange={(event) => setForm({ ...form, type_id: event.target.value })}
          >
            <option value="">Chọn loại</option>
            {(catalog.data?.types ?? [])
              .filter((type) => type.status === 'active')
              .map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Phạm vi xem">
          <select
            aria-label="Phạm vi xem"
            className={FORM_CONTROL_CLASS}
            value={form.visibility}
            onChange={(event) => setForm({ ...form, visibility: event.target.value as ResourceVisibility })}
          >
            {ENABLED_RESOURCE_VISIBILITIES.map((visibility) => (
              <option key={visibility} value={visibility}>
                {RESOURCE_VISIBILITY_LABELS[visibility]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cấp học">
          <select
            aria-label="Cấp học"
            className={FORM_CONTROL_CLASS}
            value={form.school_level ?? ''}
            onChange={text('school_level')}
          >
            <option value="">Không ghi</option>
            {LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Khối">
          <select
            aria-label="Khối"
            className={FORM_CONTROL_CLASS}
            value={form.grade_level_code ?? ''}
            onChange={text('grade_level_code')}
          >
            <option value="">Không ghi</option>
            {(catalog.data?.grades ?? [])
              .filter((grade) => !form.school_level || grade.school_level === form.school_level)
              .map((grade) => (
                <option key={grade.code} value={grade.code}>
                  {grade.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Môn học">
          <select
            aria-label="Môn học"
            className={FORM_CONTROL_CLASS}
            value={form.subject_code ?? ''}
            onChange={text('subject_code')}
          >
            <option value="">Không ghi</option>
            {(catalog.data?.subjects ?? [])
              .filter((subject) => !form.school_level || subject.school_level === form.school_level)
              .map((subject) => (
                <option key={subject.code} value={subject.code}>
                  {subject.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Chủ đề">
          <select
            aria-label="Chủ đề"
            className={FORM_CONTROL_CLASS}
            value={form.topic_id ?? ''}
            onChange={text('topic_id')}
          >
            <option value="">Không ghi</option>
            {(catalog.data?.topics ?? [])
              .filter((topic) => topic.status === 'active')
              .map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Từ khoá (cách nhau dấu phẩy)">
          <input
            className={FORM_CONTROL_CLASS}
            value={keywords}
            onChange={(event) => setKeywords(event.target.value)}
          />
        </Field>
        <Field label="Tác giả">
          <input className={FORM_CONTROL_CLASS} value={form.author_name ?? ''} onChange={text('author_name')} />
        </Field>
        <Field label="Giấy phép">
          <select
            aria-label="Giấy phép"
            className={FORM_CONTROL_CLASS}
            value={form.license_id ?? ''}
            onChange={text('license_id')}
          >
            <option value="">Chọn giấy phép</option>
            {(catalog.data?.licenses ?? [])
              .filter((item) => item.status === 'active')
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </Field>
        {license?.requires_grant_source ? (
          <Field label="Nơi cấp phép">
            <input className={FORM_CONTROL_CLASS} value={form.license_source ?? ''} onChange={text('license_source')} />
          </Field>
        ) : null}
        <Field label="Nguồn gốc">
          <input className={FORM_CONTROL_CLASS} value={form.origin ?? ''} onChange={text('origin')} />
        </Field>
      </div>
      {license?.private_only ? (
        <Alert tone="info">Học liệu không rõ giấy phép chỉ xem cá nhân, không công bố được.</Alert>
      ) : null}
      <div>
        <Button type="submit" variant="primary" disabled={create.isPending}>
          Tạo học liệu
        </Button>
      </div>
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
    </form>
  );
}

export function MyResourcesPage() {
  const { toast, setToast, close } = useToast();
  const [opened, setOpened] = useState<string>();
  const mine = useQuery({ queryKey: ['resources', 'mine'], queryFn: () => searchResources({ scope: 'mine' }) });
  return (
    <Page path="/learning-resources/mine" toast={toast} onToastClose={close}>
      <ResourceTable label="Học liệu của tôi" rows={mine.data ?? []} onOpen={setOpened} />
      {opened ? <ResourceDetailPanel key={opened} id={opened} onMessage={setToast} /> : null}
      <Section title="Thêm học liệu">
        <ResourceForm
          onCreated={(id, message) => {
            setToast(message);
            setOpened(id);
          }}
        />
      </Section>
    </Page>
  );
}

// ---- 3. Duyệt học liệu ----

export function ResourceReviewPage() {
  const { toast, setToast, close } = useToast();
  const [opened, setOpened] = useState<string>();
  const pending = useQuery({ queryKey: ['resources', 'review'], queryFn: () => searchResources({ scope: 'review' }) });
  return (
    <Page path="/learning-resources/review" toast={toast} onToastClose={close}>
      {pending.data && pending.data.length === 0 ? (
        <p className="text-content text-text-secondary">Không có học liệu chờ bạn duyệt.</p>
      ) : null}
      <ResourceTable label="Học liệu chờ duyệt" rows={pending.data ?? []} onOpen={setOpened} />
      {opened ? <ResourceDetailPanel key={opened} id={opened} onMessage={setToast} /> : null}
    </Page>
  );
}

// ---- 4. Bộ sưu tập ----

export function CollectionsPage() {
  const queryClient = useQueryClient();
  const { toast, setToast, close } = useToast();
  const [opened, setOpened] = useState<string>();
  const [form, setForm] = useState({ name: '', visibility: 'private' });
  const [adding, setAdding] = useState('');
  const collections = useQuery({ queryKey: ['resource-collections'], queryFn: listCollections });
  const detail = useQuery({
    queryKey: ['resource-collection', opened],
    queryFn: () => readCollection(opened ?? ''),
    enabled: Boolean(opened),
  });
  const available = useQuery({ queryKey: ['resources', 'search', {}], queryFn: () => searchResources({}) });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['resource-collections'] });
    await queryClient.invalidateQueries({ queryKey: ['resource-collection'] });
    setToast(message);
  };
  const create = useMutation({
    mutationFn: () => createCollection(form),
    onSuccess: (collection) => {
      setForm({ name: '', visibility: 'private' });
      setOpened(collection.id);
      return refresh(`Đã lập bộ sưu tập ${collection.name}`);
    },
  });
  const items = detail.data?.items ?? [];
  const setItems = useMutation({
    mutationFn: (ids: string[]) => setCollectionItems(opened ?? '', ids),
    onSuccess: () => refresh('Đã cập nhật bộ sưu tập'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteCollection(id),
    onSuccess: () => {
      setOpened(undefined);
      return refresh('Đã xoá bộ sưu tập');
    },
  });
  const move = (index: number, offset: number) => {
    const ids = items.map((item) => item.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + offset, 0, moved as string);
    setItems.mutate(ids);
  };
  const error = create.error ?? setItems.error ?? remove.error;
  return (
    <Page path="/learning-resources/collections" toast={toast} onToastClose={close}>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <table className="w-full text-content" aria-label="Danh sách bộ sưu tập">
        <thead className={head}>
          <tr>
            <th className={cell}>Tên</th>
            <th className={cell}>Người lập</th>
            <th className={cell}>Phạm vi</th>
            <th className={cell}>Số học liệu</th>
            <th className={cell} />
          </tr>
        </thead>
        <tbody>
          {(collections.data ?? []).map((collection) => (
            <tr key={collection.id} className="border-t border-border">
              <td className={cell}>{collection.name}</td>
              <td className={cell}>{collection.owner_name}</td>
              <td className={cell}>{RESOURCE_VISIBILITY_LABELS[collection.visibility]}</td>
              <td className={cell}>{collection.items}</td>
              <td className={`${cell} text-right`}>
                <Button variant="text" onClick={() => setOpened(collection.id)}>
                  Mở
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {detail.data ? (
        <Section title={`Bộ sưu tập ${detail.data.collection.name}`}>
          <ol className="flex flex-col gap-1 text-content" aria-label="Học liệu trong bộ sưu tập">
            {items.map((item, index) => (
              <li key={item.id} className="flex items-center gap-2">
                <span className="flex-1">
                  {index + 1}. {item.title} ({item.type_name})
                </span>
                {detail.data.collection.is_owner ? (
                  <>
                    <Button variant="text" disabled={index === 0} onClick={() => move(index, -1)}>
                      Lên
                    </Button>
                    <Button variant="text" disabled={index === items.length - 1} onClick={() => move(index, 1)}>
                      Xuống
                    </Button>
                    <Button
                      variant="text"
                      onClick={() =>
                        setItems.mutate(items.filter((other) => other.id !== item.id).map((other) => other.id))
                      }
                    >
                      Bỏ
                    </Button>
                  </>
                ) : null}
              </li>
            ))}
          </ol>
          {detail.data.collection.is_owner ? (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Thêm học liệu">
                <select
                  aria-label="Thêm học liệu"
                  className={FORM_CONTROL_CLASS}
                  value={adding}
                  onChange={(event) => setAdding(event.target.value)}
                >
                  <option value="">Chọn học liệu</option>
                  {(available.data ?? [])
                    .filter((resource) => !items.some((item) => item.id === resource.id))
                    .map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.title}
                      </option>
                    ))}
                </select>
              </Field>
              <Button
                disabled={!adding}
                onClick={() => {
                  setItems.mutate([...items.map((item) => item.id), adding]);
                  setAdding('');
                }}
              >
                Thêm vào bộ sưu tập
              </Button>
              <Button variant="text" onClick={() => remove.mutate(detail.data.collection.id)}>
                Xoá bộ sưu tập
              </Button>
            </div>
          ) : null}
          <div>
            <Button onClick={() => void exportCollection(detail.data.collection.id)}>Xuất danh sách</Button>
          </div>
        </Section>
      ) : null}
      <Section title="Lập bộ sưu tập">
        <form
          aria-label="Lập bộ sưu tập"
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <Field label="Tên bộ sưu tập">
            <input
              className={FORM_CONTROL_CLASS}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <Field label="Phạm vi chia sẻ">
            <select
              aria-label="Phạm vi chia sẻ"
              className={FORM_CONTROL_CLASS}
              value={form.visibility}
              onChange={(event) => setForm({ ...form, visibility: event.target.value })}
            >
              {ENABLED_RESOURCE_VISIBILITIES.map((visibility) => (
                <option key={visibility} value={visibility}>
                  {RESOURCE_VISIBILITY_LABELS[visibility]}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" variant="primary">
            Lập bộ sưu tập
          </Button>
        </form>
      </Section>
    </Page>
  );
}

// ---- 5. Báo lỗi học liệu ----

export function ResourceReportsPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.learningResourceManage);
  const { toast, setToast, close } = useToast();
  const [handling, setHandling] = useState<{ id: string; response: string; hide: boolean }>();
  const reports = useQuery({ queryKey: ['resource-reports'], queryFn: listResourceReports });
  const handle = useMutation({
    mutationFn: (status: 'resolved' | 'rejected') =>
      handleResourceReport(handling?.id ?? '', {
        status,
        response: handling?.response ?? '',
        hide: handling?.hide ?? false,
      }),
    onSuccess: async () => {
      setHandling(undefined);
      await queryClient.invalidateQueries({ queryKey: ['resource-reports'] });
      setToast('Đã xử lý báo lỗi');
    },
  });
  return (
    <Page path="/learning-resources/reports" toast={toast} onToastClose={close}>
      {(reports.error ?? handle.error) ? <Alert tone="danger">{messageOf(reports.error ?? handle.error)}</Alert> : null}
      <table className="w-full text-content" aria-label="Báo lỗi học liệu">
        <thead className={head}>
          <tr>
            <th className={cell}>Học liệu</th>
            <th className={cell}>Loại lỗi</th>
            <th className={cell}>Mô tả</th>
            <th className={cell}>Người báo</th>
            <th className={cell}>Trạng thái</th>
            <th className={cell}>Trả lời</th>
            <th className={cell} />
          </tr>
        </thead>
        <tbody>
          {(reports.data ?? []).map((report) => (
            <tr key={report.id} className="border-t border-border">
              <td className={cell}>{report.resource_title}</td>
              <td className={cell}>{LEARNING_RESOURCE_REPORT_KIND_LABELS[report.kind]}</td>
              <td className={cell}>{report.description}</td>
              <td className={cell}>{report.reporter_name}</td>
              <td className={cell}>
                {report.status === 'open' ? 'Chờ xử lý' : report.status === 'resolved' ? 'Đã xử lý' : 'Không chấp nhận'}
              </td>
              <td className={cell}>{report.response ?? ''}</td>
              <td className={`${cell} text-right`}>
                {canManage && report.status === 'open' ? (
                  <Button variant="text" onClick={() => setHandling({ id: report.id, response: '', hide: false })}>
                    Xử lý
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {handling ? (
        <Section title="Xử lý báo lỗi">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Trả lời người báo">
              <input
                className={FORM_CONTROL_CLASS}
                value={handling.response}
                onChange={(event) => setHandling({ ...handling, response: event.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 text-content">
              <input
                type="checkbox"
                checked={handling.hide}
                onChange={(event) => setHandling({ ...handling, hide: event.target.checked })}
              />
              Ẩn tạm học liệu
            </label>
            <Button variant="primary" onClick={() => handle.mutate('resolved')}>
              Đã xử lý
            </Button>
            <Button onClick={() => handle.mutate('rejected')}>Không chấp nhận</Button>
          </div>
        </Section>
      ) : null}
    </Page>
  );
}

// ---- 6. Thống kê kho ----

function CountTable({ title, rows }: { title: string; rows: Array<{ label: string; total: number }> }) {
  return (
    <table className="text-content" aria-label={title}>
      <thead className={head}>
        <tr>
          <th className={cell}>{title}</th>
          <th className={cell}>Số học liệu</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-t border-border">
            <td className={cell}>{row.label}</td>
            <td className={cell}>{row.total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ResourceStatisticsPage() {
  const statistics = useQuery({ queryKey: ['resource-statistics'], queryFn: readResourceStatistics });
  const data = statistics.data;
  return (
    <Page path="/learning-resources/statistics">
      {statistics.error ? <Alert tone="danger">{messageOf(statistics.error)}</Alert> : null}
      {data ? (
        <>
          <p className="text-content" aria-label="Tổng quan kho">
            Tổng {data.total} học liệu; đã công bố {data.published}; chờ duyệt {data.pending} (quá hạn {data.overdue});
            giấy phép sắp hết hiệu lực {data.license_expiring.length}
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <CountTable title="Theo môn" rows={data.by_subject} />
            <CountTable title="Theo khối" rows={data.by_grade} />
            <CountTable title="Theo loại" rows={data.by_type} />
            <CountTable title="Theo giấy phép" rows={data.by_license} />
            <CountTable title="Theo tổ" rows={data.by_department} />
            <CountTable title="Đóng góp theo giáo viên" rows={data.contributors} />
          </div>
          <table className="w-full text-content" aria-label="Lượt xem, tải">
            <thead className={head}>
              <tr>
                <th className={cell}>Học liệu</th>
                <th className={cell}>Lượt xem</th>
                <th className={cell}>Lượt tải</th>
                <th className={cell}>Báo lỗi</th>
              </tr>
            </thead>
            <tbody>
              {data.top.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className={cell}>{row.title}</td>
                  <td className={cell}>{row.views}</td>
                  <td className={cell}>{row.downloads}</td>
                  <td className={cell}>{row.reports}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </Page>
  );
}

// ---- 7. Danh mục kho ----

export function ResourceSettingsPage() {
  const queryClient = useQueryClient();
  const { toast, setToast, close } = useToast();
  const catalog = useCatalog();
  const [license, setLicense] = useState({ code: '', name: '', blocked: false });
  const [topic, setTopic] = useState({ name: '', subject_code: '', grade_level_code: '' });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['resource-catalog'] });
    setToast(message);
  };
  const toggleType = useMutation({
    mutationFn: (input: { id: string; requires_school_review: boolean }) =>
      saveResourceType(input.id, { requires_school_review: input.requires_school_review }),
    onSuccess: () => refresh('Đã ghi loại học liệu'),
  });
  const toggleLicense = useMutation({
    mutationFn: (input: { id: string; blocked: boolean }) => saveResourceLicense(input.id, { blocked: input.blocked }),
    onSuccess: () => refresh('Đã ghi giấy phép'),
  });
  const addLicense = useMutation({
    mutationFn: () => saveResourceLicense(null, license),
    onSuccess: () => {
      setLicense({ code: '', name: '', blocked: false });
      return refresh('Đã thêm giấy phép');
    },
  });
  const addTopic = useMutation({
    mutationFn: () =>
      saveResourceTopic(null, {
        name: topic.name,
        subject_code: topic.subject_code || null,
        grade_level_code: topic.grade_level_code || null,
      }),
    onSuccess: () => {
      setTopic({ name: '', subject_code: '', grade_level_code: '' });
      return refresh('Đã thêm chủ đề');
    },
  });
  const error = catalog.error ?? toggleType.error ?? toggleLicense.error ?? addLicense.error ?? addTopic.error;
  return (
    <Page path="/learning-resources/settings" toast={toast} onToastClose={close}>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <Section title="Loại học liệu">
        <table className="w-full text-content" aria-label="Loại học liệu">
          <tbody>
            {(catalog.data?.types ?? []).map((type) => (
              <tr key={type.id} className="border-t border-border">
                <td className={cell}>{type.name}</td>
                <td className={cell}>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={type.requires_school_review}
                      onChange={(event) =>
                        toggleType.mutate({ id: type.id, requires_school_review: event.target.checked })
                      }
                    />
                    Thêm bước Ban Giám hiệu duyệt
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section title="Giấy phép">
        <table className="w-full text-content" aria-label="Giấy phép">
          <tbody>
            {(catalog.data?.licenses ?? []).map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className={cell}>{item.code}</td>
                <td className={cell}>{item.name}</td>
                <td className={cell}>
                  {item.private_only ? 'Chỉ xem cá nhân' : item.requires_grant_source ? 'Ghi nơi cấp phép' : ''}
                </td>
                <td className={cell}>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.blocked}
                      onChange={(event) => toggleLicense.mutate({ id: item.id, blocked: event.target.checked })}
                    />
                    Chặn công bố
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form
          aria-label="Thêm giấy phép"
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            addLicense.mutate();
          }}
        >
          <Field label="Mã giấy phép">
            <input
              className={FORM_CONTROL_CLASS}
              value={license.code}
              onChange={(event) => setLicense({ ...license, code: event.target.value })}
            />
          </Field>
          <Field label="Tên giấy phép">
            <input
              className={FORM_CONTROL_CLASS}
              value={license.name}
              onChange={(event) => setLicense({ ...license, name: event.target.value })}
            />
          </Field>
          <Button type="submit" variant="primary">
            Thêm giấy phép
          </Button>
        </form>
      </Section>
      <Section title="Chủ đề">
        <ul className="list-disc pl-6 text-content">
          {(catalog.data?.topics ?? []).map((item) => (
            <li key={item.id}>
              {item.name}
              {item.subject_code ? ` · ${item.subject_code}` : ''}
              {item.grade_level_code ? ` · ${item.grade_level_code}` : ''}
            </li>
          ))}
        </ul>
        <form
          aria-label="Thêm chủ đề"
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            addTopic.mutate();
          }}
        >
          <Field label="Tên chủ đề">
            <input
              className={FORM_CONTROL_CLASS}
              value={topic.name}
              onChange={(event) => setTopic({ ...topic, name: event.target.value })}
            />
          </Field>
          <Field label="Mã môn">
            <input
              className={FORM_CONTROL_CLASS}
              value={topic.subject_code}
              onChange={(event) => setTopic({ ...topic, subject_code: event.target.value })}
            />
          </Field>
          <Field label="Mã khối">
            <input
              className={FORM_CONTROL_CLASS}
              value={topic.grade_level_code}
              onChange={(event) => setTopic({ ...topic, grade_level_code: event.target.value })}
            />
          </Field>
          <Button type="submit" variant="primary">
            Thêm chủ đề
          </Button>
        </form>
      </Section>
    </Page>
  );
}
