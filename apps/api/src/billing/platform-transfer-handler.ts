// Bộ nhận thêm cho thông báo tiền vào của cổng thanh toán của nền tảng (YCTD-383 lát L1b). Điểm nhận ở `billing.ts` hỏi bộ này trước:
// khoản tiền thuộc bộ (trả về true) thì không đối chiếu với hóa đơn dịch vụ nữa. Tệp riêng để `billing.ts` không phải nhập mã của gia sư AI
export const PLATFORM_TRANSFER_HANDLER = Symbol('PLATFORM_TRANSFER_HANDLER');

export interface PlatformIncomingTransfer {
  provider: string;
  providerTransactionRef: string;
  amount: number;
  transferContent: string;
  receivedAt: Date;
}

export interface PlatformTransferHandler {
  receiveTransfer(transfer: PlatformIncomingTransfer, now: Date): Promise<boolean>;
}
