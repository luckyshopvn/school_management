import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Alert } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Mã QR thanh toán số còn phải nộp của một hóa đơn qua tài khoản ảo dùng một lần; trả xong thì mã hết hiệu lực
// (P06-11; QT-04 bước 11; YCTD-57)
interface PaymentQrData {
  amount: number;
  transfer_content: string;
  virtual_account_number: string;
  qr_content: string;
  bank_name: string | null;
}

const money = (amount: number) => `${new Intl.NumberFormat('vi-VN').format(amount)} đ`;

export function PaymentQr({ invoiceId, invoiceCode }: { invoiceId: string; invoiceCode: string }) {
  const [data, setData] = useState<PaymentQrData>();
  const [image, setImage] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    requestJson<PaymentQrData>(`/api/v1/invoices/${invoiceId}/payment-qr`)
      .then(async (loaded) => {
        const url = await QRCode.toDataURL(loaded.qr_content, { margin: 1, width: 240 });
        if (!cancelled) {
          setData(loaded);
          setImage(url);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrorMessage(
            error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  if (errorMessage) {
    return <Alert tone="danger">{errorMessage}</Alert>;
  }
  if (!data || !image) {
    return <p className="text-content text-text-secondary">Đang tạo mã QR...</p>;
  }
  return (
    <div className="flex flex-col items-center gap-2" role="group" aria-label={`Mã QR thanh toán ${invoiceCode}`}>
      <img src={image} alt={`Mã QR thanh toán ${invoiceCode}`} className="h-60 w-60" />
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-content">
        <dt className="text-text-secondary">Số tiền</dt>
        <dd className="font-semibold">{money(data.amount)}</dd>
        <dt className="text-text-secondary">Tài khoản</dt>
        <dd>{data.virtual_account_number}</dd>
        {data.bank_name ? (
          <>
            <dt className="text-text-secondary">Ngân hàng</dt>
            <dd>{data.bank_name}</dd>
          </>
        ) : null}
        <dt className="text-text-secondary">Nội dung</dt>
        <dd>{data.transfer_content}</dd>
      </dl>
      <p className="text-label text-text-secondary">
        Mã chỉ dùng một lần cho đúng số tiền trên; chuyển xong nhà trường tự ghi nhận và gửi biên nhận.
      </p>
    </div>
  );
}
