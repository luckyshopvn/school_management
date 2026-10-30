import { createHash } from 'node:crypto';

// Bộ nối nhà cung cấp AI (DT-23 phần 23d, YCTD-214; tài liệu 47 mục 15.4). Mã nghiệp vụ chỉ biết giao diện `AiProvider` và bảng
// `AI_PROVIDERS` tra theo mã; không có `if` theo nhà cung cấp ở chỗ khác. Thêm nhà cung cấp là thêm một dòng vào bảng, địa chỉ và mã mô
// hình là cấu hình (của nền tảng và của trường), không ghi cứng. `mock` chỉ để kiểm thử: cho kết quả cố định, không gọi ra ngoài, ghi
// lại lời nhắc nhận được để kiểm thử khẳng định không có dữ liệu cá nhân; chỉ dựng khi cấu hình máy chủ cho phép (`AI_MOCK=true`)

export type AiPromptKind = 'questions' | 'lesson_plan' | 'check' | 'feedback' | 'tutor' | 'tutor_rewrite';

// Một lượt cũ của hội thoại (gia sư AI học sinh, YCTD-383 lát L2): gửi trước câu hỏi mới theo thứ tự, bắt đầu bằng `user`
export interface AiConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

// Ảnh gửi kèm câu hỏi mới (gia sư AI học sinh, YCTD-383 lát L4): chỉ ảnh JPEG, PNG, WebP đã kiểm ở máy chủ
export interface AiPromptImage {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  data: Buffer;
}

export interface AiPrompt {
  kind: AiPromptKind;
  system: string;
  user: string;
  maxTokens: number;
  history?: AiConversationTurn[];
  images?: AiPromptImage[];
}

// Nội dung của câu hỏi mới: có ảnh thì ảnh đứng trước chữ, không thì chỉ chữ
function userContentOf(prompt: AiPrompt) {
  if (!prompt.images || prompt.images.length === 0) {
    return prompt.user;
  }
  return [
    ...prompt.images.map((image) => ({
      type: 'image',
      source: { type: 'base64', media_type: image.mediaType, data: image.data.toString('base64') },
    })),
    { type: 'text', text: prompt.user },
  ];
}

export interface AiCompletion {
  text: string;
  // Số token lấy từ phản hồi của nhà cung cấp, không ước lượng
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface AiProviderSettings {
  apiKey: string;
  model: string;
  endpoint: string | null;
}

export interface AiProvider {
  readonly code: string;
  complete(prompt: AiPrompt, settings: AiProviderSettings): Promise<AiCompletion>;
  // Kiểm tra kết nối bằng một yêu cầu nhỏ; không trả lại khóa
  check(settings: AiProviderSettings): Promise<{ ok: boolean; detail: string }>;
}

export class AiProviderError extends Error {}

const TIMEOUT_MILLISECONDS = 90_000;
const DEFAULT_ANTHROPIC_ENDPOINT = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';

export class AnthropicProvider implements AiProvider {
  readonly code = 'anthropic';

  constructor(private readonly fetchImplementation: typeof fetch = fetch) {}

  async complete(prompt: AiPrompt, settings: AiProviderSettings): Promise<AiCompletion> {
    const base = (settings.endpoint ?? DEFAULT_ANTHROPIC_ENDPOINT).replace(/\/+$/, '');
    let response: Response;
    try {
      response = await this.fetchImplementation(`${base}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': settings.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: settings.model,
          max_tokens: prompt.maxTokens,
          system: prompt.system,
          messages: [...(prompt.history ?? []), { role: 'user', content: userContentOf(prompt) }],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MILLISECONDS),
      });
    } catch (error) {
      throw new AiProviderError(
        error instanceof Error && error.name === 'TimeoutError'
          ? 'Nhà cung cấp AI không trả lời kịp'
          : 'Không kết nối được tới nhà cung cấp AI',
      );
    }
    const body = (await response.json().catch(() => null)) as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      model?: string;
      error?: { message?: string };
    } | null;
    if (!response.ok || !body) {
      // Thông báo lỗi của nhà cung cấp có thể nhắc tới khóa: chỉ giữ mã trạng thái
      throw new AiProviderError(`Nhà cung cấp AI trả lỗi (mã ${response.status})`);
    }
    const text = (body.content ?? [])
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('');
    const input = body.usage?.input_tokens;
    const output = body.usage?.output_tokens;
    if (!Number.isInteger(input) || !Number.isInteger(output)) {
      throw new AiProviderError('Nhà cung cấp AI không trả số token của yêu cầu');
    }
    return { text, inputTokens: input as number, outputTokens: output as number, model: body.model ?? settings.model };
  }

  async check(settings: AiProviderSettings): Promise<{ ok: boolean; detail: string }> {
    const result = await this.complete(
      { kind: 'check', system: 'Trả lời đúng một chữ: ok', user: 'ok', maxTokens: 8 },
      settings,
    );
    return { ok: true, detail: `Kết nối được, mô hình ${result.model}` };
  }
}

// Bộ giả lập: kết quả cố định theo loại yêu cầu; số token là chiều dài chia 4 làm tròn lên, mỗi ảnh cộng cố định 100 token (cố định,
// kiểm thử được)
const tokensOf = (text: string) => Math.ceil(text.length / 4);
export const MOCK_IMAGE_TOKENS = 100;

function mockQuestions(user: string): string {
  const count = Number(/^SO_CAU: (\d+)$/m.exec(user)?.[1] ?? 1);
  const type = /^DANG_CAU: (\w+)$/m.exec(user)?.[1] ?? 'multiple_choice';
  const level = /^MUC: (\w+)$/m.exec(user)?.[1] ?? 'recognition';
  const questions = Array.from({ length: Math.min(Math.max(count, 1), 20) }, (_, index) => {
    const number = index + 1;
    const base = { cognitive_level: level, question_type: type, score: 1 };
    switch (type) {
      case 'true_false':
        return {
          ...base,
          content: `Câu hỏi mẫu ${number}: xác định đúng sai các ý sau`,
          options: ['Ý thứ nhất của câu mẫu', 'Ý thứ hai của câu mẫu', 'Ý thứ ba của câu mẫu', 'Ý thứ tư của câu mẫu'],
          answer: ['Đ', 'S', 'Đ', 'S'],
          guidance: null,
        };
      case 'short_answer':
        return {
          ...base,
          content: `Câu hỏi mẫu ${number}: 2 + 3 bằng bao nhiêu?`,
          options: [],
          answer: ['5'],
          guidance: null,
        };
      case 'essay':
        return {
          ...base,
          content: `Câu hỏi mẫu ${number}: trình bày ý chính của bài học`,
          options: [],
          answer: [],
          guidance: 'Nêu đủ các ý chính của bài học, mỗi ý đúng được một phần điểm',
        };
      default:
        return {
          ...base,
          content: `Câu hỏi mẫu ${number}: chọn phương án đúng`,
          options: [
            'Phương án A của câu mẫu',
            'Phương án B của câu mẫu',
            'Phương án C của câu mẫu',
            'Phương án D của câu mẫu',
          ],
          answer: ['B'],
          guidance: null,
        };
    }
  });
  return JSON.stringify({ questions });
}

function mockLessonPlan(): string {
  return JSON.stringify({
    title: 'Kế hoạch bài dạy mẫu',
    objectives: ['Nêu được nội dung chính của bài', 'Vận dụng được kiến thức vào bài tập đơn giản'],
    preparation: ['Giáo viên: bảng, phiếu học tập mẫu', 'Học sinh: sách giáo khoa, vở ghi'],
    activities: [
      { name: 'Khởi động', minutes: 5, description: 'Đặt câu hỏi gợi mở về nội dung bài học' },
      { name: 'Hình thành kiến thức', minutes: 20, description: 'Giáo viên hướng dẫn, học sinh thảo luận nhóm' },
      { name: 'Luyện tập', minutes: 15, description: 'Học sinh làm bài tập theo phiếu học tập mẫu' },
    ],
    assessment: 'Quan sát, hỏi đáp nhanh và chấm phiếu học tập mẫu',
    homework: 'Làm bài tập mẫu ở cuối bài',
  });
}

// Gia sư AI học sinh (YCTD-383 lát L2): chế độ gợi ý trả bước nhắc khái niệm, chế độ lời giải trả lời giải đầy đủ; viết lại trả câu
// không có đáp án. Đáp án cuối `x = 12` của bài mẫu chỉ có ở `final_answer` và ở lời giải đầy đủ
// Có ảnh (lát L4) thì chép đề bài mẫu vào `image_text`, không có thông tin cá nhân
function mockTutor(prompt: AiPrompt): string {
  if (prompt.kind === 'tutor_rewrite') {
    return JSON.stringify({ reply: 'Em thử làm tiếp bước chuyển vế rồi gửi cho gia sư xem nhé.' });
  }
  const solution = /^CHE_DO: loi_giai$/m.test(prompt.system);
  const image =
    prompt.images && prompt.images.length > 0
      ? { image_text: 'Giải phương trình 3x - 7 = 2x + 5', personal_data: false }
      : {};
  return JSON.stringify(
    solution
      ? {
          step: 'solution',
          topic: 'Phương trình bậc nhất một ẩn',
          reply: 'Lời giải: chuyển vế được $3x - 2x = 5 + 7$, nên $x = 12$.',
          final_answer: 'x = 12',
          ...image,
        }
      : {
          step: 'concept',
          topic: 'Phương trình bậc nhất một ẩn',
          reply:
            'Mình cùng làm nhé. Muốn tìm $x$, em đưa các hạng tử chứa $x$ về một vế. Em thử chuyển $2x$ sang vế trái xem được gì?',
          final_answer: 'x = 12',
          ...image,
        },
  );
}

export class MockAiProvider implements AiProvider {
  readonly code = 'mock';
  // Lời nhắc đã nhận, theo thứ tự (kiểm thử đọc để khẳng định không có dữ liệu cá nhân)
  readonly received: AiPrompt[] = [];
  readonly keysSeen: string[] = [];
  failNext: string | null = null;
  // Kết quả định sẵn cho các lần gọi tiếp theo, lấy lần lượt (kiểm thử đặt để thử câu trả lời lộ đáp án, nội dung không an toàn)
  readonly scripted: string[] = [];

  async complete(prompt: AiPrompt, settings: AiProviderSettings): Promise<AiCompletion> {
    this.received.push(prompt);
    this.keysSeen.push(settings.apiKey);
    if (this.failNext) {
      const message = this.failNext;
      this.failNext = null;
      throw new AiProviderError(message);
    }
    const scripted = this.scripted.shift();
    const text =
      scripted !== undefined
        ? scripted
        : prompt.kind === 'tutor' || prompt.kind === 'tutor_rewrite'
          ? mockTutor(prompt)
          : this.fixedText(prompt);
    const history = (prompt.history ?? []).reduce((sum, turn) => sum + tokensOf(turn.content), 0);
    return {
      text,
      inputTokens:
        tokensOf(prompt.system) + history + tokensOf(prompt.user) + (prompt.images?.length ?? 0) * MOCK_IMAGE_TOKENS,
      outputTokens: tokensOf(text),
      model: settings.model,
    };
  }

  private fixedText(prompt: AiPrompt): string {
    return prompt.kind === 'questions'
      ? mockQuestions(prompt.user)
      : prompt.kind === 'lesson_plan'
        ? mockLessonPlan()
        : prompt.kind === 'feedback'
          ? JSON.stringify({
              comment: 'Em đã hoàn thành các yêu cầu chính của bài. Em cần trình bày rõ hơn các bước làm.',
            })
          : 'ok';
  }

  async check(settings: AiProviderSettings): Promise<{ ok: boolean; detail: string }> {
    this.keysSeen.push(settings.apiKey);
    // Gợi ý bốn ký tự cuối của khóa đã nhận: kiểm thử cách ly khóa giữa các trường dựa vào đây
    const fingerprint = createHash('sha256').update(settings.apiKey).digest('hex').slice(0, 8);
    return { ok: true, detail: `Bộ giả lập nhận khóa ••••${settings.apiKey.slice(-4)} (${fingerprint})` };
  }
}

export interface AiProviderOptions {
  mock?: boolean;
  fetchImplementation?: typeof fetch;
}

export class AiProviderRegistry {
  private readonly providers = new Map<string, AiProvider>();

  constructor(options: AiProviderOptions = {}, extra: AiProvider[] = []) {
    const list: AiProvider[] = [new AnthropicProvider(options.fetchImplementation), ...extra];
    if (options.mock) {
      list.push(new MockAiProvider());
    }
    for (const provider of list) {
      this.providers.set(provider.code, provider);
    }
  }

  codes(): string[] {
    return [...this.providers.keys()];
  }

  get(code: string): AiProvider | undefined {
    return this.providers.get(code);
  }
}
