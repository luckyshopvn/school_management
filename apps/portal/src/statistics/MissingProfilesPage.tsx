import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { ChildDetailPanel } from '../children/ChildDetailPanel.js';
import { messageOf } from '../health/health-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useHasPermission } from '../session/permissions.js';
import { StaffDetailPanel } from '../staff/StaffDetailPanel.js';
import { readMissingChildFields, readMissingStaffFields, type MissingFields } from './statistics-api.js';

// 5.8, 5.9 Thống kê hồ sơ chưa nhập đủ (DT-14 phần 14a, YCTD-102): số học sinh, nhân sự thiếu từng trường thông tin; bấm
// số lượng để xem danh sách, bấm tên để mở hồ sơ
type Tab = 'children' | 'staff';
const TITLES: Record<Tab, string> = {
  children: '5.8 Thống kê hồ sơ học sinh chưa nhập đủ',
  staff: '5.9 Thống kê hồ sơ nhân sự chưa nhập đủ',
};

interface ListedRecord {
  id: string;
  full_name: string;
  detail: string;
}

function MissingView({ tab, orgUnitId }: { tab: Tab; orgUnitId: string }) {
  const [field, setField] = useState('');
  const [openId, setOpenId] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const data = useQuery({
    queryKey: ['missing-fields', tab, orgUnitId, field],
    queryFn: async (): Promise<MissingFields<ListedRecord>> => {
      if (tab === 'children') {
        const result = await readMissingChildFields(orgUnitId, field);
        return {
          ...result,
          records: result.records.map((row) => ({
            id: row.id,
            full_name: row.full_name,
            detail: [row.org_unit_name, row.class_name ? `lớp ${row.class_name}` : 'chưa xếp lớp'].join(', '),
          })),
        };
      }
      const result = await readMissingStaffFields(orgUnitId, field);
      return {
        ...result,
        records: result.records.map((row) => ({
          id: row.id,
          full_name: row.full_name,
          detail: [row.code, row.org_unit_name, row.job_title_name].filter(Boolean).join(', '),
        })),
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
                      onClick={() => {
                        setField(item.key);
                        setOpenId(undefined);
                      }}
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
      {selected ? (
        <section
          className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
          aria-label="Danh sách hồ sơ thiếu"
        >
          <h2 className="text-section-title font-semibold text-text">Thiếu {selected.label}</h2>
          <ul className="flex flex-col gap-1">
            {data.data.records.map((record) => (
              <li key={record.id} className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="text"
                  onClick={() => setOpenId(openId === record.id ? undefined : record.id)}
                >
                  {record.full_name}
                </Button>
                <span className="text-label text-text-secondary">{record.detail}</span>
              </li>
            ))}
          </ul>
        </section>
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
