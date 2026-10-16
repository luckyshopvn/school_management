import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, DataGrid, type DataGridColumn } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import { formatNumber, messageOf, selectClass } from './archive-ui.js';
import {
  exportArchiveReport,
  listArchiveFonds,
  periodText,
  readArchiveReport,
  type ArchiveReportFilter,
  type ArchiveReportRow,
} from './archives-api.js';

// 5.10.4. Báo cáo lưu trữ (DT-15 phần 15h2, YCTD-118): cộng thông tin lưu trữ theo phông và giai đoạn với các tiêu chí của
// Sở: tổng số mét giá, đã chỉnh lý, chưa chỉnh lý, hết giá trị, bảo quản vĩnh viễn, có thời hạn, số bó, số hộp, nơi bảo
// quản; dòng cuối là tổng cộng. Lọc theo phông, nơi bảo quản; Xuất Excel theo bộ lọc đang chọn, máy chủ ghi nhật ký xuất
const TOTAL_ROW_ID = 'total';
const meters = (value: number) => formatNumber(value);

const COLUMNS: Array<DataGridColumn<ArchiveReportRow>> = [
  {
    id: 'fond',
    header: 'Phông lưu trữ',
    alwaysVisible: true,
    className: 'font-medium',
    cell: (row) => (row.fond_id === TOTAL_ROW_ID ? 'Tổng cộng' : `${row.fond_code} - ${row.fond_name}`),
  },
  {
    id: 'period',
    header: 'Giai đoạn',
    cell: (row) => (row.fond_id === TOTAL_ROW_ID ? '' : periodText(row.period_from_year, row.period_to_year)),
  },
  { id: 'total_meters', header: 'Tổng số mét giá', cell: (row) => meters(row.total_meters) },
  { id: 'arranged_meters', header: 'Đã chỉnh lý (mét)', cell: (row) => meters(row.arranged_meters) },
  { id: 'unarranged_meters', header: 'Chưa chỉnh lý (mét)', cell: (row) => meters(row.unarranged_meters) },
  { id: 'expired_meters', header: 'Hết giá trị (mét)', cell: (row) => meters(row.expired_meters) },
  { id: 'permanent_meters', header: 'Vĩnh viễn (mét)', cell: (row) => meters(row.permanent_meters) },
  { id: 'limited_meters', header: 'Có thời hạn (mét)', cell: (row) => meters(row.limited_meters) },
  { id: 'bundle_count', header: 'Số bó', cell: (row) => formatNumber(row.bundle_count) },
  { id: 'box_count', header: 'Số hộp', cell: (row) => formatNumber(row.box_count) },
  { id: 'storage_locations', header: 'Nơi bảo quản', cell: (row) => row.storage_locations },
];

export function ArchiveReportPage() {
  const canExport = useHasPermission(PERMISSION_CODES.archiveExport);
  const grid = useGridSettings('archive-report');
  const [filter, setFilter] = useState<ArchiveReportFilter>({});
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();
  const fonds = useQuery({ queryKey: ['archive-fonds'], queryFn: listArchiveFonds });
  const report = useQuery({ queryKey: ['archive-report', filter], queryFn: () => readArchiveReport(filter) });
  const rows: ArchiveReportRow[] =
    report.data && report.data.rows.length > 0
      ? [
          ...report.data.rows,
          {
            ...report.data.totals,
            fond_id: TOTAL_ROW_ID,
            fond_code: '',
            fond_name: 'Tổng cộng',
            period_from_year: 0,
            period_to_year: 0,
            storage_locations: '',
          },
        ]
      : [];
  const runExport = async () => {
    setExportError(undefined);
    setExporting(true);
    try {
      await exportArchiveReport(filter);
    } catch (error) {
      setExportError(messageOf(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/archive-report')}</h1>
        {report.isError ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        {exportError ? <Alert tone="danger">{exportError}</Alert> : null}
        <DataGrid
          label="Báo cáo lưu trữ theo phông, giai đoạn"
          columns={COLUMNS}
          rows={rows}
          getRowId={(row) => `${row.fond_id}-${row.period_from_year}-${row.period_to_year}`}
          getRowLabel={(row) =>
            row.fond_id === TOTAL_ROW_ID
              ? 'Tổng cộng'
              : `${row.fond_name} ${periodText(row.period_from_year, row.period_to_year)}`
          }
          loading={report.isPending}
          emptyText="Chưa có thông tin lưu trữ để tổng hợp."
          search={{
            label: 'Nơi bảo quản',
            value: filter.storage_location ?? '',
            onChange: (value) => setFilter((current) => ({ ...current, storage_location: value || undefined })),
          }}
          advancedSearch={
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-label font-medium text-text">
                Phông lưu trữ
                <select
                  value={filter.fond_id ?? ''}
                  onChange={(event) =>
                    setFilter((current) => ({ ...current, fond_id: event.target.value || undefined }))
                  }
                  className={selectClass}
                >
                  <option value="">Tất cả</option>
                  {(fonds.data ?? []).map((fond) => (
                    <option key={fond.id} value={fond.id}>
                      {fond.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          }
          toolbar={
            canExport ? (
              <Button disabled={exporting} onClick={() => void runExport()}>
                Xuất Excel
              </Button>
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}
