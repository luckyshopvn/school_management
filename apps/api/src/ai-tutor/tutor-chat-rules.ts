import { normalizeName } from '../ai-assistant/ai-prompt.js';
import type { AiPrompt } from '../ai-assistant/ai-provider.js';
import type { AiTutorSchoolLevel } from './ai-tutor-rules.js';

// Quy tắc thuần của trò chuyện với gia sư AI (YCTD-383 lát L2; quyết định của Eric ngày 2026-10-30, Q3, Q4, Q6): lời nhắc hệ thống cố định
// theo cấp, khối, môn (Tiểu học có lời nhắc riêng), gợi ý theo thang, mở lời giải đầy đủ sau hai lượt tự làm, kiểm tra câu trả lời lộ đáp
// án quá sớm, kiểm duyệt câu hỏi và câu trả lời, mẫu trả lời cố định khi có dấu hiệu tự hại hoặc bị bắt nạt. Không đọc cơ sở dữ liệu

export const TUTOR_RULES = {
  turns: 'BR-466',
  hints: 'BR-467',
  safety: 'BR-468',
  history: 'BR-469',
  // Lát L4: ảnh bài tập chỉ ở gói Nâng cao, loại, cỡ, số ảnh; ảnh có thông tin cá nhân; xóa ảnh sau 30 ngày
  images: 'BR-500',
  imageSafety: 'BR-501',
} as const;

export const QUESTION_MAX_LENGTH = 2000;
export const REPORT_NOTE_MAX_LENGTH = 500;
// Số lượt tự làm tối thiểu trước khi mở "Xem lời giải đầy đủ" (Q4)
export const SOLUTION_MIN_ATTEMPTS = 2;
// Số tin nhắn cũ gửi kèm câu hỏi mới để gia sư hiểu ngữ cảnh
export const HISTORY_MESSAGES = 12;
export const TUTOR_MAX_TOKENS = 1024;
// Lịch sử trò chuyện giữ 12 tháng (Q6)
export const HISTORY_RETENTION_MONTHS = 12;
export const TOPIC_MAX_LENGTH = 80;

export type TutorMode = 'hint' | 'solution';
export type TutorStep = 'concept' | 'method' | 'example' | 'check' | 'solution' | 'refusal' | 'safety';
export type StudentModeration = 'self_harm' | 'bullying' | 'unsafe' | 'off_topic' | 'personal_data';

export const LEVEL_NAMES: Record<AiTutorSchoolLevel, string> = {
  TH: 'Tiểu học',
  THCS: 'Trung học cơ sở',
  THPT: 'Trung học phổ thông',
};

export const STEP_LABELS: Record<TutorStep, string> = {
  concept: 'Nhắc khái niệm',
  method: 'Gợi ý cách làm',
  example: 'Làm mẫu bài tương tự',
  check: 'Nhận xét bài em làm',
  solution: 'Lời giải đầy đủ',
  refusal: 'Ngoài học tập',
  safety: 'Lời nhắn an toàn',
};

// ---------- Lời nhắc hệ thống

// Khối của lớp (`K8`, `8`) thành chữ "lớp 8"; mã lạ thì giữ nguyên
export function gradeLabel(gradeLevelCode: string): string {
  const number = /(\d{1,2})$/.exec(gradeLevelCode)?.[1];
  return number ? `lớp ${Number(number)}` : gradeLevelCode;
}

const PRIMARY_STYLE = [
  'Em là học sinh Tiểu học. Viết câu ngắn, mỗi câu không quá 15 chữ.',
  'Dùng ví dụ gần gũi với em: chia kẹo, đếm quả, đo bước chân, tiền mua bánh.',
  'Không dùng thuật ngữ khó; gặp từ khó thì giải thích bằng lời thường.',
  'Khen em khi em cố gắng, giọng nhẹ nhàng.',
].join('\n');

const SECONDARY_STYLE = [
  'Dùng đúng thuật ngữ của chương trình giáo dục phổ thông 2018 ở khối của em, giải thích ngắn gọn.',
  'Giọng thân thiện, khuyến khích em tự suy nghĩ.',
].join('\n');

export interface TutorPromptContext {
  schoolLevel: AiTutorSchoolLevel;
  gradeLevelCode: string;
  subjectName: string;
  mode: TutorMode;
  // Lát L4: câu hỏi có ảnh bài tập
  hasImages?: boolean;
}

// Lời nhắc hệ thống dựng từ mẫu cố định; chỉ có cấp, khối, môn, không có thông tin của em
export function buildTutorSystemPrompt(context: TutorPromptContext): string {
  const common = [
    `Bạn là gia sư AI của một học sinh ${LEVEL_NAMES[context.schoolLevel]}, ${gradeLabel(context.gradeLevelCode)}, môn ${context.subjectName}, trong ứng dụng học tập của trường ở Việt Nam. Luôn trả lời bằng tiếng Việt.`,
    'Quy tắc bắt buộc:',
    '1. Chỉ hỗ trợ học tập các môn ở trường. Câu hỏi ngoài học tập, nội dung người lớn, bạo lực, chất cấm, cờ bạc, vũ khí, xâm nhập máy tính, hoặc nhờ làm bài kiểm tra hộ: đặt "step" là "refusal" và nhẹ nhàng mời em quay lại bài học.',
    '2. Không hỏi, không nhắc tên, địa chỉ, số điện thoại, trường lớp của em hay của người khác.',
    '3. Công thức toán viết bằng LaTeX trong $...$ hoặc $$...$$.',
    context.schoolLevel === 'TH' ? PRIMARY_STYLE : SECONDARY_STYLE,
  ];
  const mode =
    context.mode === 'hint'
      ? [
          '4. Gợi ý từng bước, KHÔNG nêu đáp án cuối cùng của bài em hỏi. Đi theo thang: (a) nhắc khái niệm liên quan, step "concept"; (b) gợi ý cách làm bước tiếp theo, step "method"; (c) làm mẫu một bài tương tự với số liệu khác, step "example". Không giải bài gốc.',
          '5. Mỗi lượt chỉ một bước, kết thúc bằng một câu hỏi để em tự làm tiếp. Em gửi bài làm thì nhận xét đúng sai từng bước, chỉ ra chỗ sai, không làm thay, step "check".',
          'CHE_DO: goi_y',
        ]
      : [
          '4. Em đã tự làm ít nhất hai lượt và bấm "Xem lời giải đầy đủ". Trình bày lời giải đầy đủ từng bước của bài em hỏi, giải thích vì sao làm như vậy, step "solution".',
          'CHE_DO: loi_giai',
        ];
  const image = context.hasImages
    ? [
        'ANH: Em gửi kèm ảnh bài tập. Chép lại phần đề bài trong ảnh vào "image_text" (chỉ đề bài, tối đa 1000 ký tự). Nếu ảnh có tên người, khuôn mặt, số điện thoại, địa chỉ, số định danh, chữ ký, tên trường lớp hoặc thông tin cá nhân khác thì đặt "personal_data" là true, không chép và không nhắc lại các thông tin đó. Ảnh không phải bài tập thì đặt "step" là "refusal".',
      ]
    : [];
  const imageFields = context.hasImages ? ', "image_text": "đề bài chép từ ảnh", "personal_data": true | false' : '';
  const format = `Trả về đúng một đối tượng JSON, không thêm chữ nào khác: {"step": "concept" | "method" | "example" | "check" | "solution" | "refusal", "topic": "chủ đề ngắn của bài, tối đa 80 ký tự, không có thông tin cá nhân", "reply": "lời của gia sư gửi em", "final_answer": "đáp án cuối cùng của bài em hỏi, chỉ để máy chủ kiểm tra, không hiển thị cho em; để trống khi không có"${imageFields}}`;
  return [...common, ...mode, ...image, format].join('\n');
}

export function buildRewritePrompt(reply: string, finalAnswer: string): AiPrompt {
  return {
    kind: 'tutor_rewrite',
    system: [
      'Bạn biên tập lời của gia sư AI gửi học sinh. Viết lại đoạn sau sao cho KHÔNG nêu đáp án cuối cùng, giữ phần gợi ý và câu hỏi để em tự làm tiếp. Luôn viết tiếng Việt, công thức toán bằng LaTeX trong $...$.',
      `Đáp án cuối cùng không được xuất hiện: ${finalAnswer || '(không rõ)'}`,
      'Trả về đúng một đối tượng JSON: {"reply": "lời đã viết lại"}',
    ].join('\n'),
    user: reply,
    maxTokens: TUTOR_MAX_TOKENS,
  };
}

// ---------- Đọc câu trả lời của nhà cung cấp

export interface TutorReply {
  step: TutorStep;
  topic: string | null;
  reply: string;
  finalAnswer: string;
  // Lát L4: đề chép từ ảnh, nhà cung cấp tự báo ảnh có thông tin cá nhân
  imageText: string;
  personalData: boolean;
}

const MODEL_STEPS: readonly TutorStep[] = ['concept', 'method', 'example', 'check', 'solution', 'refusal'];

function jsonObjectOf(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(text.slice(start, end + 1));
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const textOf = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

// Kết quả không đúng dạng JSON thì coi cả đoạn là lời của gia sư, bậc gợi ý cách làm
export function parseTutorReply(text: string, mode: TutorMode): TutorReply | null {
  const object = jsonObjectOf(text);
  const reply = object ? textOf(object.reply) : text.trim();
  if (!reply) {
    return null;
  }
  const step = object ? MODEL_STEPS.find((item) => item === object.step) : undefined;
  const topic = object ? textOf(object.topic).replace(/\s+/g, ' ').slice(0, TOPIC_MAX_LENGTH) : '';
  return {
    step: step ?? (mode === 'solution' ? 'solution' : 'method'),
    topic: topic || null,
    reply: reply.slice(0, 7000),
    finalAnswer: object ? textOf(object.final_answer) : '',
    imageText: object ? textOf(object.image_text).slice(0, 2000) : '',
    personalData: object?.personal_data === true,
  };
}

export function parseRewrite(text: string): string | null {
  const object = jsonObjectOf(text);
  const reply = object ? textOf(object.reply) : text.trim();
  return reply ? reply.slice(0, 7000) : null;
}

// ---------- Kiểm tra lộ đáp án

// Bỏ ký hiệu LaTeX, khoảng trắng, chữ hoa để so đáp án: `$x = 12$`, `x=12`, `X = 12` như nhau
function compact(text: string): string {
  return text
    .toLowerCase()
    .replace(/\\(?:left|right|displaystyle|text|mathrm)/g, '')
    .replace(/[−–]/g, '-')
    .replace(/[\s$\\{}]/g, '')
    .replace(/,(?=\d)/g, '.');
}

const ANSWER_PHRASES = [
  /đáp án (?:cuối cùng |đúng )?(?:của bài )?(?:là|:)/i,
  /kết quả (?:cuối cùng )?(?:của bài )?(?:là|:)/i,
  /nghiệm (?:của phương trình )?(?:là|:)/i,
  /vậy (?:đáp số|đáp án|kết quả)/i,
  /đáp số(?: là|:)/i,
];

// Câu trả lời ở chế độ gợi ý lộ đáp án cuối khi: có cụm "đáp án là", "đáp số:"…; hoặc chứa đúng đáp án cuối mà nhà cung cấp tự ghi ở
// `final_answer`, trừ khi đáp án đó đã có sẵn trong câu hỏi của em (không phân biệt được với số liệu của đề)
export function revealsFinalAnswer(reply: string, finalAnswer: string, question: string): boolean {
  if (ANSWER_PHRASES.some((pattern) => pattern.test(reply))) {
    return true;
  }
  const answer = compact(finalAnswer);
  if (!answer || compact(question).includes(answer)) {
    return false;
  }
  const body = compact(reply);
  if (/^-?\d+(?:\.\d+)?$/.test(answer)) {
    // Đáp án chỉ là một số: phải đứng riêng, không phải một phần của số khác
    return new RegExp(`(?<![\\d.])${answer.replace('.', '\\.')}(?![\\d.])`).test(body);
  }
  return body.includes(answer);
}

// ---------- Kiểm duyệt

// Chữ thường, giữ dấu, ký tự không phải chữ hoặc số thành khoảng trắng; bao bằng khoảng trắng để so trọn cụm từ
const accented = (text: string) =>
  ` ${text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;
const plain = (text: string) => ` ${normalizeName(text)} `;

interface PhraseList {
  // Cụm có dấu: so trên chữ giữ dấu
  accented: string[];
  // Cụm không dấu đủ dài để không nhầm nghĩa: so trên chữ đã bỏ dấu
  plain: string[];
}

const SELF_HARM: PhraseList = {
  accented: [
    'tự tử',
    'tự sát',
    'muốn chết',
    'tự làm hại bản thân',
    'tự làm đau bản thân',
    'tự hại',
    'rạch tay',
    'cắt tay mình',
    'không muốn sống',
    'chán sống',
  ],
  plain: [
    'muon tu tu',
    'muon chet',
    'khong muon song nua',
    'tu lam hai ban than',
    'tu lam dau ban than',
    'chan song qua',
  ],
};

const BULLYING: PhraseList = {
  accented: [
    'bị bắt nạt',
    'bắt nạt em',
    'bắt nạt con',
    'bị đánh hội đồng',
    'bị bạn đánh',
    'bị các bạn đánh',
    'bị đe dọa',
    'bị đe doạ',
    'bị tẩy chay',
    'bị cô lập',
    'bị chụp lén',
    'bị quấy rối',
  ],
  plain: ['bi bat nat', 'bi danh hoi dong', 'bi ban danh', 'bi de doa', 'bi tay chay', 'bi quay roi'],
};

const UNSAFE: PhraseList = {
  accented: [
    'khiêu dâm',
    'phim người lớn',
    'làm tình',
    'ma túy',
    'ma tuý',
    'cần sa',
    'thuốc lắc',
    'chế bom',
    'làm bom',
    'chế súng',
    'cá độ',
    'đánh bạc',
    'lô đề',
    'hack tài khoản',
    'bẻ khóa tài khoản',
  ],
  plain: ['sex', 'porn', 'khieu dam', 'phim nguoi lon', 'ma tuy', 'thuoc lac', 'che bom', 'danh bac', 'hack tai khoan'],
};

function matches(text: string, list: PhraseList): boolean {
  const withMarks = accented(text);
  const withoutMarks = plain(text);
  return (
    list.accented.some((phrase) => withMarks.includes(` ${phrase} `)) ||
    list.plain.some((phrase) => withoutMarks.includes(` ${phrase} `))
  );
}

// Kiểm duyệt câu hỏi của em ở máy chủ trước khi gửi đi. Dấu hiệu tự hại xét trước, rồi bị bắt nạt, rồi nội dung không phù hợp
export function moderateStudentText(text: string): Exclude<StudentModeration, 'off_topic'> | null {
  if (matches(text, SELF_HARM)) {
    return 'self_harm';
  }
  if (matches(text, BULLYING)) {
    return 'bullying';
  }
  return matches(text, UNSAFE) ? 'unsafe' : null;
}

// Kiểm duyệt câu trả lời của gia sư trước khi hiển thị
export function isUnsafeReply(text: string): boolean {
  return matches(text, UNSAFE) || matches(text, SELF_HARM);
}

// Mẫu trả lời cố định (Q7): không gọi nhà cung cấp, có số Tổng đài quốc gia bảo vệ trẻ em 111
export const SAFETY_REPLIES: Record<'self_harm' | 'bullying', string> = {
  self_harm:
    'Cảm ơn em đã chia sẻ. Điều em đang trải qua rất quan trọng và em không phải một mình. Em hãy nói ngay với bố mẹ, thầy cô chủ nhiệm hoặc một người lớn em tin tưởng. Em có thể gọi miễn phí Tổng đài quốc gia bảo vệ trẻ em **111** (24 giờ mỗi ngày). Nếu em đang gặp nguy hiểm, hãy gọi ngay **113** hoặc **115**.',
  bullying:
    'Cảm ơn em đã kể cho gia sư. Bị bắt nạt không phải lỗi của em. Em hãy kể ngay với bố mẹ, thầy cô chủ nhiệm hoặc một người lớn em tin tưởng để được giúp. Em có thể gọi miễn phí Tổng đài quốc gia bảo vệ trẻ em **111** (24 giờ mỗi ngày).',
};

// Lát L4: ảnh có thông tin cá nhân thì không lưu ảnh, không hiện câu trả lời của nhà cung cấp, nhắc em chụp lại chỉ phần đề bài
export const IMAGE_PERSONAL_DATA_REPLY =
  'Ảnh của em có thông tin cá nhân (tên, khuôn mặt, số điện thoại, địa chỉ hoặc số định danh). Gia sư không giữ ảnh này. Em hãy chụp lại **chỉ phần đề bài** rồi gửi lại nhé; lượt hỏi không bị trừ.';

export const REFUSAL_REPLY =
  'Gia sư AI chỉ giúp em học các môn ở trường. Em hãy hỏi gia sư về bài học hoặc bài tập nhé.';

// Câu thay thế khi đã viết lại mà vẫn lộ đáp án
export const NO_ANSWER_REPLY = 'Gia sư chưa nói đáp án lúc này. Em thử làm bước tiếp theo rồi gửi cho gia sư xem nhé.';

// ---------- Lượt tự làm, mở lời giải

export interface StudentMessageFacts {
  requestKind: 'ask' | 'solution';
  moderation: StudentModeration | null;
}

// Lượt tự làm: các câu em gửi sau câu hỏi đầu tiên (không tính câu bị chặn, câu xin lời giải)
export function attemptsOf(messages: readonly StudentMessageFacts[]): number {
  const asked = messages.filter((message) => message.requestKind === 'ask' && message.moderation === null).length;
  return Math.max(0, asked - 1);
}

export function isSolutionUnlocked(messages: readonly StudentMessageFacts[]): boolean {
  return attemptsOf(messages) >= SOLUTION_MIN_ATTEMPTS;
}

// ---------- Hạn giữ lịch sử

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

// Mốc xóa lịch sử: đầu ngày (giờ Việt Nam) của cùng ngày 12 tháng trước; xóa trọn ngày để lần tổng hợp token sau không ghi đè một ngày
// đã bị xóa một phần
export function retentionCutoff(now: Date): Date {
  const local = new Date(now.getTime() + VIETNAM_OFFSET_MS);
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - HISTORY_RETENTION_MONTHS, local.getUTCDate());
  return new Date(start - VIETNAM_OFFSET_MS);
}
