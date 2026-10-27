// Lớp video trực tiếp (DT-27 phần 27a, YCTD-251; tài liệu 32 mục 19.5): vai trò trong phòng và quyền tương ứng, tên phòng có mã
// trường, mã người dự, đo phút người dự từ nhật ký vào ra. Hàm thuần dùng chung cho máy chủ API (cấp mã vào phòng, đo theo gói) và
// giao diện (hiện quyền, phút còn lại)
export type VideoRoomRole = 'host' | 'student' | 'guardian' | 'observer';
export type VideoRoomKind = 'session' | 'instant';
export type VideoRoomStatus = 'open' | 'ended';
export type VideoRecordingStatus = 'recording' | 'ready' | 'failed' | 'deleted';
export type VideoTrackSource = 'camera' | 'microphone' | 'screen_share' | 'screen_share_audio';

export const VIDEO_ROOM_ROLE_LABELS: Record<VideoRoomRole, string> = {
  host: 'Gia sư (chủ phòng)',
  student: 'Học sinh',
  guardian: 'Cha mẹ (vào xem)',
  observer: 'Ban Giám hiệu (vào xem)',
};

export const VIDEO_RECORDING_STATUS_LABELS: Record<VideoRecordingStatus, string> = {
  recording: 'Đang ghi',
  ready: 'Đã ghi xong',
  failed: 'Ghi lỗi',
  deleted: 'Đã xóa theo hạn',
};

// Mã vào phòng chỉ dùng để vào trong 10 phút (tài liệu 32 mục 19.5)
export const VIDEO_JOIN_TOKEN_SECONDS = 600;

// Văn bản đồng ý ghi hình cha mẹ xác nhận cho con (lưu bản chụp và mã băm khi đồng ý)
export const VIDEO_RECORDING_CONSENT_TEXT =
  'Tôi đồng ý để nhà trường ghi hình các buổi học trực tuyến của con tôi trong chương trình này. Bản ghi chỉ người dự buổi, cha mẹ và Ban Giám hiệu xem được, không tải xuống, xóa theo thời hạn giữ của nhà trường. Tôi có thể rút lại đồng ý bất cứ lúc nào.';

export interface VideoGrants {
  roomAdmin: boolean;
  canPublish: boolean;
  canPublishData: boolean;
  canSubscribe: boolean;
  canPublishSources: VideoTrackSource[];
}

// Quyền theo vai trò: gia sư chia sẻ, ghi, tắt tiếng người khác; học sinh nói, chia sẻ màn hình khi được cho; cha mẹ và Ban Giám hiệu
// xem, nói khi được cho. Bảng trắng đi qua kênh dữ liệu nên ai được nói thì vẽ được
export function videoGrantsFor(role: VideoRoomRole, allowed: { speak?: boolean; share?: boolean } = {}): VideoGrants {
  if (role === 'host') {
    return {
      roomAdmin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
      canPublishSources: ['camera', 'microphone', 'screen_share', 'screen_share_audio'],
    };
  }
  if (role === 'student') {
    return {
      roomAdmin: false,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
      canPublishSources: allowed.share
        ? ['camera', 'microphone', 'screen_share', 'screen_share_audio']
        : ['camera', 'microphone'],
    };
  }
  const speak = allowed.speak === true;
  return {
    roomAdmin: false,
    canPublish: speak,
    canPublishData: speak,
    canSubscribe: true,
    canPublishSources: speak ? ['microphone'] : [],
  };
}

// Tên phòng ở máy chủ video: mã trường (tiền tố khóa của trường) và mã phòng, để không trùng giữa các trường và sự kiện gọi lại
// biết phòng thuộc trường nào
const ROOM_SEPARATOR = '--';
const ROOM_PART = /^[a-z0-9_-]+$/i;

export function videoRoomName(school: string, roomId: string): string {
  return `${school}${ROOM_SEPARATOR}${roomId}`;
}

export function parseVideoRoomName(name: string): { school: string; roomId: string } | null {
  const index = name.lastIndexOf(ROOM_SEPARATOR);
  if (index <= 0) {
    return null;
  }
  const school = name.slice(0, index);
  const roomId = name.slice(index + ROOM_SEPARATOR.length);
  return ROOM_PART.test(school) && ROOM_PART.test(roomId) ? { school, roomId } : null;
}

// Mã người dự trong phòng: vai trò và mã người dùng (học sinh là mã học sinh để nối điểm danh)
const ROLE_PREFIX: Record<VideoRoomRole, string> = { host: 'h', student: 's', guardian: 'g', observer: 'o' };

export function videoIdentity(role: VideoRoomRole, id: string): string {
  return `${ROLE_PREFIX[role]}:${id}`;
}

export function parseVideoIdentity(identity: string): { role: VideoRoomRole; id: string } | null {
  const [prefix, id] = identity.split(':');
  const role = (Object.keys(ROLE_PREFIX) as VideoRoomRole[]).find((key) => ROLE_PREFIX[key] === prefix);
  return role && id ? { role, id } : null;
}

// Phút người dự từ nhật ký vào ra: ghép mỗi lần vào với lần ra kế tiếp của cùng người; còn trong phòng thì tính đến `until`.
// Làm tròn lên theo phút cho từng đoạn
export function participantMinutes(
  events: Array<{ identity: string; kind: 'join' | 'leave'; at: Date }>,
  until: Date,
): number {
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const open = new Map<string, Date>();
  let total = 0;
  const add = (from: Date, to: Date) => {
    const milliseconds = to.getTime() - from.getTime();
    if (milliseconds > 0) {
      total += Math.ceil(milliseconds / 60_000);
    }
  };
  for (const event of sorted) {
    if (event.kind === 'join') {
      if (!open.has(event.identity)) {
        open.set(event.identity, event.at);
      }
    } else {
      const from = open.get(event.identity);
      if (from) {
        add(from, event.at);
        open.delete(event.identity);
      }
    }
  }
  for (const from of open.values()) {
    add(from, until);
  }
  return total;
}
