import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FACILITY_STANDARD_LEVELS, PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, StatusBadge, Toast } from '@school-management/ui';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import { UpperLevelSubmissionPanel } from '../submissions/UpperLevelSubmissionPanel.js';
import {
  downloadExcel,
  formatNumber,
  messageOf,
  readFacilityReport,
  saveStandardLevels,
  type FacilityReport,
} from './facilities-api.js';
import { SelectBox, TabBar } from './facilities-ui.js';

// 1.2 Báo cáo cơ sở vật chất (khảo sát mục 4, dòng 1.2; DT-16 phần 16i): số liệu phòng đang dùng theo khối, loại phòng và
// hiện trạng; thẻ nhà vệ sinh; tổng hợp mức độ đạt chuẩn theo khối phòng (Hiệu trưởng đánh giá, mức của trường là mức thấp
// nhất); Xuất Excel, Xuất PDF; gửi lên cấp trên theo mẫu chạy nội bộ: Xuất tệp gửi, nộp bằng tay, Đánh dấu đã gửi
type Tab = 'figures' | 'toilets' | 'standard';

const cellClass = 'px-3 py-2';

function FiguresTable({ report }: { report: FacilityReport }) {
  return (
    <section className="overflow-x-auto rounded-xl border border-border bg-card p-4" aria-label="Số liệu phòng">
      <table className="w-full text-content">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className={cellClass}>Chỉ tiêu</th>
            <th className={cellClass}>Tổng số</th>
            <th className={cellClass}>Kiên cố</th>
            <th className={cellClass}>Bán kiên cố</th>
            <th className={cellClass}>Tạm</th>
            <th className={cellClass}>Nhờ, mượn, thuê</th>
            <th className={cellClass}>Chưa khai báo hiện trạng</th>
            <th className={cellClass}>Diện tích (m²)</th>
          </tr>
        </thead>
        <tbody>
          {report.figures.map((row) => (
            <tr
              key={row.key}
              className={`border-t border-border ${row.level === 'type' ? 'text-text-secondary' : 'font-semibold'}`}
            >
              <td className={`${cellClass} ${row.level === 'type' ? 'pl-8' : ''}`}>{row.label}</td>
              <td className={cellClass}>{row.total}</td>
              <td className={cellClass}>{row.permanent}</td>
              <td className={cellClass}>{row.semi_permanent}</td>
              <td className={cellClass}>{row.temporary}</td>
              <td className={cellClass}>{row.borrowed}</td>
              <td className={cellClass}>{row.unspecified}</td>
              <td className={cellClass}>{formatNumber(row.area_m2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ToiletsTable({ report }: { report: FacilityReport }) {
  const { toilets } = report;
  return (
    <section
      className="flex flex-col gap-2 overflow-x-auto rounded-xl border border-border bg-card p-4"
      aria-label="Nhà vệ sinh"
    >
      <table className="w-full text-content">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className={cellClass}>Chỉ tiêu</th>
            <th className={cellClass}>Số phòng</th>
            <th className={cellClass}>Đạt chuẩn</th>
            <th className={cellClass}>Chưa đạt chuẩn</th>
            <th className={cellClass}>Chưa đánh giá</th>
            <th className={cellClass}>Riêng nam, nữ</th>
            <th className={cellClass}>Số chỗ</th>
          </tr>
        </thead>
        <tbody>
          {toilets.rows.map((row) => (
            <tr key={row.key} className={`border-t border-border ${row.key === 'total' ? 'font-semibold' : ''}`}>
              <td className={cellClass}>{row.label}</td>
              <td className={cellClass}>{row.rooms}</td>
              <td className={cellClass}>{row.met}</td>
              <td className={cellClass}>{row.not_met}</td>
              <td className={cellClass}>{row.unassessed}</td>
              <td className={cellClass}>{row.separate_gender}</td>
              <td className={cellClass}>{row.seats}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-content text-text-secondary">
        Phòng sinh hoạt chung có vệ sinh khép kín: {toilets.group_rooms_ensuite}, liền kề:{' '}
        {toilets.group_rooms_adjacent} trên {toilets.group_rooms} phòng. Thông tin nhà vệ sinh khai báo ở phòng loại
        Phòng vệ sinh (1.1 Khai báo cơ sở vật chất).
      </p>
    </section>
  );
}

function StandardSection({
  report,
  canManage,
  onSaved,
}: {
  report: FacilityReport;
  canManage: boolean;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, { level: string; note: string }>>({});
  useEffect(() => {
    setDraft(
      Object.fromEntries(
        report.standard.map((row) => [row.room_block, { level: row.level ?? '', note: row.note ?? '' }]),
      ),
    );
  }, [report]);
  const save = useMutation({
    mutationFn: () =>
      saveStandardLevels(
        Object.entries(draft)
          .filter(([, value]) => value.level !== '')
          .map(([room_block, value]) => ({ room_block, level: value.level, note: value.note.trim() || null })),
      ),
    onSuccess: async () => {
      onSaved('Đã ghi mức độ đạt chuẩn');
      await queryClient.invalidateQueries({ queryKey: ['facility-report'] });
      await queryClient.invalidateQueries({ queryKey: ['upper-level-submissions'] });
    },
  });
  const editable = canManage && report.whole_school;
  return (
    <section
      className="flex flex-col gap-3 overflow-x-auto rounded-xl border border-border bg-card p-4"
      aria-label="Mức độ đạt chuẩn"
    >
      <p className="text-content text-text" aria-label="Mức độ đạt chuẩn của trường">
        Mức độ đạt chuẩn của trường: <strong>{report.overall_level_label}</strong> (mức thấp nhất của năm khối phòng).
        Mức theo tiêu chuẩn cơ sở vật chất trường mầm non, cần đối chiếu văn bản hiện hành.
      </p>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <table className="w-full text-content">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className={cellClass}>Khối phòng</th>
            <th className={cellClass}>Mức độ đạt chuẩn</th>
            <th className={cellClass}>Số liệu tham khảo</th>
            <th className={cellClass}>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {report.standard.map((row) => {
            const value = draft[row.room_block] ?? { level: '', note: '' };
            return (
              <tr key={row.room_block} className="border-t border-border align-top">
                <td className={cellClass}>{row.label}</td>
                <td className={cellClass}>
                  {editable ? (
                    <select
                      aria-label={`Mức độ đạt chuẩn ${row.label}`}
                      value={value.level}
                      onChange={(event) =>
                        setDraft({ ...draft, [row.room_block]: { ...value, level: event.target.value } })
                      }
                      className="rounded-lg border border-border bg-card px-2 py-1"
                    >
                      <option value="">Chưa đánh giá</option>
                      {FACILITY_STANDARD_LEVELS.map((level) => (
                        <option key={level.value} value={level.value}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    row.level_label
                  )}
                </td>
                <td className={`${cellClass} text-label text-text-secondary`}>{row.hints.join('; ')}</td>
                <td className={cellClass}>
                  {editable ? (
                    <input
                      aria-label={`Ghi chú ${row.label}`}
                      value={value.note}
                      onChange={(event) =>
                        setDraft({ ...draft, [row.room_block]: { ...value, note: event.target.value } })
                      }
                      className="w-full rounded-lg border border-border bg-card px-2 py-1"
                    />
                  ) : (
                    (row.note ?? '')
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {editable ? (
        <div>
          <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
            Ghi mức độ đạt chuẩn
          </Button>
        </div>
      ) : canManage ? (
        <p className="text-label text-text-secondary">Bỏ chọn đơn vị để đánh giá mức độ đạt chuẩn cho toàn trường.</p>
      ) : null}
    </section>
  );
}

export function FacilityReportPage() {
  const canManage = useHasPermission(PERMISSION_CODES.schoolProfileManage);
  const canSend = useHasPermission(PERMISSION_CODES.facilitiesReport);
  const unitChoice = useUnitChoice();
  const [orgUnitId, setOrgUnitId] = useState('');
  const [tab, setTab] = useState<Tab>('figures');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const report = useQuery({
    queryKey: ['facility-report', orgUnitId],
    queryFn: () => readFacilityReport(orgUnitId),
  });
  const exportFile = useMutation({
    mutationFn: (format: 'xlsx' | 'pdf') =>
      downloadExcel(
        '/api/v1/facilities/report/export',
        { org_unit_id: orgUnitId, format },
        `bao-cao-co-so-vat-chat.${format}`,
      ),
  });
  const data = report.data;
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-page-title font-bold text-text">{menuPageTitle('/facility-report')}</h1>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={exportFile.isPending || !data}
              onClick={() => exportFile.mutate('xlsx')}
            >
              Xuất Excel
            </Button>
            <Button
              variant="secondary"
              disabled={exportFile.isPending || !data}
              onClick={() => exportFile.mutate('pdf')}
            >
              Xuất PDF
            </Button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <SelectBox
            label="Đơn vị"
            value={orgUnitId}
            options={unitChoice.units.map((unit) => ({ value: unit.id, label: unit.name }))}
            emptyLabel="Toàn trường"
            onChange={setOrgUnitId}
          />
        </div>
        {report.error ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
        {exportFile.error ? <Alert tone="danger">{messageOf(exportFile.error)}</Alert> : null}
        {data ? (
          <>
            <p className="text-content text-text-secondary">
              Báo cáo của {data.school_name}, năm học {data.academic_year}. Số liệu tính từ khai báo phòng đang dùng tại
              thời điểm xem; tệp gửi lên cấp trên lưu số liệu toàn trường tại thời điểm xuất tệp gửi.
            </p>
            <ul className="flex flex-col gap-1 text-content" aria-label="Hoàn thành dữ liệu báo cáo">
              {data.completeness.map((item) => (
                <li key={item.label} className="flex items-center gap-2">
                  <StatusBadge tone={item.done ? 'success' : 'warning'} label={item.done ? 'Đã đủ' : 'Chưa đủ'} />
                  {item.label}
                </li>
              ))}
            </ul>
            <TabBar<Tab>
              tabs={[
                { key: 'figures', label: 'Số liệu phòng' },
                { key: 'toilets', label: 'Nhà vệ sinh' },
                { key: 'standard', label: 'Mức độ đạt chuẩn' },
              ]}
              current={tab}
              onSelect={setTab}
              label="Thẻ của báo cáo cơ sở vật chất"
            />
            {tab === 'figures' ? <FiguresTable report={data} /> : null}
            {tab === 'toilets' ? <ToiletsTable report={data} /> : null}
            {tab === 'standard' ? (
              <StandardSection report={data} canManage={canManage} onSaved={setToastMessage} />
            ) : null}
            {canSend ? (
              <UpperLevelSubmissionPanel formCodes={['facilities-report']} onChanged={setToastMessage} />
            ) : null}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
