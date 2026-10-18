import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import {
  downloadExcel,
  fieldErrorsOf,
  formatNumber,
  messageOf,
  readFacilityInvestments,
  saveFacilityInvestments,
  type InvestmentRow,
  type InvestmentValues,
} from './facilities-api.js';

// 6.1 Thực trạng và nhu cầu đầu tư phòng học, nhà công vụ (khảo sát mục 3.6; DT-16 phần 16i): bảng nhập theo ô của toàn
// trường, mỗi chỉ tiêu một dòng (thực trạng kiên cố, bán kiên cố, cấp 4 xuống cấp, nhờ mượn; nhu cầu số lớp, số phòng, kinh
// phí triệu đồng). "Lấy số liệu từ khai báo phòng" điền thực trạng theo phòng đang dùng rồi người nhập sửa và Ghi
const COUNT_FIELDS: Array<{ key: keyof InvestmentValues; label: string }> = [
  { key: 'permanent', label: 'Kiên cố' },
  { key: 'semi_permanent', label: 'Bán kiên cố' },
  { key: 'degraded_level4', label: 'Cấp 4 xuống cấp' },
  { key: 'borrowed', label: 'Nhờ, mượn' },
  { key: 'need_classes', label: 'Số lớp' },
  { key: 'need_rooms', label: 'Số phòng' },
  { key: 'need_budget_million', label: 'Kinh phí (triệu đồng)' },
];

type Draft = Record<string, Record<string, string>>;

const toDraft = (items: InvestmentRow[]): Draft =>
  Object.fromEntries(
    items.map((item) => [
      item.category,
      {
        ...Object.fromEntries(
          COUNT_FIELDS.map((field) => [field.key, item[field.key] === null ? '' : String(item[field.key])]),
        ),
        note: item.note ?? '',
      },
    ]),
  );

const toNumber = (value: string | undefined) => (value === undefined || value.trim() === '' ? null : Number(value));

export function FacilityInvestmentsPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>({});
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const investments = useQuery({ queryKey: ['facility-investments'], queryFn: readFacilityInvestments });
  useEffect(() => {
    if (investments.data) {
      setDraft(toDraft(investments.data.items));
    }
  }, [investments.data]);
  const save = useMutation({
    mutationFn: () =>
      saveFacilityInvestments(
        (investments.data?.items ?? []).map((item) => {
          const values = draft[item.category] ?? {};
          return {
            category: item.category,
            permanent: toNumber(values.permanent),
            semi_permanent: toNumber(values.semi_permanent),
            degraded_level4: toNumber(values.degraded_level4),
            borrowed: toNumber(values.borrowed),
            need_classes: toNumber(values.need_classes),
            need_rooms: toNumber(values.need_rooms),
            need_budget_million: toNumber(values.need_budget_million),
            note: values.note?.trim() || null,
          };
        }),
      ),
    onSuccess: async () => {
      setToastMessage('Đã ghi thực trạng và nhu cầu đầu tư');
      await queryClient.invalidateQueries({ queryKey: ['facility-investments'] });
    },
  });
  const exportFile = useMutation({
    mutationFn: () => downloadExcel('/api/v1/facilities/investments/export', {}, 'thuc-trang-nhu-cau-dau-tu.xlsx'),
  });
  // Điền thực trạng theo khai báo phòng; phòng "Tạm" không có cột riêng nên giữ số đang nhập ở cấp 4 xuống cấp
  const collect = () => {
    const next: Draft = { ...draft };
    for (const item of investments.data?.items ?? []) {
      if (!item.suggestion) {
        continue;
      }
      next[item.category] = {
        ...next[item.category],
        permanent: String(item.suggestion.permanent),
        semi_permanent: String(item.suggestion.semi_permanent),
        borrowed: String(item.suggestion.borrowed),
      };
    }
    setDraft(next);
    setToastMessage('Đã lấy số liệu từ khai báo phòng, kiểm tra rồi bấm Ghi');
  };
  const data = investments.data;
  const errors = fieldErrorsOf(save.error);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-page-title font-bold text-text">{menuPageTitle('/facility-investments')}</h1>
          <Button variant="secondary" disabled={exportFile.isPending || !data} onClick={() => exportFile.mutate()}>
            Xuất Excel
          </Button>
        </div>
        {investments.error ? <Alert tone="danger">{messageOf(investments.error)}</Alert> : null}
        {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
        {exportFile.error ? <Alert tone="danger">{messageOf(exportFile.error)}</Alert> : null}
        {data ? (
          <>
            <p className="text-content text-text-secondary">
              Số liệu toàn trường {data.school_name}, năm học {data.academic_year}. Trường có {data.class_count} nhóm,
              lớp; {data.classes_without_room} nhóm, lớp chưa gán phòng.
            </p>
            <section
              className="overflow-x-auto rounded-xl border border-border bg-card p-4"
              aria-label="Thực trạng và nhu cầu đầu tư"
            >
              <table className="w-full text-content">
                <thead className="text-left text-label font-medium text-text-secondary">
                  <tr>
                    <th className="px-3 py-2" rowSpan={2}>
                      Chỉ tiêu
                    </th>
                    <th className="px-3 py-2 text-center" colSpan={4}>
                      Thực trạng
                    </th>
                    <th className="px-3 py-2 text-center" colSpan={3}>
                      Nhu cầu đầu tư
                    </th>
                    <th className="px-3 py-2" rowSpan={2}>
                      Ghi chú
                    </th>
                  </tr>
                  <tr>
                    {COUNT_FIELDS.map((field) => (
                      <th key={field.key} className="px-3 py-2">
                        {field.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, index) => (
                    <tr key={item.category} className="border-t border-border align-top">
                      <td className="px-3 py-2 font-medium">
                        {item.label}
                        {item.suggestion ? (
                          <p className="text-label font-normal text-text-secondary">
                            Khai báo phòng: {item.suggestion.rooms} phòng
                            {item.suggestion.temporary > 0 ? `, ${item.suggestion.temporary} phòng tạm` : ''}
                            {item.suggestion.unspecified > 0
                              ? `, ${item.suggestion.unspecified} chưa khai báo hiện trạng`
                              : ''}
                          </p>
                        ) : null}
                      </td>
                      {COUNT_FIELDS.map((field) => {
                        const error = errors[`items.${index}.${field.key}`];
                        return (
                          <td key={field.key} className="px-3 py-2">
                            {data.can_manage ? (
                              <input
                                type="number"
                                min="0"
                                step={field.key === 'need_budget_million' ? '0.01' : '1'}
                                aria-label={`${field.label} ${item.label}`}
                                value={draft[item.category]?.[field.key] ?? ''}
                                onChange={(event) =>
                                  setDraft({
                                    ...draft,
                                    [item.category]: { ...draft[item.category], [field.key]: event.target.value },
                                  })
                                }
                                className={`w-24 rounded-lg border bg-card px-2 py-1 ${error ? 'border-danger' : 'border-border'}`}
                              />
                            ) : (
                              formatNumber(item[field.key] as number | null)
                            )}
                            {error ? <p className="text-label text-danger">{error}</p> : null}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2">
                        {data.can_manage ? (
                          <input
                            aria-label={`Ghi chú ${item.label}`}
                            value={draft[item.category]?.note ?? ''}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                [item.category]: { ...draft[item.category], note: event.target.value },
                              })
                            }
                            className="w-full rounded-lg border border-border bg-card px-2 py-1"
                          />
                        ) : (
                          (item.note ?? '')
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            {data.can_manage ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={collect}>
                  Lấy số liệu từ khai báo phòng
                </Button>
                <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
                  Ghi
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
