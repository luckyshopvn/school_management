import { formatMoney, SECTION_LABELS, type Payslip } from './payroll-api.js';

// Chi tiết một phiếu lương: từng dòng kèm căn cứ, chia phần trả trước, phần điều chỉnh và thuế (BR-46, YCTD-60)
export function PayslipView({ payslip }: { payslip: Payslip }) {
  return (
    <div className="flex flex-col gap-3">
      {(['prepaid', 'adjustment', 'tax'] as const).map((section) => {
        const lines = payslip.lines.filter((line) => line.section === section);
        if (lines.length === 0) {
          return null;
        }
        return (
          <table key={section} className="w-full text-content" aria-label={SECTION_LABELS[section]}>
            <caption className="text-left text-label font-semibold text-text-secondary">
              {SECTION_LABELS[section]}
            </caption>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-t border-border">
                  <td className="px-3 py-1 font-medium">{line.name}</td>
                  <td className="px-3 py-1 text-text-secondary">{line.basis}</td>
                  <td className={`px-3 py-1 text-right ${line.amount < 0 ? 'text-danger' : ''}`}>
                    {formatMoney(line.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })}
      <p className="text-right text-content font-semibold text-text">
        Thực nhận: {formatMoney(payslip.net_amount)} đồng
      </p>
    </div>
  );
}
