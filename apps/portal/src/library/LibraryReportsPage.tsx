import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, StatusBadge } from '@school-management/ui';
import { CONDITION_LABELS, downloadLibraryReport, formatDate, readLibraryOverview } from './library-api.js';
import { EmptyRow, ErrorAlert, HEAD_CLASS, LibraryFrame, Panel, TH_CLASS, useToast } from './library-common.js';

// Báo cáo thư viện (DT-22 phần 22a, tài liệu 47 mục 13.4, YCTD-181): số liệu tổng, kho theo phân loại và khối, lượt mượn theo
// tháng và lớp, ấn phẩm và bạn đọc tích cực, sách quá hạn, bảng chỉ tiêu theo chuẩn thư viện (ngưỡng đặt ở 4.1 Quy định mượn
// và phân loại; chưa đặt ngưỡng thì chưa kết luận), xuất Excel hoặc PDF

function SimpleTable({
  label,
  headers,
  rows,
}: {
  label: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-section-title font-semibold text-text">{label}</h3>
      <table className="w-full text-content" aria-label={label}>
        <thead className={HEAD_CLASS}>
          <tr>
            {headers.map((header) => (
              <th key={header} className={TH_CLASS}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <EmptyRow columns={headers.length} message="Chưa có dữ liệu" /> : null}
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-border">
              {row.map((cell, column) => (
                <td key={column} className={TH_CLASS}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col rounded-lg border border-border px-4 py-3">
      <span className="text-label text-text-secondary">{label}</span>
      <span className="text-section-title font-semibold text-text">{value.toLocaleString('vi-VN')}</span>
    </div>
  );
}

export function LibraryReportsPage() {
  const toast = useToast();
  const overview = useQuery({ queryKey: ['library-overview'], queryFn: readLibraryOverview });
  const exportFile = useMutation({
    mutationFn: (input: { type: 'overview' | 'loans' | 'overdue'; format: 'xlsx' | 'pdf' }) =>
      downloadLibraryReport(input.type, input.format),
    onSuccess: () => toast.show('Đã tạo tệp báo cáo'),
  });
  const data = overview.data;
  return (
    <LibraryFrame path="/library/reports" toast={toast}>
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            disabled={exportFile.isPending}
            onClick={() => exportFile.mutate({ type: 'overview', format: 'xlsx' })}
          >
            Xuất báo cáo tổng hợp (Excel)
          </Button>
          <Button
            disabled={exportFile.isPending}
            onClick={() => exportFile.mutate({ type: 'overview', format: 'pdf' })}
          >
            Báo cáo tổng hợp (PDF)
          </Button>
          <Button disabled={exportFile.isPending} onClick={() => exportFile.mutate({ type: 'loans', format: 'xlsx' })}>
            Sổ mượn trả (Excel)
          </Button>
          <Button
            disabled={exportFile.isPending}
            onClick={() => exportFile.mutate({ type: 'overdue', format: 'xlsx' })}
          >
            Sách quá hạn (Excel)
          </Button>
          <Button disabled={exportFile.isPending} onClick={() => exportFile.mutate({ type: 'overdue', format: 'pdf' })}>
            Sách quá hạn (PDF)
          </Button>
        </div>
        <ErrorAlert error={overview.error ?? exportFile.error} />
      </Panel>
      {data ? (
        <>
          <Panel>
            <p className="text-content text-text-secondary">Số liệu tính đến ngày {formatDate(data.as_of)}</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Figure label="Số đầu ấn phẩm" value={data.titles} />
              <Figure label="Số bản sách" value={data.copies} />
              <Figure label="Học sinh" value={data.students} />
              <Figure label="Cán bộ, giáo viên" value={data.teachers} />
              <Figure label="Lượt mượn" value={data.loans.total} />
              <Figure label="Đang mượn" value={data.loans.open} />
              <Figure label="Quá hạn" value={data.loans.overdue} />
              <Figure label="Đã mất" value={data.loans.lost} />
            </div>
            {data.loans.overdue > 0 ? (
              <Alert tone="warning">
                Có {data.loans.overdue} bản quá hạn. Nhắc bạn đọc ở 2.1 Mượn, trả, đặt trước (thẻ Trả).
              </Alert>
            ) : null}
          </Panel>
          <Panel>
            <h2 className="text-section-title font-semibold text-text">Chỉ tiêu theo chuẩn thư viện</h2>
            <table className="w-full text-content" aria-label="Chỉ tiêu theo chuẩn thư viện">
              <thead className={HEAD_CLASS}>
                <tr>
                  <th className={TH_CLASS}>Chỉ tiêu</th>
                  <th className={TH_CLASS}>Giá trị</th>
                  <th className={TH_CLASS}>Ngưỡng</th>
                  <th className={TH_CLASS}>Kết luận</th>
                </tr>
              </thead>
              <tbody>
                {data.indicators.length === 0 ? <EmptyRow columns={4} message="Chưa bật chỉ tiêu nào" /> : null}
                {data.indicators.map((item) => (
                  <tr key={item.code} className="border-t border-border">
                    <td className={TH_CLASS}>{item.name}</td>
                    <td className={TH_CLASS}>{item.value === null ? 'Không đo được' : item.value}</td>
                    <td className={TH_CLASS}>{item.threshold === null ? 'Chưa đặt' : item.threshold}</td>
                    <td className={TH_CLASS}>
                      <StatusBadge
                        tone={item.passed === null ? 'neutral' : item.passed ? 'success' : 'danger'}
                        label={item.passed === null ? 'Chưa kết luận' : item.passed ? 'Đạt' : 'Chưa đạt'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Panel>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <SimpleTable
                label="Kho theo phân loại"
                headers={['Phân loại', 'Số đầu', 'Số bản']}
                rows={data.by_category.map((item) => [item.name, item.titles, item.copies])}
              />
              <SimpleTable
                label="Kho theo khối"
                headers={['Khối', 'Số bản']}
                rows={data.by_grade.map((item) => [item.grade_level || 'Không phân khối', item.copies])}
              />
              <SimpleTable
                label="Kho theo tình trạng"
                headers={['Tình trạng', 'Số bản']}
                rows={data.by_condition.map((item) => [
                  CONDITION_LABELS[item.condition] ?? item.condition,
                  item.copies,
                ])}
              />
              <SimpleTable
                label="Lượt mượn theo tháng"
                headers={['Tháng', 'Lượt mượn']}
                rows={data.by_month.map((item) => [item.month, item.loans])}
              />
              <SimpleTable
                label="Lượt mượn theo lớp (10 lớp nhiều nhất)"
                headers={['Lớp', 'Lượt mượn']}
                rows={data.by_class.map((item) => [item.class_name, item.loans])}
              />
              <SimpleTable
                label="Ấn phẩm mượn nhiều nhất"
                headers={['Nhan đề', 'Lượt mượn']}
                rows={data.top_titles.map((item) => [item.title, item.loans])}
              />
              <SimpleTable
                label="Bạn đọc tích cực"
                headers={['Bạn đọc', 'Số thẻ', 'Lượt mượn']}
                rows={data.top_readers.map((item) => [item.reader_name, item.card_no, item.loans])}
              />
            </div>
          </Panel>
        </>
      ) : null}
    </LibraryFrame>
  );
}
