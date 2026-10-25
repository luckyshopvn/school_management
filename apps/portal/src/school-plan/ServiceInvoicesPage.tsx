import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Alert, Button } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError, fetchWithSession, requestJson } from '../session/api-client.js';

// Hóa đơn dịch vụ của trường (DT-SaaS phần S5b, YCTD-196): quản trị trường xem hóa đơn của nền tảng, tải bản in, trả tiền bằng mã QR
// hoặc liên kết thanh toán qua cổng của nền tảng. Trả đủ thì trường được gia hạn và mở lại nếu đang chỉ đọc (trang này dùng được cả ở
// chế độ chỉ đọc)
interface ServiceInvoice {
  id: string;
  code: string;
  period_start: string;
  period_end: string;
  total: number;
  amount_paid: number;
  outstanding: number;
  status: 'issued' | 'paid' | 'void';
  overdue: boolean;
  due_on: string;
  payment_content: string;
}

interface InvoiceList {
  invoices: ServiceInvoice[];
  outstanding: number;
  payment: { available: boolean; provider: string; label: string; simulated: boolean; account_name: string | null };
}

interface PaymentRequest {
  provider: string;
  virtual_account_number: string;
  qr_content: string;
  amount: number;
  transfer_content: string;
  account_name: string | null;
}

const money = (value: number) => `${value.toLocaleString('vi-VN')} đồng`;
const day = (value: string) => value.split('-').reverse().join('/');
const STATUS: Record<ServiceInvoice['status'], string> = {
  issued: 'Chưa thanh toán',
  paid: 'Đã thanh toán',
  void: 'Đã hủy',
};
const messageOf = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Không thực hiện được, vui lòng thử lại';

function PaymentPanel({
  invoice,
  request,
  simulated,
}: {
  invoice: ServiceInvoice;
  request: PaymentRequest;
  simulated: boolean;
}) {
  const client = useQueryClient();
  const [image, setImage] = useState<string | null>(null);
  const isLink = /^https?:\/\//.test(request.qr_content);
  useEffect(() => {
    let cancelled = false;
    if (!isLink) {
      void QRCode.toDataURL(request.qr_content, { margin: 1, width: 220 }).then((url) => {
        if (!cancelled) setImage(url);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [request.qr_content, isLink]);
  const simulate = useMutation({
    mutationFn: () =>
      requestJson<{ paid: boolean }>(`/api/v1/billing/invoices/${invoice.id}/simulate-payment`, { method: 'POST' }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['service-invoices'] }),
        client.invalidateQueries({ queryKey: ['school-plan'] }),
      ]);
    },
  });
  return (
    <section
      aria-label={`Thanh toán ${invoice.code}`}
      className="flex flex-col gap-2 rounded-md border border-border p-4"
    >
      <h2 className="text-section-title font-semibold">Thanh toán hóa đơn {invoice.code}</h2>
      {isLink ? (
        <a className="text-primary underline" href={request.qr_content} target="_blank" rel="noreferrer">
          Mở trang thanh toán
        </a>
      ) : image ? (
        <img src={image} alt={`Mã QR thanh toán ${invoice.code}`} width={220} height={220} />
      ) : null}
      <dl className="grid gap-1 text-content sm:grid-cols-[200px_1fr]">
        <dt className="text-text-secondary">Số tiền</dt>
        <dd>{money(request.amount)}</dd>
        <dt className="text-text-secondary">Nội dung chuyển khoản</dt>
        <dd>{request.transfer_content}</dd>
        <dt className="text-text-secondary">Số tài khoản</dt>
        <dd>{request.virtual_account_number}</dd>
        {request.account_name ? (
          <>
            <dt className="text-text-secondary">Chủ tài khoản</dt>
            <dd>{request.account_name}</dd>
          </>
        ) : null}
      </dl>
      <p className="text-label text-text-secondary">
        Ghi đúng nội dung chuyển khoản để hệ thống tự đối soát; thanh toán đủ thì gói được gia hạn ngay.
      </p>
      {simulated ? (
        <div className="flex flex-col gap-2">
          <Alert tone="info">Máy chủ đang dùng cổng giả lập: mã QR không quét được ở ngân hàng thật.</Alert>
          <Button variant="primary" onClick={() => simulate.mutate()} disabled={simulate.isPending}>
            Giả lập đã chuyển tiền
          </Button>
          {simulate.error ? <Alert tone="danger">{messageOf(simulate.error)}</Alert> : null}
          {simulate.data?.paid ? (
            <Alert tone="success">Đã nhận đủ tiền, hóa đơn {invoice.code} đã thanh toán.</Alert>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

async function download(invoice: ServiceInvoice) {
  const response = await fetchWithSession(`/api/v1/billing/invoices/${invoice.id}/document`);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `hoa-don-${invoice.code}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ServiceInvoicesPage() {
  const list = useQuery({
    queryKey: ['service-invoices'],
    queryFn: () => requestJson<InvoiceList>('/api/v1/billing/invoices'),
  });
  const [paying, setPaying] = useState<{ invoice: ServiceInvoice; request: PaymentRequest } | null>(null);
  const pay = useMutation({
    mutationFn: (invoice: ServiceInvoice) =>
      requestJson<PaymentRequest>(`/api/v1/billing/invoices/${invoice.id}/pay`, { method: 'POST' }).then((request) => ({
        invoice,
        request,
      })),
    onSuccess: setPaying,
  });
  const data = list.data;
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/service-invoices')}</h1>
        {list.error ? <Alert tone="danger">{messageOf(list.error)}</Alert> : null}
        {pay.error ? <Alert tone="danger">{messageOf(pay.error)}</Alert> : null}
        {data ? (
          <>
            <p className="text-content">
              Còn nợ: <strong>{money(data.outstanding)}</strong>
            </p>
            {!data.payment.available ? (
              <Alert tone="info">
                Nền tảng chưa nối cổng thanh toán; liên hệ nhà cung cấp để thanh toán chuyển khoản.
              </Alert>
            ) : null}
            <table aria-label="Hóa đơn dịch vụ" className="w-full text-content">
              <thead>
                <tr className="text-left text-text-secondary">
                  <th>Mã hóa đơn</th>
                  <th>Kỳ</th>
                  <th>Tổng tiền</th>
                  <th>Còn nợ</th>
                  <th>Hạn thanh toán</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7}>Chưa có hóa đơn.</td>
                  </tr>
                ) : null}
                {data.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.code}</td>
                    <td>
                      {day(invoice.period_start)} – {day(invoice.period_end)}
                    </td>
                    <td>{money(invoice.total)}</td>
                    <td>{money(invoice.outstanding)}</td>
                    <td>{day(invoice.due_on)}</td>
                    <td>
                      {STATUS[invoice.status]}
                      {invoice.overdue ? ' (quá hạn)' : ''}
                    </td>
                    <td className="flex gap-2">
                      <Button variant="secondary" onClick={() => void download(invoice)}>
                        Tải hóa đơn
                      </Button>
                      {invoice.status === 'issued' && data.payment.available ? (
                        <Button variant="primary" onClick={() => pay.mutate(invoice)} disabled={pay.isPending}>
                          Thanh toán {invoice.code}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {paying ? (
              <PaymentPanel invoice={paying.invoice} request={paying.request} simulated={data.payment.simulated} />
            ) : null}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
