// Thi đua, khen thưởng cán bộ, giáo viên (DT-18 phần 22d, YCTD-148): kiểu, nhãn, danh mục danh hiệu mặc định và cách tính
// điểm tiêu chí dùng chung cho máy chủ và cổng quản trị. Danh mục là cấu hình của trường; bản mặc định chỉ là điểm xuất phát
// theo Luật Thi đua, khen thưởng năm 2022 và Nghị định 368/2026/NĐ-CP, trường đối chiếu văn bản hiện hành rồi sửa. Các lựa
// chọn do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11

export type EmulationTargetCode = 'individual' | 'collective';
export type EmulationTitleKindCode = 'title' | 'award';
export type EmulationDecisionLevelCode = 'school' | 'upper';
export type EmulationCampaignStatusCode = 'draft' | 'launched' | 'published' | 'closed';
export type EmulationNominationStatusCode =
  'draft' | 'submitted' | 'returned' | 'accepted' | 'passed' | 'failed' | 'proposed' | 'awarded' | 'not_awarded';
export type EmulationPositionCode = 'chair' | 'vice_chair' | 'secretary' | 'member';
export type EmulationVoteCode = 'agree' | 'disagree' | 'abstain';
export type EmulationAppealKindCode = 'review' | 'complaint';

export const EMULATION_RULE_CODE = 'YCTD-148';

export interface EmulationCriterion {
  code: string;
  title: string;
  // Trọng số (tổng các trọng số không bắt buộc bằng 100; điểm quy về thang 100)
  weight: number;
  max_score: number;
}

// Một điều kiện của danh hiệu khi kiểm tra hồ sơ: đạt, không đạt, hoặc chưa đối chiếu được (cảnh báo cho hội đồng)
export interface EmulationCheck {
  code: 'kpi' | 'initiative' | 'consecutive' | 'score' | 'quota' | 'registration';
  label: string;
  state: 'ok' | 'failed' | 'unknown';
  detail: string;
}

export const EMULATION_TARGET_LABELS: Record<EmulationTargetCode, string> = {
  individual: 'Cá nhân',
  collective: 'Tập thể',
};

export const EMULATION_KIND_LABELS: Record<EmulationTitleKindCode, string> = {
  title: 'Danh hiệu thi đua',
  award: 'Hình thức khen thưởng',
};

export const EMULATION_LEVEL_LABELS: Record<EmulationDecisionLevelCode, string> = {
  school: 'Trường quyết định',
  upper: 'Đề nghị cấp trên',
};

export const EMULATION_CAMPAIGN_KIND_LABELS: Record<'regular' | 'thematic', string> = {
  regular: 'Thi đua thường xuyên (năm học)',
  thematic: 'Thi đua theo chuyên đề, đợt',
};

export const EMULATION_CAMPAIGN_STATUS_LABELS: Record<EmulationCampaignStatusCode, string> = {
  draft: 'Đang soạn',
  launched: 'Đã phát động',
  published: 'Đã công bố kết quả bình xét',
  closed: 'Đã kết thúc',
};

export const EMULATION_REGISTRATION_STATUS_LABELS: Record<'pending' | 'accepted' | 'returned', string> = {
  pending: 'Chờ duyệt',
  accepted: 'Đã duyệt',
  returned: 'Trả lại',
};

export const EMULATION_NOMINATION_STATUS_LABELS: Record<EmulationNominationStatusCode, string> = {
  draft: 'Đang soạn',
  submitted: 'Đã nộp, chờ tiếp nhận',
  returned: 'Bị trả lại',
  accepted: 'Đã tiếp nhận, chờ bình xét',
  passed: 'Hội đồng thông qua',
  failed: 'Hội đồng không thông qua',
  proposed: 'Đã trình cấp trên',
  awarded: 'Đã khen thưởng',
  not_awarded: 'Cấp trên không khen',
};

export const EMULATION_POSITION_LABELS: Record<EmulationPositionCode, string> = {
  chair: 'Chủ tịch hội đồng',
  vice_chair: 'Phó Chủ tịch hội đồng',
  secretary: 'Thư ký hội đồng',
  member: 'Ủy viên',
};

export const EMULATION_VOTE_LABELS: Record<EmulationVoteCode, string> = {
  agree: 'Đồng ý',
  disagree: 'Không đồng ý',
  abstain: 'Không biểu quyết',
};

export const EMULATION_APPEAL_KIND_LABELS: Record<EmulationAppealKindCode, string> = {
  review: 'Phúc khảo kết quả bình xét',
  complaint: 'Khiếu nại',
};

export const EMULATION_APPEAL_STATUS_LABELS: Record<'pending' | 'accepted' | 'rejected', string> = {
  pending: 'Chờ giải quyết',
  accepted: 'Chấp nhận',
  rejected: 'Không chấp nhận',
};

export const EMULATION_DECISION_KIND_LABELS: Record<'decision' | 'proposal', string> = {
  decision: 'Quyết định khen thưởng của trường',
  proposal: 'Tờ trình đề nghị cấp trên khen thưởng',
};

export const EMULATION_CHECK_STATE_LABELS: Record<EmulationCheck['state'], string> = {
  ok: 'Đạt',
  failed: 'Không đạt',
  unknown: 'Chưa đối chiếu được',
};

export const EMULATION_LIMITS = {
  criteria: 20,
  evidence: 30,
  members: 30,
  achievements: 20_000,
};

// Điểm tiêu chí quy về thang 100: tổng (điểm / điểm tối đa × trọng số) chia tổng trọng số, làm tròn hai chữ số
export function emulationScore(criteria: EmulationCriterion[], scores: Record<string, number>): number {
  const totalWeight = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  if (totalWeight <= 0) {
    return 0;
  }
  const weighted = criteria.reduce((sum, criterion) => {
    const value = Math.min(Math.max(scores[criterion.code] ?? 0, 0), criterion.max_score);
    return sum + (criterion.max_score > 0 ? (value / criterion.max_score) * criterion.weight : 0);
  }, 0);
  return Math.round((weighted / totalWeight) * 10_000) / 100;
}

// Số năm học liên tục liền trước năm đang xét có danh hiệu tiền đề (năm học ghi theo năm bắt đầu)
export function consecutiveYearsBefore(years: Iterable<number>, currentStart: number): number {
  const set = new Set(years);
  let count = 0;
  while (set.has(currentStart - count - 1)) {
    count += 1;
  }
  return count;
}

// Tỉ lệ phiếu đồng ý tính trên tổng số thành viên hội đồng (không tính trên số có mặt) để tránh thông qua khi vắng nhiều
export function agreePercent(agree: number, members: number): number {
  return members > 0 ? Math.round((agree / members) * 10_000) / 100 : 0;
}

export interface EmulationTitleSeed {
  code: string;
  name: string;
  description: string;
  kind: EmulationTitleKindCode;
  target: EmulationTargetCode;
  decision_level: EmulationDecisionLevelCode;
  min_kpi_rank: string | null;
  requires_initiative: boolean;
  prerequisite_code: string | null;
  consecutive_years: number;
  quota_percent: number | null;
  quota_base_code: string | null;
  vote_threshold_percent: number;
  min_score: number | null;
  criteria: EmulationCriterion[];
}

const INDIVIDUAL_CRITERIA: EmulationCriterion[] = [
  { code: 'nhiem_vu', title: 'Kết quả thực hiện nhiệm vụ được giao', weight: 40, max_score: 10 },
  { code: 'pham_chat', title: 'Phẩm chất chính trị, đạo đức, lối sống, chấp hành kỷ luật', weight: 20, max_score: 10 },
  { code: 'phong_trao', title: 'Tham gia phong trào thi đua của trường', weight: 20, max_score: 10 },
  { code: 'boi_duong', title: 'Học tập, bồi dưỡng, sáng kiến, giải pháp', weight: 20, max_score: 10 },
];
const COLLECTIVE_CRITERIA: EmulationCriterion[] = [
  { code: 'nhiem_vu', title: 'Kết quả hoàn thành nhiệm vụ của tập thể', weight: 50, max_score: 10 },
  { code: 'phong_trao', title: 'Tổ chức, tham gia phong trào thi đua', weight: 30, max_score: 10 },
  { code: 'noi_bo', title: 'Nội bộ đoàn kết, không có cá nhân vi phạm kỷ luật', weight: 20, max_score: 10 },
];
const CHECK_NOTE = 'Trường đối chiếu tiêu chuẩn với văn bản hiện hành trước khi dùng.';

// Danh mục mặc định dùng cho mọi cấp học. Mã xếp loại KPI là mã của bộ quy tắc chấm 18d (excellent: hoàn thành xuất sắc,
// good: hoàn thành tốt). Số liệu (tỉ lệ, số năm liên tục, tỉ lệ phiếu) là cấu hình, trường sửa theo quy chế của mình
export const EMULATION_DEFAULT_TITLES: EmulationTitleSeed[] = [
  {
    code: 'LDTT',
    name: 'Lao động tiên tiến',
    description: `Hoàn thành tốt nhiệm vụ trở lên, tích cực tham gia phong trào thi đua (Luật Thi đua, khen thưởng năm 2022, Điều 24). ${CHECK_NOTE}`,
    kind: 'title',
    target: 'individual',
    decision_level: 'school',
    min_kpi_rank: 'good',
    requires_initiative: false,
    prerequisite_code: null,
    consecutive_years: 0,
    quota_percent: null,
    quota_base_code: null,
    vote_threshold_percent: 50,
    min_score: 70,
    criteria: INDIVIDUAL_CRITERIA,
  },
  {
    code: 'CSTDCS',
    name: 'Chiến sĩ thi đua cơ sở',
    description: `Đạt tiêu chuẩn Lao động tiên tiến và hoàn thành xuất sắc nhiệm vụ hoặc có sáng kiến được công nhận (Luật năm 2022, Điều 23); tỉ lệ không quá 10% số cá nhân đạt Lao động tiên tiến (Nghị định 368/2026/NĐ-CP, Điều 5). ${CHECK_NOTE}`,
    kind: 'title',
    target: 'individual',
    decision_level: 'school',
    min_kpi_rank: 'excellent',
    requires_initiative: false,
    prerequisite_code: null,
    consecutive_years: 0,
    quota_percent: 10,
    quota_base_code: 'LDTT',
    vote_threshold_percent: 50,
    min_score: 85,
    criteria: INDIVIDUAL_CRITERIA,
  },
  {
    code: 'CSTD-TINH',
    name: 'Chiến sĩ thi đua cấp tỉnh',
    description: `Thành tích tiêu biểu xuất sắc trong số cá nhân có nhiều lần liên tục đạt Chiến sĩ thi đua cơ sở, có sáng kiến (Luật năm 2022, Điều 22); trường lập tờ trình đề nghị cấp trên. ${CHECK_NOTE}`,
    kind: 'title',
    target: 'individual',
    decision_level: 'upper',
    min_kpi_rank: 'excellent',
    requires_initiative: true,
    prerequisite_code: 'CSTDCS',
    consecutive_years: 3,
    quota_percent: null,
    quota_base_code: null,
    vote_threshold_percent: 50,
    min_score: 90,
    criteria: INDIVIDUAL_CRITERIA,
  },
  {
    code: 'TT-LDTT',
    name: 'Tập thể lao động tiên tiến',
    description: `Hoàn thành tốt nhiệm vụ, có phong trào thi đua thường xuyên, nội bộ đoàn kết. ${CHECK_NOTE}`,
    kind: 'title',
    target: 'collective',
    decision_level: 'school',
    min_kpi_rank: null,
    requires_initiative: false,
    prerequisite_code: null,
    consecutive_years: 0,
    quota_percent: null,
    quota_base_code: null,
    vote_threshold_percent: 50,
    min_score: 70,
    criteria: COLLECTIVE_CRITERIA,
  },
  {
    code: 'TT-LDXS',
    name: 'Tập thể lao động xuất sắc',
    description: `Hoàn thành xuất sắc nhiệm vụ, là tập thể tiêu biểu; trường lập tờ trình đề nghị cấp trên. ${CHECK_NOTE}`,
    kind: 'title',
    target: 'collective',
    decision_level: 'upper',
    min_kpi_rank: null,
    requires_initiative: false,
    prerequisite_code: null,
    consecutive_years: 0,
    quota_percent: null,
    quota_base_code: null,
    vote_threshold_percent: 50,
    min_score: 85,
    criteria: COLLECTIVE_CRITERIA,
  },
  {
    code: 'GK-CN',
    name: 'Giấy khen của Hiệu trưởng (cá nhân)',
    description: `Khen cá nhân có thành tích trong đợt, chuyên đề hoặc năm học. ${CHECK_NOTE}`,
    kind: 'award',
    target: 'individual',
    decision_level: 'school',
    min_kpi_rank: null,
    requires_initiative: false,
    prerequisite_code: null,
    consecutive_years: 0,
    quota_percent: null,
    quota_base_code: null,
    vote_threshold_percent: 50,
    min_score: null,
    criteria: INDIVIDUAL_CRITERIA,
  },
  {
    code: 'GK-TT',
    name: 'Giấy khen của Hiệu trưởng (tập thể)',
    description: `Khen tập thể có thành tích trong đợt, chuyên đề hoặc năm học. ${CHECK_NOTE}`,
    kind: 'award',
    target: 'collective',
    decision_level: 'school',
    min_kpi_rank: null,
    requires_initiative: false,
    prerequisite_code: null,
    consecutive_years: 0,
    quota_percent: null,
    quota_base_code: null,
    vote_threshold_percent: 50,
    min_score: null,
    criteria: COLLECTIVE_CRITERIA,
  },
  {
    code: 'BK-TINH',
    name: 'Bằng khen của Chủ tịch Ủy ban nhân dân cấp tỉnh',
    description: `Cá nhân có thành tích xuất sắc; trường lập tờ trình đề nghị cấp trên. ${CHECK_NOTE}`,
    kind: 'award',
    target: 'individual',
    decision_level: 'upper',
    min_kpi_rank: 'excellent',
    requires_initiative: false,
    prerequisite_code: null,
    consecutive_years: 0,
    quota_percent: null,
    quota_base_code: null,
    vote_threshold_percent: 50,
    min_score: null,
    criteria: INDIVIDUAL_CRITERIA,
  },
];
