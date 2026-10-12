import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';

// Lớp đăng bài lên Fanpage (P14-08, G3-03; YCTD-90). Khóa truy cập trang chỉ đọc từ biến môi trường
// FACEBOOK_PAGE_ACCESS_TOKEN, không lưu trong cơ sở dữ liệu và không trả qua API. Kết nối thật dùng khi có tài khoản quản trị
// trang và quyền ứng dụng (việc T4); khi phát triển và kiểm thử đặt FACEBOOK_PUBLISHER=development
export interface FacebookPhoto {
  fileName: string;
  contentType: string;
  data: Buffer;
}

export interface FacebookPostInput {
  pageId: string;
  message: string;
  photos: FacebookPhoto[];
}

export abstract class FacebookPublisher {
  abstract readonly provider: string;
  // Đã có khóa hoặc là bộ giả lập; chưa có thì không cho đăng
  abstract readonly available: boolean;
  abstract publish(input: FacebookPostInput): Promise<{ postId: string }>;
}

export class UnavailableFacebookPublisher extends FacebookPublisher {
  readonly provider = 'none';
  readonly available = false;

  async publish(): Promise<{ postId: string }> {
    throw new Error('Chưa cấu hình khóa truy cập Fanpage');
  }
}

// Bộ giả lập: ghi bài vào bộ nhớ và nhật ký máy chủ, trả mã bài giả; đặt failuresLeft để giả lập Facebook trả lỗi
export class DevelopmentFacebookPublisher extends FacebookPublisher {
  readonly provider = 'development';
  readonly available = true;
  readonly posts: Array<{ postId: string; pageId: string; message: string; photoNames: string[] }> = [];
  failuresLeft = 0;
  private readonly logger = new Logger('FacebookPublisher');

  async publish(input: FacebookPostInput): Promise<{ postId: string }> {
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw new Error('Facebook trả lỗi (giả lập)');
    }
    const postId = `${input.pageId}_dev_${randomUUID().slice(0, 8)}`;
    this.posts.push({
      postId,
      pageId: input.pageId,
      message: input.message,
      photoNames: input.photos.map((photo) => photo.fileName),
    });
    this.logger.log(`Giả lập đăng Fanpage ${input.pageId}: ${postId}, ${input.photos.length} hình`);
    return { postId };
  }
}

// Kết nối Graph API: tải từng hình ở chế độ chưa công bố rồi đăng một bài kèm các hình. Chưa kiểm thử với trang thật vì chưa
// có tài khoản (việc T4); chỉ bật khi có FACEBOOK_PAGE_ACCESS_TOKEN
export class GraphApiFacebookPublisher extends FacebookPublisher {
  readonly provider = 'graph';
  readonly available = true;
  private readonly baseUrl = 'https://graph.facebook.com/v19.0';

  constructor(private readonly pageAccessToken: string) {
    super();
  }

  async publish(input: FacebookPostInput): Promise<{ postId: string }> {
    const mediaIds: string[] = [];
    for (const photo of input.photos) {
      const form = new FormData();
      form.append('published', 'false');
      form.append('access_token', this.pageAccessToken);
      form.append('source', new Blob([new Uint8Array(photo.data)], { type: photo.contentType }), photo.fileName);
      const uploaded = await this.call(`${this.baseUrl}/${encodeURIComponent(input.pageId)}/photos`, form);
      mediaIds.push(String(uploaded.id));
    }
    const form = new FormData();
    form.append('message', input.message);
    form.append('access_token', this.pageAccessToken);
    mediaIds.forEach((id, index) => form.append(`attached_media[${index}]`, JSON.stringify({ media_fbid: id })));
    const created = await this.call(`${this.baseUrl}/${encodeURIComponent(input.pageId)}/feed`, form);
    return { postId: String(created.id) };
  }

  private async call(url: string, body: FormData): Promise<Record<string, unknown>> {
    const response = await fetch(url, { method: 'POST', body });
    const result = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
      error?: { message?: string };
    };
    if (!response.ok || result.error) {
      throw new Error(`Facebook trả lỗi: ${result.error?.message ?? response.status}`);
    }
    return result;
  }
}
