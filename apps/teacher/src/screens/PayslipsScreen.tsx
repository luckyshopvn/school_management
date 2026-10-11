import { useEffect, useState } from 'react';
import { Alert, ApplicationHeader, Button } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// MG-11 Phiếu lương của tôi (P08-08, BR-46, YCTD-60): phiếu lương đã duyệt, từng dòng kèm căn cứ
interface Payslip {
  id: string;
  period_year: number;
  period_month: number;
  net_amount: number;
  lines: Array<{ id: string; section: string; name: string; amount: number; basis: string }>;
}

const money = new Intl.NumberFormat('vi-VN');
const SECTIONS: Record<string, string> = {
  prepaid: 'Trả trước tháng này',
  adjustment: 'Điều chỉnh theo công tháng trước',
  tax: 'Thuế',
};

export function PayslipsScreen({ onBack }: { onBack(): void }) {
  const [payslips, setPayslips] = useState<Payslip[]>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [openId, setOpenId] = useState<string>();

  useEffect(() => {
    requestJson<Payslip[]>('/api/v1/me/payslips')
      .then(setPayslips)
      .catch((error: unknown) =>
        setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ'),
      );
  }, []);

  return (
    <div className="min-h-screen">
      <ApplicationHeader title="Phiếu lương" />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        <div>
          <Button variant="text" onClick={onBack}>
            Quay lại
          </Button>
        </div>
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        {payslips && payslips.length === 0 ? (
          <p className="text-content text-text-secondary">Chưa có phiếu lương đã công bố.</p>
        ) : null}
        {(payslips ?? []).map((payslip) => (
          <section
            key={payslip.id}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
            aria-label={`Phiếu lương tháng ${payslip.period_month}/${payslip.period_year}`}
          >
            <button
              type="button"
              className="text-left text-content font-semibold"
              onClick={() => setOpenId(openId === payslip.id ? undefined : payslip.id)}
            >
              Tháng {payslip.period_month}/{payslip.period_year}: {money.format(payslip.net_amount)} đồng
            </button>
            {openId === payslip.id
              ? Object.keys(SECTIONS).map((section) => {
                  const lines = payslip.lines.filter((line) => line.section === section);
                  return lines.length === 0 ? null : (
                    <div key={section} className="flex flex-col gap-1">
                      <span className="text-label font-semibold text-text-secondary">{SECTIONS[section]}</span>
                      {lines.map((line) => (
                        <div key={line.id} className="flex flex-col border-t border-border pt-1">
                          <span className="flex justify-between text-content">
                            <span>{line.name}</span>
                            <span>{money.format(line.amount)}</span>
                          </span>
                          <span className="text-label text-text-secondary">{line.basis}</span>
                        </div>
                      ))}
                    </div>
                  );
                })
              : null}
          </section>
        ))}
      </main>
    </div>
  );
}
