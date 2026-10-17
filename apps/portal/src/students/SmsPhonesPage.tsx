import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, ConfirmDialog, DataGrid, Toast, type DataGridColumn } from '@school-management/ui';
import { listChildren, readChild, setSmsGuardian, type ChildListItem } from '../children/children-api.js';
import { ImportSection } from '../imports/ImportsPage.js';
import { messageOf } from '../imports/import-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useStudentClassFilter } from './StudentClassFilter.js';
import { bulkSmsGuardians, SMS_RELATION_LABELS, type SmsRelation } from './students-api.js';

// 4.1.5. Điện thoại nhận tin của phụ huynh (DT-16 phần 16g, mục 4.1.5 của Sở): lưới học sinh có số liên hệ, số nhận tin; mở
// dòng xem cha, mẹ, người giám hộ và chọn số nhận tin; chọn nhiều dòng rồi "Sửa hàng loạt" theo quan hệ; nhập số nhận tin
// từ Excel bằng bộ nhập chung (số phải là số của phụ huynh đã có trong hồ sơ)
const selectClass = 'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';

const COLUMNS: Array<DataGridColumn<ChildListItem>> = [
  { id: 'moet_student_code', header: 'Mã định danh Bộ GD&ĐT', cell: (row) => row.moet_student_code ?? '' },
  { id: 'full_name', header: 'Họ tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
  { id: 'class', header: 'Lớp', cell: (row) => row.class_name ?? '' },
  { id: 'contact_phone', header: 'Số điện thoại liên hệ', cell: (row) => row.contact_phone ?? '' },
  {
    id: 'sms_phone',
    header: 'Điện thoại nhận tin',
    cell: (row) => row.sms_phone ?? <span className="text-text-secondary">Chưa chọn</span>,
  },
];

function GuardianPanel({ childId, onChanged }: { childId: string; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const child = useQuery({ queryKey: ['child', childId], queryFn: () => readChild(childId) });
  const choose = useMutation({
    mutationFn: (guardianId: string | null) => setSmsGuardian(childId, guardianId),
    onSuccess: async () => {
      onChanged('Đã cập nhật điện thoại nhận tin');
      await queryClient.invalidateQueries({ queryKey: ['children'] });
      await queryClient.invalidateQueries({ queryKey: ['child', childId] });
    },
  });
  if (child.error) {
    return <Alert tone="danger">{messageOf(child.error)}</Alert>;
  }
  return (
    <div className="flex flex-col gap-2">
      <table className="w-full text-content" aria-label="Cha, mẹ, người giám hộ">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-3 py-1">Quan hệ</th>
            <th className="px-3 py-1">Họ tên</th>
            <th className="px-3 py-1">Nghề nghiệp</th>
            <th className="px-3 py-1">Số điện thoại</th>
            <th className="px-3 py-1">Nhận tin</th>
          </tr>
        </thead>
        <tbody>
          {(child.data?.guardians ?? []).map((guardian) => (
            <tr key={guardian.id} className="border-t border-border">
              <td className="px-3 py-1">{guardian.relationship}</td>
              <td className="px-3 py-1">{guardian.full_name}</td>
              <td className="px-3 py-1">{guardian.occupation ?? ''}</td>
              <td className="px-3 py-1">{guardian.phone ?? ''}</td>
              <td className="px-3 py-1">
                {guardian.receives_sms ? (
                  <Button variant="text" disabled={choose.isPending} onClick={() => choose.mutate(null)}>
                    Bỏ chọn
                  </Button>
                ) : guardian.phone ? (
                  <Button variant="text" disabled={choose.isPending} onClick={() => choose.mutate(guardian.id)}>
                    Chọn số này
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {choose.error ? <Alert tone="danger">{messageOf(choose.error)}</Alert> : null}
    </div>
  );
}

export function SmsPhonesPage() {
  const queryClient = useQueryClient();
  const grid = useGridSettings('sms-phones');
  const classFilter = useStudentClassFilter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string>();
  const [bulkRows, setBulkRows] = useState<ChildListItem[]>();
  const [relation, setRelation] = useState<SmsRelation>('mother');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const filter = { ...classFilter.filter, q: search || undefined };
  const children = useQuery({
    queryKey: ['children', 'sms', filter, page, grid.settings.pageSize],
    queryFn: () => listChildren({ ...filter, page, pageSize: grid.settings.pageSize }),
    enabled: grid.ready,
  });
  const bulk = useMutation({
    mutationFn: () =>
      bulkSmsGuardians(
        (bulkRows ?? []).map((row) => row.id),
        relation,
      ),
    onSuccess: async (result) => {
      setBulkRows(undefined);
      setToastMessage(
        `Đã cập nhật ${result.updated} học sinh` +
          (result.skipped.length ? `; giữ nguyên ${result.skipped.length} học sinh không có số theo quan hệ đã chọn` : ''),
      );
      await queryClient.invalidateQueries({ queryKey: ['children'] });
    },
  });

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/sms-phones')}</h1>
        {children.isError ? <Alert tone="danger">{messageOf(children.error)}</Alert> : null}
        <DataGrid
          label="Điện thoại nhận tin của học sinh"
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
          advancedSearch={classFilter.controls(() => setPage(1))}
          selectable
          toolbar={(selected) => (
            <Button disabled={selected.length === 0} onClick={() => setBulkRows(selected)}>
              Sửa hàng loạt
            </Button>
          )}
          rowActions={(row) => (
            <Button variant="text" onClick={() => setOpenId(openId === row.id ? undefined : row.id)}>
              {openId === row.id ? 'Ẩn' : 'Phụ huynh'}
            </Button>
          )}
          activeRowId={openId}
          renderRowDetail={(row) =>
            openId === row.id ? <GuardianPanel childId={row.id} onChanged={setToastMessage} /> : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
          serverPagination={{ page, total: children.data?.total ?? 0, onPageChange: setPage }}
        />
        <ImportSection type="sms_phones" onChanged={setToastMessage} />
      </div>
      {bulkRows ? (
        <ConfirmDialog
          open
          title="Sửa hàng loạt điện thoại nhận tin"
          confirmLabel="Ghi"
          busy={bulk.isPending}
          onCancel={() => setBulkRows(undefined)}
          onConfirm={() => bulk.mutate()}
        >
          <div className="flex flex-col gap-3">
            <p>Chọn số nhận tin cho {bulkRows.length} học sinh đã chọn.</p>
            <label className="text-label font-medium text-text">
              Điện thoại nhận tin
              <select
                value={relation}
                onChange={(event) => setRelation(event.target.value as SmsRelation)}
                className={selectClass}
              >
                {(Object.keys(SMS_RELATION_LABELS) as SmsRelation[]).map((key) => (
                  <option key={key} value={key}>
                    {SMS_RELATION_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
            {bulk.error ? <Alert tone="danger">{messageOf(bulk.error)}</Alert> : null}
          </div>
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}
