import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { SCHOOL_OWNERSHIP_TYPES } from '@school-management/shared';
import { Alert, Button } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { downloadExcel, formatNumber, messageOf, readEmisReport } from './facilities-api.js';
import { TabBar } from './facilities-ui.js';

// 1.1 Báo cáo EMIS đầu năm (YCTD-102): Biểu 1 năm thẻ tính từ dữ liệu năm học đang dùng, xem và xuất Excel; chưa gửi lên
// Sở. Mã số, tên chỉ tiêu cần đối chiếu biểu mẫu chính thức
export function EmisPage() {
  const report = useQuery({ queryKey: ['emis-start-of-year'], queryFn: readEmisReport });
  const [tab, setTab] = useState('school_classes');
  const exportFile = useMutation({
    mutationFn: () => downloadExcel('/api/v1/reports/emis/start-of-year/export', {}, 'emis-dau-nam.xlsx'),
  });
  const current = report.data?.tabs.find((item) => item.key === tab);
  const ownership = SCHOOL_OWNERSHIP_TYPES.find((type) => type.value === report.data?.ownership)?.label;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-page-title font-bold text-text">1.1 Báo cáo EMIS đầu năm</h1>
          <Button
            variant="secondary"
            disabled={exportFile.isPending || !report.data}
            onClick={() => exportFile.mutate()}
          >
            Xuất Excel
          </Button>
        </div>
        {report.error ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
        {exportFile.error ? <Alert tone="danger">{messageOf(exportFile.error)}</Alert> : null}
        {report.data ? (
          <>
            <p className="text-content text-text-secondary">
              Biểu 1 của {report.data.school_name}, năm học {report.data.academic_year}
              {ownership ? `, loại hình ${ownership.toLowerCase()}` : ''}. Số liệu tính tại thời điểm xem; chưa gửi lên
              Sở.
            </p>
            {report.data.warnings.map((warning) => (
              <Alert key={warning} tone="warning">
                {warning}
              </Alert>
            ))}
            <TabBar
              tabs={report.data.tabs.map((item) => ({ key: item.key, label: item.label }))}
              current={tab}
              onSelect={setTab}
              label="Thẻ của Biểu 1"
            />
            {current ? (
              <section
                className="overflow-x-auto rounded-xl border border-border bg-card p-4"
                aria-label={current.label}
              >
                <table className="w-full text-content">
                  <thead className="text-left text-label font-medium text-text-secondary">
                    <tr>
                      <th className="px-3 py-2">Chỉ tiêu</th>
                      <th className="px-3 py-2">Đơn vị</th>
                      <th className="px-3 py-2">Mã số</th>
                      <th className="px-3 py-2">Tổng số</th>
                      <th className="px-3 py-2">Công lập</th>
                      <th className="px-3 py-2">Tư thục</th>
                      <th className="px-3 py-2">Dân lập</th>
                      <th className="px-3 py-2">Nữ</th>
                      <th className="px-3 py-2">Dân tộc thiểu số</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.rows.map((row) => (
                      <tr key={row.code} className="border-t border-border">
                        <td className="px-3 py-2">{row.label}</td>
                        <td className="px-3 py-2">{row.unit}</td>
                        <td className="px-3 py-2">{row.code}</td>
                        <td className="px-3 py-2 font-medium">{formatNumber(row.total)}</td>
                        <td className="px-3 py-2">{formatNumber(row.public)}</td>
                        <td className="px-3 py-2">{formatNumber(row.private)}</td>
                        <td className="px-3 py-2">{formatNumber(row.people_founded)}</td>
                        <td className="px-3 py-2">{formatNumber(row.female)}</td>
                        <td className="px-3 py-2">{formatNumber(row.ethnic_minority)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
