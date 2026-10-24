import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge } from '@school-management/ui';
import { messageOf } from '../archives/archive-ui.js';
import { Page, useToast } from '../directives/directive-ui.js';
import { useHasPermission } from '../session/permissions.js';
import { listCollections } from './learning-resources-api.js';
import {
  BANK_KIND_LABELS,
  BANK_STATUS_LABELS,
  COGNITIVE_LABELS,
  downloadSharingFile,
  importPackage,
  listPackageImports,
  listRubrics,
  previewPackage,
  readCollectionBankItems,
  readSharingStatistics,
  rubricAction,
  saveRubric,
  searchBank,
  setCollectionBankItems,
  type BankItem,
  type BankKind,
  type Rubric,
} from './resource-sharing-api.js';

// Kho học liệu số, phần câu hỏi và chia sẻ (DT-22 phần 22h2, YCTD-184): 8. Câu hỏi, đề trong kho (tham chiếu ngân hàng của
// 22g1, thống kê sử dụng, chỗ trống chủ đề), 9. Rubric, 10. Gói chia sẻ liên trường
const cell = 'px-3 py-2';
const head = 'text-left text-label font-medium text-text-secondary';

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

// ---- 8. Câu hỏi, đề trong kho ----

export function ResourceBankPage() {
  const queryClient = useQueryClient();
  const { toast, setToast, close } = useToast();
  const [kind, setKind] = useState<BankKind>('question');
  const [q, setQ] = useState('');
  const [level, setLevel] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const bank = useQuery({
    queryKey: ['resource-bank', kind, q, level],
    queryFn: () => searchBank({ kind, q: q.trim() || undefined, cognitive_level: level || undefined }),
  });
  const collections = useQuery({ queryKey: ['resource-collections'], queryFn: listCollections });
  const mine = (collections.data ?? []).filter((collection) => collection.is_owner);
  const statistics = useQuery({ queryKey: ['resource-sharing-statistics'], queryFn: readSharingStatistics });
  const add = useMutation({
    mutationFn: async (item: BankItem) => {
      const current = await readCollectionBankItems(collectionId);
      return setCollectionBankItems(collectionId, [
        ...current.map((row) => ({ kind: row.kind, id: row.id })),
        { kind: item.kind, id: item.id },
      ]);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resource-collection-bank'] });
      setToast('Đã thêm vào bộ sưu tập');
    },
  });
  const data = statistics.data;
  return (
    <Page path="/learning-resources/questions" toast={toast} onToastClose={close}>
      <p className="text-content text-text-secondary">
        Câu hỏi, đề, ma trận nằm ở ngân hàng của nhóm "8. Kiểm tra, đánh giá"; kho chỉ hiện và tham chiếu. Soạn, thẩm
        định ở màn hình của ngân hàng.
      </p>
      {(bank.error ?? add.error) ? <Alert tone="danger">{messageOf(bank.error ?? add.error)}</Alert> : null}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Loại">
          <select
            aria-label="Loại"
            className={FORM_CONTROL_CLASS}
            value={kind}
            onChange={(event) => setKind(event.target.value as BankKind)}
          >
            {(Object.keys(BANK_KIND_LABELS) as BankKind[]).map((value) => (
              <option key={value} value={value}>
                {BANK_KIND_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tìm">
          <input
            aria-label="Tìm"
            className={FORM_CONTROL_CLASS}
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </Field>
        {kind === 'question' ? (
          <Field label="Mức nhận thức">
            <select
              aria-label="Mức nhận thức"
              className={FORM_CONTROL_CLASS}
              value={level}
              onChange={(event) => setLevel(event.target.value)}
            >
              <option value="">Mọi mức</option>
              {Object.entries(COGNITIVE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Thêm vào bộ sưu tập">
          <select
            aria-label="Thêm vào bộ sưu tập"
            className={FORM_CONTROL_CLASS}
            value={collectionId}
            onChange={(event) => setCollectionId(event.target.value)}
          >
            <option value="">Chọn bộ sưu tập của bạn</option>
            {mine.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-content" aria-label="Câu hỏi, đề trong kho">
          <thead className={head}>
            <tr>
              <th className={cell}>Nội dung</th>
              <th className={cell}>Môn, khối</th>
              {kind === 'question' ? (
                <>
                  <th className={cell}>Chủ đề, mức</th>
                  <th className={cell}>Đã dùng</th>
                </>
              ) : null}
              <th className={cell}>Trạng thái</th>
              <th className={cell} />
            </tr>
          </thead>
          <tbody>
            {(bank.data ?? []).map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className={cell}>{row.title}</td>
                <td className={cell}>
                  {row.subject_name}, {row.grade_level_code}
                </td>
                {kind === 'question' ? (
                  <>
                    <td className={cell}>
                      {[row.topic_name, COGNITIVE_LABELS[row.cognitive_level ?? '']].filter(Boolean).join(', ')}
                    </td>
                    <td className={cell}>
                      {row.exams ?? 0} đề, {row.attempts ?? 0} bài
                      {row.difficulty !== null && row.difficulty !== undefined ? `, độ khó ${row.difficulty}` : ''}
                    </td>
                  </>
                ) : null}
                <td className={cell}>
                  <StatusBadge
                    tone={row.status === 'approved' || row.status === 'locked' ? 'success' : 'neutral'}
                    label={BANK_STATUS_LABELS[row.status] ?? row.status}
                  />
                </td>
                <td className={`${cell} whitespace-nowrap text-right`}>
                  <a className="text-label text-brand underline" href={row.link}>
                    Mở ở ngân hàng
                  </a>{' '}
                  <Button variant="text" disabled={!collectionId || add.isPending} onClick={() => add.mutate(row)}>
                    Thêm
                  </Button>
                </td>
              </tr>
            ))}
            {bank.data && bank.data.length === 0 ? (
              <tr>
                <td className={`${cell} text-text-secondary`} colSpan={6}>
                  Không có mục nào bạn xem được.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {collectionId ? <CollectionBankItems collectionId={collectionId} /> : null}
      {data ? (
        <Section title="Thống kê sử dụng câu hỏi">
          <p className="text-content" aria-label="Tổng quan câu hỏi">
            {data.questions} câu dùng được; {data.used_questions} câu đã dùng trong đề
          </p>
          <table className="text-content" aria-label="Theo mức nhận thức">
            <thead className={head}>
              <tr>
                <th className={cell}>Mức</th>
                <th className={cell}>Số câu</th>
                <th className={cell}>Đã dùng</th>
                <th className={cell}>Số bài</th>
                <th className={cell}>Độ khó</th>
              </tr>
            </thead>
            <tbody>
              {data.questions_by_level.map((row) => (
                <tr key={row.level} className="border-t border-border">
                  <td className={cell}>{row.label}</td>
                  <td className={cell}>{row.questions}</td>
                  <td className={cell}>{row.used}</td>
                  <td className={cell}>{row.attempts}</td>
                  <td className={cell}>{row.difficulty ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="text-content" aria-label="Chỗ trống chủ đề">
            <thead className={head}>
              <tr>
                <th className={cell}>Chủ đề còn trống</th>
                <th className={cell}>Học liệu</th>
                <th className={cell}>Câu hỏi</th>
              </tr>
            </thead>
            <tbody>
              {data.gaps.map((row) => (
                <tr key={row.name} className="border-t border-border">
                  <td className={cell}>{row.name}</td>
                  <td className={cell}>{row.resources}</td>
                  <td className={cell}>{row.questions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}
    </Page>
  );
}

function CollectionBankItems({ collectionId }: { collectionId: string }) {
  const items = useQuery({
    queryKey: ['resource-collection-bank', collectionId],
    queryFn: () => readCollectionBankItems(collectionId),
  });
  return (
    <Section title="Câu hỏi, đề trong bộ sưu tập">
      <ul className="flex flex-col gap-1 text-content" aria-label="Mục ngân hàng trong bộ sưu tập">
        {(items.data ?? []).map((item) => (
          <li key={`${item.kind}-${item.id}`}>
            {item.kind_label}: {item.title}
          </li>
        ))}
        {items.data && items.data.length === 0 ? <li className="text-text-secondary">Chưa có mục nào.</li> : null}
      </ul>
    </Section>
  );
}

// ---- 9. Rubric ----

const emptyRubric = () => ({
  name: '',
  description: '',
  levels: [
    { label: 'Chưa đạt', score: '0' },
    { label: 'Đạt', score: '1' },
    { label: 'Tốt', score: '2' },
  ],
  criteria: [{ name: '', weight: '1', descriptors: ['', '', ''] }],
});

export function RubricsPage() {
  const queryClient = useQueryClient();
  const { toast, setToast, close } = useToast();
  const rubrics = useQuery({ queryKey: ['rubrics'], queryFn: listRubrics });
  const [form, setForm] = useState(emptyRubric);
  const [editing, setEditing] = useState<string | null>(null);
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['rubrics'] });
    setToast(message);
  };
  const save = useMutation({
    mutationFn: () =>
      saveRubric(editing, {
        name: form.name,
        description: form.description || null,
        visibility: 'school',
        levels: form.levels.map((level) => ({ label: level.label, score: Number(level.score.replace(',', '.')) })),
        criteria: form.criteria.map((criterion) => ({
          name: criterion.name,
          weight: Number(criterion.weight.replace(',', '.')),
          descriptors: criterion.descriptors,
        })),
      }),
    onSuccess: (rubric) => {
      setForm(emptyRubric());
      setEditing(null);
      return refresh(`Đã lưu rubric ${rubric.name} (điểm tối đa ${rubric.max_score})`);
    },
  });
  const act = useMutation({
    mutationFn: (input: { id: string; action: 'clone' | 'archive' | 'restore' }) =>
      rubricAction(input.id, input.action),
    onSuccess: (rubric, input) =>
      refresh(input.action === 'clone' ? `Đã nhân bản thành ${rubric.name}` : 'Đã cập nhật rubric'),
  });
  const edit = (rubric: Rubric) => {
    setEditing(rubric.id);
    setForm({
      name: rubric.name,
      description: rubric.description ?? '',
      levels: rubric.levels.map((level) => ({ label: level.label, score: String(level.score) })),
      criteria: rubric.criteria.map((criterion) => ({
        name: criterion.name,
        weight: String(criterion.weight),
        descriptors: [...criterion.descriptors],
      })),
    });
  };
  const setLevelCount = (count: number) =>
    setForm({
      ...form,
      levels: Array.from(
        { length: count },
        (_unused, index) => form.levels[index] ?? { label: `Mức ${index + 1}`, score: String(index) },
      ),
      criteria: form.criteria.map((criterion) => ({
        ...criterion,
        descriptors: Array.from({ length: count }, (_unused, index) => criterion.descriptors[index] ?? ''),
      })),
    });
  const error = save.error ?? act.error;
  return (
    <Page path="/learning-resources/rubrics" toast={toast} onToastClose={close}>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <table className="w-full text-content" aria-label="Danh sách rubric">
        <thead className={head}>
          <tr>
            <th className={cell}>Tên</th>
            <th className={cell}>Tiêu chí × mức</th>
            <th className={cell}>Điểm tối đa</th>
            <th className={cell}>Người lập</th>
            <th className={cell}>Trạng thái</th>
            <th className={cell} />
          </tr>
        </thead>
        <tbody>
          {(rubrics.data ?? []).map((rubric) => (
            <tr key={rubric.id} className="border-t border-border">
              <td className={cell}>{rubric.name}</td>
              <td className={cell}>
                {rubric.criteria.length} × {rubric.levels.length}
              </td>
              <td className={cell}>{rubric.max_score}</td>
              <td className={cell}>{rubric.owner_name}</td>
              <td className={cell}>{rubric.status === 'active' ? 'Đang dùng' : 'Đã lưu trữ'}</td>
              <td className={`${cell} whitespace-nowrap text-right`}>
                {rubric.is_owner ? (
                  <Button variant="text" onClick={() => edit(rubric)}>
                    Sửa
                  </Button>
                ) : null}
                <Button variant="text" onClick={() => act.mutate({ id: rubric.id, action: 'clone' })}>
                  Nhân bản
                </Button>
                <Button
                  variant="text"
                  onClick={() => void downloadSharingFile(`rubrics/${rubric.id}/print`, 'rubric.pdf')}
                >
                  In
                </Button>
                {rubric.is_owner ? (
                  <Button
                    variant="text"
                    onClick={() =>
                      act.mutate({ id: rubric.id, action: rubric.status === 'active' ? 'archive' : 'restore' })
                    }
                  >
                    {rubric.status === 'active' ? 'Lưu trữ' : 'Dùng lại'}
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Section title={editing ? 'Sửa rubric' : 'Lập rubric'}>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Tên rubric">
            <input
              aria-label="Tên rubric"
              className={FORM_CONTROL_CLASS}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <Field label="Mô tả">
            <input
              aria-label="Mô tả rubric"
              className={FORM_CONTROL_CLASS}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>
          <Field label="Số mức">
            <select
              aria-label="Số mức"
              className={FORM_CONTROL_CLASS}
              value={form.levels.length}
              onChange={(event) => setLevelCount(Number(event.target.value))}
            >
              {[2, 3, 4, 5, 6].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-3">
          {form.levels.map((level, index) => (
            <div key={index} className="flex gap-2">
              <input
                aria-label={`Tên mức ${index + 1}`}
                className={`w-32 ${FORM_CONTROL_CLASS}`}
                value={level.label}
                onChange={(event) =>
                  setForm({
                    ...form,
                    levels: form.levels.map((item, position) =>
                      position === index ? { ...item, label: event.target.value } : item,
                    ),
                  })
                }
              />
              <input
                aria-label={`Điểm mức ${index + 1}`}
                className={`w-16 ${FORM_CONTROL_CLASS}`}
                value={level.score}
                onChange={(event) =>
                  setForm({
                    ...form,
                    levels: form.levels.map((item, position) =>
                      position === index ? { ...item, score: event.target.value } : item,
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
        {form.criteria.map((criterion, row) => (
          <div key={row} className="flex flex-wrap items-end gap-2">
            <input
              aria-label={`Tiêu chí ${row + 1}`}
              placeholder="Tiêu chí"
              className={FORM_CONTROL_CLASS}
              value={criterion.name}
              onChange={(event) =>
                setForm({
                  ...form,
                  criteria: form.criteria.map((item, position) =>
                    position === row ? { ...item, name: event.target.value } : item,
                  ),
                })
              }
            />
            <input
              aria-label={`Trọng số tiêu chí ${row + 1}`}
              className={`w-16 ${FORM_CONTROL_CLASS}`}
              value={criterion.weight}
              onChange={(event) =>
                setForm({
                  ...form,
                  criteria: form.criteria.map((item, position) =>
                    position === row ? { ...item, weight: event.target.value } : item,
                  ),
                })
              }
            />
            {criterion.descriptors.map((descriptor, index) => (
              <input
                key={index}
                aria-label={`Mô tả tiêu chí ${row + 1} mức ${index + 1}`}
                placeholder={form.levels[index]?.label}
                className={FORM_CONTROL_CLASS}
                value={descriptor}
                onChange={(event) =>
                  setForm({
                    ...form,
                    criteria: form.criteria.map((item, position) =>
                      position === row
                        ? {
                            ...item,
                            descriptors: item.descriptors.map((text, at) => (at === index ? event.target.value : text)),
                          }
                        : item,
                    ),
                  })
                }
              />
            ))}
          </div>
        ))}
        <div className="flex gap-2">
          <Button
            onClick={() =>
              setForm({
                ...form,
                criteria: [...form.criteria, { name: '', weight: '1', descriptors: form.levels.map(() => '') }],
              })
            }
          >
            Thêm tiêu chí
          </Button>
          <Button variant="primary" disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>
            Lưu rubric
          </Button>
          {editing ? (
            <Button
              variant="text"
              onClick={() => {
                setEditing(null);
                setForm(emptyRubric());
              }}
            >
              Huỷ sửa
            </Button>
          ) : null}
        </div>
      </Section>
    </Page>
  );
}

// ---- 10. Gói chia sẻ liên trường ----

export function ResourcePackagesPage() {
  const queryClient = useQueryClient();
  const { toast, setToast, close } = useToast();
  const canShare = useHasPermission(PERMISSION_CODES.learningResourceShare);
  const collections = useQuery({ queryKey: ['resource-collections'], queryFn: listCollections });
  const imports = useQuery({ queryKey: ['resource-package-imports'], queryFn: listPackageImports, enabled: canShare });
  const [collectionId, setCollectionId] = useState('');
  const [school, setSchool] = useState('');
  const [file, setFile] = useState<File>();
  const preview = useQuery({
    queryKey: ['resource-package-preview', collectionId],
    queryFn: () => previewPackage(collectionId),
    enabled: Boolean(collectionId),
  });
  const exportFile = useMutation({
    mutationFn: () =>
      downloadSharingFile(
        `packages/export?collection_id=${collectionId}&source_school=${encodeURIComponent(school.trim())}`,
        'goi.hoclieu.gz',
      ),
    onSuccess: () => setToast('Đã xuất gói chia sẻ'),
  });
  const upload = useMutation({
    mutationFn: () => importPackage(file as File),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['resource-package-imports'] });
      setToast(
        `Đã nhập ${result.imported_count} học liệu, bỏ qua ${result.skipped.length}; học liệu nhập đang chờ duyệt`,
      );
    },
  });
  const error = preview.error ?? exportFile.error ?? upload.error;
  return (
    <Page path="/learning-resources/packages" toast={toast} onToastClose={close}>
      <p className="text-content text-text-secondary">
        Bản chạy nội bộ: trường xuất một bộ sưu tập thành tệp gói (bản kê, giấy phép, mã băm từng tệp, không có dữ liệu
        cá nhân) gửi trường khác; trường nhận nhập gói, học liệu vào kho ở trạng thái chờ duyệt. Danh mục chung liên
        trường chờ bản dịch vụ nhiều trường.
      </p>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <Section title="Xuất gói">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Bộ sưu tập">
            <select
              aria-label="Bộ sưu tập"
              className={FORM_CONTROL_CLASS}
              value={collectionId}
              onChange={(event) => setCollectionId(event.target.value)}
            >
              <option value="">Chọn bộ sưu tập</option>
              {(collections.data ?? []).map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tên trường nguồn">
            <input
              aria-label="Tên trường nguồn"
              className={FORM_CONTROL_CLASS}
              value={school}
              onChange={(event) => setSchool(event.target.value)}
            />
          </Field>
          <Button
            variant="primary"
            disabled={!collectionId || !school.trim() || !preview.data?.exportable.length || exportFile.isPending}
            onClick={() => exportFile.mutate()}
          >
            Xuất gói
          </Button>
        </div>
        {preview.data ? (
          <div className="flex flex-col gap-1 text-content" aria-label="Xem trước gói">
            <p>Xuất được {preview.data.exportable.length} học liệu.</p>
            {preview.data.skipped.map((row) => (
              <p key={row.title} className="text-text-secondary">
                Bỏ qua: {row.title} ({row.reason})
              </p>
            ))}
          </div>
        ) : null}
      </Section>
      <Section title="Nhập gói">
        <div className="flex flex-wrap items-end gap-3">
          <input
            type="file"
            aria-label="Tệp gói"
            className="text-label"
            onChange={(event) => setFile(event.target.files?.[0])}
          />
          <Button variant="primary" disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
            Nhập gói
          </Button>
        </div>
        {upload.data && upload.data.skipped.length > 0 ? (
          <ul className="text-content text-text-secondary" aria-label="Học liệu bỏ qua">
            {upload.data.skipped.map((row, index) => (
              <li key={index}>
                {row.title}: {row.reason}
              </li>
            ))}
          </ul>
        ) : null}
        <table className="w-full text-content" aria-label="Lịch sử nhập gói">
          <thead className={head}>
            <tr>
              <th className={cell}>Mã gói</th>
              <th className={cell}>Trường nguồn</th>
              <th className={cell}>Đã nhập</th>
              <th className={cell}>Bỏ qua</th>
              <th className={cell}>Người nhập</th>
            </tr>
          </thead>
          <tbody>
            {(imports.data ?? []).map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className={cell}>{row.package_code}</td>
                <td className={cell}>{row.source_school}</td>
                <td className={cell}>{row.imported_count}</td>
                <td className={cell}>{row.skipped.length}</td>
                <td className={cell}>{row.imported_by_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </Page>
  );
}
