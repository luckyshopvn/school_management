import type { VideoAdmission, VideoJoinInfo, VideoRecordingRow } from '@school-management/ui';
import { requestJson } from '../session/api-client.js';

// Lớp video trực tiếp, phía nhà trường (DT-27 phần 27a, YCTD-251)
export interface VideoRoomDetail {
  id: string;
  title: string;
  status: 'open' | 'ended';
  admissions: VideoAdmission[];
  recording: { id: string; started_at: string } | null;
  usage: {
    minutes_used: number;
    minutes_limit: number | null;
    recording_mb_used: number;
    recording_mb_limit: number | null;
  };
}

export interface VideoSettingsView {
  max_participants: number;
  recording_retention_days: number;
  lobby_enabled: boolean;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
});

export const videoApi = {
  status: () => requestJson<{ enabled: boolean; provider: string | null }>('/api/v1/video/status'),
  openSessionRoom: (sessionId: string) =>
    requestJson<VideoJoinInfo>(`/api/v1/video/sessions/${sessionId}/room`, json('POST', {})),
  room: (roomId: string) => requestJson<VideoRoomDetail>(`/api/v1/video/rooms/${roomId}`),
  participant: (roomId: string, identity: string, change: object) =>
    requestJson(`/api/v1/video/rooms/${roomId}/participants/${encodeURIComponent(identity)}`, json('PATCH', change)),
  recording: (roomId: string, start: boolean) =>
    requestJson(`/api/v1/video/rooms/${roomId}/recording/${start ? 'start' : 'stop'}`, json('POST', {})),
  end: (roomId: string) => requestJson(`/api/v1/video/rooms/${roomId}/end`, json('POST', {})),
  recordings: (sessionId: string) => requestJson<VideoRecordingRow[]>(`/api/v1/video/sessions/${sessionId}/recordings`),
  viewLink: (recordingId: string) =>
    requestJson<{ url: string }>(`/api/v1/video/recordings/${recordingId}/view-link`, json('POST', {})),
  settings: () => requestJson<VideoSettingsView>('/api/v1/video/settings'),
  saveSettings: (body: VideoSettingsView) =>
    requestJson<VideoSettingsView>('/api/v1/video/settings', json('PUT', body)),
  usage: () => requestJson<VideoRoomDetail['usage']>('/api/v1/video/usage'),
};
