import { createHash } from 'node:crypto';

// Bộ nối nhà cung cấp AI (DT-23 phần 23d, YCTD-214; tài liệu 47 mục 15.4). Mã nghiệp vụ chỉ biết giao diện `AiProvider` và bảng
// `AI_PROVIDERS` tra theo mã; không có `if` theo nhà cung cấp ở chỗ khác. Thêm nhà cung cấp là thêm một dòng vào bảng, địa chỉ và mã mô
// hình là cấu hình (của nền tảng và của trường), không ghi cứng. `mock` chỉ để kiểm thử: cho kết quả cố định, không gọi ra ngoài, ghi
// lại lời nhắc nhận được để kiểm thử khẳng định không có dữ liệu cá nhân; chỉ dựng khi cấu hình máy chủ cho phép (`AI_MOCK=true`)

export type AiPromptKind = 'questions' | 'lesson_plan' | 'check' | 'feedback' | 'answer';

export interface AiPrompt {
  kind: AiPromptKind;
  system: string;
  user: string;
  maxTokens: number;
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
          messages: [{ role: 'user', content: prompt.user }],
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

// Bộ giả lập: kết quả cố định theo loại yêu cầu; số token là chiều dài chia 4 làm tròn lên (cố định, kiểm thử được)
const tokensOf = (text: string) => Math.ceil(text.length / 4);

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

export class MockAiProvider implements AiProvider {
  readonly code = 'mock';
  // Lời nhắc đã nhận, theo thứ tự (kiểm thử đọc để khẳng định không có dữ liệu cá nhân)
  readonly received: AiPrompt[] = [];
  readonly keysSeen: string[] = [];
  failNext: string | null = null;

  async complete(prompt: AiPrompt, settings: AiProviderSettings): Promise<AiCompletion> {
    this.received.push(prompt);
    this.keysSeen.push(settings.apiKey);
    if (this.failNext) {
      const message = this.failNext;
      this.failNext = null;
      throw new AiProviderError(message);
    }
    const text =
      prompt.kind === 'questions'
        ? mockQuestions(prompt.user)
        : prompt.kind === 'lesson_plan'
          ? mockLessonPlan()
          : prompt.kind === 'feedback'
            ? JSON.stringify({
                comment: 'Em đã hoàn thành các yêu cầu chính của bài. Em cần trình bày rõ hơn các bước làm.',
              })
            : prompt.kind === 'answer'
              ? JSON.stringify({
                  answer:
                    'Em hãy xem lại định nghĩa trong bài: số nguyên tố chỉ có hai ước là 1 và chính nó. Em thử kiểm tra từng số.',
                })
              : 'ok';
    return {
      text,
      inputTokens: tokensOf(prompt.system) + tokensOf(prompt.user),
      outputTokens: tokensOf(text),
      model: settings.model,
    };
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
