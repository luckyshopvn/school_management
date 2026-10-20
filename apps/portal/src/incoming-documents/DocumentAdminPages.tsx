import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DOCUMENT_CATALOG_KIND_LABELS, PERMISSION_CODES, type DocumentCatalogKind } from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import { fieldErrorsOf, formatDate, messageOf, selectClass, useArchiveUnits } from '../archives/archive-ui.js';
import {
  deleteBook,
  deleteCatalog,
  deleteExternalUnit,
  deleteUnitGroup,
  exportRegister,
  listBooks,
  listCatalog,
  listDocumentStaff,
  listExternalUnits,
  listLeaders,
  listUnitGroups,
  readRegister,
  saveBook,
  saveCatalog,
  saveExternalUnit,
  saveLeaders,
  saveUnitGroup,
  type CatalogItem,
  type DocumentBook,
  type ExternalUnit,
  type ExternalUnitGroup,
  type RegisterRow,
} from './incoming-api.js';

// Quản trị văn bản theo VNPT iOffice (DT-18 phần 18a, YCTD-138): 2.1 Sổ văn bản (khai báo sổ, sổ đăng ký văn bản đến, xuất
// Excel), 2.2 Đơn vị bên ngoài, 2.3 Khai báo nhóm đơn vị ban hành, 2.4 Danh mục văn bản (hình thức, độ khẩn, độ mật, lĩnh
// vực), 2.5 Lãnh đạo nhận văn bản. Ghi cần quyền quản trị văn bản; văn thư xem sổ và in sổ
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const ADMIN = PERMISSION_CODES.incomingDocumentAdmin;

function Page({ path, children, toast, onToastClose }: { path: '/document-books' | '/external-units' | '/external-unit-groups' | '/document-catalogs' | '/document-leaders'; children: ReactNode; toast?: string; onToastClose(): void }) {
  return (
    <AppShell>
      <Toast message={toast} onClose={onToastClose} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle(path)}</h1>
        {children}
      </div>
    </AppShell>
  );
}

function useToast() {
  const [toast, setToast] = useState<string>();
  const close = useCallback(() => setToast(undefined), []);
  return { toast, setToast, close };
}

function Tabs<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value;
  options: Array<{ value: Value; label: string }>;
  onChange(value: Value): void;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 border-b border-border">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={`-mb-px rounded-t-lg border border-b-0 px-3 py-2 text-content ${
            value === option.value ? 'border-border bg-card font-semibold text-text' : 'border-transparent text-text-secondary'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ---- 2.1 Sổ văn bản ----

function BookForm({ book, onSaved, onCancel }: { book?: DocumentBook; onSaved(book: DocumentBook): void; onCancel(): void }) {
  const year = new Date().getFullYear();
  const [values, setValues] = useState({
    name: book?.name ?? 'Sổ văn bản đến',
    org_unit_id: book?.org_unit_id ?? '',
    year: String(book?.year ?? year),
    start_number: String(book?.start_number ?? 1),
    start_date: book?.start_date ?? `${year}-01-01`,
    end_date: book?.end_date ?? `${year}-12-31`,
    sort_order: String(book?.sort_order ?? 0),
    follower_ids: book?.followers.map((item) => item.user_id) ?? [],
    admin_ids: book?.admins.map((item) => item.user_id) ?? [],
  });
  const staff = useQuery({ queryKey: ['document-staff'], queryFn: listDocumentStaff });
  const units = useArchiveUnits(ADMIN);
  const save = useMutation({
    mutationFn: () =>
      saveBook(book?.id ?? null, {
        ...values,
        org_unit_id: values.org_unit_id || null,
        year: Number(values.year) || values.year,
        start_number: Number(values.start_number) || values.start_number,
        end_date: values.end_date || null,
        sort_order: Number(values.sort_order) || 0,
      }),
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const people = (key: 'follower_ids' | 'admin_ids', label: string) => (
    <FormRow label={label} error={errors[key]}>
      <select
        multiple
        aria-label={label}
        className={`${FORM_CONTROL_CLASS} h-32`}
        value={values[key]}
        onChange={(event) =>
          setValues((current) => ({ ...current, [key]: [...event.target.selectedOptions].map((option) => option.value) }))
        }
      >
        {(staff.data ?? []).map((person) => (
          <option key={person.user_id} value={person.user_id}>
            {person.full_name}
          </option>
        ))}
      </select>
    </FormRow>
  );
  const field = (key: 'name' | 'year' | 'start_number' | 'sort_order', label: string) => (
    <FormRow label={label} error={errors[key]}>
      <input className={FORM_CONTROL_CLASS} value={values[key]} onChange={(event) => set(key, event.target.value)} />
    </FormRow>
  );
  return (
    <form
      noValidate
      aria-label={book ? `Sửa sổ ${book.name}` : 'Thêm mới sổ văn bản'}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thông tin sổ">
        {field('name', 'Tên sổ văn bản')}
        <FormRow label="Đơn vị áp dụng" error={errors.org_unit_id}>
          <select className={FORM_CONTROL_CLASS} value={values.org_unit_id} onChange={(event) => set('org_unit_id', event.target.value)}>
            <option value="">Toàn trường</option>
            {units.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </FormRow>
        {field('year', 'Năm')}
        {field('start_number', 'Số bắt đầu')}
        <FormRow label="Ngày áp dụng" error={errors.start_date}>
          <input type="date" className={FORM_CONTROL_CLASS} value={values.start_date} onChange={(event) => set('start_date', event.target.value)} />
        </FormRow>
        <FormRow label="Ngày kết thúc" error={errors.end_date}>
          <input type="date" className={FORM_CONTROL_CLASS} value={values.end_date} onChange={(event) => set('end_date', event.target.value)} />
        </FormRow>
        {field('sort_order', 'STT hiển thị')}
        {people('follower_ids', 'Người theo dõi')}
        {people('admin_ids', 'Người quản trị')}
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

const BOOK_COLUMNS: Array<DataGridColumn<DocumentBook>> = [
  { id: 'name', header: 'Tên sổ văn bản', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
  { id: 'org_unit', header: 'Đơn vị áp dụng', cell: (row) => row.org_unit_name ?? 'Toàn trường' },
  { id: 'year', header: 'Năm', cell: (row) => row.year },
  { id: 'start_number', header: 'Số bắt đầu', cell: (row) => row.start_number },
  { id: 'start_date', header: 'Ngày áp dụng', cell: (row) => formatDate(row.start_date) },
  { id: 'end_date', header: 'Ngày kết thúc', cell: (row) => formatDate(row.end_date) },
  { id: 'sort_order', header: 'STT hiển thị', cell: (row) => row.sort_order },
  { id: 'followers', header: 'Người theo dõi', cell: (row) => row.followers.map((item) => item.user_name).join(', ') },
  { id: 'admins', header: 'Người quản trị', cell: (row) => row.admins.map((item) => item.user_name).join(', ') },
  { id: 'document_count', header: 'Số văn bản', cell: (row) => row.document_count },
  { id: 'next_number', header: 'Số đến kế tiếp', cell: (row) => row.next_number },
];

const REGISTER_COLUMNS: Array<DataGridColumn<RegisterRow>> = [
  { id: 'arrival_date', header: 'Ngày đến', cell: (row) => formatDate(row.arrival_date) },
  { id: 'arrival_number', header: 'Số đến', cell: (row) => row.arrival_number },
  { id: 'issuer_name', header: 'Tác giả', cell: (row) => row.issuer_name },
  { id: 'symbol', header: 'Số ký hiệu', cell: (row) => row.symbol },
  { id: 'document_date', header: 'Ngày văn bản', cell: (row) => formatDate(row.document_date) },
  { id: 'summary', header: 'Trích yếu', alwaysVisible: true, cell: (row) => row.summary },
  { id: 'recipients', header: 'Nơi nhận', cell: (row) => row.recipients },
  { id: 'form_name', header: 'Hình thức', cell: (row) => row.form_name ?? '' },
  { id: 'urgency_name', header: 'Độ khẩn', cell: (row) => row.urgency_name ?? '' },
  { id: 'field_name', header: 'Lĩnh vực', cell: (row) => row.field_name ?? '' },
  { id: 'main_handler', header: 'Xử lý chính', cell: (row) => row.main_handler },
];

export function DocumentBooksPage() {
  const canAdmin = useHasPermission(ADMIN);
  const queryClient = useQueryClient();
  const { toast, setToast, close } = useToast();
  const bookGrid = useGridSettings('document-books');
  const registerGrid = useGridSettings('incoming-register');
  const [tab, setTab] = useState<'books' | 'register'>('books');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [deleting, setDeleting] = useState<DocumentBook>();
  const [bookId, setBookId] = useState('');
  const today = VIETNAM_DATE.format(new Date());
  const [range, setRange] = useState({ from: `${today.slice(0, 4)}-01-01`, to: today });
  const [exportError, setExportError] = useState<string>();
  const books = useQuery({ queryKey: ['document-books', year], queryFn: () => listBooks(Number(year) || undefined) });
  const selected = bookId || books.data?.[0]?.id || '';
  const register = useQuery({
    queryKey: ['document-register', selected, range],
    queryFn: () => readRegister(selected, range.from, range.to),
    enabled: tab === 'register' && Boolean(selected),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['document-books'] });
  const remove = useMutation({
    mutationFn: (book: DocumentBook) => deleteBook(book.id),
    onSuccess: async (_result, book) => {
      setDeleting(undefined);
      await refresh();
      setToast(`Đã xóa ${book.name}`);
    },
    onError: () => setDeleting(undefined),
  });
  return (
    <Page path="/document-books" toast={toast} onToastClose={close}>
      <Tabs<'books' | 'register'>
        label="Sổ văn bản"
        value={tab}
        options={[
          { value: 'books', label: 'Khai báo sổ văn bản đến' },
          { value: 'register', label: 'Sổ đăng ký văn bản đến' },
        ]}
        onChange={setTab}
      />
      <label className="max-w-xs text-label font-medium text-text">
        Năm
        <input className={selectClass} inputMode="numeric" value={year} onChange={(event) => setYear(event.target.value)} />
      </label>
      {books.error ? <Alert tone="danger">{messageOf(books.error)}</Alert> : null}
      {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      {tab === 'books' ? (
        <>
          {creating ? (
            <section className="rounded-xl border border-border bg-card p-4">
              <BookForm
                onCancel={() => setCreating(false)}
                onSaved={(saved) => {
                  setCreating(false);
                  void refresh();
                  setToast(`Đã tạo ${saved.name}`);
                }}
              />
            </section>
          ) : null}
          <DataGrid
            label="Danh sách sổ văn bản đến"
            columns={BOOK_COLUMNS}
            rows={books.data ?? []}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.name}
            loading={!books.data && !books.error}
            emptyText="Chưa có sổ văn bản đến của năm."
            toolbar={
              canAdmin ? (
                <Button variant="primary" onClick={() => setCreating(true)}>
                  Thêm mới
                </Button>
              ) : null
            }
            rowActions={(row) =>
              canAdmin ? (
                <span className="flex justify-end gap-1">
                  <Button variant="text" onClick={() => setEditingId(editingId === row.id ? undefined : row.id)}>
                    Sửa
                  </Button>
                  <Button variant="text" onClick={() => setDeleting(row)}>
                    Xóa
                  </Button>
                </span>
              ) : null
            }
            activeRowId={editingId}
            renderRowDetail={(row) =>
              editingId === row.id ? (
                <BookForm
                  key={row.id}
                  book={row}
                  onCancel={() => setEditingId(undefined)}
                  onSaved={(saved) => {
                    setEditingId(undefined);
                    void refresh();
                    setToast(`Đã ghi ${saved.name}`);
                  }}
                />
              ) : null
            }
            settings={bookGrid.settings}
            onSettingsChange={bookGrid.update}
          />
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="text-label font-medium text-text">
              Sổ văn bản
              <select className={selectClass} value={selected} onChange={(event) => setBookId(event.target.value)}>
                {(books.data ?? []).map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-label font-medium text-text">
              Từ ngày
              <input type="date" className={selectClass} value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} />
            </label>
            <label className="text-label font-medium text-text">
              Đến ngày
              <input type="date" className={selectClass} value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} />
            </label>
          </div>
          {register.error ? <Alert tone="danger">{messageOf(register.error)}</Alert> : null}
          {exportError ? <Alert tone="danger">{exportError}</Alert> : null}
          <DataGrid
            label="Sổ đăng ký văn bản đến"
            columns={REGISTER_COLUMNS}
            rows={register.data?.items ?? []}
            getRowId={(row) => row.id}
            getRowLabel={(row) => String(row.arrival_number)}
            loading={Boolean(selected) && !register.data && !register.error}
            emptyText="Sổ chưa có văn bản trong khoảng ngày."
            toolbar={
              <Button
                disabled={!selected}
                onClick={() => {
                  setExportError(undefined);
                  exportRegister(selected, range.from, range.to).catch((error: unknown) => setExportError(messageOf(error)));
                }}
              >
                Xuất Excel
              </Button>
            }
            settings={registerGrid.settings}
            onSettingsChange={registerGrid.update}
          />
        </>
      )}
      {deleting ? (
        <ConfirmDeleteDialog
          open
          subject={deleting.name}
          busy={remove.isPending}
          onCancel={() => setDeleting(undefined)}
          onConfirm={() => remove.mutate(deleting)}
        />
      ) : null}
    </Page>
  );
}

// ---- 2.2 Đơn vị bên ngoài ----

function UnitForm({ unit, onSaved, onCancel }: { unit?: ExternalUnit; onSaved(unit: ExternalUnit): void; onCancel(): void }) {
  const [values, setValues] = useState({
    code: unit?.code ?? '',
    name: unit?.name ?? '',
    address: unit?.address ?? '',
    phone: unit?.phone ?? '',
    email: unit?.email ?? '',
    electronic_code: unit?.electronic_code ?? '',
    sort_order: String(unit?.sort_order ?? 0),
    active: unit?.active ?? true,
  });
  const save = useMutation({
    mutationFn: () =>
      saveExternalUnit(unit?.id ?? null, {
        code: values.code,
        name: values.name,
        address: values.address || null,
        phone: values.phone || null,
        email: values.email || null,
        electronic_code: values.electronic_code || null,
        sort_order: Number(values.sort_order) || 0,
        active: values.active,
      }),
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  const field = (key: 'code' | 'name' | 'address' | 'phone' | 'email' | 'electronic_code' | 'sort_order', label: string) => (
    <FormRow label={label} error={errors[key]}>
      <input
        className={FORM_CONTROL_CLASS}
        value={values[key]}
        onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
      />
    </FormRow>
  );
  return (
    <form
      noValidate
      aria-label={unit ? `Sửa đơn vị ${unit.name}` : 'Thêm mới đơn vị bên ngoài'}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thông tin đơn vị">
        {field('code', 'Mã đơn vị')}
        {field('name', 'Tên đơn vị')}
        {field('address', 'Địa chỉ')}
        {field('phone', 'Điện thoại')}
        {field('email', 'Thư điện tử')}
        {field('electronic_code', 'Mã định danh điện tử (liên thông)')}
        {field('sort_order', 'STT hiển thị')}
        <FormRow label="Đang sử dụng">
          <input
            type="checkbox"
            className="h-4 w-4"
            aria-label="Đang sử dụng"
            checked={values.active}
            onChange={(event) => setValues((current) => ({ ...current, active: event.target.checked }))}
          />
        </FormRow>
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

const UNIT_COLUMNS: Array<DataGridColumn<ExternalUnit>> = [
  { id: 'code', header: 'Mã đơn vị', cell: (row) => row.code },
  { id: 'name', header: 'Tên đơn vị', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
  { id: 'groups', header: 'Nhóm đơn vị ban hành', cell: (row) => row.group_names.join(', ') },
  { id: 'address', header: 'Địa chỉ', hiddenByDefault: true, cell: (row) => row.address ?? '' },
  { id: 'phone', header: 'Điện thoại', cell: (row) => row.phone ?? '' },
  { id: 'email', header: 'Thư điện tử', cell: (row) => row.email ?? '' },
  { id: 'electronic_code', header: 'Mã định danh điện tử', cell: (row) => row.electronic_code ?? '' },
  { id: 'active', header: 'Trạng thái', cell: (row) => (row.active ? 'Đang sử dụng' : 'Ngừng sử dụng') },
];

export function ExternalUnitsPage() {
  const queryClient = useQueryClient();
  const { toast, setToast, close } = useToast();
  const grid = useGridSettings('external-units');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [deleting, setDeleting] = useState<ExternalUnit>();
  const units = useQuery({ queryKey: ['external-units', search], queryFn: () => listExternalUnits(search.trim() || undefined) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['external-units'] });
  const remove = useMutation({
    mutationFn: (unit: ExternalUnit) => deleteExternalUnit(unit.id),
    onSuccess: async (_result, unit) => {
      setDeleting(undefined);
      await refresh();
      setToast(`Đã xóa đơn vị ${unit.name}`);
    },
    onError: () => setDeleting(undefined),
  });
  return (
    <Page path="/external-units" toast={toast} onToastClose={close}>
      {creating ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <UnitForm
            onCancel={() => setCreating(false)}
            onSaved={(saved) => {
              setCreating(false);
              void refresh();
              setToast(`Đã thêm đơn vị ${saved.name}`);
            }}
          />
        </section>
      ) : null}
      {units.error ? <Alert tone="danger">{messageOf(units.error)}</Alert> : null}
      {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      <DataGrid
        label="Danh sách đơn vị bên ngoài"
        columns={UNIT_COLUMNS}
        rows={units.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        loading={!units.data && !units.error}
        emptyText="Chưa có đơn vị bên ngoài."
        search={{ label: 'Tìm theo mã, tên đơn vị', value: search, onChange: setSearch }}
        toolbar={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Thêm mới
          </Button>
        }
        rowActions={(row) => (
          <span className="flex justify-end gap-1">
            <Button variant="text" onClick={() => setEditingId(editingId === row.id ? undefined : row.id)}>
              Sửa
            </Button>
            <Button variant="text" onClick={() => setDeleting(row)}>
              Xóa
            </Button>
          </span>
        )}
        activeRowId={editingId}
        renderRowDetail={(row) =>
          editingId === row.id ? (
            <UnitForm
              key={row.id}
              unit={row}
              onCancel={() => setEditingId(undefined)}
              onSaved={(saved) => {
                setEditingId(undefined);
                void refresh();
                setToast(`Đã ghi đơn vị ${saved.name}`);
              }}
            />
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      {deleting ? (
        <ConfirmDeleteDialog
          open
          subject={`đơn vị ${deleting.name}`}
          busy={remove.isPending}
          onCancel={() => setDeleting(undefined)}
          onConfirm={() => remove.mutate(deleting)}
        />
      ) : null}
    </Page>
  );
}

// ---- 2.3 Khai báo nhóm đơn vị ban hành ----

function GroupForm({
  group,
  onSaved,
  onCancel,
}: {
  group?: ExternalUnitGroup;
  onSaved(group: ExternalUnitGroup): void;
  onCancel(): void;
}) {
  const units = useQuery({ queryKey: ['external-units', ''], queryFn: () => listExternalUnits() });
  const [name, setName] = useState(group?.name ?? '');
  const [note, setNote] = useState(group?.note ?? '');
  const [unitIds, setUnitIds] = useState<string[]>(group?.unit_ids ?? []);
  const save = useMutation({
    mutationFn: () => saveUnitGroup(group?.id ?? null, { name, note: note || null, sort_order: group?.sort_order ?? 0, unit_ids: unitIds }),
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  return (
    <form
      noValidate
      aria-label={group ? `Sửa nhóm ${group.name}` : 'Thêm mới nhóm đơn vị ban hành'}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Nhóm đơn vị ban hành">
        <FormRow label="Tên nhóm" error={errors.name}>
          <input className={FORM_CONTROL_CLASS} value={name} onChange={(event) => setName(event.target.value)} />
        </FormRow>
        <FormRow label="Ghi chú" error={errors.note}>
          <input className={FORM_CONTROL_CLASS} value={note} onChange={(event) => setNote(event.target.value)} />
        </FormRow>
        <FormRow label="Đơn vị trong nhóm" error={errors.unit_ids}>
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {(units.data ?? []).map((unit) => (
              <label key={unit.id} className="flex items-center gap-2 text-content">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={unitIds.includes(unit.id)}
                  onChange={(event) =>
                    setUnitIds((current) =>
                      event.target.checked ? [...current, unit.id] : current.filter((id) => id !== unit.id),
                    )
                  }
                />
                {unit.name}
              </label>
            ))}
          </div>
        </FormRow>
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

const GROUP_COLUMNS: Array<DataGridColumn<ExternalUnitGroup>> = [
  { id: 'name', header: 'Tên nhóm', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
  { id: 'units', header: 'Đơn vị trong nhóm', cell: (row) => row.unit_names.join(', ') },
  { id: 'note', header: 'Ghi chú', cell: (row) => row.note ?? '' },
];

export function ExternalUnitGroupsPage() {
  const queryClient = useQueryClient();
  const { toast, setToast, close } = useToast();
  const grid = useGridSettings('external-unit-groups');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [deleting, setDeleting] = useState<ExternalUnitGroup>();
  const groups = useQuery({ queryKey: ['external-unit-groups'], queryFn: listUnitGroups });
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['external-unit-groups'] }),
      queryClient.invalidateQueries({ queryKey: ['external-units'] }),
    ]);
  const remove = useMutation({
    mutationFn: (group: ExternalUnitGroup) => deleteUnitGroup(group.id),
    onSuccess: async (_result, group) => {
      setDeleting(undefined);
      await refresh();
      setToast(`Đã xóa nhóm ${group.name}`);
    },
    onError: () => setDeleting(undefined),
  });
  return (
    <Page path="/external-unit-groups" toast={toast} onToastClose={close}>
      {creating ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <GroupForm
            onCancel={() => setCreating(false)}
            onSaved={(saved) => {
              setCreating(false);
              void refresh();
              setToast(`Đã thêm nhóm ${saved.name}`);
            }}
          />
        </section>
      ) : null}
      {groups.error ? <Alert tone="danger">{messageOf(groups.error)}</Alert> : null}
      <DataGrid
        label="Danh sách nhóm đơn vị ban hành"
        columns={GROUP_COLUMNS}
        rows={groups.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        loading={!groups.data && !groups.error}
        emptyText="Chưa có nhóm đơn vị."
        toolbar={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Thêm mới
          </Button>
        }
        rowActions={(row) => (
          <span className="flex justify-end gap-1">
            <Button variant="text" onClick={() => setEditingId(editingId === row.id ? undefined : row.id)}>
              Sửa
            </Button>
            <Button variant="text" onClick={() => setDeleting(row)}>
              Xóa
            </Button>
          </span>
        )}
        activeRowId={editingId}
        renderRowDetail={(row) =>
          editingId === row.id ? (
            <GroupForm
              key={row.id}
              group={row}
              onCancel={() => setEditingId(undefined)}
              onSaved={(saved) => {
                setEditingId(undefined);
                void refresh();
                setToast(`Đã ghi nhóm ${saved.name}`);
              }}
            />
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      {deleting ? (
        <ConfirmDeleteDialog
          open
          subject={`nhóm ${deleting.name}`}
          busy={remove.isPending}
          onCancel={() => setDeleting(undefined)}
          onConfirm={() => remove.mutate(deleting)}
        />
      ) : null}
    </Page>
  );
}

// ---- 2.4 Danh mục văn bản ----

const CATALOG_KINDS = Object.keys(DOCUMENT_CATALOG_KIND_LABELS) as DocumentCatalogKind[];
const LEVEL_LABELS: Partial<Record<DocumentCatalogKind, string[]>> = {
  urgency: ['Thường', 'Khẩn', 'Hỏa tốc'],
  secrecy: ['Thường', 'Mật', 'Tối mật'],
};

function CatalogForm({
  kind,
  item,
  onSaved,
  onCancel,
}: {
  kind: DocumentCatalogKind;
  item?: CatalogItem;
  onSaved(item: CatalogItem): void;
  onCancel(): void;
}) {
  const [values, setValues] = useState({
    code: item?.code ?? '',
    name: item?.name ?? '',
    level: item?.level ?? 0,
    education_level: item?.education_level ?? '',
    sort_order: String(item?.sort_order ?? 0),
    active: item?.active ?? true,
  });
  const save = useMutation({
    mutationFn: () =>
      saveCatalog(item?.id ?? null, {
        kind,
        code: values.code,
        name: values.name,
        level: values.level,
        education_level: values.education_level || null,
        sort_order: Number(values.sort_order) || 0,
        active: values.active,
      }),
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  const levels = LEVEL_LABELS[kind];
  return (
    <form
      noValidate
      aria-label={item ? `Sửa ${item.name}` : `Thêm mới ${DOCUMENT_CATALOG_KIND_LABELS[kind].toLocaleLowerCase('vi')}`}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title={DOCUMENT_CATALOG_KIND_LABELS[kind]}>
        <FormRow label="Mã" error={errors.code}>
          <input className={FORM_CONTROL_CLASS} value={values.code} onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))} />
        </FormRow>
        <FormRow label="Tên" error={errors.name}>
          <input className={FORM_CONTROL_CLASS} value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} />
        </FormRow>
        {levels ? (
          <FormRow label="Mức" error={errors.level}>
            <select
              className={FORM_CONTROL_CLASS}
              value={values.level}
              onChange={(event) => setValues((current) => ({ ...current, level: Number(event.target.value) }))}
            >
              {levels.map((label, level) => (
                <option key={label} value={level}>
                  {label}
                </option>
              ))}
            </select>
          </FormRow>
        ) : null}
        <FormRow label="Cấp học (trống là mọi cấp)" error={errors.education_level}>
          <input
            className={FORM_CONTROL_CLASS}
            value={values.education_level}
            onChange={(event) => setValues((current) => ({ ...current, education_level: event.target.value }))}
          />
        </FormRow>
        <FormRow label="STT hiển thị" error={errors.sort_order}>
          <input className={FORM_CONTROL_CLASS} value={values.sort_order} onChange={(event) => setValues((current) => ({ ...current, sort_order: event.target.value }))} />
        </FormRow>
        <FormRow label="Đang sử dụng">
          <input
            type="checkbox"
            className="h-4 w-4"
            aria-label="Đang sử dụng"
            checked={values.active}
            onChange={(event) => setValues((current) => ({ ...current, active: event.target.checked }))}
          />
        </FormRow>
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

export function DocumentCatalogsPage() {
  const queryClient = useQueryClient();
  const { toast, setToast, close } = useToast();
  const grid = useGridSettings('document-catalogs');
  const [kind, setKind] = useState<DocumentCatalogKind>('form');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [deleting, setDeleting] = useState<CatalogItem>();
  const catalog = useQuery({ queryKey: ['document-catalogs'], queryFn: () => listCatalog() });
  const rows = (catalog.data ?? []).filter((item) => item.kind === kind);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['document-catalogs'] });
  const remove = useMutation({
    mutationFn: (item: CatalogItem) => deleteCatalog(item.id),
    onSuccess: async (_result, item) => {
      setDeleting(undefined);
      await refresh();
      setToast(`Đã xóa ${item.name}`);
    },
    onError: () => setDeleting(undefined),
  });
  const levels = LEVEL_LABELS[kind];
  const columns: Array<DataGridColumn<CatalogItem>> = [
    { id: 'code', header: 'Mã', cell: (row) => row.code },
    { id: 'name', header: 'Tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
    ...(levels ? [{ id: 'level', header: 'Mức', cell: (row: CatalogItem) => levels[row.level] ?? '' }] : []),
    { id: 'education_level', header: 'Cấp học', cell: (row) => row.education_level ?? 'Mọi cấp' },
    { id: 'sort_order', header: 'STT hiển thị', cell: (row) => row.sort_order },
    { id: 'active', header: 'Trạng thái', cell: (row) => (row.active ? 'Đang sử dụng' : 'Ngừng sử dụng') },
  ];
  return (
    <Page path="/document-catalogs" toast={toast} onToastClose={close}>
      <Tabs
        label="Danh mục văn bản"
        value={kind}
        options={CATALOG_KINDS.map((value) => ({ value, label: DOCUMENT_CATALOG_KIND_LABELS[value] }))}
        onChange={(value) => {
          setKind(value);
          setCreating(false);
          setEditingId(undefined);
        }}
      />
      {creating ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <CatalogForm
            kind={kind}
            onCancel={() => setCreating(false)}
            onSaved={(saved) => {
              setCreating(false);
              void refresh();
              setToast(`Đã thêm ${saved.name}`);
            }}
          />
        </section>
      ) : null}
      {catalog.error ? <Alert tone="danger">{messageOf(catalog.error)}</Alert> : null}
      {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      <DataGrid
        label={`Danh mục ${DOCUMENT_CATALOG_KIND_LABELS[kind].toLocaleLowerCase('vi')}`}
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        loading={!catalog.data && !catalog.error}
        emptyText="Danh mục trống."
        toolbar={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Thêm mới
          </Button>
        }
        rowActions={(row) => (
          <span className="flex justify-end gap-1">
            <Button variant="text" onClick={() => setEditingId(editingId === row.id ? undefined : row.id)}>
              Sửa
            </Button>
            <Button variant="text" onClick={() => setDeleting(row)}>
              Xóa
            </Button>
          </span>
        )}
        activeRowId={editingId}
        renderRowDetail={(row) =>
          editingId === row.id ? (
            <CatalogForm
              key={row.id}
              kind={kind}
              item={row}
              onCancel={() => setEditingId(undefined)}
              onSaved={(saved) => {
                setEditingId(undefined);
                void refresh();
                setToast(`Đã ghi ${saved.name}`);
              }}
            />
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      {deleting ? (
        <ConfirmDeleteDialog
          open
          subject={deleting.name}
          busy={remove.isPending}
          onCancel={() => setDeleting(undefined)}
          onConfirm={() => remove.mutate(deleting)}
        >
          Mục đã dùng ở văn bản thì không xóa được, hãy bỏ chọn "Đang sử dụng".
        </ConfirmDeleteDialog>
      ) : null}
    </Page>
  );
}

// ---- 2.5 Lãnh đạo nhận văn bản ----

export function DocumentLeadersPage() {
  const queryClient = useQueryClient();
  const { toast, setToast, close } = useToast();
  const staff = useQuery({ queryKey: ['document-staff'], queryFn: listDocumentStaff });
  const leaders = useQuery({ queryKey: ['document-leaders'], queryFn: listLeaders });
  const [chosen, setChosen] = useState<Record<string, string | null>>({});
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (leaders.data && !loaded) {
      setChosen(Object.fromEntries(leaders.data.map((leader) => [leader.user_id, leader.title ?? ''])));
      setLoaded(true);
    }
  }, [leaders.data, loaded]);
  const save = useMutation({
    mutationFn: () =>
      saveLeaders(
        Object.entries(chosen)
          .filter(([, title]) => title !== null)
          .map(([userId, title]) => ({ user_id: userId, title: title || null })),
      ),
    onSuccess: async (saved) => {
      queryClient.setQueryData(['document-leaders'], saved);
      setToast(`Đã ghi ${saved.length} lãnh đạo nhận văn bản`);
    },
  });
  return (
    <Page path="/document-leaders" toast={toast} onToastClose={close}>
      <p className="text-content text-text-secondary">
        Người được chọn hiện trong danh sách khi văn thư "Trình lãnh đạo" và khi chuyển lãnh đạo. Chỉ chọn được nhân sự đang
        làm việc có tài khoản.
      </p>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      {staff.error ? <Alert tone="danger">{messageOf(staff.error)}</Alert> : null}
      <table className="w-full text-content" aria-label="Lãnh đạo nhận văn bản">
        <thead>
          <tr className="text-left text-label text-text-secondary">
            <th className="p-2">Chọn</th>
            <th className="p-2">Họ và tên</th>
            <th className="p-2">Bộ phận</th>
            <th className="p-2">Chức vụ in trên phiếu</th>
          </tr>
        </thead>
        <tbody>
          {(staff.data ?? []).map((person) => {
            const selected = chosen[person.user_id] !== undefined && chosen[person.user_id] !== null;
            return (
              <tr key={person.user_id} className="border-t border-border">
                <td className="p-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    aria-label={`Chọn ${person.full_name}`}
                    checked={selected}
                    onChange={(event) =>
                      setChosen((current) => ({
                        ...current,
                        [person.user_id]: event.target.checked ? (person.job_title_name ?? '') : null,
                      }))
                    }
                  />
                </td>
                <td className="p-2 font-medium">{person.full_name}</td>
                <td className="p-2">{person.department_name ?? person.org_unit_name ?? ''}</td>
                <td className="p-2">
                  {selected ? (
                    <input
                      aria-label={`Chức vụ của ${person.full_name}`}
                      className={FORM_CONTROL_CLASS}
                      value={chosen[person.user_id] ?? ''}
                      onChange={(event) => setChosen((current) => ({ ...current, [person.user_id]: event.target.value }))}
                    />
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div>
        <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
          Ghi
        </Button>
      </div>
    </Page>
  );
}
