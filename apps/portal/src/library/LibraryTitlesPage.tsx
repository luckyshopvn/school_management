import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES, SCHOOL_LEVEL_CODES, type SchoolLevelCode } from '@school-management/shared';
import { Alert, Button, ConfirmDialog, StatusBadge, TextField } from '@school-management/ui';
import { useHasPermission } from '../session/permissions.js';
import {
  addCopies,
  CONDITION_LABELS,
  createTitle,
  deleteTitleFile,
  disposeCopies,
  downloadRegistry,
  downloadTitleFile,
  formatDate,
  LEVEL_LABELS,
  listTitles,
  printLabels,
  readLibrarySettings,
  readTitle,
  SOURCE_LABELS,
  updateCopy,
  updateTitle,
  uploadTitleFile,
  type CopySource,
  type LibraryCategory,
  type LibraryTitle,
  type LibraryTitleDetail,
  type TitleFile,
  type TitleInput,
} from './library-api.js';
import {
  EmptyRow,
  ErrorAlert,
  HEAD_CLASS,
  LibraryFrame,
  PAGE_SIZE,
  Pager,
  Panel,
  ReasonDialog,
  SELECT_CLASS,
  TH_CLASS,
  toggleId,
  useToast,
} from './library-common.js';

// Ấn phẩm và bản sao của thư viện (DT-22 phần 22a, tài liệu 47 mục 13.4, YCTD-181): tra cứu theo từ khóa, phân loại, khối;
// cán bộ có quyền quản lý thêm, sửa ấn phẩm, thêm bản sao có số đăng ký cá biệt, đổi tình trạng, thanh lý, in tem mã, đính
// tệp tài liệu số và xuất sổ đăng ký cá biệt; người chỉ có quyền xem thì chỉ tra cứu

const EMPTY_FORM = {
  category_id: '',
  title: '',
  authors: '',
  publisher: '',
  publish_year: '',
  isbn: '',
  school_level: '',
  grade_level: '',
  topic: '',
  language: 'vi',
  shelf: '',
  description: '',
};
type FormState = typeof EMPTY_FORM;

function formOf(title: LibraryTitle | undefined, categories: LibraryCategory[]): FormState {
  if (!title) {
    return { ...EMPTY_FORM, category_id: categories[0]?.id ?? '' };
  }
  return {
    category_id: title.category_id,
    title: title.title,
    authors: title.authors ?? '',
    publisher: title.publisher ?? '',
    publish_year: title.publish_year === null ? '' : String(title.publish_year),
    isbn: title.isbn ?? '',
    school_level: title.school_level ?? '',
    grade_level: title.grade_level ?? '',
    topic: title.topic ?? '',
    language: title.language,
    shelf: title.shelf ?? '',
    description: title.description ?? '',
  };
}

function inputOf(form: FormState, defaultCategoryId: string): TitleInput {
  const text = (value: string) => (value.trim() === '' ? null : value.trim());
  return {
    category_id: form.category_id || defaultCategoryId,
    title: form.title.trim(),
    authors: text(form.authors),
    publisher: text(form.publisher),
    publish_year: form.publish_year.trim() === '' ? null : Number(form.publish_year),
    isbn: text(form.isbn),
    school_level: (form.school_level || null) as SchoolLevelCode | null,
    grade_level: text(form.grade_level),
    topic: text(form.topic),
    language: form.language.trim() || 'vi',
    shelf: text(form.shelf),
    description: text(form.description),
  };
}

function TitleForm({
  title,
  categories,
  onSaved,
  onCancel,
}: {
  title: LibraryTitle | undefined;
  categories: LibraryCategory[];
  onSaved(id: string, message: string): void;
  onCancel(): void;
}) {
  const [form, setForm] = useState(() => formOf(title, categories));
  // Danh sách phân loại có thể tải sau khi mở biểu mẫu: chưa chọn thì dùng phân loại đầu tiên
  const defaultCategoryId = categories[0]?.id ?? '';
  const categoryId = form.category_id || defaultCategoryId;
  const set = (field: keyof FormState) => (event: { target: { value: string } }) =>
    setForm({ ...form, [field]: event.target.value });
  const save = useMutation({
    mutationFn: async () => {
      const input = inputOf(form, defaultCategoryId);
      if (title) {
        await updateTitle(title.id, input);
        return { id: title.id, message: 'Đã cập nhật ấn phẩm' };
      }
      return { id: (await createTitle(input)).id, message: 'Đã thêm ấn phẩm' };
    },
    onSuccess: (result) => onSaved(result.id, result.message),
  });
  return (
    <Panel>
      <h2 className="text-section-title font-semibold text-text">{title ? 'Sửa ấn phẩm' : 'Thêm ấn phẩm'}</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Phân loại
          <select value={categoryId} onChange={set('category_id')} className={SELECT_CLASS}>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <TextField label="Nhan đề" value={form.title} onChange={set('title')} />
        <TextField label="Tác giả" value={form.authors} onChange={set('authors')} />
        <TextField label="Nhà xuất bản" value={form.publisher} onChange={set('publisher')} />
        <TextField label="Năm xuất bản" inputMode="numeric" value={form.publish_year} onChange={set('publish_year')} />
        <TextField label="ISBN" value={form.isbn} onChange={set('isbn')} />
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Cấp học
          <select value={form.school_level} onChange={set('school_level')} className={SELECT_CLASS}>
            <option value="">Không phân cấp</option>
            {SCHOOL_LEVEL_CODES.map((code) => (
              <option key={code} value={code}>
                {LEVEL_LABELS[code]}
              </option>
            ))}
          </select>
        </label>
        <TextField label="Khối" value={form.grade_level} onChange={set('grade_level')} />
        <TextField label="Chủ đề" value={form.topic} onChange={set('topic')} />
        <TextField label="Ngôn ngữ" value={form.language} onChange={set('language')} />
        <TextField label="Kệ" value={form.shelf} onChange={set('shelf')} />
        <TextField label="Mô tả" value={form.description} onChange={set('description')} />
      </div>
      <ErrorAlert error={save.error} />
      <div className="flex gap-3">
        <Button
          variant="primary"
          disabled={save.isPending || form.title.trim() === '' || categoryId === ''}
          onClick={() => save.mutate()}
        >
          {title ? 'Lưu thay đổi' : 'Thêm ấn phẩm'}
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </div>
    </Panel>
  );
}

function TitleDetail({
  titleId,
  canManage,
  onEdit,
  onSaved,
}: {
  titleId: string;
  canManage: boolean;
  onEdit(title: LibraryTitleDetail): void;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ['library-title', titleId], queryFn: () => readTitle(titleId) });
  const [selected, setSelected] = useState<string[]>([]);
  const [disposing, setDisposing] = useState(false);
  const [removing, setRemoving] = useState<TitleFile>();
  const [copyForm, setCopyForm] = useState({
    quantity: '1',
    source: 'purchase' as CopySource,
    price: '',
    acquired_on: '',
    shelf: '',
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['library-title', titleId] });
    await queryClient.invalidateQueries({ queryKey: ['library-titles'] });
    onSaved(message);
  };
  const add = useMutation({
    mutationFn: () =>
      addCopies(titleId, {
        quantity: Number(copyForm.quantity),
        source: copyForm.source,
        price: copyForm.price.trim() === '' ? null : Number(copyForm.price),
        acquired_on: copyForm.acquired_on || null,
        shelf: copyForm.shelf.trim() || null,
      }),
    onSuccess: (created) =>
      refresh(
        `Đã thêm ${created.length} bản sao, số đăng ký ${created[0]?.copy_no ?? ''}${created.length > 1 ? ` đến ${created[created.length - 1]?.copy_no}` : ''}`,
      ),
  });
  const setCondition = useMutation({
    mutationFn: (input: { id: string; condition: 'good' | 'damaged' }) =>
      updateCopy(input.id, { condition: input.condition }),
    onSuccess: () => refresh('Đã đổi tình trạng bản sao'),
  });
  const dispose = useMutation({
    mutationFn: (reason: string) => disposeCopies(selected, reason),
    onSuccess: async (result) => {
      setSelected([]);
      setDisposing(false);
      await refresh(`Đã thanh lý ${result.disposed.length} bản sao`);
    },
    onError: () => setDisposing(false),
  });
  const labels = useMutation({
    mutationFn: () => printLabels(selected),
    onSuccess: () => onSaved('Đã tạo tệp tem mã'),
  });
  const retire = useMutation({
    mutationFn: (status: 'active' | 'retired') => updateTitle(titleId, { status }),
    onSuccess: (_, status) => refresh(status === 'retired' ? 'Đã ngừng dùng ấn phẩm' : 'Đã dùng lại ấn phẩm'),
  });
  const upload = useMutation({
    mutationFn: (file: File) => uploadTitleFile(titleId, file),
    onSuccess: () => refresh('Đã tải tệp lên'),
  });
  const download = useMutation({ mutationFn: (file: TitleFile) => downloadTitleFile(titleId, file) });
  const remove = useMutation({
    mutationFn: (file: TitleFile) => deleteTitleFile(titleId, file.id),
    onSuccess: async () => {
      setRemoving(undefined);
      await refresh('Đã xóa tệp');
    },
    onError: () => setRemoving(undefined),
  });
  const title = detail.data;
  if (detail.error) {
    return <ErrorAlert error={detail.error} />;
  }
  if (!title) {
    return null;
  }
  const selectable = title.copies.filter((copy) => copy.condition !== 'disposed');
  const error =
    add.error ??
    setCondition.error ??
    dispose.error ??
    labels.error ??
    retire.error ??
    upload.error ??
    download.error ??
    remove.error;
  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-section-title font-semibold text-text">{title.title}</h2>
        {canManage ? (
          <div className="flex gap-2">
            <Button onClick={() => onEdit(title)}>Sửa ấn phẩm</Button>
            <Button
              disabled={retire.isPending}
              onClick={() => retire.mutate(title.status === 'active' ? 'retired' : 'active')}
            >
              {title.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}
            </Button>
          </div>
        ) : null}
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-content md:grid-cols-3">
        <div>Tác giả: {title.authors ?? ''}</div>
        <div>Nhà xuất bản: {[title.publisher, title.publish_year].filter(Boolean).join(', ')}</div>
        <div>ISBN: {title.isbn ?? ''}</div>
        <div>
          Phân loại: {title.category_name}
          {title.lendable ? '' : ' (đọc tại chỗ)'}
        </div>
        <div>
          Cấp, khối:{' '}
          {[title.school_level ? LEVEL_LABELS[title.school_level] : null, title.grade_level].filter(Boolean).join(', ')}
        </div>
        <div>Kệ: {title.shelf ?? ''}</div>
        <div>Chủ đề: {title.topic ?? ''}</div>
        <div>
          Số bản: {title.copies_total}, sẵn sàng cho mượn: {title.copies_available}
        </div>
        <div>{title.status === 'retired' ? 'Đã ngừng dùng' : 'Đang dùng'}</div>
      </dl>
      {title.description ? <p className="text-content text-text-secondary">{title.description}</p> : null}
      <ErrorAlert error={error} />
      {canManage ? (
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            label="Số bản thêm"
            inputMode="numeric"
            value={copyForm.quantity}
            onChange={(event) => setCopyForm({ ...copyForm, quantity: event.target.value })}
          />
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Nguồn
            <select
              value={copyForm.source}
              onChange={(event) => setCopyForm({ ...copyForm, source: event.target.value as CopySource })}
              className={SELECT_CLASS}
            >
              {(Object.keys(SOURCE_LABELS) as CopySource[]).map((code) => (
                <option key={code} value={code}>
                  {SOURCE_LABELS[code]}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Giá (đồng)"
            inputMode="numeric"
            value={copyForm.price}
            onChange={(event) => setCopyForm({ ...copyForm, price: event.target.value })}
          />
          <TextField
            label="Ngày nhập"
            type="date"
            value={copyForm.acquired_on}
            onChange={(event) => setCopyForm({ ...copyForm, acquired_on: event.target.value })}
          />
          <TextField
            label="Kệ (trống thì theo ấn phẩm)"
            value={copyForm.shelf}
            onChange={(event) => setCopyForm({ ...copyForm, shelf: event.target.value })}
          />
          <Button
            variant="primary"
            disabled={
              add.isPending ||
              title.status !== 'active' ||
              !Number.isInteger(Number(copyForm.quantity)) ||
              Number(copyForm.quantity) < 1
            }
            onClick={() => add.mutate()}
          >
            Thêm bản sao
          </Button>
        </div>
      ) : null}
      {canManage ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-label text-text-secondary">Đã chọn {selected.length} bản</span>
          <Button disabled={selected.length === 0 || labels.isPending} onClick={() => labels.mutate()}>
            In tem mã
          </Button>
          <Button
            variant="danger"
            disabled={selected.length === 0 || dispose.isPending}
            onClick={() => setDisposing(true)}
          >
            Thanh lý
          </Button>
        </div>
      ) : null}
      <table className="w-full text-content" aria-label="Bản sao của ấn phẩm">
        <thead className={HEAD_CLASS}>
          <tr>
            {canManage ? (
              <th className={TH_CLASS}>
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả bản sao"
                  checked={selectable.length > 0 && selected.length === selectable.length}
                  onChange={(event) => setSelected(event.target.checked ? selectable.map((copy) => copy.id) : [])}
                />
              </th>
            ) : null}
            <th className={TH_CLASS}>Số đăng ký</th>
            <th className={TH_CLASS}>Tình trạng</th>
            <th className={TH_CLASS}>Kệ</th>
            <th className={TH_CLASS}>Nguồn, ngày nhập</th>
            <th className={TH_CLASS}>Đang mượn</th>
            {canManage ? <th className={TH_CLASS} /> : null}
          </tr>
        </thead>
        <tbody>
          {title.copies.length === 0 ? <EmptyRow columns={canManage ? 7 : 5} message="Chưa có bản sao" /> : null}
          {title.copies.map((copy) => (
            <tr key={copy.id} className="border-t border-border">
              {canManage ? (
                <td className={TH_CLASS}>
                  <input
                    type="checkbox"
                    aria-label={`Chọn bản ${copy.copy_no}`}
                    disabled={copy.condition === 'disposed'}
                    checked={selected.includes(copy.id)}
                    onChange={() => setSelected(toggleId(selected, copy.id))}
                  />
                </td>
              ) : null}
              <td className={`${TH_CLASS} font-semibold`}>{copy.copy_no}</td>
              <td className={TH_CLASS}>
                <StatusBadge
                  tone={copy.condition === 'good' ? 'success' : copy.condition === 'damaged' ? 'warning' : 'neutral'}
                  label={CONDITION_LABELS[copy.condition]}
                />
                {copy.condition === 'disposed' && copy.disposal_reason ? ` ${copy.disposal_reason}` : ''}
              </td>
              <td className={TH_CLASS}>{copy.shelf ?? ''}</td>
              <td className={TH_CLASS}>
                {SOURCE_LABELS[copy.source]}
                {copy.acquired_on ? `, ${formatDate(copy.acquired_on)}` : ''}
              </td>
              <td className={TH_CLASS}>{copy.loan_id ? `Hạn ${formatDate(copy.loan_due_on)}` : ''}</td>
              {canManage ? (
                <td className={TH_CLASS}>
                  {copy.condition === 'good' || copy.condition === 'damaged' ? (
                    <Button
                      disabled={setCondition.isPending}
                      onClick={() =>
                        setCondition.mutate({ id: copy.id, condition: copy.condition === 'good' ? 'damaged' : 'good' })
                      }
                    >
                      {copy.condition === 'good' ? 'Đánh dấu hỏng' : 'Đánh dấu tốt'}
                    </Button>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="text-section-title font-semibold text-text">Tài liệu số</h3>
      {canManage ? (
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Tải tệp lên (PDF, ảnh, Word, Excel, tối đa 20 MB)
          <input
            type="file"
            disabled={upload.isPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                upload.mutate(file);
              }
              event.target.value = '';
            }}
          />
        </label>
      ) : null}
      {title.files.length === 0 ? <p className="text-content text-text-secondary">Chưa có tệp tài liệu số.</p> : null}
      <ul className="flex flex-col gap-1 text-content">
        {title.files.map((file) => (
          <li key={file.id} className="flex flex-wrap items-center gap-3">
            <span>
              {file.file_name} ({Math.max(1, Math.round(file.size_bytes / 1024))} KB)
            </span>
            <Button disabled={download.isPending} onClick={() => download.mutate(file)}>
              Tải xuống
            </Button>
            {canManage ? (
              <Button variant="danger" disabled={remove.isPending} onClick={() => setRemoving(file)}>
                Xóa
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <ReasonDialog
        open={disposing}
        title="Thanh lý bản sao"
        description={`Thanh lý ${selected.length} bản sao đã chọn. Bản đã thanh lý không cho mượn nữa và không hoàn tác được.`}
        confirmLabel="Thanh lý"
        busy={dispose.isPending}
        onConfirm={(reason) => dispose.mutate(reason)}
        onCancel={() => setDisposing(false)}
      />
      <ConfirmDialog
        open={removing !== undefined}
        title="Xóa tệp tài liệu số"
        confirmLabel="Xóa tệp"
        busy={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
        onCancel={() => setRemoving(undefined)}
      >
        Xóa tệp {removing?.file_name}. Việc này không hoàn tác được.
      </ConfirmDialog>
    </Panel>
  );
}

export function LibraryTitlesPage() {
  const canManage = useHasPermission(PERMISSION_CODES.schoolLibraryManage);
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [applied, setApplied] = useState({ query: '', category_id: '', grade_level: '' });
  const [categoryId, setCategoryId] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [offset, setOffset] = useState(0);
  const [openId, setOpenId] = useState<string>();
  const [editing, setEditing] = useState<{ title: LibraryTitle | undefined }>();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['library-settings'], queryFn: readLibrarySettings });
  const categories = settings.data?.categories ?? [];
  const activeCategories = categories.filter((item) => item.status === 'active');
  const titles = useQuery({
    queryKey: ['library-titles', applied, offset],
    queryFn: () => listTitles({ ...applied, limit: PAGE_SIZE, offset }),
  });
  const registry = useMutation({
    mutationFn: downloadRegistry,
    onSuccess: () => toast.show('Đã tạo sổ đăng ký cá biệt'),
  });
  const search = () => {
    setOffset(0);
    setApplied({ query: query.trim(), category_id: categoryId, grade_level: gradeLevel.trim() });
  };
  return (
    <LibraryFrame path="/library/titles" toast={toast}>
      <Panel>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            search();
          }}
        >
          <TextField
            label="Từ khóa (nhan đề, tác giả, ISBN, chủ đề)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Phân loại
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={SELECT_CLASS}>
              <option value="">Tất cả</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <TextField label="Khối" value={gradeLevel} onChange={(event) => setGradeLevel(event.target.value)} />
          <Button type="submit" variant="primary">
            Tìm kiếm
          </Button>
          {canManage ? (
            <>
              <Button onClick={() => setEditing({ title: undefined })}>Thêm ấn phẩm</Button>
              <Button disabled={registry.isPending} onClick={() => registry.mutate('xlsx')}>
                Sổ đăng ký cá biệt (Excel)
              </Button>
              <Button disabled={registry.isPending} onClick={() => registry.mutate('pdf')}>
                Sổ đăng ký cá biệt (PDF)
              </Button>
            </>
          ) : null}
        </form>
        <ErrorAlert error={titles.error ?? settings.error ?? registry.error} />
        {!canManage ? <Alert tone="info">Bạn chỉ có quyền tra cứu danh mục sách.</Alert> : null}
        <table className="w-full text-content" aria-label="Danh sách ấn phẩm">
          <thead className={HEAD_CLASS}>
            <tr>
              <th className={TH_CLASS}>Nhan đề</th>
              <th className={TH_CLASS}>Tác giả</th>
              <th className={TH_CLASS}>Phân loại</th>
              <th className={TH_CLASS}>Khối</th>
              <th className={TH_CLASS}>Kệ</th>
              <th className={TH_CLASS}>Số bản</th>
              <th className={TH_CLASS}>Sẵn sàng</th>
              <th className={TH_CLASS} />
            </tr>
          </thead>
          <tbody>
            {titles.data && titles.data.items.length === 0 ? <EmptyRow columns={8} message="Không có ấn phẩm" /> : null}
            {(titles.data?.items ?? []).map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className={`${TH_CLASS} font-semibold`}>{item.title}</td>
                <td className={TH_CLASS}>{item.authors ?? ''}</td>
                <td className={TH_CLASS}>{item.category_name}</td>
                <td className={TH_CLASS}>{item.grade_level ?? ''}</td>
                <td className={TH_CLASS}>{item.shelf ?? ''}</td>
                <td className={TH_CLASS}>{item.copies_total}</td>
                <td className={TH_CLASS}>{item.copies_available}</td>
                <td className={TH_CLASS}>
                  <Button aria-label={`Xem ${item.title}`} onClick={() => setOpenId(item.id)}>
                    Xem chi tiết
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager total={titles.data?.total ?? 0} offset={offset} onChange={setOffset} />
      </Panel>
      {editing ? (
        <TitleForm
          key={editing.title?.id ?? 'new'}
          title={editing.title}
          categories={activeCategories}
          onCancel={() => setEditing(undefined)}
          onSaved={async (id, message) => {
            setEditing(undefined);
            setOpenId(id);
            await queryClient.invalidateQueries({ queryKey: ['library-titles'] });
            await queryClient.invalidateQueries({ queryKey: ['library-title', id] });
            toast.show(message);
          }}
        />
      ) : null}
      {openId ? (
        <TitleDetail
          key={openId}
          titleId={openId}
          canManage={canManage}
          onEdit={(title) => setEditing({ title })}
          onSaved={toast.show}
        />
      ) : null}
    </LibraryFrame>
  );
}
