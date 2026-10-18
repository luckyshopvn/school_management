import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, ConfirmDialog, FORM_CONTROL_CLASS, FormBlock, FormRow, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import {
  cancelOpenAcademicYear,
  openAcademicYear,
  readRolloverStatus,
  type AcademicYear,
} from './academic-years-api.js';

// 5.7. Chuyển hồ sơ lên năm học mới theo Sở (DT-16 phần 16e, khảo sát mục 3.5 dòng 5.7): "Thực hiện" dùng lại thao tác mở
// năm học (BR-93: kiểm tra, tạo cơ sở dữ liệu năm mới, chuyển hồ sơ, đóng năm đang dùng); năm học mới tạo và lưu lịch ở 2.1
// Năm học. "Hủy" chỉ cho khi năm học mới chưa phát sinh dữ liệu; máy chủ kiểm tra và trả lý do khi không hủy được
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const formatDate = (value: string | null) => (value ? value.split('-').reverse().join('/') : '');
const describe = (year: AcademicYear) => `${year.name} (${formatDate(year.start_date)} – ${formatDate(year.end_date)})`;

export function YearRolloverPage() {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ['academic-years', 'rollover'], queryFn: readRolloverStatus });
  const [targetId, setTargetId] = useState('');
  const [confirming, setConfirming] = useState<'run' | 'cancel'>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const target = status.data?.candidates.find((year) => year.id === targetId) ?? status.data?.candidates[0];
  const refresh = async () => {
    await queryClient.invalidateQueries();
  };
  const run = useMutation({
    mutationFn: () => openAcademicYear(target?.id ?? ''),
    onSuccess: async (year) => {
      setConfirming(undefined);
      await refresh();
      setToastMessage(`Đã chuyển hồ sơ lên năm học ${year.name}`);
    },
    onError: () => setConfirming(undefined),
  });
  const cancel = useMutation({
    mutationFn: () => cancelOpenAcademicYear(status.data?.current?.id ?? ''),
    onSuccess: async (year) => {
      setConfirming(undefined);
      await refresh();
      setToastMessage(`Đã hủy chuyển hồ sơ lên năm học ${year.name}`);
    },
    onError: () => setConfirming(undefined),
  });
  const current = status.data?.current ?? null;

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/year-rollover')}</h1>
        {status.isError ? <Alert tone="danger">{messageOf(status.error)}</Alert> : null}
        {run.error ? <Alert tone="danger">{messageOf(run.error)}</Alert> : null}
        {cancel.error ? <Alert tone="danger">{messageOf(cancel.error)}</Alert> : null}
        <section
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
          aria-label="Chuyển hồ sơ lên năm học mới"
        >
          <FormBlock title="Chuyển hồ sơ lên năm học mới">
            <FormRow label="Năm học đang dùng">
              <span className="text-content text-text">
                {current ? describe(current) : 'Chưa có năm học đang dùng'}
              </span>
            </FormRow>
            <FormRow label="Năm học mới">
              {status.data && status.data.candidates.length > 0 ? (
                <select
                  className={FORM_CONTROL_CLASS}
                  value={target?.id ?? ''}
                  onChange={(event) => setTargetId(event.target.value)}
                >
                  {status.data.candidates.map((year) => (
                    <option key={year.id} value={year.id}>
                      {describe(year)}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-content text-text-secondary">
                  Chưa có năm học mới có lịch. Tạo năm học và lưu lịch ở 2.1 Năm học (Quản trị hệ thống).
                </span>
              )}
            </FormRow>
          </FormBlock>
          <p className="text-label text-text-secondary">
            Thực hiện: tạo dữ liệu năm học mới, chuyển hồ sơ đang dùng (cây đơn vị, danh mục, học sinh, nhân sự, công
            nợ…) sang năm mới rồi khóa năm học cũ chỉ đọc. Hủy: đưa năm học mới về chờ mở và mở lại năm học cũ; chỉ hủy
            được khi năm học mới chưa phát sinh dữ liệu (chưa thêm, sửa dữ liệu nào sau khi chuyển, chưa gửi biểu mẫu
            lên cấp trên).
          </p>
          {status.data && !status.data.cancel.allowed && current ? (
            <p className="text-label text-text-secondary">Không hủy được: {status.data.cancel.reason}</p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" disabled={!target || run.isPending} onClick={() => setConfirming('run')}>
              Thực hiện
            </Button>
            <Button disabled={!status.data?.cancel.allowed || cancel.isPending} onClick={() => setConfirming('cancel')}>
              Hủy
            </Button>
          </div>
        </section>
      </div>
      {confirming === 'run' && target ? (
        <ConfirmDialog
          open
          title={`Chuyển hồ sơ lên năm học ${target.name}?`}
          confirmLabel="Thực hiện"
          busy={run.isPending}
          onCancel={() => setConfirming(undefined)}
          onConfirm={() => run.mutate()}
        >
          Năm học {current?.name ?? 'đang dùng'} sẽ chỉ đọc sau khi chuyển. Có thể hủy khi năm học mới chưa phát sinh dữ
          liệu.
        </ConfirmDialog>
      ) : null}
      {confirming === 'cancel' && current ? (
        <ConfirmDialog
          open
          title={`Hủy chuyển hồ sơ lên năm học ${current.name}?`}
          confirmLabel="Hủy chuyển hồ sơ"
          busy={cancel.isPending}
          onCancel={() => setConfirming(undefined)}
          onConfirm={() => cancel.mutate()}
        >
          Dữ liệu năm học {current.name} bị xóa, năm học về trạng thái chờ mở; năm học trước mở lại và ghi được như
          trước khi chuyển.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}
