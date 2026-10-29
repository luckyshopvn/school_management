import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, StatusBadge, TextField } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import {
  createTextbookSet,
  formatDate,
  issueTextbooks,
  listOutstandingTextbooks,
  listTextbookSets,
  RETURN_CONDITION_LABELS,
  returnMany,
  updateTextbookSet,
  type IssueResult,
  type ReturnCondition,
  type TextbookSet,
} from './library-api.js';
import {
  EmptyRow,
  ErrorAlert,
  HEAD_CLASS,
  LibraryFrame,
  Panel,
  SELECT_CLASS,
  TabBar,
  TH_CLASS,
  TitlePicker,
  toggleId,
  useToast,
} from './library-common.js';

// Phát và thu sách giáo khoa (DT-22 phần 22a, tài liệu 47 mục 13.4, YCTD-181): bộ sách theo khối, phát cả bộ cho học sinh
// một lớp (mỗi học sinh một bản mỗi đầu sách, hạn trả là ngày kết thúc năm học), thu hàng loạt cuối năm kèm tình trạng.
// Học sinh chưa có thẻ và đầu sách thiếu bản được báo lại sau khi phát
type Tab = 'issue' | 'collect' | 'sets';
const TAB_LABELS: Record<Tab, string> = { issue: 'Phát sách', collect: 'Thu sách', sets: 'Bộ sách theo khối' };

function ClassSelect({
  classes,
  value,
  onChange,
}: {
  classes: Array<{ id: string; name: string }>;
  value: string;
  onChange(id: string): void;
}) {
  return (
    <label className="flex flex-col gap-2 text-label font-medium text-text">
      Lớp
      <select value={value} onChange={(event) => onChange(event.target.value)} className={SELECT_CLASS}>
        <option value="">Chọn lớp</option>
        {classes.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function IssueTab({
  classes,
  classId,
  onClassChange,
  onDone,
}: {
  classes: Array<{ id: string; name: string }>;
  classId: string;
  onClassChange(id: string): void;
  onDone(message: string): void;
}) {
  const queryClient = useQueryClient();
  const sets = useQuery({ queryKey: ['library-textbook-sets'], queryFn: listTextbookSets });
  const [setId, setSetId] = useState('');
  const [result, setResult] = useState<IssueResult>();
  const activeSets = (sets.data ?? []).filter((item) => item.status === 'active');
  const issue = useMutation({
    mutationFn: () => issueTextbooks(classId, setId),
    onSuccess: async (issued) => {
      setResult(issued);
      await queryClient.invalidateQueries({ queryKey: ['library-outstanding'] });
      await queryClient.invalidateQueries({ queryKey: ['library-titles'] });
      onDone(`Đã phát ${issued.issued} cuốn cho lớp ${issued.class_name}`);
    },
  });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <ClassSelect classes={classes} value={classId} onChange={onClassChange} />
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Bộ sách
          <select value={setId} onChange={(event) => setSetId(event.target.value)} className={SELECT_CLASS}>
            <option value="">Chọn bộ sách</option>
            {activeSets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} (khối {item.grade_level}, {item.titles.length} đầu sách)
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="primary"
          disabled={issue.isPending || classId === '' || setId === ''}
          onClick={() => issue.mutate()}
        >
          Phát sách cho lớp
        </Button>
      </div>
      <ErrorAlert error={issue.error ?? sets.error} />
      {sets.data && activeSets.length === 0 ? (
        <Alert tone="info">Chưa có bộ sách nào. Khai báo ở thẻ Bộ sách theo khối.</Alert>
      ) : null}
      {result ? (
        <div className="flex flex-col gap-2">
          <Alert tone="success">
            Lớp {result.class_name} có {result.students} học sinh; đã phát {result.issued} cuốn, hạn trả{' '}
            {formatDate(result.due_on)}.
          </Alert>
          {result.shortages.length > 0 ? (
            <Alert tone="warning">
              Thiếu bản: {result.shortages.map((item) => `${item.title} (thiếu ${item.missing} cuốn)`).join('; ')}. Nhập
              thêm bản sao rồi phát lại, học sinh đã nhận thì được bỏ qua.
            </Alert>
          ) : null}
          {result.without_card.length > 0 ? (
            <Alert tone="warning">
              {result.without_card.length} học sinh chưa có thẻ bạn đọc nên chưa được phát:{' '}
              {result.without_card.join(', ')}. Đồng bộ thẻ ở 1.2 Bạn đọc rồi phát lại.
            </Alert>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CollectTab({
  classes,
  classId,
  onClassChange,
  onDone,
}: {
  classes: Array<{ id: string; name: string }>;
  classId: string;
  onClassChange(id: string): void;
  onDone(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [condition, setCondition] = useState<ReturnCondition>('good');
  const outstanding = useQuery({
    queryKey: ['library-outstanding', classId],
    queryFn: () => listOutstandingTextbooks(classId),
    enabled: classId !== '',
  });
  const items = outstanding.data ?? [];
  const collect = useMutation({
    mutationFn: () => returnMany(selected.map((id) => ({ loan_id: id, condition }))),
    onSuccess: async (result) => {
      setSelected([]);
      await queryClient.invalidateQueries({ queryKey: ['library-outstanding'] });
      await queryClient.invalidateQueries({ queryKey: ['library-loans'] });
      onDone(`Đã thu ${result.returned} cuốn`);
    },
  });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <ClassSelect
          classes={classes}
          value={classId}
          onChange={(id) => {
            onClassChange(id);
            setSelected([]);
          }}
        />
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Tình trạng khi thu
          <select
            value={condition}
            onChange={(event) => setCondition(event.target.value as ReturnCondition)}
            className={SELECT_CLASS}
          >
            {(Object.keys(RETURN_CONDITION_LABELS) as ReturnCondition[]).map((item) => (
              <option key={item} value={item}>
                {RETURN_CONDITION_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="primary"
          disabled={collect.isPending || selected.length === 0}
          onClick={() => collect.mutate()}
        >
          Thu sách đã chọn ({selected.length})
        </Button>
      </div>
      <p className="text-label text-text-secondary">
        Chọn các dòng cùng tình trạng rồi thu; sách hỏng hoặc mất thu riêng với tình trạng tương ứng. Các dòng cùng
        thành công hoặc không dòng nào được thu.
      </p>
      <ErrorAlert error={collect.error ?? outstanding.error} />
      <table className="w-full text-content" aria-label="Sách giáo khoa lớp còn giữ">
        <thead className={HEAD_CLASS}>
          <tr>
            <th className={TH_CLASS}>
              <input
                type="checkbox"
                aria-label="Chọn tất cả dòng"
                checked={items.length > 0 && selected.length === items.length}
                onChange={(event) => setSelected(event.target.checked ? items.map((item) => item.id) : [])}
              />
            </th>
            <th className={TH_CLASS}>Học sinh</th>
            <th className={TH_CLASS}>Sách</th>
            <th className={TH_CLASS}>Số đăng ký</th>
            <th className={TH_CLASS}>Ngày phát</th>
            <th className={TH_CLASS}>Hạn trả</th>
          </tr>
        </thead>
        <tbody>
          {classId === '' ? <EmptyRow columns={6} message="Chọn lớp để xem sách còn giữ" /> : null}
          {classId !== '' && outstanding.data && items.length === 0 ? (
            <EmptyRow columns={6} message="Lớp không còn giữ sách giáo khoa" />
          ) : null}
          {items.map((item) => (
            <tr key={item.id} className="border-t border-border">
              <td className={TH_CLASS}>
                <input
                  type="checkbox"
                  aria-label={`Chọn ${item.title} của ${item.reader_name}`}
                  checked={selected.includes(item.id)}
                  onChange={() => setSelected(toggleId(selected, item.id))}
                />
              </td>
              <td className={TH_CLASS}>{item.reader_name}</td>
              <td className={TH_CLASS}>{item.title}</td>
              <td className={TH_CLASS}>{item.copy_no}</td>
              <td className={TH_CLASS}>{formatDate(item.loaned_on)}</td>
              <td className={TH_CLASS}>{formatDate(item.due_on)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SetForm({
  set,
  onSaved,
  onCancel,
}: {
  set: TextbookSet | undefined;
  onSaved(message: string): void;
  onCancel(): void;
}) {
  const [name, setName] = useState(set?.name ?? '');
  const [grade, setGrade] = useState(set?.grade_level ?? '');
  const [titles, setTitles] = useState(set?.titles ?? []);
  const save = useMutation({
    mutationFn: async () => {
      const input = { name: name.trim(), grade_level: grade.trim(), title_ids: titles.map((item) => item.title_id) };
      if (set) {
        await updateTextbookSet(set.id, input);
        return 'Đã cập nhật bộ sách';
      }
      await createTextbookSet(input);
      return 'Đã thêm bộ sách';
    },
    onSuccess: onSaved,
  });
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h3 className="text-section-title font-semibold text-text">{set ? 'Sửa bộ sách' : 'Thêm bộ sách'}</h3>
      <div className="flex flex-wrap items-end gap-3">
        <TextField label="Tên bộ sách" value={name} onChange={(event) => setName(event.target.value)} />
        <TextField label="Khối" value={grade} onChange={(event) => setGrade(event.target.value)} />
      </div>
      <ul className="flex flex-wrap gap-2 text-content">
        {titles.map((item) => (
          <li key={item.title_id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1">
            {item.title}
            <Button
              variant="text"
              aria-label={`Bỏ ${item.title}`}
              onClick={() => setTitles(titles.filter((value) => value.title_id !== item.title_id))}
            >
              Bỏ
            </Button>
          </li>
        ))}
      </ul>
      <TitlePicker
        label="Tìm đầu sách để thêm vào bộ"
        actionLabel="Thêm vào bộ"
        onPick={(title) => {
          if (!titles.some((item) => item.title_id === title.id)) {
            setTitles([...titles, { title_id: title.id, title: title.title }]);
          }
        }}
      />
      <ErrorAlert error={save.error} />
      <div className="flex gap-3">
        <Button
          variant="primary"
          disabled={save.isPending || name.trim() === '' || grade.trim() === '' || titles.length === 0}
          onClick={() => save.mutate()}
        >
          {set ? 'Lưu thay đổi' : 'Thêm bộ sách'}
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </div>
    </div>
  );
}

function SetsTab({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const sets = useQuery({ queryKey: ['library-textbook-sets'], queryFn: listTextbookSets });
  const [editing, setEditing] = useState<{ set: TextbookSet | undefined }>();
  const toggle = useMutation({
    mutationFn: (set: TextbookSet) =>
      updateTextbookSet(set.id, {
        name: set.name,
        grade_level: set.grade_level,
        title_ids: set.titles.map((item) => item.title_id),
        status: set.status === 'active' ? 'inactive' : 'active',
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['library-textbook-sets'] });
      onDone('Đã cập nhật bộ sách');
    },
  });
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="primary" onClick={() => setEditing({ set: undefined })}>
          Thêm bộ sách
        </Button>
      </div>
      <ErrorAlert error={sets.error ?? toggle.error} />
      {editing ? (
        <SetForm
          key={editing.set?.id ?? 'new'}
          set={editing.set}
          onCancel={() => setEditing(undefined)}
          onSaved={async (message) => {
            setEditing(undefined);
            await queryClient.invalidateQueries({ queryKey: ['library-textbook-sets'] });
            onDone(message);
          }}
        />
      ) : null}
      <table className="w-full text-content" aria-label="Bộ sách giáo khoa">
        <thead className={HEAD_CLASS}>
          <tr>
            <th className={TH_CLASS}>Bộ sách</th>
            <th className={TH_CLASS}>Khối</th>
            <th className={TH_CLASS}>Đầu sách</th>
            <th className={TH_CLASS}>Trạng thái</th>
            <th className={TH_CLASS} />
          </tr>
        </thead>
        <tbody>
          {sets.data && sets.data.length === 0 ? <EmptyRow columns={5} message="Chưa có bộ sách" /> : null}
          {(sets.data ?? []).map((set) => (
            <tr key={set.id} className="border-t border-border">
              <td className={`${TH_CLASS} font-semibold`}>{set.name}</td>
              <td className={TH_CLASS}>{set.grade_level}</td>
              <td className={TH_CLASS}>{set.titles.map((item) => item.title).join('; ')}</td>
              <td className={TH_CLASS}>
                <StatusBadge
                  tone={set.status === 'active' ? 'success' : 'neutral'}
                  label={set.status === 'active' ? 'Đang dùng' : 'Ngừng dùng'}
                />
              </td>
              <td className={TH_CLASS}>
                <div className="flex flex-wrap gap-2">
                  <Button aria-label={`Sửa ${set.name}`} onClick={() => setEditing({ set })}>
                    Sửa
                  </Button>
                  <Button disabled={toggle.isPending} onClick={() => toggle.mutate(set)}>
                    {set.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LibraryTextbooksPage() {
  const toast = useToast();
  const unitChoice = useUnitChoice();
  const [tab, setTab] = useState<Tab>('issue');
  const [classId, setClassId] = useState('');
  const classes = useQuery({
    queryKey: ['classes', unitChoice.selectedId],
    queryFn: () => listClasses(unitChoice.selectedId ?? ''),
    enabled: unitChoice.selectedId !== undefined,
  });
  const activeClasses = (classes.data ?? []).filter((item) => item.status === 'active');
  return (
    <LibraryFrame path="/library/textbooks" toast={toast}>
      <div className="flex flex-wrap items-end gap-4">
        <UnitSelect
          units={unitChoice.units}
          selectedId={unitChoice.selectedId}
          onSelect={(id) => {
            unitChoice.select(id);
            setClassId('');
          }}
        />
        <TabBar tabs={TAB_LABELS} value={tab} label="Phát và thu sách giáo khoa" onChange={setTab} />
      </div>
      <Panel>
        {tab === 'issue' ? (
          <IssueTab classes={activeClasses} classId={classId} onClassChange={setClassId} onDone={toast.show} />
        ) : null}
        {tab === 'collect' ? (
          <CollectTab classes={activeClasses} classId={classId} onClassChange={setClassId} onDone={toast.show} />
        ) : null}
        {tab === 'sets' ? <SetsTab onDone={toast.show} /> : null}
      </Panel>
    </LibraryFrame>
  );
}
