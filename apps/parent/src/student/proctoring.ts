import type { CameraState } from './student-api.js';

// Camera và nhận diện khuôn mặt ngay trên máy học sinh (DT-23 phần 23a, GD-106 Eric chốt 2026-10-26): hình từ camera chỉ đi vào
// bộ nhận diện chạy trong trình duyệt để đếm số khuôn mặt; không vẽ ra canvas để gửi, không ghi hình, không tải hình hay video
// lên máy chủ. Máy chủ chỉ nhận loại sự kiện và thời điểm
export interface CameraProbe {
  state: CameraState;
  stream: MediaStream | null;
}

// Xin camera ở bước vào bài (trình duyệt hỏi học sinh): không cho phép hoặc máy không có camera đều được báo lại để bài xử lý theo
// cấu hình (chặn vào bài, hoặc cho vào và đánh dấu cho giáo viên)
export async function openCamera(): Promise<CameraProbe> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { state: 'unavailable', stream: null };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
      audio: false,
    });
    return { state: 'granted', stream };
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    return { state: name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable', stream: null };
  }
}

export function stopStream(stream: MediaStream | null): void {
  for (const track of stream?.getTracks() ?? []) {
    track.stop();
  }
}

export async function enterFullscreen(): Promise<boolean> {
  try {
    await document.documentElement.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}

export async function leaveFullscreen(): Promise<void> {
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch {
      // Đã thoát rồi hoặc trình duyệt không cho: bỏ qua
    }
  }
}

// Đếm khuôn mặt trong khung hình hiện tại của video. Thư viện (mô hình nhỏ TinyFaceDetector, giấy phép MIT) và mô hình ở thư mục
// models của chính ứng dụng được tải lúc cần, không gọi ra ngoài
export async function createFaceCounter(): Promise<(video: HTMLVideoElement) => Promise<number>> {
  const faceapi = await import('@vladmandic/face-api');
  await faceapi.nets.tinyFaceDetector.loadFromUri(`${import.meta.env.BASE_URL}models`);
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 });
  return async (video) => (await faceapi.detectAllFaces(video, options)).length;
}
