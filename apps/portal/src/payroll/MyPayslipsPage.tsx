import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { formatMoney, readMyPayslips } from './payroll-api.js';
import { PayslipView } from './PayslipView.js';

// MH-44 Phiếu lương của tôi (P08-08, BR-46, YCTD-60): phiếu lương đã duyệt của chính người đăng nhập
export function MyPayslipsPage() {
  const payslips = useQuery({ queryKey: ['my-payslips'], queryFn: readMyPayslips, retry: false });
  const [openId, setOpenId] = useState<string>();
  const notLinked = payslips.error instanceof ApiError && payslips.error.status === 404;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Phiếu lương của tôi</h1>
        {notLinked ? (
          <p className="text-content text-text-secondary">
            Tài khoản chưa gắn với hồ sơ nhân sự nên chưa có phiếu lương.
          </p>
        ) : payslips.error ? (
          <Alert tone="danger">
            {payslips.error instanceof ApiError ? payslips.error.message : 'Không kết nối được tới máy chủ'}
          </Alert>
        ) : null}
        {payslips.data && payslips.data.length === 0 ? (
          <p className="text-content text-text-secondary">Chưa có phiếu lương đã công bố.</p>
        ) : null}
        {(payslips.data ?? []).map((payslip) => (
          <section
            key={payslip.id}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            aria-label={`Phiếu lương tháng ${payslip.period_month}/${payslip.period_year}`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-section-title font-semibold text-text">
                Tháng {payslip.period_month}/{payslip.period_year}: thực nhận {formatMoney(payslip.net_amount)} đồng
              </h2>
              <Button variant="text" onClick={() => setOpenId(openId === payslip.id ? undefined : payslip.id)}>
                {openId === payslip.id ? 'Ẩn' : 'Chi tiết'}
              </Button>
            </div>
            {openId === payslip.id ? <PayslipView payslip={payslip} /> : null}
          </section>
        ))}
      </div>
    </AppShell>
  );
}
