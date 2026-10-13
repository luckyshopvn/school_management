import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';

// Lớp đăng bài lên Fanpage (P14-08, G3-03; YCTD-90, YCTD-92). Khóa truy cập trang (loại dài hạn) chỉ đọc từ biến môi trường
// FACEBOOK_PAGE_ACCESS_TOKEN, không lưu trong cơ sở dữ liệu và không trả qua API. Phiên bản Graph API đặt ở
// FACEBOOK_GRAPH_VERSION, mặc định v21.0; khi phát triển và kiểm thử đặt FACEBOOK_PUBLISHER=development
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

export const DEFAULT_FACEBOOK_GRAPH_VERSION = 'v21.0';

export type FetchFunction = (input: string, init?: RequestInit) => Promise<Response>;

export abstract class FacebookPublisher {
  abstract readonly provider: string;
  // Đã có khóa hoặc là bộ giả lập; chưa có thì không cho đăng
  abstract readonly available: boolean;
  abstract publish(input: FacebookPostInput): Promise<{ postId: string }>;
  // Kiểm tra kết nối: đọc mã và tên trang bằng khóa đang dùng; lỗi thì ném lỗi tiếng Việt
  abstract verify(pageId: string): Promise<{ id: string; name: string }>;
}

export class UnavailableFacebookPublisher extends FacebookPublisher {
  readonly provider = 'none';
  readonly available = false;

  async publish(): Promise<{ postId: string }> {
    throw new Error('Chưa cấu hình khóa truy cập Fanpage');
  }

  async verify(): Promise<{ id: string; name: string }> {
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

  async verify(pageId: string): Promise<{ id: string; name: string }> {
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw new Error('Facebook trả lỗi (giả lập)');
    }
    return { id: pageId, name: 'Fanpage giả lập' };
  }
}

// Mã lỗi thường gặp của Graph API đổi sang lời báo tiếng Việt cho người quản trị
const FACEBOOK_ERRORS: Record<number, string> = {
  190: 'Khóa truy cập Fanpage không hợp lệ hoặc đã hết hạn; cần cấp lại khóa trang dài hạn',
  200: 'Ứng dụng chưa được cấp quyền đăng bài lên trang (pages_manage_posts)',
  10: 'Ứng dụng chưa được cấp quyền với trang này',
  100: 'Mã trang hoặc tham số gửi Facebook không hợp lệ',
  4: 'Facebook đang giới hạn số lần gọi, vui lòng thử lại sau',
  17: 'Facebook đang giới hạn số lần gọi, vui lòng thử lại sau',
  32: 'Facebook đang giới hạn số lần gọi của trang, vui lòng thử lại sau',
  368: 'Facebook tạm chặn trang đăng bài do vi phạm chính sách',
};

export function facebookErrorMessage(code: number | undefined, message: string | undefined, status: number): string {
  const known = code !== undefined ? FACEBOOK_ERRORS[code] : undefined;
  return `Facebook trả lỗi: ${known ?? message ?? status}${code !== undefined ? ` (mã ${code})` : ''}`;
}

// Kết nối Graph API: bài có hình thì tải từng hình ở chế độ chưa công bố rồi đăng một bài kèm các hình; bài không hình chỉ
// đăng nội dung lên /feed. Chỉ bật khi có FACEBOOK_PAGE_ACCESS_TOKEN
export class GraphApiFacebookPublisher extends FacebookPublisher {
  readonly provider = 'graph';
  readonly available = true;
  private readonly baseUrl: string;

  constructor(
    private readonly pageAccessToken: string,
    graphVersion: string = DEFAULT_FACEBOOK_GRAPH_VERSION,
    private readonly fetcher: FetchFunction = (input, init) => fetch(input, init),
  ) {
    super();
    this.baseUrl = `https://graph.facebook.com/${graphVersion}`;
  }

  async publish(input: FacebookPostInput): Promise<{ postId: string }> {
    const pagePath = `${this.baseUrl}/${encodeURIComponent(input.pageId)}`;
    const mediaIds: string[] = [];
    for (const photo of input.photos) {
      const form = new FormData();
      form.append('published', 'false');
      form.append('access_token', this.pageAccessToken);
      form.append('source', new Blob([new Uint8Array(photo.data)], { type: photo.contentType }), photo.fileName);
      const uploaded = await this.call(`${pagePath}/photos`, { method: 'POST', body: form });
      mediaIds.push(String(uploaded.id));
    }
    const form = new FormData();
    form.append('message', input.message);
    form.append('access_token', this.pageAccessToken);
    mediaIds.forEach((id, index) => form.append(`attached_media[${index}]`, JSON.stringify({ media_fbid: id })));
    const created = await this.call(`${pagePath}/feed`, { method: 'POST', body: form });
    return { postId: String(created.id) };
  }

  async verify(pageId: string): Promise<{ id: string; name: string }> {
    // Khóa gửi ở tiêu đề để không lộ trong nhật ký đường dẫn
    const page = await this.call(`${this.baseUrl}/${encodeURIComponent(pageId)}?fields=id,name`, {
      method: 'GET',
      headers: { authorization: `Bearer ${this.pageAccessToken}` },
    });
    return { id: String(page.id), name: String(page.name ?? '') };
  }

  private async call(url: string, init: RequestInit): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await this.fetcher(url, init);
    } catch {
      throw new Error('Không kết nối được tới Facebook, vui lòng thử lại');
    }
    const result = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
      error?: { message?: string; code?: number };
    };
    if (!response.ok || result.error) {
      throw new Error(facebookErrorMessage(result.error?.code, result.error?.message, response.status));
    }
    return result;
  }
}
