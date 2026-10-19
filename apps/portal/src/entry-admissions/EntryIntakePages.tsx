import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ADMISSION_DECISION_LABELS,
  ADMISSION_DOCUMENTS,
  ADMISSION_PROGRAM_LABELS,
  ADMISSION_PROGRAM_TYPES,
  ADMISSION_RECORD_TYPES,
  ADVANCED_REVIEW_LABELS,
  ADVANCED_REVIEW_STATUSES,
  FINAL_YEAR_FILE_KIND_LABELS,
  FINAL_YEAR_FILE_KINDS,
  FINAL_YEAR_RESIDENCE_LABELS,
  FINAL_YEAR_RESIDENCE_TYPES,
  PERMISSION_CODES,
  type AdmissionDecision,
  type AdmissionDocument,
  type AdmissionProgramType,
  type AdmissionRecordType,
  type DataGridKey,
  type FinalYearFileKind,
  type PortalQuickLinkPath,
} from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  ConfirmDialog,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormRow,
  StatusBadge,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { SelectBox } from '../facilities/facilities-ui.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import { formatDate, formatDateTime, messageOf, type ImportRowError } from './entry-admissions-api.js';
import {
  arrangeClasses,
  cancelIntake,
  cancelTransferred,
  copyNoticeContent,
  describeResult,
  downloadEvidence,
  downloadIntakeForms,
  downloadNoticeTemplate,
  downloadRoutingTemplate,
  exportIntake,
  importNotices,
  importRouting,
  listIntake,
  listIntakeCampaigns,
  listNoticeRecipients,
  listTransferResults,
  openIntakeFile,
  readIntakeOptions,
  removeIntake,
  removeIntakeFile,
  reviewAdvanced,
  runTransfer,
  saveIntake,
  sendNotice,
  updateIntake,
  updateIntakeCampaign,
  updateTransfers,
  uploadIntakeFile,
  type IntakeCampaign,
  type IntakeFilter,
  type IntakeRow,
  type IntakeScreen,
  type NoticeRecipient,
  type ResultRow,
  type TransferResult,
} from './entry-intake-api.js';

// 1.3 đến 1.7 phân hệ Tuyển sinh đầu cấp và 5.11 phân hệ Mầm non (DT-17 phần 17d, khảo sát mục 10.2.4): bộ lọc, cột, nút như
// Sở. Hồ sơ phân tuyến nhập từ Excel thay kết nối phân tuyến của Sở; thông báo gửi qua ứng dụng phụ huynh và Zalo OA, tin nhắn
// SMS chờ kết nối nhà cung cấp; chuyển hồ sơ tạo hồ sơ học sinh ở năm học nhận trẻ của đợt
const YES_NO = [
  { value: 'yes', label: 'Đã' },
  { value: 'no', label: 'Chưa' },
];
const HAS = [
  { value: 'yes', label: 'Có' },
  { value: 'no', label: 'Không' },
];

type FilterField =
  | { key: string; label: string; type: 'text' | 'date' }
  | { key: string; label: string; type: 'select'; options: ReadonlyArray<{ value: string; label: string }> };

function useToast() {
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  return { toastMessage, setToastMessage, closeToast };
}

function useCampaigns() {
  return useQuery({ queryKey: ['entry-intake', 'campaigns'], queryFn: listIntakeCampaigns });
}

function useOptions() {
  return useQuery({ queryKey: ['entry-intake', 'options'], queryFn: readIntakeOptions });
}

function FilterForm({
  label,
  fields,
  extra,
  draft,
  onChange,
  onSubmit,
  children,
}: {
  label: string;
  fields: FilterField[];
  extra?: FilterField[];
  draft: IntakeFilter;
  onChange(key: string, value: string): void;
  onSubmit(): void;
  children?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const render = (field: FilterField) =>
    field.type === 'select' ? (
      <SelectBox
        key={field.key}
        label={field.label}
        value={draft[field.key] ?? ''}
        emptyLabel="Tất cả"
        options={field.options}
        onChange={(value) => onChange(field.key, value)}
      />
    ) : (
      <label key={field.key} className="flex flex-col gap-2 text-label font-medium text-text">
        {field.label}
        <input
          type={field.type}
          className={FORM_CONTROL_CLASS}
          value={draft[field.key] ?? ''}
          onChange={(event) => onChange(field.key, event.target.value)}
        />
      </label>
    );
  return (
    <form
      className="grid grid-cols-1 gap-4 md:grid-cols-4"
      aria-label={label}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {children}
      {fields.map(render)}
      {expanded ? extra?.map(render) : null}
      <div className="flex items-end gap-2">
        <Button type="submit" variant="primary">
          Tìm kiếm
        </Button>
        {extra?.length ? (
          <Button variant="text" onClick={() => setExpanded((current) => !current)}>
            {expanded ? 'Thu gọn tìm kiếm' : 'Mở rộng tìm kiếm'}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function CampaignSelect({
  campaigns,
  value,
  onChange,
  allowAll = false,
}: {
  campaigns: IntakeCampaign[];
  value: string;
  onChange(value: string): void;
  allowAll?: boolean;
}) {
  return (
    <SelectBox
      label="Đợt tuyển sinh"
      value={value}
      emptyLabel={allowAll ? 'Tất cả' : undefined}
      options={campaigns.map((campaign) => ({
        value: campaign.id,
        label: `${campaign.name} (${ADMISSION_PROGRAM_LABELS[campaign.program_type]})`,
      }))}
      onChange={onChange}
    />
  );
}

// Đợt đầu tiên làm mặc định khi danh sách đợt nạp xong
function useDefaultCampaign(campaigns: IntakeCampaign[] | undefined, set: (id: string) => void, current: string) {
  useEffect(() => {
    if (!current && campaigns?.[0]) {
      set(campaigns[0].id);
    }
  }, [campaigns, current, set]);
}

function FileLinks({
  row,
  kind,
  onError,
}: {
  row: IntakeRow;
  kind: FinalYearFileKind;
  onError(message: string): void;
}) {
  const files = row.files.filter((file) => file.kind === kind);
  return (
    <span className="flex flex-col">
      {files.map((file) => (
        <Button
          key={file.id}
          variant="text"
          onClick={() => openIntakeFile(file.id).catch((reason: unknown) => onError(messageOf(reason)))}
        >
          {file.file_name}
        </Button>
      ))}
    </span>
  );
}

const studentInfo = (row: IntakeRow) =>
  `${row.full_name} · ${formatDate(row.dob)} · ${row.gender === 'male' ? 'Nam' : 'Nữ'}`;
const residenceText = (row: IntakeRow) =>
  [row.residence_type ? FINAL_YEAR_RESIDENCE_LABELS[row.residence_type] : null, row.current_residence]
    .filter(Boolean)
    .join(': ');
const addressColumns: Array<DataGridColumn<IntakeRow>> = [
  { id: 'residential_group', header: 'Tổ', cell: (row) => row.residential_group ?? '' },
  { id: 'quarter', header: 'Khu phố', cell: (row) => row.quarter ?? '' },
  { id: 'ward', header: 'Phường/Xã', cell: (row) => row.ward ?? '' },
  { id: 'province', header: 'Thành phố (Tỉnh)', cell: (row) => row.province ?? '' },
];

const EDIT_FIELDS: Array<{ key: string; label: string; advanced?: boolean }> = [
  { key: 'place_of_birth', label: 'Nơi sinh' },
  { key: 'current_residence', label: 'Nơi ở hiện tại (nhập theo VNeID)' },
  { key: 'residential_group', label: 'Tổ' },
  { key: 'quarter', label: 'Khu phố' },
  { key: 'ward', label: 'Phường/Xã' },
  { key: 'province', label: 'Thành phố (Tỉnh)' },
  { key: 'father_name', label: 'Họ tên cha' },
  { key: 'mother_name', label: 'Họ tên mẹ' },
  { key: 'guardian_full_name', label: 'Người liên hệ' },
  { key: 'guardian_phone', label: 'Số điện thoại' },
  { key: 'guardian_email', label: 'Thư điện tử' },
  { key: 'final_year_ward', label: 'Phường/Xã cuối cấp' },
  { key: 'final_year_school', label: 'Trường cuối cấp' },
  { key: 'advanced_criteria', label: 'Tiêu chí', advanced: true },
  { key: 'advanced_achievements', label: 'Kết quả học tập và thành tích', advanced: true },
  { key: 'registered_at', label: 'Ngày đăng ký (YYYY-MM-DD)', advanced: true },
];

// "Cập nhật" ở từng dòng của 1.3, 1.4: thông tin cư trú, liên hệ, giấy tờ; số định danh nhập lại khi cần (để trống là giữ)
function EditIntakeDialog({
  row,
  relationships,
  onClose,
  onSaved,
}: {
  row: IntakeRow;
  relationships: Array<{ id: string; name: string }>;
  onClose(): void;
  onSaved(message: string): void;
}) {
  const advanced = row.program_type === 'advanced';
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(EDIT_FIELDS.map((field) => [field.key, String(row[field.key as keyof IntakeRow] ?? '')])),
    residence_type: row.residence_type ?? '',
    guardian_relationship_item_id: row.guardian_relationship_item_id ?? '',
    child_has_allergies: row.child_has_allergies === null ? '' : String(row.child_has_allergies),
    ward_review: row.ward_review,
    national_id: '',
  }));
  const [kind, setKind] = useState<FinalYearFileKind>('birth_certificate');
  const [file, setFile] = useState<File>();
  const [error, setError] = useState<string>();
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const save = useMutation({
    mutationFn: async () => {
      const input: Record<string, string | boolean | null> = {};
      for (const field of EDIT_FIELDS) {
        if (field.advanced && !advanced) {
          continue;
        }
        input[field.key] = values[field.key]?.trim() || null;
      }
      input.guardian_full_name = values.guardian_full_name?.trim() ?? '';
      input.guardian_phone = values.guardian_phone?.trim() ?? '';
      input.residence_type = values.residence_type || null;
      input.guardian_relationship_item_id = values.guardian_relationship_item_id || null;
      input.child_has_allergies = values.child_has_allergies === '' ? null : values.child_has_allergies === 'true';
      if (advanced) {
        input.ward_review = values.ward_review ?? 'pending';
      }
      if (values.national_id?.trim()) {
        input.national_id = values.national_id.trim();
      }
      await updateIntake(row.id, input);
      if (file) {
        await uploadIntakeFile(row.id, kind, file);
      }
    },
    onSuccess: () => onSaved(`Đã cập nhật hồ sơ của ${row.full_name}`),
    onError: (reason) => setError(messageOf(reason)),
  });
  const remove = useMutation({
    mutationFn: (fileId: string) => removeIntakeFile(fileId),
    onSuccess: () => onSaved('Đã gỡ giấy tờ'),
    onError: (reason) => setError(messageOf(reason)),
  });
  const select = (
    key: string,
    label: string,
    options: ReadonlyArray<{ value: string; label: string }>,
    empty?: string,
  ) => (
    <FormRow label={label}>
      <select className={FORM_CONTROL_CLASS} value={values[key]} onChange={(event) => set(key, event.target.value)}>
        {empty !== undefined ? <option value="">{empty}</option> : null}
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </FormRow>
  );
  return (
    <ConfirmDialog
      open
      title={`Cập nhật hồ sơ tuyển sinh: ${row.full_name}`}
      confirmLabel="Ghi"
      busy={save.isPending}
      onCancel={onClose}
      onConfirm={() => save.mutate()}
    >
      <span className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <FormRow label="Số ĐDCN (nhập lại để thay)">
          <input
            className={FORM_CONTROL_CLASS}
            placeholder={row.national_id || 'Chưa có'}
            value={values.national_id}
            onChange={(event) => set('national_id', event.target.value)}
          />
        </FormRow>
        {select('residence_type', 'Diện cư trú', FINAL_YEAR_RESIDENCE_TYPES, 'Chưa chọn')}
        {EDIT_FIELDS.filter((field) => advanced || !field.advanced).map((field) => (
          <FormRow key={field.key} label={field.label}>
            <input
              className={FORM_CONTROL_CLASS}
              value={values[field.key] ?? ''}
              onChange={(event) => set(field.key, event.target.value)}
            />
          </FormRow>
        ))}
        {select(
          'guardian_relationship_item_id',
          'Quan hệ với học sinh',
          relationships.map((item) => ({ value: item.id, label: item.name })),
          'Chưa chọn',
        )}
        {select(
          'child_has_allergies',
          'Dị ứng',
          [
            { value: 'false', label: 'Không có dị ứng' },
            { value: 'true', label: 'Có dị ứng' },
          ],
          'Chưa khai báo',
        )}
        {advanced ? select('ward_review', 'Trạng thái xã/phường', ADVANCED_REVIEW_STATUSES) : null}
        <span className="flex flex-col gap-1">
          <span className="text-label font-medium text-text">Giấy tờ đã tải</span>
          {row.files.length === 0 ? <span className="text-label text-text-secondary">Chưa có giấy tờ.</span> : null}
          {row.files.map((item) => (
            <span key={item.id} className="flex flex-wrap items-center gap-2 text-label">
              <span>
                {FINAL_YEAR_FILE_KIND_LABELS[item.kind]}: {item.file_name}
              </span>
              <Button variant="text" onClick={() => remove.mutate(item.id)}>
                Gỡ
              </Button>
            </span>
          ))}
        </span>
        <FormRow label="Loại giấy tờ tải thêm">
          <select
            className={FORM_CONTROL_CLASS}
            value={kind}
            onChange={(event) => setKind(event.target.value as FinalYearFileKind)}
          >
            {FINAL_YEAR_FILE_KINDS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Tệp (ảnh hoặc PDF)">
          <input
            type="file"
            aria-label="Tệp giấy tờ"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(event) => setFile(event.target.files?.[0])}
          />
        </FormRow>
      </span>
    </ConfirmDialog>
  );
}

// Hộp nhập Excel dùng chung: tải mẫu, chọn tệp, nhập; có lỗi thì không ghi dòng nào, "Tải danh sách lỗi" lấy tệp kèm lỗi
function ImportDialog({
  title,
  guide,
  onTemplate,
  onImport,
  onClose,
  onDone,
}: {
  title: string;
  guide: string;
  onTemplate(): Promise<void>;
  onImport(file: File, errorFile: boolean): Promise<{ count: number; errors: ImportRowError[] } | null>;
  onClose(): void;
  onDone(message: string): void;
}) {
  const [file, setFile] = useState<File>();
  const [errors, setErrors] = useState<ImportRowError[]>([]);
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const act = (work: () => Promise<void>) => {
    setMessage(undefined);
    setBusy(true);
    work()
      .catch((reason: unknown) => setMessage(messageOf(reason)))
      .finally(() => setBusy(false));
  };
  return (
    <ConfirmDialog
      open
      title={title}
      confirmLabel="Nhập"
      busy={busy}
      onCancel={onClose}
      onConfirm={() =>
        act(async () => {
          if (!file) {
            setMessage('Chọn tệp Excel trước');
            return;
          }
          const result = await onImport(file, false);
          setErrors(result?.errors ?? []);
          if (result && result.errors.length === 0) {
            onDone(`Đã nhập ${result.count} dòng`);
          }
        })
      }
    >
      <span className="flex flex-col gap-3">
        <span>{guide}</span>
        {message ? <Alert tone="danger">{message}</Alert> : null}
        <span className="flex flex-wrap gap-2">
          <Button variant="text" onClick={() => act(onTemplate)}>
            Tải tệp mẫu
          </Button>
          <Button
            variant="text"
            disabled={!file || errors.length === 0}
            onClick={() => act(async () => void (await onImport(file as File, true)))}
          >
            Tải danh sách lỗi
          </Button>
        </span>
        <input
          type="file"
          aria-label="Tệp Excel"
          accept=".xlsx"
          onChange={(event) => {
            setFile(event.target.files?.[0]);
            setErrors([]);
          }}
        />
        {errors.length ? (
          <Alert tone="danger">
            {errors.length} lỗi:{' '}
            {errors
              .slice(0, 10)
              .map((item) => `dòng ${item.row}${item.column ? ` (${item.column})` : ''}: ${item.message}`)
              .join('; ')}
          </Alert>
        ) : null}
      </span>
    </ConfirmDialog>
  );
}

// Loại hình, năm học nhận trẻ của đợt tuyển sinh; năm học nhận trẻ phải đã tạo và đang mở thì mới chuyển hồ sơ được
function CampaignSettingsDialog({
  campaign,
  onClose,
  onSaved,
}: {
  campaign: IntakeCampaign;
  onClose(): void;
  onSaved(message: string): void;
}) {
  const options = useOptions();
  const [programType, setProgramType] = useState<AdmissionProgramType>(campaign.program_type);
  const [yearId, setYearId] = useState(campaign.target_academic_year_id ?? '');
  const [error, setError] = useState<string>();
  const save = useMutation({
    mutationFn: () =>
      updateIntakeCampaign(campaign.id, { program_type: programType, target_academic_year_id: yearId || null }),
    onSuccess: () => onSaved(`Đã ghi đợt tuyển sinh ${campaign.name}`),
    onError: (reason) => setError(messageOf(reason)),
  });
  return (
    <ConfirmDialog
      open
      title={`Đợt tuyển sinh: ${campaign.name}`}
      confirmLabel="Ghi"
      busy={save.isPending}
      onCancel={onClose}
      onConfirm={() => save.mutate()}
    >
      <span className="flex flex-col gap-3">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <SelectBox
          label="Loại hình"
          value={programType}
          options={ADMISSION_PROGRAM_TYPES}
          onChange={(value) => setProgramType(value as AdmissionProgramType)}
        />
        <SelectBox
          label="Năm học nhận trẻ"
          value={yearId}
          emptyLabel="Chưa chọn"
          options={(options.data?.academic_years ?? []).map((year) => ({
            value: year.id,
            label: `${year.name}${year.status === 'open' ? ' (đang dùng)' : year.status === 'draft' ? ' (chưa mở)' : ' (đã đóng)'}`,
          }))}
          onChange={setYearId}
        />
      </span>
    </ConfirmDialog>
  );
}

function usePageState(screen: IntakeScreen, initial: IntakeFilter = {}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<IntakeFilter>(initial);
  const [filter, setFilter] = useState<IntakeFilter>(initial);
  const [error, setError] = useState<string>();
  const toast = useToast();
  const rows = useQuery({
    queryKey: ['entry-intake', screen, filter],
    queryFn: () => listIntake(screen, filter),
  });
  const refresh = async (message?: string) => {
    await queryClient.invalidateQueries({ queryKey: ['entry-intake'] });
    if (message) {
      toast.setToastMessage(message);
    }
  };
  const run = (work: () => Promise<string | undefined | void>) => {
    setError(undefined);
    work()
      .then((message) => (message ? toast.setToastMessage(message) : undefined))
      .catch((reason: unknown) => setError(messageOf(reason)));
  };
  const set = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  return { draft, setDraft, filter, setFilter, error, setError, toast, rows, refresh, run, set };
}

function PageFrame({
  path,
  info,
  errors,
  toast,
  children,
}: {
  path: PortalQuickLinkPath;
  info: ReactNode;
  errors: Array<string | undefined>;
  toast: ReturnType<typeof useToast>;
  children: ReactNode;
}) {
  return (
    <AppShell>
      <Toast message={toast.toastMessage} onClose={toast.closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle(path)}</h1>
        <Alert tone="info">{info}</Alert>
        {errors.filter(Boolean).map((message) => (
          <Alert key={message} tone="danger">
            {message}
          </Alert>
        ))}
        {children}
      </div>
    </AppShell>
  );
}

function Tabs({
  label,
  tabs,
  value,
  onChange,
}: {
  label: string;
  tabs: Array<[string, string]>;
  value: string;
  onChange(value: string): void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label={label}>
      {tabs.map(([code, text]) => (
        <Button
          key={code}
          role="tab"
          aria-selected={value === code}
          variant={value === code ? 'secondary' : 'text'}
          onClick={() => onChange(code)}
        >
          {text}
        </Button>
      ))}
    </div>
  );
}

// 1.4 Tiếp nhận hồ sơ tuyển sinh
export function IntakePage() {
  const canManage = useHasPermission(PERMISSION_CODES.entryIntakeManage);
  const grid = useGridSettings('entry-intake');
  const page = usePageState('intake');
  const campaigns = useCampaigns();
  const options = useOptions();
  const { setDraft, setFilter } = page;
  const setCampaign = useCallback(
    (id: string) => {
      setDraft((current) => ({ ...current, campaign_id: id }));
      setFilter((current) => ({ ...current, campaign_id: id }));
    },
    [setDraft, setFilter],
  );
  useDefaultCampaign(campaigns.data?.items, setCampaign, page.filter.campaign_id ?? '');
  const campaign = campaigns.data?.items.find((item) => item.id === page.filter.campaign_id);
  const [edits, setEdits] = useState<Record<string, { documents: AdmissionDocument[]; decision: AdmissionDecision }>>(
    {},
  );
  const [editing, setEditing] = useState<IntakeRow>();
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cancelling, setCancelling] = useState<IntakeRow[]>();
  const rows = page.rows.data?.items ?? [];
  const current = (row: IntakeRow) =>
    edits[row.id] ?? { documents: row.submitted_documents, decision: row.admission_decision };
  const change = (row: IntakeRow, next: { documents?: AdmissionDocument[]; decision?: AdmissionDecision }) =>
    setEdits((all) => ({ ...all, [row.id]: { ...current(row), ...next } }));
  const locked = (row: IntakeRow) => !canManage || row.status === 'cancelled';
  const onError = (message: string) => page.setError(message);

  const columns: Array<DataGridColumn<IntakeRow>> = [
    { id: 'student', header: 'Thông tin học sinh', alwaysVisible: true, className: 'font-medium', cell: studentInfo },
    { id: 'national_id', header: 'Số ĐDCN', cell: (row) => row.national_id },
    { id: 'residence', header: 'Nơi ở hiện tại (VNEID)', cell: residenceText },
    { id: 'contact', header: 'Thông tin liên hệ', cell: (row) => `${row.guardian_full_name} · ${row.guardian_phone}` },
    {
      id: 'application',
      header: 'Hồ sơ nhập học',
      cell: (row) => (
        <span className="flex flex-col">
          <span>{row.code}</span>
          <span className="text-label text-text-secondary">
            {row.status === 'cancelled'
              ? 'Đã hủy nhập học'
              : row.status === 'converted'
                ? 'Đã chuyển sang CSDL'
                : row.source === 'routing'
                  ? 'Phân tuyến'
                  : 'Tuyển sinh trực tuyến'}
          </span>
        </span>
      ),
    },
    { id: 'final_year_ward', header: 'Phường/Xã cuối cấp', cell: (row) => row.final_year_ward ?? '' },
    { id: 'final_year_school', header: 'Trường cuối cấp', cell: (row) => row.final_year_school ?? '' },
    {
      id: 'birth_certificate',
      header: 'Giấy khai sinh',
      cell: (row) => <FileLinks row={row} kind="birth_certificate" onError={onError} />,
    },
    {
      id: 'residence_proof',
      header: 'Hình ảnh cư trú VNEID',
      cell: (row) => <FileLinks row={row} kind="residence" onError={onError} />,
    },
    { id: 'evidence', header: 'Minh chứng', cell: (row) => <FileLinks row={row} kind="evidence" onError={onError} /> },
    ...addressColumns,
    ...ADMISSION_DOCUMENTS.map((document): DataGridColumn<IntakeRow> => ({
      id: `document_${document.value}`,
      header: document.label,
      hiddenByDefault: document.value === 'primary_transcript' || document.value === 'primary_completion',
      cell: (row) => (
        <input
          type="checkbox"
          aria-label={`${document.label}: ${row.full_name}`}
          disabled={locked(row)}
          checked={current(row).documents.includes(document.value)}
          onChange={(event) =>
            change(row, {
              documents: event.target.checked
                ? [...current(row).documents, document.value]
                : current(row).documents.filter((item) => item !== document.value),
            })
          }
        />
      ),
    })),
    ...(['accepted', 'declined'] as const).map((decision): DataGridColumn<IntakeRow> => ({
      id: `decision_${decision}`,
      header: ADMISSION_DECISION_LABELS[decision],
      cell: (row) => (
        <input
          type="checkbox"
          aria-label={`${ADMISSION_DECISION_LABELS[decision]}: ${row.full_name}`}
          disabled={locked(row) || row.status === 'converted'}
          checked={current(row).decision === decision}
          onChange={(event) => change(row, { decision: event.target.checked ? decision : 'pending' })}
        />
      ),
    })),
  ];
  const changed = Object.entries(edits).filter(([id, value]) => {
    const row = rows.find((item) => item.id === id);
    return (
      row &&
      (value.decision !== row.admission_decision ||
        [...value.documents].sort().join() !== [...row.submitted_documents].sort().join())
    );
  });

  const filterFields: FilterField[] = [
    { key: 'final_year_school', label: 'Trường cuối cấp', type: 'text' },
    { key: 'residence_type', label: 'Diện cư trú', type: 'select', options: FINAL_YEAR_RESIDENCE_TYPES },
    { key: 'ward', label: 'Chọn Phường', type: 'text' },
    { key: 'quarter', label: 'Chọn Khu phố', type: 'text' },
    { key: 'national_id', label: 'Số ĐDCN', type: 'text' },
    { key: 'q', label: 'Họ và tên', type: 'text' },
    { key: 'dob', label: 'Ngày sinh', type: 'date' },
  ];
  const extraFields: FilterField[] = [
    { key: 'father_name', label: 'Họ tên cha', type: 'text' },
    { key: 'mother_name', label: 'Họ tên mẹ', type: 'text' },
    {
      key: 'decision',
      label: 'PH đồng ý nhập học',
      type: 'select',
      options: [
        { value: 'accepted', label: 'Đã' },
        { value: 'not_accepted', label: 'Chưa' },
      ],
    },
    { key: 'doc_admission_notice', label: 'PH nộp Giấy báo nhập học', type: 'select', options: YES_NO },
    { key: 'doc_declaration', label: 'PH nộp Phiếu kê khai', type: 'select', options: YES_NO },
    { key: 'doc_birth_certificate_copy', label: 'PH nộp Giấy khai sinh', type: 'select', options: YES_NO },
  ];

  return (
    <PageFrame
      path="/entry-admissions/intake"
      toast={page.toast}
      errors={[
        page.rows.isError ? messageOf(page.rows.error) : undefined,
        page.error,
        grid.error ? messageOf(grid.error) : undefined,
      ]}
      info={
        <>
          Hồ sơ được phân tuyến về trường (nhập từ Excel, bản chạy nội bộ thay kết nối phân tuyến của Sở) và hồ sơ đã
          đạt của tuyển sinh trực tuyến. Tích giấy tờ đã nộp, phụ huynh đồng ý hoặc từ chối nhập học rồi bấm "Lưu dữ
          liệu".
          {campaign
            ? ` Đợt: ${campaign.name}, loại hình ${ADMISSION_PROGRAM_LABELS[campaign.program_type]}${campaign.target_academic_year_id ? '' : ', chưa chọn năm học nhận trẻ'}.`
            : ''}
        </>
      }
    >
      <FilterForm
        label="Tìm kiếm hồ sơ tiếp nhận"
        fields={filterFields}
        extra={extraFields}
        draft={page.draft}
        onChange={page.set}
        onSubmit={() => page.setFilter(page.draft)}
      >
        <CampaignSelect
          campaigns={campaigns.data?.items ?? []}
          value={page.draft.campaign_id ?? ''}
          onChange={(value) => page.set('campaign_id', value)}
        />
      </FilterForm>
      <DataGrid
        label="Danh sách hồ sơ tiếp nhận"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.full_name}
        loading={page.rows.isPending}
        emptyText="Chưa có hồ sơ được phân tuyến về trường."
        selectable
        toolbar={(selected) => {
          const ids = selected.map((row) => row.id);
          return (
            <>
              {canManage ? (
                <>
                  <Button disabled={!campaign} onClick={() => setImportOpen(true)}>
                    Nhập từ Excel
                  </Button>
                  <Button
                    variant="primary"
                    disabled={changed.length === 0}
                    onClick={() =>
                      page.run(async () => {
                        const result = await saveIntake(
                          changed.map(([id, value]) => ({
                            id,
                            submitted_documents: value.documents,
                            admission_decision: value.decision,
                          })),
                        );
                        setEdits({});
                        await page.refresh();
                        return describeResult(result, 'Đã lưu');
                      })
                    }
                  >
                    Lưu dữ liệu
                  </Button>
                </>
              ) : null}
              <Button onClick={() => page.run(() => exportIntake('intake', page.filter))}>Xuất Excel</Button>
              <Button
                disabled={ids.length === 0}
                onClick={() => page.run(() => downloadIntakeForms(ids, 'information'))}
              >
                Tải phiếu thông tin
              </Button>
              {canManage ? (
                <Button disabled={ids.length === 0} onClick={() => setCancelling(selected)}>
                  Hủy nhập học
                </Button>
              ) : null}
              <Button
                disabled={ids.length === 0}
                onClick={() => page.run(() => downloadIntakeForms(ids, 'registration'))}
              >
                In phiếu đăng ký
              </Button>
              {canManage && campaign ? (
                <Button variant="text" onClick={() => setSettingsOpen(true)}>
                  Đợt tuyển sinh
                </Button>
              ) : null}
            </>
          );
        }}
        rowActions={(row) =>
          canManage && row.status !== 'converted' && row.status !== 'cancelled' ? (
            <Button variant="text" onClick={() => setEditing(row)}>
              Cập nhật
            </Button>
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      {editing ? (
        <EditIntakeDialog
          row={editing}
          relationships={options.data?.relationships ?? []}
          onClose={() => setEditing(undefined)}
          onSaved={(message) => {
            setEditing(undefined);
            void page.refresh(message);
          }}
        />
      ) : null}
      {importOpen && campaign ? (
        <ImportDialog
          title={`Nhập danh sách phân tuyến: ${campaign.name}`}
          guide="Tệp theo mẫu, mỗi dòng một học sinh được phân tuyến về trường. Có lỗi thì không nhập dòng nào."
          onTemplate={downloadRoutingTemplate}
          onImport={async (file, errorFile) => {
            const result = await importRouting(campaign.id, file, errorFile);
            return result ? { count: result.created, errors: result.errors } : null;
          }}
          onClose={() => setImportOpen(false)}
          onDone={(message) => {
            setImportOpen(false);
            void page.refresh(message);
          }}
        />
      ) : null}
      {settingsOpen && campaign ? (
        <CampaignSettingsDialog
          campaign={campaign}
          onClose={() => setSettingsOpen(false)}
          onSaved={(message) => {
            setSettingsOpen(false);
            void page.refresh(message);
          }}
        />
      ) : null}
      {cancelling ? (
        <ConfirmDialog
          open
          title="Hủy nhập học"
          confirmLabel="Hủy nhập học"
          onCancel={() => setCancelling(undefined)}
          onConfirm={() =>
            page.run(async () => {
              const result = await cancelIntake(cancelling.map((row) => row.id));
              setCancelling(undefined);
              await page.refresh();
              return describeResult(result, 'Đã hủy nhập học');
            })
          }
        >
          Bạn có chắc chắn muốn hủy nhập học cho {cancelling.length} hồ sơ đã chọn? Hồ sơ đã chuyển sang CSDL hủy ở 1.7.
        </ConfirmDialog>
      ) : null}
    </PageFrame>
  );
}

// 1.3 Danh sách học sinh đăng ký trường tiên tiến
export function AdvancedRegistrationsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.entryIntakeManage);
  const grid = useGridSettings('entry-advanced');
  const page = usePageState('advanced');
  const options = useOptions();
  const [editing, setEditing] = useState<IntakeRow>();
  const [deleting, setDeleting] = useState<IntakeRow[]>();
  const onError = (message: string) => page.setError(message);
  const review = (rows: IntakeRow[], value: 'admitted' | 'not_admitted' | 'pending') =>
    page.run(async () => {
      const result = await reviewAdvanced(
        rows.map((row) => row.id),
        value,
      );
      await page.refresh();
      return describeResult(result);
    });
  const reviewTone = (value: string) =>
    value === 'admitted' ? 'success' : value === 'not_admitted' ? 'danger' : 'neutral';
  const columns: Array<DataGridColumn<IntakeRow>> = [
    { id: 'student', header: 'Thông tin học sinh', alwaysVisible: true, className: 'font-medium', cell: studentInfo },
    { id: 'place_of_birth', header: 'Nơi sinh', cell: (row) => row.place_of_birth ?? '' },
    { id: 'final_year', header: 'Thông tin cuối cấp', cell: (row) => row.final_year_school ?? '' },
    { id: 'national_id', header: 'Số ĐDCN', cell: (row) => row.national_id },
    { id: 'residence', header: 'Nơi ở hiện tại (VNEID)', cell: residenceText },
    { id: 'father_name', header: 'Họ tên cha', cell: (row) => row.father_name ?? '' },
    { id: 'mother_name', header: 'Họ tên mẹ', cell: (row) => row.mother_name ?? '' },
    { id: 'phone', header: 'Số điện thoại', cell: (row) => row.guardian_phone },
    { id: 'program', header: 'Loại trường', cell: (row) => ADMISSION_PROGRAM_LABELS[row.program_type] },
    { id: 'school', header: 'Tên trường', cell: (row) => row.org_unit_name },
    { id: 'criteria', header: 'Tiêu chí', cell: (row) => row.advanced_criteria ?? '' },
    { id: 'achievements', header: 'Kết quả học tập và thành tích', cell: (row) => row.advanced_achievements ?? '' },
    { id: 'registered_at', header: 'Ngày đăng ký', cell: (row) => formatDate(row.registered_at) },
    {
      id: 'evidence',
      header: 'Hình ảnh minh chứng',
      cell: (row) => <FileLinks row={row} kind="evidence" onError={onError} />,
    },
    {
      id: 'school_review',
      header: 'Trạng thái trường',
      cell: (row) => (
        <StatusBadge tone={reviewTone(row.school_review)} label={ADVANCED_REVIEW_LABELS[row.school_review]} />
      ),
    },
    {
      id: 'ward_review',
      header: 'Trạng thái xã/phường',
      cell: (row) => <StatusBadge tone={reviewTone(row.ward_review)} label={ADVANCED_REVIEW_LABELS[row.ward_review]} />,
    },
    {
      id: 'decision',
      header: 'Đồng ý nhập học',
      cell: (row) => (row.admission_decision === 'accepted' ? 'Đã đồng ý' : ''),
    },
    { id: 'unit', header: 'Trường', cell: (row) => row.target_org_unit_name ?? row.org_unit_name },
    { id: 'class', header: 'Lớp', cell: (row) => row.planned_class_name ?? '' },
    ...addressColumns,
  ];
  return (
    <PageFrame
      path="/entry-admissions/advanced"
      toast={page.toast}
      errors={[
        page.rows.isError ? messageOf(page.rows.error) : undefined,
        page.error,
        grid.error ? messageOf(grid.error) : undefined,
      ]}
      info="Hồ sơ của đợt tuyển sinh loại hình tiên tiến. Trạng thái trường duyệt bấm Xác nhận hồ sơ, Không đồng ý, Chưa xác nhận; trạng thái xã/phường nhập tay ở Cập nhật (không có kết nối của xã/phường)."
    >
      <FilterForm
        label="Tìm kiếm đăng ký trường tiên tiến"
        fields={[
          { key: 'national_id', label: 'Số định danh', type: 'text' },
          { key: 'q', label: 'Họ và tên', type: 'text' },
          { key: 'school_review', label: 'Trường duyệt', type: 'select', options: ADVANCED_REVIEW_STATUSES },
          { key: 'ward_review', label: 'Xã/Phường đồng ý', type: 'select', options: ADVANCED_REVIEW_STATUSES },
        ]}
        draft={page.draft}
        onChange={page.set}
        onSubmit={() => page.setFilter(page.draft)}
      />
      <DataGrid
        label="Danh sách học sinh đăng ký trường tiên tiến"
        columns={columns}
        rows={page.rows.data?.items ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.full_name}
        loading={page.rows.isPending}
        emptyText="Chưa có học sinh đăng ký trường tiên tiến."
        selectable
        toolbar={(selected) => {
          const ids = selected.map((row) => row.id);
          return (
            <>
              {canManage ? (
                <Button disabled={ids.length === 0} onClick={() => setDeleting(selected)}>
                  Xóa
                </Button>
              ) : null}
              <Button onClick={() => page.run(() => exportIntake('advanced', page.filter))}>Xuất Excel</Button>
              <Button
                disabled={ids.length === 0}
                onClick={() => page.run(() => downloadIntakeForms(ids, 'registration'))}
              >
                In phiếu
              </Button>
              <Button disabled={ids.length === 0} onClick={() => page.run(() => downloadEvidence(ids))}>
                Tải minh chứng
              </Button>
              {canManage ? (
                <>
                  <Button variant="primary" disabled={ids.length === 0} onClick={() => review(selected, 'admitted')}>
                    Xác nhận hồ sơ
                  </Button>
                  <Button disabled={ids.length === 0} onClick={() => review(selected, 'not_admitted')}>
                    Không đồng ý
                  </Button>
                  <Button disabled={ids.length === 0} onClick={() => review(selected, 'pending')}>
                    Chưa xác nhận
                  </Button>
                </>
              ) : null}
            </>
          );
        }}
        rowActions={(row) =>
          canManage && row.status !== 'converted' && row.status !== 'cancelled' ? (
            <Button variant="text" onClick={() => setEditing(row)}>
              Cập nhật
            </Button>
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      {editing ? (
        <EditIntakeDialog
          row={editing}
          relationships={options.data?.relationships ?? []}
          onClose={() => setEditing(undefined)}
          onSaved={(message) => {
            setEditing(undefined);
            void page.refresh(message);
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDeleteDialog
          open
          title="Xóa hồ sơ đăng ký"
          subject={`${deleting.length} hồ sơ đã chọn`}
          onCancel={() => setDeleting(undefined)}
          onConfirm={() =>
            page.run(async () => {
              const result = await removeIntake(deleting.map((row) => row.id));
              setDeleting(undefined);
              await page.refresh();
              return describeResult(result, 'Đã xóa');
            })
          }
        />
      ) : null}
    </PageFrame>
  );
}

// 1.5 Gửi thông báo tuyển sinh đầu cấp
export function NoticesPage() {
  const canManage = useHasPermission(PERMISSION_CODES.entryIntakeManage);
  const grid = useGridSettings('entry-notices');
  const queryClient = useQueryClient();
  const toast = useToast();
  const campaigns = useCampaigns();
  const [draft, setDraft] = useState<IntakeFilter>({});
  const [filter, setFilter] = useState<IntakeFilter>({});
  const [content, setContent] = useState('');
  const [error, setError] = useState<string>();
  const [importKind, setImportKind] = useState<'content' | 'external'>();
  const [sending, setSending] = useState<NoticeRecipient[]>();
  const setCampaign = useCallback((id: string) => {
    setDraft((current) => ({ ...current, campaign_id: id }));
    setFilter((current) => ({ ...current, campaign_id: id }));
  }, []);
  useDefaultCampaign(campaigns.data?.items, setCampaign, filter.campaign_id ?? '');
  const campaignId = filter.campaign_id ?? '';
  const recipients = useQuery({
    queryKey: ['entry-intake', 'notices', filter],
    queryFn: () => listNoticeRecipients(filter),
    enabled: campaignId !== '',
  });
  const refresh = async (message?: string) => {
    await queryClient.invalidateQueries({ queryKey: ['entry-intake'] });
    if (message) {
      toast.setToastMessage(message);
    }
  };
  const run = (work: () => Promise<string | undefined | void>) => {
    setError(undefined);
    work()
      .then((message) => (message ? toast.setToastMessage(message) : undefined))
      .catch((reason: unknown) => setError(messageOf(reason)));
  };
  const set = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const columns: Array<DataGridColumn<NoticeRecipient>> = [
    { id: 'national_id', header: 'Số ĐDCN', cell: (row) => row.national_id },
    { id: 'full_name', header: 'Họ tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
    { id: 'dob', header: 'Ngày sinh', cell: (row) => formatDate(row.dob) },
    {
      id: 'gender',
      header: 'Giới tính',
      cell: (row) => (row.gender === 'male' ? 'Nam' : row.gender === 'female' ? 'Nữ' : ''),
    },
    { id: 'phone', header: 'Số điện thoại', cell: (row) => row.phone ?? '' },
    { id: 'content', header: 'Nội dung gửi', cell: (row) => row.notice_content ?? '' },
    {
      id: 'final_year',
      header: 'Cuối Cấp',
      cell: (row) => `${row.final_year_school ?? ''}${row.external ? ' (ngoài hệ thống)' : ''}`,
    },
    { id: 'moet', header: 'API mã bộ', cell: (row) => row.moet_code ?? '' },
    {
      id: 'sent',
      header: 'Gửi thông báo',
      cell: (row) =>
        row.last_notice_at ? (
          <StatusBadge tone="success" label={`Đã gửi ${formatDateTime(row.last_notice_at)}`} />
        ) : (
          <StatusBadge tone="neutral" label={row.has_parent_account ? 'Chưa gửi' : 'Chưa có tài khoản ứng dụng'} />
        ),
    },
  ];
  return (
    <PageFrame
      path="/entry-admissions/notices"
      toast={toast}
      errors={[
        recipients.isError ? messageOf(recipients.error) : undefined,
        error,
        grid.error ? messageOf(grid.error) : undefined,
      ]}
      info="Thông báo gửi qua ứng dụng phụ huynh và Zalo OA tới tài khoản phụ huynh có cùng số điện thoại. Người nhận chưa có tài khoản ghi chưa gửi được; tin nhắn SMS chờ kết nối nhà cung cấp."
    >
      <section className="flex flex-col gap-3" aria-label="Soạn nội dung tin nhắn">
        <h2 className="text-section-title font-semibold text-text">SOẠN NỘI DUNG TIN NHẮN</h2>
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Nội dung tin nhắn
          <textarea
            className={FORM_CONTROL_CLASS}
            rows={4}
            maxLength={1000}
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </label>
        <span className="text-label text-text-secondary">{content.length}/1000 ký tự</span>
      </section>
      <section className="flex flex-col gap-3" aria-label="Danh sách người nhận">
        <h2 className="text-section-title font-semibold text-text">DANH SÁCH NGƯỜI NHẬN</h2>
        <FilterForm
          label="Tìm kiếm người nhận"
          fields={[
            { key: 'program_type', label: 'Loại hình', type: 'select', options: ADMISSION_PROGRAM_TYPES },
            {
              key: 'routed',
              label: 'Phân tuyến',
              type: 'select',
              options: [
                { value: 'yes', label: 'Đã phân tuyến' },
                { value: 'no', label: 'Chưa phân tuyến' },
              ],
            },
            { key: 'has_phone', label: 'Có số điện thoại', type: 'select', options: HAS },
            {
              key: 'notice_sent',
              label: 'Gửi thông báo',
              type: 'select',
              options: [
                { value: 'yes', label: 'Đã gửi' },
                { value: 'no', label: 'Chưa gửi' },
              ],
            },
            {
              key: 'decision',
              label: 'PH đồng ý nhập học',
              type: 'select',
              options: [
                { value: 'accepted', label: 'Đã đồng ý' },
                { value: 'not_accepted', label: 'Chưa đồng ý' },
              ],
            },
            { key: 'ward', label: 'Phường/Xã', type: 'text' },
            { key: 'quarter', label: 'Khu phố', type: 'text' },
            { key: 'national_id', label: 'Số ĐDCN', type: 'text' },
            { key: 'q', label: 'Họ và tên', type: 'text' },
          ]}
          draft={draft}
          onChange={set}
          onSubmit={() => setFilter(draft)}
        >
          <CampaignSelect
            campaigns={campaigns.data?.items ?? []}
            value={draft.campaign_id ?? ''}
            onChange={(value) => set('campaign_id', value)}
          />
        </FilterForm>
        <DataGrid
          label="Danh sách người nhận thông báo"
          columns={columns}
          rows={recipients.data?.items ?? []}
          getRowId={(row) => row.key}
          getRowLabel={(row) => row.full_name}
          loading={campaignId !== '' && recipients.isPending}
          emptyText="Chưa có người nhận."
          selectable
          toolbar={(selected) =>
            canManage ? (
              <>
                <Button variant="primary" disabled={selected.length === 0} onClick={() => setSending(selected)}>
                  Gửi thông báo
                </Button>
                <Button disabled={!campaignId} onClick={() => setImportKind('content')}>
                  Nhập từ Excel
                </Button>
                <Button disabled={!campaignId} onClick={() => setImportKind('external')}>
                  Nhập từ Excel học sinh ngoài hệ thống
                </Button>
                <Button
                  disabled={selected.length === 0 || content.trim() === ''}
                  onClick={() =>
                    run(async () => {
                      const result = await copyNoticeContent(campaignId, content, selected);
                      await refresh();
                      return `Đã sao chép nội dung cho ${result.updated} người nhận`;
                    })
                  }
                >
                  Sao chép nội dung
                </Button>
              </>
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </section>
      {sending ? (
        <ConfirmDialog
          open
          title="Gửi thông báo"
          confirmLabel="Gửi thông báo"
          onCancel={() => setSending(undefined)}
          onConfirm={() =>
            run(async () => {
              const result = await sendNotice(campaignId, content, sending);
              setSending(undefined);
              await refresh();
              return `Đã gửi ${result.delivered}/${result.recipients} người nhận; ${result.not_delivered} người chưa có tài khoản ứng dụng phụ huynh (SMS chờ kết nối nhà cung cấp)`;
            })
          }
        >
          Gửi thông báo cho {sending.length} người nhận đã chọn? Dòng có "Nội dung gửi" riêng gửi nội dung đó, dòng còn
          lại gửi nội dung đang soạn.
        </ConfirmDialog>
      ) : null}
      {importKind ? (
        <ImportDialog
          title={importKind === 'content' ? 'Nhập nội dung gửi từ Excel' : 'Nhập từ Excel học sinh ngoài hệ thống'}
          guide={
            importKind === 'content'
              ? 'Mỗi dòng một hồ sơ trong đợt (tìm theo số ĐDCN hoặc mã hồ sơ) kèm nội dung gửi riêng.'
              : 'Mỗi dòng một học sinh không có hồ sơ trong đợt, có số điện thoại để nhận thông báo.'
          }
          onTemplate={() => downloadNoticeTemplate(importKind)}
          onImport={async (file, errorFile) => {
            const result = await importNotices(campaignId, importKind, file, errorFile);
            return result ? { count: result.created ?? result.updated ?? 0, errors: result.errors } : null;
          }}
          onClose={() => setImportKind(undefined)}
          onDone={(message) => {
            setImportKind(undefined);
            void refresh(message);
          }}
        />
      ) : null}
    </PageFrame>
  );
}

// Chuyển hồ sơ: hỏi xác nhận; hồ sơ đã xếp lớp thì hỏi tiếp có xóa lớp đã xếp không (như hộp hỏi của Sở)
function TransferDialogs({
  rows,
  onClose,
  onDone,
}: {
  rows: IntakeRow[];
  onClose(): void;
  onDone(result: { package_code: string; results: TransferResult[] }): void;
}) {
  const [step, setStep] = useState<'confirm' | 'classes'>('confirm');
  const [confirmDuplicates, setConfirmDuplicates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const arranged = rows.filter((row) => row.planned_class_id).length;
  const go = (clearClasses: boolean) => {
    setBusy(true);
    setError(undefined);
    runTransfer(
      rows.map((row) => row.id),
      clearClasses,
      confirmDuplicates,
    )
      .then(onDone)
      .catch((reason: unknown) => setError(messageOf(reason)))
      .finally(() => setBusy(false));
  };
  if (step === 'classes') {
    return (
      <ConfirmDialog
        open
        title="Lớp đã xếp"
        confirmLabel="Giữ lớp đã xếp"
        busy={busy}
        onCancel={onClose}
        onConfirm={() => go(false)}
      >
        <span className="flex flex-col gap-2">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <span>
            {arranged} học sinh đã chọn đã được xếp lớp. Bạn có muốn xóa lớp đã xếp? Xóa lớp thì hồ sơ học sinh chờ
            duyệt và xếp lớp ở Hồ sơ học sinh; giữ lớp thì học sinh vào lớp đã xếp khi bạn có quyền duyệt hồ sơ trẻ.
          </span>
          <span>
            <Button disabled={busy} onClick={() => go(true)}>
              Xóa lớp đã xếp
            </Button>
          </span>
        </span>
      </ConfirmDialog>
    );
  }
  return (
    <ConfirmDialog
      open
      title="Chuyển hồ sơ sang CSDL"
      confirmLabel="Chuyển hồ sơ"
      busy={busy}
      onCancel={onClose}
      onConfirm={() => (arranged > 0 ? setStep('classes') : go(false))}
    >
      <span className="flex flex-col gap-2">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <span>Bạn có chắc chắn muốn chuyển {rows.length} học sinh đã tích chọn sang CSDL?</span>
        <label className="flex items-center gap-2 text-label">
          <input
            type="checkbox"
            checked={confirmDuplicates}
            onChange={(event) => setConfirmDuplicates(event.target.checked)}
          />
          Vẫn chuyển hồ sơ trùng họ tên và ngày sinh với học sinh đã có
        </label>
      </span>
    </ConfirmDialog>
  );
}

function ResultsGrid({
  gridKey,
  kind,
  label,
  initialPackage,
}: {
  gridKey: DataGridKey;
  kind: 'transfer' | 'cancel';
  label: string;
  initialPackage: string;
}) {
  const grid = useGridSettings(gridKey);
  const [packageCode, setPackageCode] = useState(initialPackage);
  const results = useQuery({
    queryKey: ['entry-intake', 'results', kind, packageCode],
    queryFn: () => listTransferResults(kind, packageCode),
  });
  const columns: Array<DataGridColumn<ResultRow>> =
    kind === 'transfer'
      ? [
          { id: 'student_code', header: 'Mã học sinh', cell: (row) => row.student_code },
          { id: 'full_name', header: 'Họ và tên', alwaysVisible: true, cell: (row) => row.full_name },
          { id: 'national_id', header: 'Số ĐDCN', cell: (row) => row.national_id },
          {
            id: 'result',
            header: 'Kết quả',
            cell: (row) => (
              <StatusBadge tone={row.succeeded ? 'success' : 'danger'} label={row.succeeded ? 'Thành công' : 'Lỗi'} />
            ),
          },
          { id: 'note', header: 'Ghi chú', cell: (row) => row.note ?? '' },
          { id: 'package', header: 'Mã gói tin', hiddenByDefault: true, cell: (row) => row.package_code },
          { id: 'time', header: 'Thời gian', hiddenByDefault: true, cell: (row) => formatDateTime(row.created_at) },
        ]
      : [
          { id: 'guid', header: 'Mã GUID', cell: (row) => row.guid ?? '' },
          { id: 'full_name', header: 'Họ và tên', alwaysVisible: true, cell: (row) => row.full_name },
          {
            id: 'result',
            header: 'Kết quả',
            cell: (row) => (
              <StatusBadge tone={row.succeeded ? 'success' : 'danger'} label={row.succeeded ? 'Thành công' : 'Lỗi'} />
            ),
          },
          { id: 'note', header: 'Ghi chú', cell: (row) => row.note ?? '' },
          { id: 'time', header: 'Thời gian', hiddenByDefault: true, cell: (row) => formatDateTime(row.created_at) },
        ];
  return (
    <>
      {results.isError ? <Alert tone="danger">{messageOf(results.error)}</Alert> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SelectBox
          label="Mã gói tin"
          value={packageCode}
          emptyLabel="Tất cả"
          options={(results.data?.packages ?? []).map((code) => ({ value: code, label: code }))}
          onChange={setPackageCode}
        />
      </div>
      <DataGrid
        label={label}
        columns={columns}
        rows={results.data?.items ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.full_name}
        loading={results.isPending}
        emptyText="Chưa có kết quả."
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </>
  );
}

const transferredText = (row: IntakeRow) =>
  row.status === 'converted'
    ? 'Đã chuyển'
    : row.last_transfer_succeeded === false
      ? 'Lỗi lần chuyển trước'
      : 'Chưa chuyển';

// 1.6 Chuyển hồ sơ trúng tuyển sang CSDL
export function TransferPage() {
  const canTransfer = useHasPermission(PERMISSION_CODES.entryIntakeTransfer);
  const grid = useGridSettings('entry-transfer');
  const page = usePageState('transfer', { transferred: 'no' });
  const options = useOptions();
  const [tab, setTab] = useState('sync');
  const [lastPackage, setLastPackage] = useState('');
  const [edits, setEdits] = useState<Record<string, { unit: string | null; type: AdmissionRecordType }>>({});
  const [transferring, setTransferring] = useState<IntakeRow[]>();
  const rows = page.rows.data?.items ?? [];
  const current = (row: IntakeRow) => edits[row.id] ?? { unit: row.target_org_unit_id, type: row.record_type };
  const editable = (row: IntakeRow) => canTransfer && row.status !== 'converted';
  const units = (options.data?.org_units ?? []).map((unit) => ({ value: unit.id, label: unit.name }));
  const changed = Object.entries(edits).filter(([id, value]) => {
    const row = rows.find((item) => item.id === id);
    return row && (value.unit !== row.target_org_unit_id || value.type !== row.record_type);
  });
  const columns: Array<DataGridColumn<IntakeRow>> = [
    { id: 'code', header: 'ID', hiddenByDefault: true, cell: (row) => row.code },
    { id: 'student_code', header: 'Mã học sinh', cell: (row) => row.student_code ?? row.code },
    {
      id: 'full_name',
      header: 'Họ và tên',
      alwaysVisible: true,
      className: 'font-medium',
      cell: (row) => row.full_name,
    },
    { id: 'national_id', header: 'Số ĐDCN', cell: (row) => row.national_id },
    { id: 'gender', header: 'Giới tính', cell: (row) => (row.gender === 'male' ? 'Nam' : 'Nữ') },
    { id: 'dob', header: 'Ngày sinh', cell: (row) => formatDate(row.dob) },
    {
      id: 'transferred',
      header: 'Chuyển hồ sơ sang CSDL',
      cell: (row) => (
        <span className="flex flex-col">
          <StatusBadge
            tone={row.status === 'converted' ? 'success' : row.last_transfer_succeeded === false ? 'danger' : 'neutral'}
            label={transferredText(row)}
          />
          {row.last_transfer_note && row.status !== 'converted' ? (
            <span className="text-label text-text-secondary">{row.last_transfer_note}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'free',
      header: 'Tự do',
      cell: (row) => (
        <input
          type="checkbox"
          aria-label={`Tự do: ${row.full_name}`}
          disabled={!editable(row)}
          checked={current(row).type === 'free'}
          onChange={(event) =>
            setEdits((all) => ({
              ...all,
              [row.id]: { ...current(row), type: event.target.checked ? 'free' : 'account' },
            }))
          }
        />
      ),
    },
    {
      id: 'unit',
      header: 'Điểm trường',
      cell: (row) =>
        editable(row) ? (
          <select
            aria-label={`Điểm trường: ${row.full_name}`}
            className={FORM_CONTROL_CLASS}
            value={current(row).unit ?? ''}
            onChange={(event) =>
              setEdits((all) => ({ ...all, [row.id]: { ...current(row), unit: event.target.value || null } }))
            }
          >
            <option value="">{row.org_unit_name}</option>
            {units.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        ) : (
          (row.target_org_unit_name ?? row.org_unit_name)
        ),
    },
    { id: 'class', header: 'Xếp lớp', cell: (row) => row.planned_class_name ?? '' },
    { id: 'residence', header: 'Nơi ở hiện nay', cell: residenceText },
    ...addressColumns,
    { id: 'package', header: 'Mã gói tin', hiddenByDefault: true, cell: (row) => row.transfer_package_code ?? '' },
  ];
  return (
    <PageFrame
      path="/entry-admissions/transfer"
      toast={page.toast}
      errors={[
        page.rows.isError ? messageOf(page.rows.error) : undefined,
        page.error,
        grid.error ? messageOf(grid.error) : undefined,
      ]}
      info="Chuyển hồ sơ trúng tuyển thành hồ sơ học sinh ở năm học nhận trẻ của đợt (năm học đó phải đã tạo và đang mở). Hồ sơ cần số định danh, giấy khai sinh, quan hệ của người liên hệ và khai báo dị ứng; hồ sơ thiếu ghi lỗi ở bảng kết quả. Mỗi lần chuyển một mã gói tin, mỗi hồ sơ một mã GUID."
    >
      <Tabs
        label="Chuyển hồ sơ"
        tabs={[
          ['sync', 'Đồng bộ hồ sơ sang CSDL'],
          ['results', 'Xem kết quả đồng bộ'],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'results' ? (
        <ResultsGrid
          gridKey="entry-transfer-results"
          kind="transfer"
          label="Kết quả đồng bộ hồ sơ"
          initialPackage={lastPackage}
        />
      ) : (
        <>
          <FilterForm
            label="Tìm kiếm hồ sơ trúng tuyển"
            fields={[
              {
                key: 'transferred',
                label: 'Chuyển hồ sơ sang CSDL',
                type: 'select',
                options: [
                  { value: 'yes', label: 'Đã chuyển' },
                  { value: 'no', label: 'Chưa chuyển' },
                ],
              },
              { key: 'record_type', label: 'Loại hồ sơ', type: 'select', options: ADMISSION_RECORD_TYPES },
              { key: 'q', label: 'Tìm kiếm hồ sơ (Họ và tên/Số ĐDCN)', type: 'text' },
            ]}
            extra={[
              { key: 'province', label: 'Nơi ở hiện nay: Tỉnh/TP', type: 'text' },
              { key: 'ward', label: 'Phường/Xã', type: 'text' },
              { key: 'quarter', label: 'Khu phố', type: 'text' },
              { key: 'package_code', label: 'Mã gói tin', type: 'text' },
            ]}
            draft={page.draft}
            onChange={page.set}
            onSubmit={() => {
              // Ô tìm kiếm chung: toàn chữ số là số định danh
              const q = page.draft.q?.trim() ?? '';
              page.setFilter({ ...page.draft, q: /^\d+$/.test(q) ? '' : q, national_id: /^\d+$/.test(q) ? q : '' });
            }}
          />
          <DataGrid
            label="Danh sách hồ sơ trúng tuyển"
            columns={columns}
            rows={rows}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.full_name}
            loading={page.rows.isPending}
            emptyText="Chưa có hồ sơ trúng tuyển."
            selectable
            toolbar={(selected) => (
              <>
                {canTransfer ? (
                  <>
                    <Button
                      disabled={changed.length === 0}
                      onClick={() =>
                        page.run(async () => {
                          const result = await updateTransfers(
                            changed.map(([id, value]) => ({
                              id,
                              target_org_unit_id: value.unit,
                              record_type: value.type,
                            })),
                          );
                          setEdits({});
                          await page.refresh();
                          return describeResult(result, 'Đã cập nhật');
                        })
                      }
                    >
                      Cập nhật
                    </Button>
                    <Button
                      variant="primary"
                      disabled={selected.filter((row) => row.status !== 'converted').length === 0}
                      onClick={() => setTransferring(selected.filter((row) => row.status !== 'converted'))}
                    >
                      Chuyển hồ sơ sang CSDL
                    </Button>
                  </>
                ) : null}
                <Button onClick={() => page.run(() => exportIntake('transfer', page.filter))}>Xuất Excel</Button>
                <Button variant="text" onClick={() => setTab('results')}>
                  Bảng kết quả
                </Button>
              </>
            )}
            settings={grid.settings}
            onSettingsChange={grid.update}
          />
        </>
      )}
      {transferring ? (
        <TransferDialogs
          rows={transferring}
          onClose={() => setTransferring(undefined)}
          onDone={(result) => {
            setTransferring(undefined);
            setLastPackage(result.package_code);
            const succeeded = result.results.filter((item) => item.succeeded).length;
            void page.refresh(
              `Gói tin ${result.package_code}: chuyển thành công ${succeeded}/${result.results.length} hồ sơ`,
            );
            setTab('results');
          }}
        />
      ) : null}
    </PageFrame>
  );
}

// 1.7 Danh sách kết quả chuyển hồ sơ
export function TransferResultsPage() {
  const canTransfer = useHasPermission(PERMISSION_CODES.entryIntakeTransfer);
  const grid = useGridSettings('entry-transfer-results');
  const page = usePageState('transferred');
  const [tab, setTab] = useState('list');
  const [lastPackage, setLastPackage] = useState('');
  const [cancelling, setCancelling] = useState<IntakeRow[]>();
  const columns: Array<DataGridColumn<IntakeRow>> = [
    { id: 'student_code', header: 'Mã học sinh', cell: (row) => row.student_code ?? row.code },
    {
      id: 'full_name',
      header: 'Họ và tên',
      alwaysVisible: true,
      className: 'font-medium',
      cell: (row) => row.full_name,
    },
    { id: 'national_id', header: 'Mã số ĐDCN', cell: (row) => row.national_id },
    { id: 'gender', header: 'Giới tính', cell: (row) => (row.gender === 'male' ? 'Nam' : 'Nữ') },
    { id: 'dob', header: 'Ngày sinh', cell: (row) => formatDate(row.dob) },
    { id: 'final_year', header: 'Lớp cuối cấp', cell: (row) => row.final_year_school ?? '' },
    { id: 'free', header: 'Tự do', cell: (row) => (row.record_type === 'free' ? 'x' : '') },
    { id: 'phone', header: 'Điện thoại liên hệ', cell: (row) => row.guardian_phone },
    { id: 'class', header: 'Xếp lớp', cell: (row) => row.planned_class_name ?? '' },
    { id: 'guid', header: 'Mã GUID', cell: (row) => row.transfer_guid ?? '' },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) =>
        row.status === 'cancelled' ? (
          <StatusBadge tone="warning" label="Đã hủy nhập học" />
        ) : (
          <StatusBadge tone="success" label="Đã chuyển" />
        ),
    },
    { id: 'package', header: 'Mã gói tin', hiddenByDefault: true, cell: (row) => row.transfer_package_code ?? '' },
  ];
  return (
    <PageFrame
      path="/entry-admissions/transfer-results"
      toast={page.toast}
      errors={[
        page.rows.isError ? messageOf(page.rows.error) : undefined,
        page.error,
        grid.error ? messageOf(grid.error) : undefined,
      ]}
      info="Hồ sơ đã chuyển sang hồ sơ học sinh. Hủy nhập học chỉ với hồ sơ học sinh chưa phát sinh dữ liệu (điểm danh, học phí, sức khỏe…); hồ sơ đã phát sinh dữ liệu xử lý bằng thôi học ở Hồ sơ học sinh."
    >
      <Tabs
        label="Kết quả chuyển hồ sơ"
        tabs={[
          ['list', 'Danh sách kết quả chuyển hồ sơ'],
          ['cancel', 'Xem kết quả hủy nhập học'],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'cancel' ? (
        <ResultsGrid
          gridKey="entry-cancel-results"
          kind="cancel"
          label="Kết quả hủy nhập học"
          initialPackage={lastPackage}
        />
      ) : (
        <>
          <FilterForm
            label="Tìm kiếm kết quả chuyển hồ sơ"
            fields={[
              { key: 'q', label: 'Họ và tên', type: 'text' },
              { key: 'student_code', label: 'Mã học sinh', type: 'text' },
              { key: 'national_id', label: 'Mã số ĐDCN', type: 'text' },
              { key: 'record_type', label: 'Loại hồ sơ', type: 'select', options: ADMISSION_RECORD_TYPES },
              { key: 'package_code', label: 'Mã gói tin', type: 'text' },
              { key: 'guid', label: 'Tìm kiếm hồ sơ (Mã GUID)', type: 'text' },
            ]}
            draft={page.draft}
            onChange={page.set}
            onSubmit={() => page.setFilter(page.draft)}
          />
          <DataGrid
            label="Danh sách kết quả chuyển hồ sơ"
            columns={columns}
            rows={page.rows.data?.items ?? []}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.full_name}
            loading={page.rows.isPending}
            emptyText="Chưa có hồ sơ đã chuyển."
            selectable
            toolbar={(selected) => (
              <>
                {canTransfer ? (
                  <Button
                    disabled={selected.filter((row) => row.status === 'converted').length === 0}
                    onClick={() => setCancelling(selected.filter((row) => row.status === 'converted'))}
                  >
                    Hủy nhập học
                  </Button>
                ) : null}
                <Button onClick={() => page.run(() => exportIntake('transferred', page.filter))}>Xuất Excel</Button>
              </>
            )}
            settings={grid.settings}
            onSettingsChange={grid.update}
          />
        </>
      )}
      {cancelling ? (
        <ConfirmDialog
          open
          title="Hủy nhập học"
          confirmLabel="Hủy nhập học"
          onCancel={() => setCancelling(undefined)}
          onConfirm={() =>
            page.run(async () => {
              const result = await cancelTransferred(cancelling.map((row) => row.id));
              setCancelling(undefined);
              setLastPackage(result.package_code);
              await page.refresh();
              setTab('cancel');
              const succeeded = result.results.filter((item) => item.succeeded).length;
              return `Đã hủy nhập học ${succeeded}/${result.results.length} học sinh; xem ghi chú ở thẻ kết quả hủy nhập học`;
            })
          }
        >
          Bạn có chắc chắn muốn hủy nhập học cho những học sinh đã tích chọn ({cancelling.length})?
        </ConfirmDialog>
      ) : null}
    </PageFrame>
  );
}

// 5.11 Danh sách trúng tuyển Tuyển sinh đầu cấp (phân hệ Mầm non): bước 1 xếp lớp, bước 2 chuyển sang hồ sơ học sinh, dùng
// chung xử lý của 1.6
export function AdmittedStudentsPage() {
  const canTransfer = useHasPermission(PERMISSION_CODES.entryIntakeTransfer);
  const grid = useGridSettings('admitted-students');
  const page = usePageState('transfer', { transferred: 'no' });
  const options = useOptions();
  const [classId, setClassId] = useState('');
  const [transferring, setTransferring] = useState<IntakeRow[]>();
  const classes = useMemo(
    () => (options.data?.classes ?? []).map((item) => ({ value: item.id, label: item.name })),
    [options.data],
  );
  const columns: Array<DataGridColumn<IntakeRow>> = [
    {
      id: 'full_name',
      header: 'Họ và tên',
      alwaysVisible: true,
      className: 'font-medium',
      cell: (row) => row.full_name,
    },
    { id: 'dob', header: 'Ngày sinh', cell: (row) => formatDate(row.dob) },
    { id: 'gender', header: 'Giới tính', cell: (row) => (row.gender === 'male' ? 'Nam' : 'Nữ') },
    { id: 'national_id', header: 'Số ĐDCN', cell: (row) => row.national_id },
    { id: 'campaign', header: 'Đợt tuyển sinh', cell: (row) => row.campaign_name },
    { id: 'unit', header: 'Điểm trường', cell: (row) => row.target_org_unit_name ?? row.org_unit_name },
    { id: 'class', header: 'Lớp đã xếp', cell: (row) => row.planned_class_name ?? '' },
    { id: 'transferred', header: 'Chuyển sang hồ sơ học sinh', cell: transferredText },
    {
      id: 'note',
      header: 'Ghi chú',
      cell: (row) => (row.status === 'converted' ? '' : (row.last_transfer_note ?? '')),
    },
  ];
  return (
    <PageFrame
      path="/admitted-students"
      toast={page.toast}
      errors={[
        page.rows.isError ? messageOf(page.rows.error) : undefined,
        page.error,
        grid.error ? messageOf(grid.error) : undefined,
      ]}
      info="Học sinh trúng tuyển của Tuyển sinh đầu cấp. Bước 1: chọn học sinh, chọn lớp và bấm Xếp lớp. Bước 2: chọn học sinh và bấm Chuyển sang hồ sơ học sinh (cùng xử lý với 1.6 của phân hệ Tuyển sinh đầu cấp)."
    >
      <FilterForm
        label="Tìm kiếm học sinh trúng tuyển"
        fields={[
          { key: 'q', label: 'Họ và tên', type: 'text' },
          { key: 'national_id', label: 'Số ĐDCN', type: 'text' },
          {
            key: 'transferred',
            label: 'Chuyển sang hồ sơ học sinh',
            type: 'select',
            options: [
              { value: 'yes', label: 'Đã chuyển' },
              { value: 'no', label: 'Chưa chuyển' },
            ],
          },
        ]}
        draft={page.draft}
        onChange={page.set}
        onSubmit={() => page.setFilter(page.draft)}
      />
      {canTransfer ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <SelectBox
            label="Lớp xếp cho học sinh đã chọn"
            value={classId}
            emptyLabel="Bỏ xếp lớp"
            options={classes}
            onChange={setClassId}
          />
        </div>
      ) : null}
      <DataGrid
        label="Danh sách trúng tuyển Tuyển sinh đầu cấp"
        columns={columns}
        rows={page.rows.data?.items ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.full_name}
        loading={page.rows.isPending}
        emptyText="Chưa có học sinh trúng tuyển."
        selectable
        toolbar={(selected) =>
          canTransfer ? (
            <>
              <Button
                disabled={selected.length === 0}
                onClick={() =>
                  page.run(async () => {
                    const result = await arrangeClasses(
                      selected.map((row) => row.id),
                      classId || null,
                    );
                    await page.refresh();
                    return describeResult(result, classId ? 'Đã xếp lớp' : 'Đã bỏ xếp lớp');
                  })
                }
              >
                Bước 1: Xếp lớp
              </Button>
              <Button
                variant="primary"
                disabled={selected.filter((row) => row.status !== 'converted').length === 0}
                onClick={() => setTransferring(selected.filter((row) => row.status !== 'converted'))}
              >
                Bước 2: Chuyển sang hồ sơ học sinh
              </Button>
            </>
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      {transferring ? (
        <TransferDialogs
          rows={transferring}
          onClose={() => setTransferring(undefined)}
          onDone={(result) => {
            setTransferring(undefined);
            const failed = result.results.filter((item) => !item.succeeded);
            void page.refresh(
              `Gói tin ${result.package_code}: chuyển thành công ${result.results.length - failed.length}/${result.results.length}` +
                (failed.length ? `; lỗi: ${failed.map((item) => `${item.full_name} (${item.note})`).join('; ')}` : ''),
            );
          }}
        />
      ) : null}
    </PageFrame>
  );
}
