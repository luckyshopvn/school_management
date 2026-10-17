import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, DataGrid, Toast, type DataGridColumn } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { ChildDetailPanel } from '../children/ChildDetailPanel.js';
import { messageOf } from '../health/health-api.js';
import { AppShell } from '../pages/AppShell.js';
import { matchesSearch } from '../pages/grid-search.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { useHasPermission } from '../session/permissions.js';
import { StaffDetailPanel } from '../staff/StaffDetailPanel.js';
import { readMissingChildFields, readMissingStaffFields, type MissingFields } from './statistics-api.js';

// 5.8, 5.9 Thống kê hồ sơ chưa nhập đủ (DT-14 phần 14a, YCTD-102): số học sinh, nhân sự thiếu từng trường thông tin; bấm
// số lượng để xem danh sách, bấm tên để mở hồ sơ. Danh sách hồ sơ thiếu trên lưới dữ liệu chung: tìm tại chỗ theo họ tên,
// mã; "Mở rộng tìm kiếm" chọn trường thông tin thiếu và lọc đơn vị; bảng số hồ sơ thiếu giữ nguyên (DT-16 phần 16b)
type Tab = 'children' | 'staff';
const TITLES: Record<Tab, string> = {
  children: '5.8 Thống kê hồ sơ học sinh chưa nhập đủ',
  staff: '5.9 Thống kê hồ sơ nhân sự chưa nhập đủ',
};

interface ListedRecord {
  id: string;
  code: string;
  full_name: string;
  dob: string;
  org_unit_name: string;
  class_name: string | null;
  job_title_name: string | null;
}

const selectClass = 'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const formatDate = (value: string) => value.split('-').reverse().join('/');

function recordColumns(tab: Tab, openRecord: (record: ListedRecord) => void): Array<DataGridColumn<ListedRecord>> {
  const name: DataGridColumn<ListedRecord> = {
    id: 'full_name',
    header: 'Họ tên',
    alwaysVisible: true,
    cell: (row) => (
      <Button type="button" variant="text" onClick={() => openRecord(row)}>
        {row.full_name}
      </Button>
    ),
  };
  const unit: DataGridColumn<ListedRecord> = {
    id: 'org_unit_name',
    header: 'Đơn vị',
    cell: (row) => row.org_unit_name,
  };
  return tab === 'children'
    ? [
        name,
        { id: 'dob', header: 'Ngày sinh', cell: (row) => formatDate(row.dob) },
        unit,
        { id: 'class_name', header: 'Lớp', cell: (row) => row.class_name ?? 'Chưa xếp lớp' },
      ]
    : [
        { id: 'code', header: 'Mã', cell: (row) => row.code },
        name,
        unit,
        { id: 'job_title_name', header: 'Chức danh', cell: (row) => row.job_title_name ?? '' },
      ];
}

function MissingView({ tab, orgUnitId }: { tab: Tab; orgUnitId: string }) {
  const [field, setField] = useState('');
  const [openId, setOpenId] = useState<string>();
  const [search, setSearch] = useState('');
  const [unitName, setUnitName] = useState('');
  const grid = useGridSettings(tab === 'children' ? 'missing-child-profiles' : 'missing-staff-profiles');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const data = useQuery({
    queryKey: ['missing-fields', tab, orgUnitId, field],
    queryFn: async (): Promise<MissingFields<ListedRecord>> => {
      if (tab === 'children') {
        const result = await readMissingChildFields(orgUnitId, field);
        return {
          ...result,
          records: result.records.map((row) => ({ ...row, code: '', job_title_name: null })),
        };
      }
      const result = await readMissingStaffFields(orgUnitId, field);
      return {
        ...result,
        records: result.records.map((row) => ({ ...row, dob: '', class_name: null })),
      };
    },
    retry: false,
  });
  if (data.error) {
    return <Alert tone="danger">{messageOf(data.error)}</Alert>;
  }
  if (!data.data) {
    return null;
  }
  const selected = data.data.fields.find((item) => item.key === field);
  const unitNames = [...new Set(data.data.records.map((record) => record.org_unit_name))].sort((a, b) =>
    a.localeCompare(b, 'vi'),
  );
  const rows = data.data.records.filter(
    (record) =>
      (unitName === '' || record.org_unit_name === unitName) &&
      matchesSearch(search, record.full_name, record.code, record.class_name, record.job_title_name),
  );
  const chooseField = (key: string) => {
    setField(key);
    setOpenId(undefined);
    setUnitName('');
  };
  return (
    <>
      <Toast message={toastMessage} onClose={closeToast} />
      <section
        className="flex flex-col gap-2 overflow-x-auto rounded-xl border border-border bg-card p-4"
        aria-label="Số hồ sơ thiếu theo trường thông tin"
      >
        <p className="text-content text-text">
          Tổng số {tab === 'children' ? 'học sinh đang học' : 'nhân sự đang làm việc'}: {data.data.total}
        </p>
        <table className="w-full text-content">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-2">Trường thông tin</th>
              <th className="px-3 py-2">Số hồ sơ thiếu</th>
            </tr>
          </thead>
          <tbody>
            {data.data.fields.map((item) => (
              <tr key={item.key} className="border-t border-border">
                <td className="px-3 py-2">{item.label}</td>
                <td className="px-3 py-2">
                  {item.missing_count === 0 ? (
                    '0'
                  ) : (
                    <Button
                      type="button"
                      variant="text"
                      aria-label={`Xem ${item.missing_count} hồ sơ thiếu ${item.label}`}
                      onClick={() => chooseField(item.key)}
                    >
                      {item.missing_count}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
      {selected ? (
        <>
          <h2 className="text-section-title font-semibold text-text">Thiếu {selected.label}</h2>
          <DataGrid
            label="Danh sách hồ sơ thiếu"
            columns={recordColumns(tab, (record) => setOpenId(openId === record.id ? undefined : record.id))}
            rows={rows}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.full_name}
            emptyText={`Không có hồ sơ nào thiếu ${selected.label}.`}
            search={{
              label: tab === 'children' ? 'Tìm theo họ tên, lớp' : 'Tìm theo họ tên, mã',
              value: search,
              onChange: setSearch,
            }}
            advancedSearch={
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="text-label font-medium text-text">
                  Trường thông tin thiếu
                  <select value={field} onChange={(event) => chooseField(event.target.value)} className={selectClass}>
                    {data.data.fields
                      .filter((item) => item.missing_count > 0)
                      .map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.label}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="text-label font-medium text-text">
                  Đơn vị
                  <select
                    value={unitName}
                    onChange={(event) => setUnitName(event.target.value)}
                    className={selectClass}
                  >
                    <option value="">Tất cả</option>
                    {unitNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            }
            activeRowId={openId}
            settings={grid.settings}
            onSettingsChange={grid.update}
          />
        </>
      ) : null}
      {openId ? (
        <section className="rounded-xl border border-border bg-card p-4" aria-label="Hồ sơ đang mở">
          {tab === 'children' ? (
            <ChildDetailPanel key={openId} childId={openId} onChanged={setToastMessage} />
          ) : (
            <StaffDetailPanel key={openId} staffId={openId} onChanged={setToastMessage} />
          )}
        </section>
      ) : null}
    </>
  );
}

export function MissingProfilesPage() {
  const canViewChildren = useHasPermission(PERMISSION_CODES.childStatisticsView);
  const canViewStaff = useHasPermission(PERMISSION_CODES.staffStatisticsView);
  const tabs = (['children', 'staff'] as Tab[]).filter((tab) => (tab === 'staff' ? canViewStaff : canViewChildren));
  const [chosen, setChosen] = useState<Tab>();
  const tab = chosen ?? tabs[0];
  const unitChoice = useUnitChoice();
  const [orgUnitId, setOrgUnitId] = useState('');
  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{tab ? TITLES[tab] : 'Thống kê hồ sơ chưa nhập đủ'}</h1>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Loại hồ sơ">
          {tabs.map((code) => (
            <Button
              key={code}
              role="tab"
              aria-selected={tab === code}
              variant={tab === code ? 'secondary' : 'text'}
              onClick={() => setChosen(code)}
            >
              {code === 'children' ? 'Hồ sơ học sinh' : 'Hồ sơ nhân sự'}
            </Button>
          ))}
        </div>
        <UnitSelect
          units={[{ id: '', name: 'Tất cả trong phạm vi' } as (typeof unitChoice.units)[number], ...unitChoice.units]}
          selectedId={orgUnitId}
          onSelect={setOrgUnitId}
        />
        {tab === undefined ? <Alert tone="info">Bạn chưa được cấp quyền xem thống kê hồ sơ.</Alert> : null}
        {tab ? <MissingView key={`${tab}-${orgUnitId}`} tab={tab} orgUnitId={orgUnitId} /> : null}
      </div>
    </AppShell>
  );
}
