import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, ConfirmDialog, DataGrid, StatusBadge, Toast, type DataGridColumn } from '@school-management/ui';
import { listChildren, type ChildListItem } from '../children/children-api.js';
import { ImportSection } from '../imports/ImportsPage.js';
import { messageOf } from '../imports/import-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useStudentClassFilter } from './StudentClassFilter.js';
import { setResidenceNote, unverifyNationalIds, verifyNationalIds } from './students-api.js';

// 4.1.8–4.1.9. Thu thập, xác thực số định danh với CSDLQG về dân cư, bản chạy nội bộ (DT-16 phần 16g). Theo quyết định của
// Eric ngày 2026-10-16, bước cần hệ thống bên ngoài ghi đúng việc làm: nhà trường xác thực trên CSDLQG ngoài hệ thống rồi bấm
// "Đánh dấu đã xác thực" (hệ thống kiểm tra số đủ mười hai chữ số, ghi ngày và người đánh dấu); biến động cư trú ghi tay.
// Thu thập số định danh bằng "Tải file mẫu", "Tải lên" của bộ nhập chung
const selectClass = 'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const formatDate = (value: string) => value.split('-').reverse().join('/');
const formatDateTime = (value: string | null | undefined) =>
  value ? formatDate(new Date(value).toISOString().slice(0, 10)) : '';

const COLUMNS: Array<DataGridColumn<ChildListItem>> = [
  { id: 'moet_student_code', header: 'Mã định danh Bộ GD&ĐT', cell: (row) => row.moet_student_code ?? '' },
  { id: 'full_name', header: 'Họ tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
  { id: 'dob', header: 'Ngày sinh', cell: (row) => formatDate(row.dob) },
  { id: 'class', header: 'Lớp', cell: (row) => row.class_name ?? '' },
  { id: 'national_id', header: 'Số định danh', cell: (row) => row.national_id_masked },
  {
    id: 'verified',
    header: 'Tình trạng xác thực',
    cell: (row) =>
      row.national_id_verified_at ? (
        <StatusBadge tone="success" label="Đã xác thực" />
      ) : (
        <StatusBadge tone="warning" label="Chưa xác thực" />
      ),
  },
  { id: 'verified_at', header: 'Ngày xác thực', cell: (row) => formatDateTime(row.national_id_verified_at) },
  { id: 'verified_by', header: 'Người xác thực', cell: (row) => row.national_id_verified_by_name ?? '' },
  { id: 'residence', header: 'Biến động cư trú', cell: (row) => row.residence_change_note ?? '' },
];

export function NationalIdsPage() {
  const queryClient = useQueryClient();
  const grid = useGridSettings('national-ids');
  const [verified, setVerified] = useState('');
  const classFilter = useStudentClassFilter({ national_id_verified: verified || undefined });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [noteRow, setNoteRow] = useState<ChildListItem>();
  const [note, setNote] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const filter = { ...classFilter.filter, q: search || undefined };
  const children = useQuery({
    queryKey: ['children', 'national-ids', filter, page, grid.settings.pageSize],
    queryFn: () => listChildren({ ...filter, page, pageSize: grid.settings.pageSize }),
    enabled: grid.ready,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['children'] });
  const mark = useMutation({
    mutationFn: ({ rows, value }: { rows: ChildListItem[]; value: boolean }) =>
      value
        ? verifyNationalIds(rows.map((row) => row.id)).then(
            (result) => `Đã đánh dấu đã xác thực ${result.verified} học sinh`,
          )
        : unverifyNationalIds(rows.map((row) => row.id)).then(
            (result) => `Đã bỏ đánh dấu xác thực ${result.unverified} học sinh`,
          ),
    onSuccess: async (message) => {
      setToastMessage(message);
      await refresh();
    },
  });
  const saveNote = useMutation({
    mutationFn: () => setResidenceNote(noteRow?.id ?? '', note.trim()),
    onSuccess: async () => {
      setNoteRow(undefined);
      setToastMessage('Đã ghi biến động cư trú');
      await refresh();
    },
  });

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/national-ids')}</h1>
        <Alert tone="info">
          Hệ thống chưa kết nối CSDL quốc gia về dân cư. Xác thực số định danh và tra cứu biến động cư trú trên hệ thống
          của Bộ Công an, rồi bấm "Đánh dấu đã xác thực" và ghi biến động cư trú tại đây.
        </Alert>
        {children.isError ? <Alert tone="danger">{messageOf(children.error)}</Alert> : null}
        {mark.error ? <Alert tone="danger">{messageOf(mark.error)}</Alert> : null}
        <DataGrid
          label="Số định danh của học sinh"
          columns={COLUMNS}
          rows={children.data?.items ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.full_name}
          loading={!children.data && !children.isError}
          emptyText="Không có học sinh nào."
          search={{
            label: 'Tìm theo họ tên',
            value: search,
            onChange: (value) => {
              setSearch(value);
              setPage(1);
            },
          }}
          advancedSearch={classFilter.controls(
            () => setPage(1),
            <label className="text-label font-medium text-text">
              Tình trạng xác thực
              <select
                value={verified}
                onChange={(event) => {
                  setVerified(event.target.value);
                  setPage(1);
                }}
                className={selectClass}
              >
                <option value="">Tất cả</option>
                <option value="true">Đã xác thực</option>
                <option value="false">Chưa xác thực</option>
              </select>
            </label>,
          )}
          selectable
          toolbar={(selected) => (
            <>
              <Button
                variant="primary"
                disabled={selected.length === 0 || mark.isPending}
                onClick={() => mark.mutate({ rows: selected, value: true })}
              >
                Đánh dấu đã xác thực
              </Button>
              <Button
                disabled={selected.length === 0 || mark.isPending}
                onClick={() => mark.mutate({ rows: selected, value: false })}
              >
                Bỏ đánh dấu xác thực
              </Button>
            </>
          )}
          rowActions={(row) => (
            <Button
              variant="text"
              onClick={() => {
                setNoteRow(row);
                setNote(row.residence_change_note ?? '');
              }}
            >
              Biến động cư trú
            </Button>
          )}
          settings={grid.settings}
          onSettingsChange={grid.update}
          serverPagination={{ page, total: children.data?.total ?? 0, onPageChange: setPage }}
        />
        <ImportSection type="national_ids" onChanged={setToastMessage} />
      </div>
      {noteRow ? (
        <ConfirmDialog
          open
          title={`Biến động cư trú – ${noteRow.full_name}`}
          confirmLabel="Ghi"
          busy={saveNote.isPending}
          onCancel={() => setNoteRow(undefined)}
          onConfirm={() => saveNote.mutate()}
        >
          <label className="flex flex-col gap-1 text-label font-medium text-text">
            Nội dung (tra cứu trên CSDL quốc gia về dân cư); để trống là xóa
            <textarea
              value={note}
              maxLength={1000}
              rows={4}
              onChange={(event) => setNote(event.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
            />
          </label>
          {saveNote.error ? <Alert tone="danger">{messageOf(saveNote.error)}</Alert> : null}
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}
