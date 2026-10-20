// Chỗ nối của trục liên thông văn bản (DT-18 phần 18a, YCTD-138). Bản chạy nội bộ (tài liệu 32 mục 9.2): phần mềm không kết
// nối trục, văn thư nhập tay văn bản nhận được hoặc tải tệp nhận được rồi đánh dấu tiếp nhận; trạng thái ghi ngày, người
// đánh dấu. Khi có kết nối thật, cắm lớp con gửi báo nhận lên trục ở acknowledge và đăng ký lớp đó ở mô đun ứng dụng
export interface ExchangeAcknowledgement {
  documentId: string;
  reference: string | null;
  acknowledgedBy: string;
}

// Gửi văn bản đi tới đơn vị bên ngoài qua trục (DT-18 phần 18b, YCTD-140). Bản nội bộ không truyền gì: văn thư gửi bằng
// cách khác (thư điện tử, bưu điện, trục của cơ quan khác) rồi đánh dấu đã gửi; trả về mã tham chiếu văn thư ghi
export interface ExchangeDispatch {
  documentId: string;
  recipientId: string;
  electronicCode: string | null;
  symbol: string;
  reference: string | null;
  sentBy: string;
}

export abstract class DocumentExchange {
  // Có truyền thật lên trục không; bản nội bộ trả false để giao diện ghi đúng việc đã làm
  abstract readonly connected: boolean;
  abstract readonly description: string;
  abstract acknowledge(input: ExchangeAcknowledgement): Promise<void>;
  // Gửi văn bản đi tới một đơn vị nhận; trả mã tham chiếu của trục (bản nội bộ trả lại mã văn thư nhập)
  abstract send(input: ExchangeDispatch): Promise<string | null>;
}

export class LocalDocumentExchange extends DocumentExchange {
  readonly connected = false;
  readonly description =
    'Chưa kết nối trục liên thông văn bản: văn thư nhập văn bản nhận được và đánh dấu tiếp nhận bằng tay, phần mềm không gửi báo nhận';

  async acknowledge(): Promise<void> {
    // Bản nội bộ không gửi gì; trạng thái tiếp nhận do dịch vụ văn bản đến ghi
  }

  async send(input: ExchangeDispatch): Promise<string | null> {
    // Bản nội bộ không truyền gì; trạng thái đã gửi do dịch vụ văn bản đi ghi theo đánh dấu của văn thư
    return input.reference;
  }
}
