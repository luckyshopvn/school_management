import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, DataGrid, TextField, Toast, type DataGridColumn } from '@school-management/ui';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { matchesSearch } from '../pages/grid-search.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { messageOf, selectClass } from '../work/work-api.js';
import {
  confirmCompletion,
  exportCompletion,
  readCompletionClass,
  readCompletionStatistics,
  recordCompletion,
  RESULT_LABELS,
  unconfirmCompletion,
  type CompletionClass,
  type CompletionClassDetail,
  type CompletionResult,
} from './program-completion-api.js';

// Quản lý hoàn thành chương trình giáo dục mầm non (YCTD-102): giáo viên chủ nhiệm, quản lý đơn vị ghi kết quả từng học sinh
// lớp mẫu giáo 5-6 tuổi (có thể đánh dấu cả lớp), Ban Giám hiệu xác nhận để khóa danh sách; thống kê tỷ lệ theo lớp, đơn vị;
// xuất danh sách ra Excel. Danh sách lớp và danh sách học sinh của lớp trên lưới dữ liệu chung, kết quả, ghi chú nhập ngay
// trong ô; bảng thống kê theo đơn vị giữ nguyên (DT-16 phần 16b)
type Draft = Record<string, { result: CompletionResult | ''; note: string }>;
type CompletionChild = CompletionClassDetail['children'][number];

const filterClass = 'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';

function draftOf(detail: CompletionClassDetail): Draft {
  return Object.fromEntries(
    detail.children.map((child) => [child.child_id, { result: child.result ?? '', note: child.note ?? '' }]),
  );
}

function ClassPanel({ classId, onChanged }: { classId: string; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('program-completion-children');
  const detail = useQuery({
    queryKey: ['program-completion', 'class', classId],
    queryFn: () => readCompletionClass(classId),
  });
  const [draft, setDraft] = useState<Draft>({});
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    if (detail.data) {
      setDraft(draftOf(detail.data));
    }
  }, [detail.data]);
  const refreshed = (message: string) => (data: CompletionClassDetail) => {
    queryClient.setQueryData(['program-completion', 'class', classId], data);
    onChanged(message);
  };
  const save = useMutation({
    mutationFn: () =>
      recordCompletion(
        classId,
        Object.entries(draft)
          .filter(([, value]) => value.result !== '')
          .map(([childId, value]) => ({
            child_id: childId,
            result: value.result as CompletionResult,
            note: value.note.trim() || null,
          })),
      ),
    onSuccess: refreshed('Đã lưu kết quả hoàn thành chương trình'),
  });
  const confirm = useMutation({
    mutationFn: () => confirmCompletion(classId),
    onSuccess: refreshed('Đã xác nhận danh sách của lớp'),
  });
  const unconfirm = useMutation({
    mutationFn: () => unconfirmCompletion(classId, reason),
    onSuccess: (data) => {
      setReason('');
      refreshed('Đã hủy xác nhận danh sách của lớp')(data);
    },
  });
  const download = useMutation({ mutationFn: () => exportCompletion({ classId }) });
  const error = [detail.error, save.error, confirm.error, unconfirm.error, download.error, grid.error].find(Boolean);
  const data = detail.data;
  if (!data) {
    return error ? <Alert tone="danger">{messageOf(error)}</Alert> : null;
  }
  const editable = data.can_manage && !data.confirmed;
  const marked = Object.values(draft).filter((value) => value.result !== '').length;
  const setChild = (child: CompletionChild, change: Partial<Draft[string]>) =>
    setDraft((current) => ({
      ...current,
      [child.child_id]: { ...(current[child.child_id] ?? { result: '', note: '' }), ...change },
    }));
  const columns: Array<DataGridColumn<CompletionChild>> = [
    {
      id: 'full_name',
      header: 'Họ tên',
      alwaysVisible: true,
      className: 'font-medium',
      cell: (child) => child.full_name,
    },
    { id: 'dob', header: 'Ngày sinh', cell: (child) => child.dob },
    {
      id: 'result',
      header: 'Kết quả',
      alwaysVisible: true,
      cell: (child) =>
        editable ? (
          <select
            aria-label={`Kết quả ${child.full_name}`}
            value={draft[child.child_id]?.result ?? ''}
            className={selectClass}
            onChange={(event) => setChild(child, { result: event.target.value as CompletionResult | '' })}
          >
            <option value="">Chưa ghi</option>
            {(Object.keys(RESULT_LABELS) as CompletionResult[]).map((result) => (
              <option key={result} value={result}>
                {RESULT_LABELS[result]}
              </option>
            ))}
          </select>
        ) : child.result ? (
          RESULT_LABELS[child.result]
        ) : (
          'Chưa ghi'
        ),
    },
    {
      id: 'note',
      header: 'Ghi chú',
      cell: (child) =>
        editable ? (
          <input
            aria-label={`Ghi chú ${child.full_name}`}
            value={draft[child.child_id]?.note ?? ''}
            maxLength={500}
            className="w-full rounded-lg border border-border bg-card px-3 py-2"
            onChange={(event) => setChild(child, { note: event.target.value })}
          />
        ) : (
          (child.note ?? '')
        ),
    },
  ];
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-card p-4" aria-label={`Danh sách lớp ${data.name}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-section-title font-semibold text-text">Lớp {data.name}</h2>
        <span>
          {data.confirmed
            ? `Đã xác nhận bởi ${data.confirmed_by_name ?? ''}`
            : `Chưa xác nhận · đã ghi ${data.children_count - data.unmarked_count}/${data.children_count} học sinh`}
        </span>
      </div>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <DataGrid
        label={`Kết quả hoàn thành chương trình lớp ${data.name}`}
        columns={columns}
        rows={data.children.filter((child) => matchesSearch(search, child.full_name))}
        getRowId={(child) => child.child_id}
        getRowLabel={(child) => child.full_name}
        getRowAriaLabel={(child) => `Học sinh ${child.full_name}`}
        emptyText={data.children.length === 0 ? 'Lớp chưa có học sinh đang học.' : 'Không có học sinh nào khớp.'}
        search={{ label: 'Tìm theo họ tên', value: search, onChange: setSearch }}
        toolbar={
          <>
            {editable ? (
              <Button
                onClick={() =>
                  setDraft((current) =>
                    Object.fromEntries(
                      Object.entries(current).map(([childId, value]) => [childId, { ...value, result: 'completed' }]),
                    ),
                  )
                }
              >
                Đánh dấu cả lớp hoàn thành
              </Button>
            ) : null}
            <Button disabled={download.isPending} onClick={() => download.mutate()}>
              Xuất Excel
            </Button>
          </>
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      <div className="flex flex-wrap items-end gap-3">
        {editable ? (
          <Button variant="primary" disabled={save.isPending || marked === 0} onClick={() => save.mutate()}>
            Lưu kết quả
          </Button>
        ) : null}
        {data.can_approve && !data.confirmed ? (
          <Button
            variant={editable ? 'secondary' : 'primary'}
            disabled={confirm.isPending || data.unmarked_count > 0 || data.children_count === 0}
            onClick={() => confirm.mutate()}
          >
            Xác nhận danh sách
          </Button>
        ) : null}
        {data.can_approve && data.confirmed ? (
          <>
            <TextField label="Lý do hủy xác nhận" value={reason} onChange={(event) => setReason(event.target.value)} />
            <Button
              variant="danger"
              disabled={unconfirm.isPending || reason.trim() === ''}
              onClick={() => unconfirm.mutate()}
            >
              Hủy xác nhận
            </Button>
          </>
        ) : null}
      </div>
    </section>
  );
}

const CLASS_COLUMNS: Array<DataGridColumn<CompletionClass>> = [
  { id: 'name', header: 'Lớp', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
  { id: 'org_unit_name', header: 'Đơn vị', cell: (row) => row.org_unit_name },
  { id: 'children_count', header: 'Số học sinh', cell: (row) => row.children_count },
  { id: 'completed_count', header: 'Hoàn thành', cell: (row) => row.completed_count },
  { id: 'not_completed_count', header: 'Chưa hoàn thành', cell: (row) => row.not_completed_count },
  { id: 'unmarked_count', header: 'Chưa ghi', cell: (row) => row.unmarked_count },
  { id: 'completion_rate', header: 'Tỷ lệ', cell: (row) => `${row.completion_rate}%` },
  { id: 'confirmed', header: 'Xác nhận', cell: (row) => (row.confirmed ? 'Đã xác nhận' : 'Chưa xác nhận') },
];

export function ProgramCompletionPage() {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const grid = useGridSettings('program-completion-classes');
  const [orgUnitId, setOrgUnitId] = useState('');
  const [classId, setClassId] = useState<string>();
  const [search, setSearch] = useState('');
  const [confirmedFilter, setConfirmedFilter] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const statistics = useQuery({
    queryKey: ['program-completion', 'statistics', orgUnitId],
    queryFn: () => readCompletionStatistics(orgUnitId),
  });
  const download = useMutation({ mutationFn: () => exportCompletion({ orgUnitId: orgUnitId || undefined }) });
  const changed = (message: string) => {
    void queryClient.invalidateQueries({ queryKey: ['program-completion', 'statistics'] });
    setToastMessage(message);
  };
  const data = statistics.data;
  const classRows = (data?.classes ?? []).filter(
    (row) =>
      (confirmedFilter === '' || String(row.confirmed) === confirmedFilter) &&
      matchesSearch(search, row.name, row.code, row.org_unit_name),
  );
  const pageError = [statistics.error, download.error, grid.error].find(Boolean);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/program-completion')}</h1>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-label font-medium text-text">
            Đơn vị
            <select
              value={orgUnitId}
              className={selectClass}
              onChange={(event) => {
                setOrgUnitId(event.target.value);
                setClassId(undefined);
              }}
            >
              <option value="">Tất cả trong phạm vi</option>
              {unitChoice.units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {pageError ? <Alert tone="danger">{messageOf(pageError)}</Alert> : null}
        {data ? (
          <section className="flex flex-col gap-2 rounded-lg bg-card p-4" aria-label="Thống kê hoàn thành chương trình">
            <h2 className="text-section-title font-semibold text-text">Thống kê</h2>
            <p>
              Toàn phạm vi: {data.total.completed_count}/{data.total.children_count} học sinh hoàn thành (
              {data.total.completion_rate}%), chưa hoàn thành {data.total.not_completed_count}, chưa ghi{' '}
              {data.total.unmarked_count}
            </p>
            <table className="w-full text-content">
              <thead>
                <tr className="text-left text-text-secondary">
                  <th className="py-2">Đơn vị</th>
                  <th>Số lớp</th>
                  <th>Lớp đã xác nhận</th>
                  <th>Số học sinh</th>
                  <th>Hoàn thành</th>
                  <th>Tỷ lệ</th>
                </tr>
              </thead>
              <tbody>
                {data.units.map((unit) => (
                  <tr key={unit.org_unit_id} className="border-t border-border">
                    <td className="py-2">{unit.org_unit_name}</td>
                    <td>{unit.class_count}</td>
                    <td>{unit.confirmed_class_count}</td>
                    <td>{unit.children_count}</td>
                    <td>{unit.completed_count}</td>
                    <td>{unit.completion_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
        <DataGrid
          label="Lớp mẫu giáo 5-6 tuổi"
          columns={CLASS_COLUMNS}
          rows={classRows}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.name}
          getRowAriaLabel={(row) => `Lớp ${row.name}`}
          loading={statistics.isPending}
          emptyText="Không có lớp mẫu giáo 5-6 tuổi trong phạm vi."
          search={{ label: 'Tìm theo lớp, đơn vị', value: search, onChange: setSearch }}
          advancedSearch={
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-label font-medium text-text">
                Xác nhận
                <select
                  value={confirmedFilter}
                  onChange={(event) => setConfirmedFilter(event.target.value)}
                  className={filterClass}
                >
                  <option value="">Tất cả</option>
                  <option value="true">Đã xác nhận</option>
                  <option value="false">Chưa xác nhận</option>
                </select>
              </label>
            </div>
          }
          toolbar={
            <Button disabled={download.isPending} onClick={() => download.mutate()}>
              Xuất Excel các lớp
            </Button>
          }
          rowActions={(row) => (
            <Button variant="text" onClick={() => setClassId(row.id)}>
              Mở lớp {row.name}
            </Button>
          )}
          activeRowId={classId}
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
        {classId ? <ClassPanel key={classId} classId={classId} onChanged={changed} /> : null}
      </div>
    </AppShell>
  );
}
