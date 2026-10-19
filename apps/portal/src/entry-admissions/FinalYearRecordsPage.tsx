import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FINAL_YEAR_FILE_KIND_LABELS,
  FINAL_YEAR_FILE_KINDS,
  FINAL_YEAR_IDENTITY_LABELS,
  FINAL_YEAR_IDENTITY_TYPES,
  FINAL_YEAR_REGISTRATION_SOURCES,
  FINAL_YEAR_RESIDENCE_LABELS,
  FINAL_YEAR_RESIDENCE_TYPES,
  FINAL_YEAR_REVIEW_LABELS,
  FINAL_YEAR_REVIEW_STATUSES,
  FINAL_YEAR_SOURCE_LABELS,
  FINAL_YEAR_STATUS_LABELS,
  FINAL_YEAR_STATUSES,
  PERMISSION_CODES,
  type FinalYearFileKind,
  type FinalYearStatus,
} from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDialog,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormRow,
  StatusBadge,
  Toast,
  type DataGridColumn,
  type StatusTone,
} from '@school-management/ui';
import { bulkResetPassword, type BulkPasswordResult } from '../accounts/accounts-api.js';
import { SelectBox } from '../facilities/facilities-ui.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import {
  actOnFinalYearRecords,
  downloadFinalYearPdf,
  exportFinalYearRecords,
  finalYearAccounts,
  formatDate,
  importFinalYearRecords,
  listCompletion,
  listFinalYearRecords,
  messageOf,
  openFinalYearFile,
  openMap,
  removeFinalYearFile,
  saveEditDeadline,
  updateFinalYearRecord,
  uploadFinalYearFile,
  type FinalYearAccount,
  type FinalYearFilter,
  type FinalYearInput,
  type FinalYearRecord,
  type ImportRowError,
} from './entry-admissions-api.js';

// 1.1 Hồ sơ học sinh cuối cấp mầm non (DT-17 phần 17c, khảo sát mục 10.2.3): trẻ đang học lớp năm cuối cấp; nhãn, bộ lọc,
// cột, nút như Sở. Phụ huynh xác nhận hoặc đề xuất sửa trên ứng dụng phụ huynh; trường sửa thông tin ("Cập nhật" ở từng
// dòng) rồi bấm "Đã chỉnh sửa thông tin". Trường phân tuyến, đối tượng, hình thức ưu tiên, nguồn đăng ký, vị trí nhập tay vì
// không có kết nối phân tuyến của Sở
export const STATUS_TONES: Record<FinalYearStatus, StatusTone> = {
  parent_pending: 'neutral',
  awaiting_school_edit: 'warning',
  awaiting_parent_reconfirm: 'warning',
  parent_confirmed: 'success',
  school_edited: 'warning',
  parent_confirmed_after_edit: 'success',
};

type PdfButton = { label: string; format: 'a5' | 'a4_folded'; selected: boolean; split: boolean };
const PDF_BUTTONS: PdfButton[] = [
  { label: 'Xuất PDF A5 toàn bộ hồ sơ', format: 'a5', selected: false, split: false },
  { label: 'Xuất PDF A4 gập đôi toàn bộ hồ sơ', format: 'a4_folded', selected: false, split: false },
  { label: 'Xuất PDF A5 hồ sơ chọn', format: 'a5', selected: true, split: false },
  { label: 'Xuất PDF A4 gập đôi hồ sơ chọn', format: 'a4_folded', selected: true, split: false },
  { label: 'Xuất PDF A5 toàn bộ hồ sơ (Tách file)', format: 'a5', selected: false, split: true },
  { label: 'Xuất PDF A5 hồ sơ chọn (Tách file)', format: 'a5', selected: true, split: true },
];

const EDIT_TEXT_FIELDS: Array<{ key: keyof FinalYearInput; label: string }> = [
  { key: 'current_residence', label: 'Nơi ở hiện tại (nhập theo VNeID)' },
  { key: 'house_number', label: 'Số nhà' },
  { key: 'street', label: 'Đường' },
  { key: 'residential_group', label: 'Tổ' },
  { key: 'quarter', label: 'Khu phố' },
  { key: 'ward', label: 'Phường/Xã' },
  { key: 'province', label: 'Thành phố (Tỉnh)' },
  { key: 'contact_name', label: 'Người liên hệ' },
  { key: 'contact_phone', label: 'Điện thoại liên hệ' },
  { key: 'contact_email', label: 'Thư điện tử' },
  { key: 'routed_school', label: 'Trường phân tuyến' },
  { key: 'beneficiary', label: 'Đối tượng' },
  { key: 'priority_form', label: 'Hình thức ưu tiên' },
  { key: 'latitude', label: 'Vĩ độ' },
  { key: 'longitude', label: 'Kinh độ' },
];

const YES_NO = [
  { value: 'true', label: 'Có' },
  { value: 'false', label: 'Không' },
];

function filesOf(row: FinalYearRecord, kind: FinalYearFileKind) {
  return row.files.filter((file) => file.kind === kind);
}

function FileLinks({
  row,
  kind,
  onError,
}: {
  row: FinalYearRecord;
  kind: FinalYearFileKind;
  onError(message: string): void;
}) {
  const files = filesOf(row, kind);
  if (files.length === 0) {
    return kind === 'birth_certificate' && !row.missing.includes('birth_certificate') ? (
      <span>Có ở hồ sơ học sinh</span>
    ) : null;
  }
  return (
    <span className="flex flex-col">
      {files.map((file) => (
        <Button
          key={file.id}
          variant="text"
          onClick={() => openFinalYearFile(file.id).catch((reason: unknown) => onError(messageOf(reason)))}
        >
          {file.file_name}
        </Button>
      ))}
    </span>
  );
}

function EditRecordDialog({
  row,
  onClose,
  onSaved,
}: {
  row: FinalYearRecord;
  onClose(): void;
  onSaved(message: string): void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      [...EDIT_TEXT_FIELDS.map((field) => field.key), 'identity_type', 'residence_type', 'registration_source'].map(
        (key) => [key, String(row[key as keyof FinalYearRecord] ?? '')],
      ),
    ),
  );
  const [kind, setKind] = useState<FinalYearFileKind>('residence');
  const [file, setFile] = useState<File>();
  const [error, setError] = useState<string>();
  const save = useMutation({
    mutationFn: async () => {
      const input: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(values)) {
        input[key] = value.trim() === '' ? null : value.trim();
      }
      await updateFinalYearRecord(row.id, input as FinalYearInput);
      if (file) {
        await uploadFinalYearFile(row.id, kind, file);
      }
    },
    onSuccess: () => onSaved(`Đã cập nhật hồ sơ của ${row.full_name}`),
    onError: (reason) => setError(messageOf(reason)),
  });
  const remove = useMutation({
    mutationFn: (fileId: string) => removeFinalYearFile(fileId),
    onSuccess: () => onSaved('Đã gỡ giấy tờ'),
    onError: (reason) => setError(messageOf(reason)),
  });
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  return (
    <ConfirmDialog
      open
      title={`Cập nhật hồ sơ cuối cấp: ${row.full_name}`}
      confirmLabel="Ghi"
      busy={save.isPending}
      onCancel={onClose}
      onConfirm={() => save.mutate()}
    >
      <span className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {row.parent_proposal ? <Alert tone="warning">PHHS đề xuất: {row.parent_proposal}</Alert> : null}
        <FormRow label="Loại định danh">
          <select
            className={FORM_CONTROL_CLASS}
            value={values.identity_type}
            onChange={(event) => set('identity_type', event.target.value)}
          >
            {FINAL_YEAR_IDENTITY_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Diện cư trú">
          <select
            className={FORM_CONTROL_CLASS}
            value={values.residence_type}
            onChange={(event) => set('residence_type', event.target.value)}
          >
            <option value="">Chưa chọn</option>
            {FINAL_YEAR_RESIDENCE_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </FormRow>
        {EDIT_TEXT_FIELDS.map((field) => (
          <FormRow key={field.key} label={field.label}>
            <input
              className={FORM_CONTROL_CLASS}
              value={values[field.key] ?? ''}
              onChange={(event) => set(field.key, event.target.value)}
            />
          </FormRow>
        ))}
        <FormRow label="PHHS đăng ký">
          <select
            className={FORM_CONTROL_CLASS}
            value={values.registration_source}
            onChange={(event) => set('registration_source', event.target.value)}
          >
            {FINAL_YEAR_REGISTRATION_SOURCES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </FormRow>
        <span className="flex flex-col gap-1">
          <span className="text-label font-medium text-text">Giấy tờ đã tải</span>
          {row.files.length === 0 ? <span className="text-label text-text-secondary">Chưa có giấy tờ.</span> : null}
          {row.files.map((item) => (
            <span key={item.id} className="flex flex-wrap items-center gap-2 text-label">
              <span>
                {FINAL_YEAR_FILE_KIND_LABELS[item.kind]}: {item.file_name} (
                {item.uploaded_by_parent ? 'phụ huynh' : 'nhà trường'})
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
            accept="image/jpeg,image/png,application/pdf"
            onChange={(event) => setFile(event.target.files?.[0])}
          />
        </FormRow>
      </span>
    </ConfirmDialog>
  );
}

export function FinalYearRecordsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.finalYearManage);
  const canApprove = useHasPermission(PERMISSION_CODES.finalYearApprove);
  const queryClient = useQueryClient();
  const grid = useGridSettings('final-year-records');
  const [draft, setDraft] = useState<FinalYearFilter>({ order: 'school' });
  const [filter, setFilter] = useState<FinalYearFilter>({ order: 'school' });
  const [editing, setEditing] = useState<FinalYearRecord>();
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [importFile, setImportFile] = useState<File>();
  const [importOpen, setImportOpen] = useState(false);
  const [importErrors, setImportErrors] = useState<ImportRowError[]>([]);
  const [accounts, setAccounts] = useState<FinalYearAccount[]>();
  const [passwords, setPasswords] = useState<BulkPasswordResult[]>();
  const [error, setError] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const records = useQuery({
    queryKey: ['final-year', 'records', filter],
    queryFn: () => listFinalYearRecords(filter),
  });
  const classes = useQuery({ queryKey: ['final-year', 'completion'], queryFn: listCompletion });
  const refresh = async (message?: string) => {
    await queryClient.invalidateQueries({ queryKey: ['final-year'] });
    if (message) {
      setToastMessage(message);
    }
  };
  const run = (work: () => Promise<string | undefined | void>) => {
    setError(undefined);
    work()
      .then((message) => (message ? setToastMessage(message) : undefined))
      .catch((reason: unknown) => setError(messageOf(reason)));
  };
  const act = useMutation({
    mutationFn: async ({
      action,
      rows,
    }: {
      action: 'confirm' | 'edited' | 'approve' | 'unapprove';
      rows: FinalYearRecord[];
    }) =>
      actOnFinalYearRecords(
        action,
        rows.map((row) => row.id),
      ),
    onSuccess: async (result) => {
      await refresh(
        `Đã thực hiện cho ${result.done} hồ sơ` +
          (result.skipped.length
            ? `; bỏ qua ${result.skipped.length}: ${result.skipped.map((item) => `${item.full_name} (${item.reason})`).join('; ')}`
            : ''),
      );
    },
    onError: (reason) => setError(messageOf(reason)),
  });
  const set = (key: keyof FinalYearFilter, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const editDeadline = records.data?.edit_deadline ?? null;
  const onError = (message: string) => setError(message);

  const columns: Array<DataGridColumn<FinalYearRecord>> = [
    { id: 'moet_student_code', header: 'Mã định danh', cell: (row) => row.moet_student_code ?? '' },
    {
      id: 'full_name',
      header: 'Họ và tên',
      alwaysVisible: true,
      className: 'font-medium',
      cell: (row) => row.full_name,
    },
    { id: 'dob', header: 'Ngày sinh', cell: (row) => formatDate(row.dob) },
    { id: 'gender', header: 'Giới tính', cell: (row) => (row.gender === 'male' ? 'Nam' : 'Nữ') },
    {
      id: 'account',
      header: 'Mật khẩu',
      cell: (row) => (row.has_parent_account ? 'Đã có tài khoản phụ huynh' : 'Chưa có tài khoản'),
    },
    { id: 'place_of_birth', header: 'Nơi sinh', cell: (row) => row.place_of_birth ?? '' },
    { id: 'class_name', header: 'Lớp', cell: (row) => row.class_name },
    {
      id: 'national_id',
      header: 'Số định danh cá nhân (do Công An phường/xã cấp)',
      cell: (row) => `${row.national_id} · ${FINAL_YEAR_IDENTITY_LABELS[row.identity_type]}`,
    },
    {
      id: 'current_residence',
      header: 'Nơi ở hiện tại (nhập theo VNEID)',
      cell: (row) =>
        [row.residence_type ? FINAL_YEAR_RESIDENCE_LABELS[row.residence_type] : null, row.current_residence]
          .filter(Boolean)
          .join(': '),
    },
    {
      id: 'location',
      header: 'Xem vị trí',
      cell: (row) =>
        row.latitude !== null && row.longitude !== null ? (
          <Button variant="text" onClick={() => openMap(row.latitude as number, row.longitude as number)}>
            Xem vị trí
          </Button>
        ) : (
          ''
        ),
    },
    {
      id: 'contact',
      header: 'Thông tin liên hệ',
      cell: (row) => [row.contact_name, row.contact_phone, row.contact_email].filter(Boolean).join(' · '),
    },
    {
      id: 'check',
      header: 'Nội dung kiểm dò',
      cell: (row) => <StatusBadge tone={row.missing.length ? 'warning' : 'success'} label={row.check_text} />,
    },
    { id: 'proposal', header: 'PHHS Đề xuất', cell: (row) => row.parent_proposal ?? '' },
    {
      id: 'status',
      header: 'Trạng thái hồ sơ',
      cell: (row) => <StatusBadge tone={STATUS_TONES[row.status]} label={FINAL_YEAR_STATUS_LABELS[row.status]} />,
    },
    {
      id: 'review',
      header: 'Trạng thái duyệt',
      cell: (row) =>
        row.review_status === 'approved'
          ? `${FINAL_YEAR_REVIEW_LABELS.approved}${row.approved_by_name ? ` (${row.approved_by_name})` : ''}`
          : FINAL_YEAR_REVIEW_LABELS.pending,
    },
    { id: 'source', header: 'PHHS đăng ký', cell: (row) => FINAL_YEAR_SOURCE_LABELS[row.registration_source] },
    {
      id: 'birth_certificate',
      header: 'Giấy khai sinh',
      cell: (row) => <FileLinks row={row} kind="birth_certificate" onError={onError} />,
    },
    {
      id: 'residence_proof',
      header: 'Hình ảnh Thông tin cư trú trên VNEID (hoặc giấy xác nhận cư trú)',
      cell: (row) => <FileLinks row={row} kind="residence" onError={onError} />,
    },
    { id: 'routed_school', header: 'Trường phân tuyến', cell: (row) => row.routed_school ?? '' },
    { id: 'consent', header: 'PH đồng ý nhập học', cell: (row) => (row.admission_consent ? 'Đã đồng ý' : '') },
    { id: 'evidence', header: 'Minh chứng', cell: (row) => <FileLinks row={row} kind="evidence" onError={onError} /> },
    { id: 'beneficiary', header: 'Đối tượng', cell: (row) => row.beneficiary ?? '' },
    { id: 'priority_form', header: 'Hình thức ưu tiên', cell: (row) => row.priority_form ?? '' },
    { id: 'house_number', header: 'Số nhà', hiddenByDefault: true, cell: (row) => row.house_number ?? '' },
    { id: 'street', header: 'Đường', hiddenByDefault: true, cell: (row) => row.street ?? '' },
    { id: 'residential_group', header: 'Tổ', hiddenByDefault: true, cell: (row) => row.residential_group ?? '' },
    { id: 'quarter', header: 'Khu phố', hiddenByDefault: true, cell: (row) => row.quarter ?? '' },
    { id: 'ward', header: 'Phường/Xã', cell: (row) => row.ward ?? '' },
    { id: 'province', header: 'Thành phố (Tỉnh)', cell: (row) => row.province ?? '' },
  ];
  const rows = records.data?.items ?? [];

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/entry-admissions/final-year')}</h1>
        <Alert tone="info">
          Hạn điều chỉnh thông tin: {editDeadline ? formatDate(editDeadline) : 'chưa đặt'}. Kiểm dò: hồ sơ đủ số định
          danh, nơi ở hiện tại, số điện thoại liên hệ, giấy khai sinh và ảnh thông tin cư trú trên VNeID. Diện cư trú,
          trường phân tuyến, đối tượng, hình thức ưu tiên, nguồn đăng ký, vị trí do nhà trường nhập (không có kết nối
          phân tuyến của Sở).
        </Alert>
        {records.isError ? <Alert tone="danger">{messageOf(records.error)}</Alert> : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        <form
          className="grid grid-cols-1 gap-4 md:grid-cols-4"
          aria-label="Tìm kiếm hồ sơ cuối cấp"
          onSubmit={(event) => {
            event.preventDefault();
            setFilter(draft);
          }}
        >
          <SelectBox
            label="Lớp"
            value={draft.class_id ?? ''}
            emptyLabel="Tất cả"
            options={(classes.data?.items ?? []).map((item) => ({ value: item.class_id, label: item.class_name }))}
            onChange={(value) => set('class_id', value)}
          />
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Số định danh
            <input
              className={FORM_CONTROL_CLASS}
              value={draft.national_id ?? ''}
              onChange={(event) => set('national_id', event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Họ và tên
            <input
              className={FORM_CONTROL_CLASS}
              value={draft.q ?? ''}
              onChange={(event) => set('q', event.target.value)}
            />
          </label>
          <SelectBox
            label="Kiểm dò"
            value={draft.check ?? ''}
            emptyLabel="Tất cả"
            options={[
              { value: 'complete', label: 'Đủ thông tin' },
              { value: 'missing', label: 'Thiếu thông tin' },
            ]}
            onChange={(value) => set('check', value)}
          />
          <SelectBox
            label="Trạng thái định danh"
            value={draft.identity_type ?? ''}
            emptyLabel="Tất cả"
            options={FINAL_YEAR_IDENTITY_TYPES}
            onChange={(value) => set('identity_type', value)}
          />
          <SelectBox
            label="Trạng thái hồ sơ"
            value={draft.status ?? ''}
            emptyLabel="Tất cả"
            options={FINAL_YEAR_STATUSES}
            onChange={(value) => set('status', value)}
          />
          <SelectBox
            label="Nguồn đăng ký"
            value={draft.registration_source ?? ''}
            emptyLabel="Tất cả"
            options={FINAL_YEAR_REGISTRATION_SOURCES}
            onChange={(value) => set('registration_source', value)}
          />
          <SelectBox
            label="Trạng thái duyệt"
            value={draft.review_status ?? ''}
            emptyLabel="Tất cả"
            options={FINAL_YEAR_REVIEW_STATUSES}
            onChange={(value) => set('review_status', value)}
          />
          <SelectBox
            label="Có vị trí"
            value={draft.has_location ?? ''}
            emptyLabel="Tất cả"
            options={YES_NO}
            onChange={(value) => set('has_location', value)}
          />
          <SelectBox
            label="Đồng ý nhập học"
            value={draft.admission_consent ?? ''}
            emptyLabel="Tất cả"
            options={[
              { value: 'true', label: 'Đã đồng ý' },
              { value: 'false', label: 'Chưa đồng ý' },
            ]}
            onChange={(value) => set('admission_consent', value)}
          />
          <SelectBox
            label="Xem theo"
            value={draft.order ?? 'school'}
            options={[
              { value: 'school', label: 'Alphabet toàn trường' },
              { value: 'class', label: 'Alphabet lớp' },
            ]}
            onChange={(value) => set('order', value)}
          />
          <div className="flex items-end">
            <Button type="submit" variant="primary">
              Tìm kiếm
            </Button>
          </div>
        </form>
        <DataGrid
          label="Danh sách hồ sơ học sinh cuối cấp"
          columns={columns}
          rows={rows}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.full_name}
          loading={records.isPending}
          emptyText="Chưa có học sinh lớp năm cuối cấp."
          selectable
          toolbar={(selected) => {
            const ids = selected.map((row) => row.id);
            return (
              <>
                {canManage ? (
                  <>
                    <Button onClick={() => setImportOpen(true)}>Cập nhật từ Excel</Button>
                    <Button
                      disabled={selected.length === 0}
                      onClick={() => act.mutate({ action: 'confirm', rows: selected })}
                    >
                      Xác nhận hồ sơ
                    </Button>
                    <Button
                      disabled={selected.length === 0}
                      onClick={() => act.mutate({ action: 'edited', rows: selected })}
                    >
                      Đã chỉnh sửa thông tin
                    </Button>
                  </>
                ) : null}
                {canApprove ? (
                  <>
                    <Button
                      variant="primary"
                      disabled={selected.length === 0}
                      onClick={() => act.mutate({ action: 'approve', rows: selected })}
                    >
                      Duyệt hồ sơ
                    </Button>
                    <Button
                      disabled={selected.length === 0}
                      onClick={() => act.mutate({ action: 'unapprove', rows: selected })}
                    >
                      Hủy duyệt hồ sơ
                    </Button>
                  </>
                ) : null}
                <Button onClick={() => run(() => exportFinalYearRecords(filter))}>Xuất Excel</Button>
                <Button
                  disabled={selected.length === 0}
                  onClick={() =>
                    run(async () => {
                      setAccounts((await finalYearAccounts(ids)).items);
                    })
                  }
                >
                  Thông tin tài khoản
                </Button>
                {canManage ? (
                  <Button
                    disabled={selected.length === 0}
                    onClick={() =>
                      run(async () => {
                        const userIds = (await finalYearAccounts(ids)).items
                          .map((item) => item.user_id)
                          .filter((id): id is string => id !== null);
                        if (userIds.length === 0) {
                          return 'Hồ sơ đã chọn chưa có tài khoản phụ huynh';
                        }
                        setPasswords((await bulkResetPassword([...new Set(userIds)])).items);
                      })
                    }
                  >
                    Khởi tạo mật khẩu
                  </Button>
                ) : null}
                {PDF_BUTTONS.map((button) => (
                  <Button
                    key={button.label}
                    disabled={button.selected && selected.length === 0}
                    onClick={() =>
                      run(() =>
                        downloadFinalYearPdf({
                          format: button.format,
                          split: button.split,
                          ids: button.selected ? ids : null,
                          filter,
                        }),
                      )
                    }
                  >
                    {button.label}
                  </Button>
                ))}
                {canManage ? (
                  <Button
                    disabled={!importFile || importErrors.length === 0}
                    onClick={() => run(async () => void (await importFinalYearRecords(importFile as File, true)))}
                  >
                    Tải danh sách lỗi
                  </Button>
                ) : null}
                <Button
                  disabled={selected.length === 0}
                  onClick={() => run(() => downloadFinalYearPdf({ format: 'a5', kind: 'declaration', ids, filter }))}
                >
                  In phiếu kê khai
                </Button>
                <Button
                  disabled={selected.length === 0}
                  onClick={() => run(() => downloadFinalYearPdf({ format: 'a5', kind: 'information', ids, filter }))}
                >
                  In phiếu thông tin
                </Button>
                {canManage ? (
                  <Button
                    variant="text"
                    onClick={() => {
                      setDeadline(editDeadline ?? '');
                      setDeadlineOpen(true);
                    }}
                  >
                    Hạn điều chỉnh thông tin
                  </Button>
                ) : null}
              </>
            );
          }}
          rowActions={(row) =>
            canManage ? (
              <Button variant="text" onClick={() => setEditing(row)}>
                Cập nhật
              </Button>
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
      {editing ? (
        <EditRecordDialog
          row={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(message) => {
            setEditing(undefined);
            void refresh(message);
          }}
        />
      ) : null}
      {deadlineOpen ? (
        <ConfirmDialog
          open
          title="Hạn điều chỉnh thông tin"
          confirmLabel="Ghi"
          onCancel={() => setDeadlineOpen(false)}
          onConfirm={() =>
            run(async () => {
              await saveEditDeadline(deadline || null);
              setDeadlineOpen(false);
              await refresh();
              return 'Đã ghi hạn điều chỉnh thông tin';
            })
          }
        >
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Phụ huynh xác nhận, đề xuất sửa, tải giấy tờ đến hết ngày (bỏ trống là không giới hạn)
            <input
              type="date"
              className={FORM_CONTROL_CLASS}
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </label>
        </ConfirmDialog>
      ) : null}
      {importOpen ? (
        <ConfirmDialog
          open
          title="Cập nhật từ Excel"
          confirmLabel="Cập nhật"
          onCancel={() => setImportOpen(false)}
          onConfirm={() =>
            run(async () => {
              if (!importFile) {
                return 'Chọn tệp Excel trước';
              }
              const result = await importFinalYearRecords(importFile);
              setImportErrors(result?.errors ?? []);
              if (result && result.errors.length === 0) {
                setImportOpen(false);
                await refresh();
                return `Đã cập nhật ${result.updated} hồ sơ`;
              }
            })
          }
        >
          <span className="flex flex-col gap-3">
            <span>
              Dùng tệp "Xuất Excel" (giữ cột ID), sửa các cột thông tin cư trú, liên hệ, vị trí, phân tuyến rồi tải lên.
              Có lỗi thì không cập nhật dòng nào; bấm "Tải danh sách lỗi" để lấy tệp kèm nội dung lỗi.
            </span>
            <input
              type="file"
              aria-label="Tệp Excel cập nhật hồ sơ"
              accept=".xlsx"
              onChange={(event) => {
                setImportFile(event.target.files?.[0]);
                setImportErrors([]);
              }}
            />
            {importErrors.length ? (
              <Alert tone="danger">
                {importErrors.length} lỗi:{' '}
                {importErrors
                  .slice(0, 10)
                  .map((item) => `dòng ${item.row}${item.column ? ` (${item.column})` : ''}: ${item.message}`)
                  .join('; ')}
              </Alert>
            ) : null}
          </span>
        </ConfirmDialog>
      ) : null}
      {accounts ? (
        <ConfirmDialog
          open
          title="Thông tin tài khoản phụ huynh"
          confirmLabel="Đóng"
          onCancel={() => setAccounts(undefined)}
          onConfirm={() => setAccounts(undefined)}
        >
          <span className="flex flex-col gap-1 text-label">
            {accounts.length === 0 ? 'Hồ sơ đã chọn chưa có phụ huynh.' : null}
            {accounts.map((item) => (
              <span key={`${item.record_id}-${item.guardian_name}`}>
                {item.child_name} ({item.class_name}): {item.relationship ? `${item.relationship} ` : ''}
                {item.guardian_name}, tên đăng nhập {item.phone ?? 'chưa có số điện thoại'} —{' '}
                {item.has_account ? 'đã có tài khoản' : 'chưa có tài khoản'}
              </span>
            ))}
          </span>
        </ConfirmDialog>
      ) : null}
      {passwords ? (
        <ConfirmDialog
          open
          title="Mật khẩu tạm của phụ huynh"
          confirmLabel="Đóng"
          onCancel={() => setPasswords(undefined)}
          onConfirm={() => setPasswords(undefined)}
        >
          <span className="flex flex-col gap-1 text-label">
            <span>Mật khẩu chỉ hiện một lần; phụ huynh phải đổi mật khẩu ở lần đăng nhập sau.</span>
            {passwords.map((item) => (
              <span key={item.user_id}>
                {item.full_name} ({item.login}): {item.temporary_password ?? item.skipped_reason}
              </span>
            ))}
          </span>
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}
