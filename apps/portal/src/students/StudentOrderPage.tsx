import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, DataGrid, Toast, type DataGridColumn } from '@school-management/ui';
import { searchClasses } from '../classes/classes-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { messageOf } from '../imports/import-api.js';
import { readClassOrder, saveClassOrder, sortStudents, type OrderedStudent } from './students-api.js';

// 4.1.3. Sắp xếp học sinh (DT-16 phần 16g, mục 4.1.3 của Sở): chọn lớp, "Sắp xếp A–Z" theo tên rồi họ (thứ tự chữ cái tiếng
// Việt) cho lớp chọn hoặc tất cả lớp, đổi chỗ bằng nút Lên, Xuống rồi "Ghi thứ tự". Số thứ tự lưu cố định trong lớp; danh
// sách học sinh lọc theo lớp và danh sách lớp của giáo viên theo thứ tự này
const formatDate = (value: string) => value.split('-').reverse().join('/');
const selectClass = 'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';

export function StudentOrderPage() {
  const queryClient = useQueryClient();
  const grid = useGridSettings('student-order');
  const [classId, setClassId] = useState('');
  const [rows, setRows] = useState<OrderedStudent[]>([]);
  const [dirty, setDirty] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const classes = useQuery({
    queryKey: ['classes', 'search', 'active'],
    queryFn: () => searchClasses({ status: 'active' }),
  });
  const order = useQuery({
    queryKey: ['student-order', classId],
    queryFn: () => readClassOrder(classId),
    enabled: Boolean(classId),
  });
  useEffect(() => {
    setRows(order.data?.items ?? []);
    setDirty(false);
  }, [order.data]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['student-order'] });
  const sort = useMutation({
    mutationFn: (all: boolean) => sortStudents(all ? null : classId),
    onSuccess: async (result) => {
      setToastMessage(`Đã sắp xếp A–Z ${result.students} học sinh của ${result.classes} lớp`);
      await refresh();
    },
  });
  const save = useMutation({
    mutationFn: () =>
      saveClassOrder(
        classId,
        rows.map((row) => row.id),
      ),
    onSuccess: async () => {
      setToastMessage('Đã ghi thứ tự học sinh trong lớp');
      await refresh();
    },
  });
  const move = (index: number, step: number) => {
    const next = [...rows];
    const [row] = next.splice(index, 1);
    if (row) {
      next.splice(index + step, 0, row);
      setRows(next);
      setDirty(true);
    }
  };
  const columns: Array<DataGridColumn<OrderedStudent>> = [
    { id: 'position', header: 'STT', alwaysVisible: true, cell: (row) => rows.indexOf(row) + 1 },
    { id: 'moet_student_code', header: 'Mã định danh Bộ GD&ĐT', cell: (row) => row.moet_student_code ?? '' },
    { id: 'full_name', header: 'Họ tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
    { id: 'dob', header: 'Ngày sinh', cell: (row) => formatDate(row.dob) },
    { id: 'gender', header: 'Giới tính', cell: (row) => (row.gender === 'male' ? 'Nam' : 'Nữ') },
    {
      id: 'order_number',
      header: 'Số thứ tự đã ghi',
      hiddenByDefault: true,
      cell: (row) => row.order_number ?? 'Chưa sắp xếp',
    },
  ];
  const error = classes.error ?? order.error ?? sort.error ?? save.error;

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/student-order')}</h1>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-label font-medium text-text">
            Lớp
            <select
              aria-label="Lớp"
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              className={selectClass}
            >
              <option value="">Chọn lớp</option>
              {(classes.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} – {item.org_unit_name}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={!classId || sort.isPending} onClick={() => sort.mutate(false)}>
            Sắp xếp A–Z lớp đã chọn
          </Button>
          <Button disabled={sort.isPending} onClick={() => sort.mutate(true)}>
            Sắp xếp A–Z tất cả lớp
          </Button>
        </div>
        {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
        {classId ? (
          <DataGrid
            label="Thứ tự học sinh trong lớp"
            columns={columns}
            rows={rows}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.full_name}
            loading={order.isPending}
            emptyText="Lớp chưa có học sinh."
            toolbar={
              <Button variant="primary" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
                Ghi thứ tự
              </Button>
            }
            rowActions={(row) => {
              const index = rows.indexOf(row);
              return (
                <span className="flex gap-1">
                  <Button variant="text" disabled={index === 0} onClick={() => move(index, -1)}>
                    Lên
                  </Button>
                  <Button variant="text" disabled={index === rows.length - 1} onClick={() => move(index, 1)}>
                    Xuống
                  </Button>
                </span>
              );
            }}
            settings={grid.settings}
            onSettingsChange={grid.update}
          />
        ) : (
          <p className="text-content text-text-secondary">Chọn lớp để xem và sắp xếp thứ tự học sinh.</p>
        )}
      </div>
    </AppShell>
  );
}
