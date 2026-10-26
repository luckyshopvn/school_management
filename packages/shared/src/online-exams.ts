// Thi trực tuyến cho học sinh (DT-23 phần 23a, YCTD-211): nhãn và hằng số dùng chung cho máy chủ, cổng quản trị, ứng dụng học sinh.
// Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11; Eric chốt GD-105 (học sinh tự đăng nhập mọi cấp, trường tắt theo cấp) và
// GD-106 (khóa toàn màn hình và camera) ngày 2026-10-26

// Kênh đăng nhập của học sinh: cùng cơ chế phiên, khác kênh, khác tuyến (/student/*)
export const STUDENT_CHANNEL = 'student';

// Vai trò của tài khoản học sinh ở dịch vụ định danh (gắn một-một với tài khoản học và thi của học sinh)
export const STUDENT_ROLE_CODE = 'VT-21';

export type ExamResultMode = 'immediate' | 'after_close' | 'teacher_release';
export const EXAM_RESULT_MODES: readonly ExamResultMode[] = ['immediate', 'after_close', 'teacher_release'];
export const EXAM_RESULT_MODE_LABELS: Record<ExamResultMode, string> = {
  immediate: 'Hiện ngay sau khi nộp',
  after_close: 'Hiện sau giờ đóng',
  teacher_release: 'Giáo viên công bố',
};

export type ExamVariantMode = 'random' | 'fixed';
export const EXAM_VARIANT_MODE_LABELS: Record<ExamVariantMode, string> = {
  random: 'Phát ngẫu nhiên các mã đề',
  fixed: 'Một mã đề cố định',
};

export type ExamAttemptPolicy = 'best' | 'last';
export const EXAM_ATTEMPT_POLICY_LABELS: Record<ExamAttemptPolicy, string> = {
  best: 'Tính lần điểm cao nhất',
  last: 'Tính lần nộp sau cùng',
};

export type ExamViolationAction = 'flag' | 'auto_submit';
export const EXAM_VIOLATION_ACTION_LABELS: Record<ExamViolationAction, string> = {
  flag: 'Đánh dấu cho giáo viên xét',
  auto_submit: 'Tự nộp bài',
};

export type ExamCameraFallback = 'block' | 'flag';
export const EXAM_CAMERA_FALLBACK_LABELS: Record<ExamCameraFallback, string> = {
  block: 'Không cho vào bài',
  flag: 'Cho vào bài và đánh dấu cho giáo viên',
};

export type ExamSingleSessionMode = 'reject_new' | 'close_old';
export const EXAM_SINGLE_SESSION_LABELS: Record<ExamSingleSessionMode, string> = {
  reject_new: 'Từ chối phiên đăng nhập thứ hai',
  close_old: 'Đóng phiên cũ, cho phiên mới làm tiếp',
};

export type ExamAssignmentStatus = 'published' | 'cancelled';
export type ExamAttemptStatus = 'in_progress' | 'submitted';
export type ExamSubmitReason = 'manual' | 'timeout' | 'violation' | 'teacher';
export const EXAM_SUBMIT_REASON_LABELS: Record<ExamSubmitReason, string> = {
  manual: 'Học sinh nộp bài',
  timeout: 'Hết giờ, hệ thống tự nộp',
  violation: 'Quá số lần rời bài, hệ thống tự nộp',
  teacher: 'Giáo viên nộp thay',
};

// Trạng thái camera học sinh báo lúc vào bài (hình xử lý ngay trên máy học sinh, không gửi hình hay video)
export type ExamCameraState = 'off' | 'granted' | 'denied' | 'unavailable';

export const PROCTOR_EVENT_TYPES = [
  'fullscreen_exit',
  'page_hidden',
  'window_blur',
  'camera_denied',
  'camera_unavailable',
  'camera_lost',
  'no_face',
  'multiple_faces',
  'second_session',
] as const;
export type ProctorEventType = (typeof PROCTOR_EVENT_TYPES)[number];

export const PROCTOR_EVENT_LABELS: Record<ProctorEventType, string> = {
  fullscreen_exit: 'Thoát toàn màn hình',
  page_hidden: 'Rời trang, đổi thẻ trình duyệt',
  window_blur: 'Đổi sang cửa sổ khác',
  camera_denied: 'Không cho phép camera',
  camera_unavailable: 'Máy không có camera',
  camera_lost: 'Camera ngừng hoạt động',
  no_face: 'Không thấy khuôn mặt trong khung hình',
  multiple_faces: 'Có nhiều khuôn mặt trong khung hình',
  second_session: 'Phiên đăng nhập thứ hai',
};

// Loại sự kiện tính vào số lần rời bài (mặc định cho phép 3 lần). Sự kiện của camera chỉ là căn cứ để giáo viên xét, không tính
// vào số lần và không tự nộp bài, không tự trừ điểm
export const VIOLATION_EVENT_TYPES: readonly ProctorEventType[] = ['fullscreen_exit', 'page_hidden', 'window_blur'];

// Các sự kiện rời bài xảy ra trong khoảng này coi là một lần (thoát toàn màn hình thường kéo theo mất tiêu điểm cửa sổ)
export const VIOLATION_MERGE_SECONDS = 3;

// Học sinh làm tiếp được khi mất mạng; lưu nháp sau hạn nộp quá khoảng này bị từ chối
export const ANSWER_SAVE_GRACE_SECONDS = 10;

export interface FaceWatchSignal {
  type: 'no_face' | 'multiple_faces';
  // Đã kéo dài bao lâu (mili giây) và số khuôn mặt thấy lúc báo
  duration_ms: number;
  faces: number;
}

export interface FaceWatchOptions {
  // Không thấy mặt liên tục từng này giây mới báo (tránh báo khi cúi nhìn giấy nháp trong chốc lát)
  noFaceSeconds?: number;
  // Thấy từ hai khuôn mặt liên tục từng này giây mới báo
  multipleFacesSeconds?: number;
  // Tình trạng kéo dài thì báo lại sau từng này giây
  repeatSeconds?: number;
}

// Bộ đọc kết quả nhận diện khuôn mặt ngay trên máy học sinh (DT-23 phần 23a, GD-106): nhận số khuôn mặt của từng khung hình, chỉ
// trả về sự kiện khi tình trạng không thấy mặt hoặc nhiều khuôn mặt kéo dài; không giữ hình, không nhận hình. Mỗi tình trạng báo
// một lần khi đủ thời gian, kéo dài thì báo lại theo chu kỳ, hết tình trạng thì bắt đầu lại từ đầu
export function createFaceWatch(options: FaceWatchOptions = {}) {
  const thresholds = {
    no_face: (options.noFaceSeconds ?? 5) * 1000,
    multiple_faces: (options.multipleFacesSeconds ?? 2) * 1000,
  };
  const repeatMs = (options.repeatSeconds ?? 60) * 1000;
  const state: Record<FaceWatchSignal['type'], { since: number | null; lastReport: number | null }> = {
    no_face: { since: null, lastReport: null },
    multiple_faces: { since: null, lastReport: null },
  };
  return {
    push(faces: number, now: number): FaceWatchSignal[] {
      const active: FaceWatchSignal['type'] | null = faces === 0 ? 'no_face' : faces >= 2 ? 'multiple_faces' : null;
      const signals: FaceWatchSignal[] = [];
      for (const type of ['no_face', 'multiple_faces'] as const) {
        const entry = state[type];
        if (active !== type) {
          entry.since = null;
          entry.lastReport = null;
          continue;
        }
        entry.since ??= now;
        const elapsed = now - entry.since;
        const due =
          entry.lastReport === null ? elapsed >= thresholds[type] : now - entry.lastReport >= repeatMs;
        if (due) {
          entry.lastReport = now;
          signals.push({ type, duration_ms: elapsed, faces });
        }
      }
      return signals;
    },
  };
}
