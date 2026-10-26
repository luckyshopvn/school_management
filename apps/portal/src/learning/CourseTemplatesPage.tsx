import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import {
  applyTemplate,
  createTemplate,
  listSpaces,
  listTemplates,
  readLearningConfig,
  reviewTemplate,
  saveTemplate,
  submitTemplate,
  TEMPLATE_STATUS_LABELS,
  type CourseTemplate,
  type TemplateContent,
} from './learning-api.js';

// 9.2 Khoá học mẫu (DT-28 phần 28b, YCTD-272): tổ chuyên môn soạn khoá mẫu một lần cho cả khối (chương, hoạt động trang nội
// dung, liên kết, học liệu), gửi duyệt theo Thông tư 09/2021/TT-BGDĐT Điều 7 khoản 3 (tổ trưởng thông qua, Ban Giám hiệu
// phê duyệt), rồi giáo viên đẩy bản đã duyệt xuống lớp học trực tuyến của mình
const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

const slug = (value: string, fallback: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 30) || fallback;

function TemplateEditor({ template, onSaved }: { template: CourseTemplate; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const content: TemplateContent = template.content ?? { sections: [] };
  const [sectionTitle, setSectionTitle] = useState('');
  const [itemSection, setItemSection] = useState(content.sections[0]?.key ?? '');
  const [itemTitle, setItemTitle] = useState('');
  const [itemBody, setItemBody] = useState('');
  const save = useMutation({
    mutationFn: (next: TemplateContent) => saveTemplate(template.id, { content: next }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['course-templates'] });
      onSaved('Đã lưu khoá mẫu');
    },
  });
  const addSection = () => {
    const key = `${slug(sectionTitle, 'chuong')}-${content.sections.length + 1}`;
    save.mutate({ sections: [...content.sections, { key, title: sectionTitle, planned_week: null, items: [] }] });
    setSectionTitle('');
    setItemSection(key);
  };
  const addItem = () => {
    const count = content.sections.reduce((sum, section) => sum + section.items.length, 0);
    const key = `${slug(itemTitle, 'hoat-dong')}-${count + 1}`;
    save.mutate({
      sections: content.sections.map((section) =>
        section.key === itemSection
          ? {
              ...section,
              items: [...section.items, { key, kind: 'page', title: itemTitle, settings: { body: itemBody } }],
            }
          : section,
      ),
    });
    setItemTitle('');
    setItemBody('');
  };
  return (
    <div className="flex flex-col gap-3 rounded border border-border p-3">
      {content.sections.map((section) => (
        <div key={section.key}>
          <h3 className="text-content font-semibold text-text">{section.title}</h3>
          <ul className="list-disc pl-6 text-content text-text">
            {section.items.map((item) => (
              <li key={item.key}>{item.title}</li>
            ))}
          </ul>
        </div>
      ))}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-label font-medium text-text">
          Chương mới của khoá mẫu
          <input
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={sectionTitle}
            onChange={(event) => setSectionTitle(event.target.value)}
          />
        </label>
        <Button disabled={!sectionTitle || save.isPending} onClick={addSection}>
          Thêm chương vào khoá mẫu
        </Button>
      </div>
      {content.sections.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-label font-medium text-text">
            Chương
            <select
              className={`mt-2 block ${FORM_CONTROL_CLASS}`}
              value={itemSection}
              onChange={(event) => setItemSection(event.target.value)}
            >
              {content.sections.map((section) => (
                <option key={section.key} value={section.key}>
                  {section.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-label font-medium text-text">
            Tên trang nội dung
            <input
              className={`mt-2 block ${FORM_CONTROL_CLASS}`}
              value={itemTitle}
              onChange={(event) => setItemTitle(event.target.value)}
            />
          </label>
          <label className="text-label font-medium text-text">
            Nội dung
            <input
              className={`mt-2 block ${FORM_CONTROL_CLASS}`}
              value={itemBody}
              onChange={(event) => setItemBody(event.target.value)}
            />
          </label>
          <Button disabled={!itemTitle || !itemBody || save.isPending} onClick={addItem}>
            Thêm trang vào khoá mẫu
          </Button>
        </div>
      ) : null}
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
    </div>
  );
}

function ApplyPanel({ template, onApplied }: { template: CourseTemplate; onApplied(message: string): void }) {
  const spaces = useQuery({ queryKey: ['learning-spaces', 'mine'], queryFn: () => listSpaces('mine') });
  const [chosen, setChosen] = useState<string[]>([]);
  const apply = useMutation({
    mutationFn: () => applyTemplate(template.id, chosen),
    onSuccess: (result) => {
      setChosen([]);
      const created = result.spaces.reduce((sum, space) => sum + space.created, 0);
      const kept = result.spaces.reduce((sum, space) => sum + space.kept_local, 0);
      onApplied(
        `Đã đẩy khoá mẫu xuống ${result.spaces.length} lớp: thêm ${created} hoạt động, giữ ${kept} hoạt động giáo viên đã sửa`,
      );
    },
  });
  const matching = (spaces.data ?? []).filter((space) => space.school_level === template.school_level);
  return (
    <fieldset className="flex flex-col gap-2 rounded border border-border p-3">
      <legend className="text-label font-medium text-text">Đẩy xuống lớp học trực tuyến của tôi</legend>
      {matching.map((space) => (
        <label key={space.id} className="flex items-center gap-2 text-content text-text">
          <input
            type="checkbox"
            checked={chosen.includes(space.id)}
            onChange={(event) =>
              setChosen(event.target.checked ? [...chosen, space.id] : chosen.filter((id) => id !== space.id))
            }
          />
          {space.title}
        </label>
      ))}
      {matching.length === 0 ? <p className="text-content text-text-secondary">Không có lớp cùng cấp học.</p> : null}
      <div>
        <Button disabled={chosen.length === 0 || apply.isPending} onClick={() => apply.mutate()}>
          Đẩy khoá mẫu xuống lớp
        </Button>
      </div>
      {apply.error ? <Alert tone="danger">{messageOf(apply.error)}</Alert> : null}
    </fieldset>
  );
}

function TemplateCard({ template, onChanged }: { template: CourseTemplate; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['course-templates'] });
  const submit = useMutation({
    mutationFn: () => submitTemplate(template.id),
    onSuccess: async () => {
      await refresh();
      onChanged('Đã gửi khoá mẫu cho tổ duyệt');
    },
  });
  const review = useMutation({
    mutationFn: (decision: 'approve' | 'return') => reviewTemplate(template.id, { decision, note: note || undefined }),
    onSuccess: async (row) => {
      await refresh();
      onChanged(`Khoá mẫu: ${TEMPLATE_STATUS_LABELS[row.status]}`);
    },
  });
  const error = submit.error ?? review.error;
  return (
    <li className="flex flex-col gap-2 border-t border-border py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-text">{template.title}</span>
        <StatusBadge
          tone={template.status === 'published' ? 'success' : 'neutral'}
          label={TEMPLATE_STATUS_LABELS[template.status]}
        />
        <span className="text-label text-text-secondary">
          {template.school_level}
          {template.subject_name ? ` · ${template.subject_name}` : ''} · {template.owner_name} · phiên bản{' '}
          {template.version}
        </span>
        <Button variant="text" onClick={() => setOpen(!open)}>
          {open ? 'Đóng' : 'Mở'}
        </Button>
      </div>
      {template.return_reason && template.status === 'returned' ? (
        <Alert tone="warning">Lý do trả lại: {template.return_reason}</Alert>
      ) : null}
      {open ? (
        <div className="flex flex-col gap-3">
          {template.can_edit ? <TemplateEditor template={template} onSaved={onChanged} /> : null}
          {template.can_edit && (template.status === 'draft' || template.status === 'returned') ? (
            <div>
              <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
                Gửi duyệt
              </Button>
            </div>
          ) : null}
          {template.can_review ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-label font-medium text-text">
                Ghi chú duyệt
                <input
                  className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
              <Button onClick={() => review.mutate('approve')} disabled={review.isPending}>
                Duyệt
              </Button>
              <Button variant="secondary" onClick={() => review.mutate('return')} disabled={review.isPending || !note}>
                Trả lại
              </Button>
            </div>
          ) : null}
          {template.published_version !== null ? <ApplyPanel template={template} onApplied={onChanged} /> : null}
        </div>
      ) : null}
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
    </li>
  );
}

export function CourseTemplatesPage() {
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: ['learning-config'], queryFn: readLearningConfig });
  const templates = useQuery({ queryKey: ['course-templates'], queryFn: listTemplates });
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState('THCS');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const create = useMutation({
    mutationFn: () => createTemplate({ title, school_level: level, content: { sections: [] } }),
    onSuccess: async () => {
      setTitle('');
      await queryClient.invalidateQueries({ queryKey: ['course-templates'] });
      setToastMessage('Đã tạo khoá mẫu nháp');
    },
  });
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/course-templates')}</h1>
        <p className="text-content text-text-secondary">
          Khoá mẫu phải được tổ chuyên môn thông qua và Ban Giám hiệu phê duyệt trước khi dùng (Thông tư
          09/2021/TT-BGDĐT Điều 7 khoản 3). Đẩy xuống lớp chỉ thêm và cập nhật, không ghi đè hoạt động giáo viên đã sửa.
        </p>
        {templates.error ? <Alert tone="danger">{messageOf(templates.error)}</Alert> : null}
        <ul aria-label="Khoá học mẫu">
          {(templates.data ?? []).map((template) => (
            <TemplateCard key={template.id} template={template} onChanged={setToastMessage} />
          ))}
        </ul>
        {templates.data && templates.data.length === 0 ? (
          <p className="text-content text-text-secondary">Chưa có khoá mẫu.</p>
        ) : null}
        {config.data?.can_template ? (
          <form
            aria-label="Tạo khoá mẫu"
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <label className="text-label font-medium text-text">
              Tên khoá mẫu
              <input
                className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="text-label font-medium text-text">
              Cấp học của khoá mẫu
              <select
                className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                value={level}
                onChange={(event) => setLevel(event.target.value)}
              >
                <option value="TH">Tiểu học</option>
                <option value="THCS">THCS</option>
                <option value="THPT">THPT</option>
              </select>
            </label>
            <Button type="submit" disabled={!title || create.isPending}>
              Tạo khoá mẫu
            </Button>
            {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
          </form>
        ) : null}
      </div>
    </AppShell>
  );
}
