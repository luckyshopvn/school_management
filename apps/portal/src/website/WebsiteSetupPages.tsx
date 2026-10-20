import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { WEBSITE_DOMAIN_KIND_LABELS, WEBSITE_SCHOOL_LEVELS, type WebsiteDomainKind } from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  StatusBadge,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { fieldErrorsOf, messageOf } from '../archives/archive-ui.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import {
  addDomain,
  confirmDomainDns,
  createSampleContent,
  deleteDomain,
  deleteSampleContent,
  listDomains,
  readSettings,
  removeSettingsImage,
  saveSettings,
  updateDomain,
  uploadSettingsImage,
  type WebsiteDomain,
  type WebsiteSettings,
  type WebsiteSettingsInput,
} from './website-api.js';
import { AdminImage, formatDateTime } from './WebsiteCommon.js';

// 1.1 Thông tin website và 1.2 Tên miền của website trường (DT-18 phần 18f, YCTD-144). Tên miền lưu ở cơ sở dữ liệu; trỏ
// tên miền về máy chủ là việc làm tay của quản trị, hệ thống ghi trạng thái "đã trỏ" do người dùng đánh dấu
type TextKey =
  | 'site_name'
  | 'slogan'
  | 'introduction'
  | 'address'
  | 'phone'
  | 'email'
  | 'map_url'
  | 'office_hours'
  | 'facebook_url'
  | 'admission_form_url'
  | 'footer_note';

const TEXT_FIELDS: Array<{ key: TextKey; label: string; multiline?: boolean; placeholder?: string }> = [
  { key: 'site_name', label: 'Tên website *' },
  { key: 'slogan', label: 'Khẩu hiệu' },
  { key: 'introduction', label: 'Giới thiệu ngắn ở trang chủ', multiline: true },
  { key: 'address', label: 'Địa chỉ' },
  { key: 'phone', label: 'Điện thoại' },
  { key: 'email', label: 'Thư điện tử' },
  { key: 'office_hours', label: 'Giờ làm việc' },
  { key: 'map_url', label: 'Đường dẫn bản đồ', placeholder: 'https://...' },
  { key: 'facebook_url', label: 'Trang mạng xã hội', placeholder: 'https://...' },
  {
    key: 'admission_form_url',
    label: 'Đường dẫn nộp hồ sơ tuyển sinh',
    placeholder: 'Địa chỉ ứng dụng phụ huynh kèm #tuyen-sinh',
  },
  { key: 'footer_note', label: 'Chân trang', multiline: true },
];

function inputOf(settings: WebsiteSettings): WebsiteSettingsInput {
  return {
    site_name: settings.site_name,
    slogan: settings.slogan,
    introduction: settings.introduction,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    map_url: settings.map_url,
    office_hours: settings.office_hours,
    facebook_url: settings.facebook_url,
    admission_form_url: settings.admission_form_url,
    footer_note: settings.footer_note,
    primary_color: settings.primary_color,
    school_levels: settings.school_levels,
    show_timetable: settings.show_timetable,
    demo_mode: settings.demo_mode,
  };
}

export function WebsiteSettingsPage() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['website-settings'], queryFn: readSettings });
  const [draft, setDraft] = useState<WebsiteSettingsInput>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const action = useMutation({
    mutationFn: async (step: { run(): Promise<WebsiteSettings>; text: string }) => ({
      result: await step.run(),
      text: step.text,
    }),
    onSuccess: ({ result, text }) => {
      queryClient.setQueryData(['website-settings'], result);
      setDraft(undefined);
      setToastMessage(text);
    },
  });
  const errors = fieldErrorsOf(action.error);
  const current = settings.data;
  if (!current) {
    return (
      <AppShell>
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/website/settings')}</h1>
        {settings.error ? <Alert tone="danger">{messageOf(settings.error)}</Alert> : <p>Đang tải…</p>}
      </AppShell>
    );
  }
  const input = draft ?? inputOf(current);
  const change = <Key extends keyof WebsiteSettingsInput>(key: Key, value: WebsiteSettingsInput[Key]) =>
    setDraft({ ...input, [key]: value });
  const image = (purpose: 'logo' | 'banner', label: string) => {
    const fileId = purpose === 'logo' ? current.logo_file_id : current.banner_file_id;
    return (
      <FormRow label={label}>
        <div className="flex flex-wrap items-center gap-3">
          {fileId ? (
            <AdminImage fileId={fileId} alt={label} className="h-16 max-w-48 rounded object-contain" />
          ) : (
            <span className="text-label text-text-secondary">Chưa có</span>
          )}
          <input
            type="file"
            aria-label={`Tải ${label.toLowerCase()}`}
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) {
                action.mutate({ run: () => uploadSettingsImage(purpose, file), text: `Đã tải ${label.toLowerCase()}` });
              }
            }}
          />
          {fileId ? (
            <Button
              variant="text"
              onClick={() =>
                action.mutate({ run: () => removeSettingsImage(purpose), text: `Đã xóa ${label.toLowerCase()}` })
              }
            >
              Xóa ảnh
            </Button>
          ) : null}
        </div>
      </FormRow>
    );
  };
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/website/settings')}</h1>
        {action.error && Object.keys(errors).length === 0 ? (
          <Alert tone="danger">{messageOf(action.error)}</Alert>
        ) : null}
        <FormBlock title="Thông tin hiện trên website">
          {TEXT_FIELDS.map((field) => (
            <FormRow key={field.key} label={field.label} error={errors[field.key]}>
              {field.multiline ? (
                <textarea
                  value={input[field.key] ?? ''}
                  onChange={(event) => change(field.key, event.target.value)}
                  rows={3}
                  className={FORM_CONTROL_CLASS}
                />
              ) : (
                <input
                  value={input[field.key] ?? ''}
                  placeholder={field.placeholder}
                  onChange={(event) => change(field.key, event.target.value)}
                  className={FORM_CONTROL_CLASS}
                />
              )}
            </FormRow>
          ))}
          <FormRow label="Màu chủ đạo" error={errors.primary_color}>
            <input
              type="color"
              value={input.primary_color}
              onChange={(event) => change('primary_color', event.target.value)}
              className="h-10 w-20 rounded border border-border"
            />
          </FormRow>
          <FormRow label="Cấp học của trường" error={errors.school_levels}>
            <div className="flex flex-wrap gap-4">
              {WEBSITE_SCHOOL_LEVELS.map((level) => (
                <label key={level.value} className="flex items-center gap-2 text-content">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={input.school_levels.includes(level.value)}
                    onChange={(event) =>
                      change(
                        'school_levels',
                        event.target.checked
                          ? [...input.school_levels, level.value]
                          : input.school_levels.filter((value) => value !== level.value),
                      )
                    }
                  />
                  {level.label}
                </label>
              ))}
            </div>
          </FormRow>
          <FormRow label="Trang thời khóa biểu">
            <label className="flex items-center gap-2 text-content">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={input.show_timetable}
                onChange={(event) => change('show_timetable', event.target.checked)}
              />
              Hiện mục Thời khóa biểu (trang chờ phân hệ xếp thời khóa biểu)
            </label>
          </FormRow>
          <FormRow label="Chế độ trình diễn">
            <label className="flex items-center gap-2 text-content">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={input.demo_mode}
                onChange={(event) => change('demo_mode', event.target.checked)}
              />
              Bật chế độ trình diễn (hiện dải "Trang trình diễn", không cho máy tìm kiếm lập chỉ mục, hiện nội dung mẫu)
            </label>
          </FormRow>
        </FormBlock>
        <div>
          <Button
            variant="primary"
            disabled={action.isPending}
            onClick={() => action.mutate({ run: () => saveSettings(input), text: 'Đã ghi thông tin website' })}
          >
            Ghi
          </Button>
        </div>
        <FormBlock title="Biểu trưng và ảnh đầu trang">
          {image('logo', 'Biểu trưng')}
          {image('banner', 'Ảnh đầu trang')}
        </FormBlock>
        <FormBlock title="Nội dung mẫu của chế độ trình diễn">
          <p className="text-label text-text-secondary">
            Nội dung mẫu gồm vài tin tức, thông báo có chữ [Mẫu], chỉ hiện trên website khi bật chế độ trình diễn. Hiện
            có {current.sample_count} bài mẫu.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={action.isPending || !current.demo_mode || current.sample_count > 0}
              onClick={() => action.mutate({ run: createSampleContent, text: 'Đã tạo nội dung mẫu' })}
            >
              Tạo nội dung mẫu
            </Button>
            <Button
              variant="danger"
              disabled={action.isPending || current.sample_count === 0}
              onClick={() => action.mutate({ run: deleteSampleContent, text: 'Đã xóa nội dung mẫu' })}
            >
              Xóa nội dung mẫu
            </Button>
          </div>
        </FormBlock>
      </div>
    </AppShell>
  );
}

const DOMAIN_COLUMNS: Array<DataGridColumn<WebsiteDomain>> = [
  {
    id: 'hostname',
    header: 'Tên miền',
    alwaysVisible: true,
    cell: (row) => <span className="font-medium">{row.hostname}</span>,
  },
  { id: 'kind', header: 'Loại', cell: (row) => WEBSITE_DOMAIN_KIND_LABELS[row.kind] },
  {
    id: 'active',
    header: 'Trạng thái',
    cell: (row) =>
      row.active ? <StatusBadge tone="success" label="Đang dùng" /> : <StatusBadge tone="neutral" label="Ngừng dùng" />,
  },
  {
    id: 'dns',
    header: 'Trỏ tên miền',
    cell: (row) =>
      row.dns_confirmed_at
        ? `Đã đánh dấu đã trỏ ${formatDateTime(row.dns_confirmed_at)} (${row.dns_confirmed_by_name ?? ''})`
        : 'Chưa đánh dấu',
  },
  { id: 'note', header: 'Ghi chú', hiddenByDefault: true, cell: (row) => row.note ?? '' },
];

export function WebsiteDomainsPage() {
  const queryClient = useQueryClient();
  const grid = useGridSettings('website-domains');
  const domains = useQuery({ queryKey: ['website-domains'], queryFn: listDomains });
  const [hostname, setHostname] = useState('');
  const [kind, setKind] = useState<WebsiteDomainKind>('primary');
  const [note, setNote] = useState('');
  const [removing, setRemoving] = useState<WebsiteDomain>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const action = useMutation({
    mutationFn: async (step: { run(): Promise<unknown>; text: string }) => {
      await step.run();
      return step.text;
    },
    onSuccess: (text) => {
      void queryClient.invalidateQueries({ queryKey: ['website-domains'] });
      setRemoving(undefined);
      setToastMessage(text);
    },
  });
  const errors = fieldErrorsOf(action.error);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/website/domains')}</h1>
        <section
          aria-label="Hướng dẫn trỏ tên miền"
          className="rounded-xl border border-border bg-card p-4 text-content"
        >
          <h2 className="mb-2 text-section-title font-semibold text-text">Hướng dẫn trỏ tên miền</h2>
          <ol className="list-decimal pl-6">
            <li>Thêm tên miền của trường vào danh sách dưới đây (không ghi http:// và dấu /).</li>
            <li>
              Ở trang quản lý tên miền của nhà cung cấp, tạo bản ghi A (hoặc CNAME) trỏ tên miền về địa chỉ máy chủ của
              hệ thống.
            </li>
            <li>
              Khi bản ghi đã có hiệu lực, bấm "Đánh dấu đã trỏ". Máy chủ web tự xin chứng chỉ HTTPS ở lần truy cập đầu
              tiên và chỉ xin cho tên miền đang dùng trong danh sách này.
            </li>
            <li>
              Tên miền phụ tự chuyển về tên miền chính. Tên miền trình diễn (ví dụ tên miền giả lập .test khi thử trên
              máy) luôn hiện dải "Trang trình diễn".
            </li>
          </ol>
        </section>
        <FormBlock title="Thêm tên miền">
          <FormRow label="Tên miền *" error={errors.hostname}>
            <input
              value={hostname}
              placeholder="truong.edu.vn"
              onChange={(event) => setHostname(event.target.value)}
              className={FORM_CONTROL_CLASS}
            />
          </FormRow>
          <FormRow label="Loại" error={errors.kind}>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as WebsiteDomainKind)}
              className={FORM_CONTROL_CLASS}
            >
              {Object.entries(WEBSITE_DOMAIN_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Ghi chú">
            <input value={note} onChange={(event) => setNote(event.target.value)} className={FORM_CONTROL_CLASS} />
          </FormRow>
          <div>
            <Button
              variant="primary"
              disabled={action.isPending}
              onClick={() =>
                action.mutate({
                  run: async () => {
                    await addDomain({ hostname, kind, note: note || null });
                    setHostname('');
                    setNote('');
                  },
                  text: 'Đã thêm tên miền',
                })
              }
            >
              Thêm tên miền
            </Button>
          </div>
        </FormBlock>
        {action.error && Object.keys(errors).length === 0 ? (
          <Alert tone="danger">{messageOf(action.error)}</Alert>
        ) : null}
        {domains.error ? <Alert tone="danger">{messageOf(domains.error)}</Alert> : null}
        <DataGrid
          label="Danh sách tên miền"
          columns={DOMAIN_COLUMNS}
          rows={domains.data?.items ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.hostname}
          getRowAriaLabel={(row) => `Tên miền ${row.hostname}`}
          loading={!domains.data && !domains.isError}
          emptyText="Chưa có tên miền nào."
          rowActions={(row) => (
            <div className="flex flex-wrap gap-1">
              <Button
                variant="text"
                onClick={() =>
                  action.mutate({
                    run: () => confirmDomainDns(row.id, !row.dns_confirmed_at),
                    text: row.dns_confirmed_at ? 'Đã bỏ đánh dấu đã trỏ' : 'Đã đánh dấu đã trỏ tên miền',
                  })
                }
              >
                {row.dns_confirmed_at ? 'Bỏ đánh dấu đã trỏ' : 'Đánh dấu đã trỏ'}
              </Button>
              <Button
                variant="text"
                onClick={() =>
                  action.mutate({
                    run: () => updateDomain(row.id, { active: !row.active }),
                    text: row.active ? 'Đã ngừng dùng tên miền' : 'Đã dùng lại tên miền',
                  })
                }
              >
                {row.active ? 'Ngừng dùng' : 'Dùng lại'}
              </Button>
              <Button variant="text" onClick={() => setRemoving(row)}>
                Xóa
              </Button>
            </div>
          )}
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
        <ConfirmDeleteDialog
          open={!!removing}
          subject={`tên miền ${removing?.hostname ?? ''}`}
          busy={action.isPending}
          onCancel={() => setRemoving(undefined)}
          onConfirm={() => removing && action.mutate({ run: () => deleteDomain(removing.id), text: 'Đã xóa tên miền' })}
        />
      </div>
    </AppShell>
  );
}
