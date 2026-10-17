import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert } from '@school-management/ui';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { messageOf } from '../imports/import-api.js';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { readIdentityDuplicates, readIdentityProgress } from '../staff/staff-so-api.js';

// 5.6. Tiến độ xác thực số định danh nhân sự (DT-16 phần 16f, mục 5.5–5.6 của Sở, phần nhân sự): theo đơn vị hoặc bộ phận
// (phòng ban) tổng số, đã xác thực, sai thông tin, tỷ lệ; lấy từ trạng thái đánh dấu ở 3.1.5 (bản chạy nội bộ). Danh sách trùng
// số định danh: các hồ sơ có cùng số định danh 12 chữ số
const formatDate = (value: string | null) => (value ? value.split('-').reverse().join('/') : '');

export function StaffIdentityProgressPage() {
  const unitChoice = useUnitChoice();
  const [orgUnitId, setOrgUnitId] = useState('');
  const [groupBy, setGroupBy] = useState<'unit' | 'department'>('unit');
  const progress = useQuery({
    queryKey: ['staff-identity-progress', orgUnitId, groupBy],
    queryFn: () => readIdentityProgress(orgUnitId || undefined, groupBy),
  });
  const duplicates = useQuery({
    queryKey: ['staff-identity-duplicates', orgUnitId],
    queryFn: () => readIdentityDuplicates(orgUnitId || undefined),
  });
  const error = progress.error ?? duplicates.error;
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/staff-identity-progress')}</h1>
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 text-label font-medium text-text">
            Đơn vị
            <select
              value={orgUnitId}
              onChange={(event) => setOrgUnitId(event.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
            >
              <option value="">Tất cả đơn vị trong phạm vi</option>
              {unitChoice.units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-label font-medium text-text">
            Thống kê theo
            <select
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value as 'unit' | 'department')}
              className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
            >
              <option value="unit">Đơn vị</option>
              <option value="department">Bộ phận</option>
            </select>
          </label>
        </div>
        {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
        <section
          className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
          aria-label="Tiến độ xác thực"
        >
          <h2 className="text-section-title font-semibold text-text">Tiến độ xác thực</h2>
          <table className="w-full text-content" aria-label="Bảng tiến độ xác thực">
            <thead className="text-left text-label font-medium text-text-secondary">
              <tr>
                <th className="px-3 py-1">{groupBy === 'unit' ? 'Đơn vị' : 'Bộ phận'}</th>
                <th className="px-3 py-1 text-right">Tổng số</th>
                <th className="px-3 py-1 text-right">Đã xác thực</th>
                <th className="px-3 py-1 text-right">Sai thông tin</th>
                <th className="px-3 py-1 text-right">Tỷ lệ (%)</th>
              </tr>
            </thead>
            <tbody>
              {(progress.data?.items ?? []).map((item) => (
                <tr key={item.name} className="border-t border-border">
                  <td className="px-3 py-1">{item.name}</td>
                  <td className="px-3 py-1 text-right">{item.total}</td>
                  <td className="px-3 py-1 text-right">{item.verified}</td>
                  <td className="px-3 py-1 text-right">{item.invalid}</td>
                  <td className="px-3 py-1 text-right">{item.rate}</td>
                </tr>
              ))}
              {progress.data ? (
                <tr className="border-t border-border font-semibold">
                  <td className="px-3 py-1">Tổng cộng</td>
                  <td className="px-3 py-1 text-right">{progress.data.totals.total}</td>
                  <td className="px-3 py-1 text-right">{progress.data.totals.verified}</td>
                  <td className="px-3 py-1 text-right">{progress.data.totals.invalid}</td>
                  <td className="px-3 py-1 text-right">{progress.data.totals.rate}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
        <section
          className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
          aria-label="Danh sách trùng số định danh"
        >
          <h2 className="text-section-title font-semibold text-text">Danh sách trùng số định danh</h2>
          {duplicates.data && duplicates.data.groups.length === 0 ? (
            <p className="text-content text-text-secondary">Không có hồ sơ trùng số định danh.</p>
          ) : (
            <table className="w-full text-content" aria-label="Bảng trùng số định danh">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-1">Số định danh</th>
                  <th className="px-3 py-1">Mã nhân sự</th>
                  <th className="px-3 py-1">Họ tên</th>
                  <th className="px-3 py-1">Ngày sinh</th>
                  <th className="px-3 py-1">Đơn vị</th>
                  <th className="px-3 py-1">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {(duplicates.data?.groups ?? []).flatMap((group) =>
                  group.staff.map((person) => (
                    <tr key={person.id} className="border-t border-border">
                      <td className="px-3 py-1">{group.id_number_masked}</td>
                      <td className="px-3 py-1">{person.code}</td>
                      <td className="px-3 py-1">{person.full_name}</td>
                      <td className="px-3 py-1">{formatDate(person.dob)}</td>
                      <td className="px-3 py-1">{person.unit_name}</td>
                      <td className="px-3 py-1">{person.status === 'active' ? 'Đang làm việc' : 'Đã nghỉ việc'}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </AppShell>
  );
}
