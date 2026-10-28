import {
  pollProctor,
  readProctorIce,
  sendProctorSignal,
  uploadRecordingChunk,
  type CameraState,
} from './student-api.js';

// Camera và nhận diện khuôn mặt ngay trên máy học sinh (DT-23 phần 23a, GD-106 Eric chốt 2026-10-26): hình từ camera chỉ đi vào
// bộ nhận diện chạy trong trình duyệt để đếm số khuôn mặt; không vẽ ra canvas để gửi. Máy chủ chỉ nhận loại sự kiện và thời điểm.
// Chỉ khi nhà trường bật và giáo viên chọn cho bài thi (DT-23 phần 23e, cuối tệp này) hình mới đi tiếp: xem trực tiếp qua WebRTC
// tới giáo viên, hoặc ghi hình tải lên kho mã hoá, sau khi học sinh đã đọc thông báo và cha mẹ đồng ý (dưới 16 tuổi)
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

// ----- Giám thị camera (DT-23 phần 23e, YCTD-215) -----

const LIVE_POLL_MILLISECONDS = 2000;
const RECORDING_TIMESLICE_MILLISECONDS = 10_000;
const RECORDING_BITS_PER_SECOND = 250_000;
const UPLOAD_ATTEMPTS = 3;

// Trả lời phiên xem trực tiếp của giáo viên: hỏi máy chủ định kỳ, gặp offer thì trả lời bằng camera của em; hình đi thẳng tới
// trình duyệt giáo viên (qua máy chủ chuyển tiếp khi cần), máy chủ API chỉ chuyển thông điệp báo hiệu. Phiên giáo viên ngắt thì
// đóng kết nối tương ứng. `onWatching` báo số người đang xem để màn hình nói rõ cho học sinh
export function startLiveResponder(attemptId: string, stream: MediaStream, onWatching: (count: number) => void) {
  let active = true;
  let cursor = 0;
  let timer: number | undefined;
  const connections = new Map<string, RTCPeerConnection>();

  async function respond(viewId: string, offer: string, servers: RTCIceServer[]) {
    connections.get(viewId)?.close();
    const connection = new RTCPeerConnection({ iceServers: servers });
    connections.set(viewId, connection);
    for (const track of stream.getVideoTracks()) {
      connection.addTrack(track, stream);
    }
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        void sendProctorSignal(attemptId, viewId, 'ice', JSON.stringify(event.candidate.toJSON())).catch(
          () => undefined,
        );
      }
    };
    await connection.setRemoteDescription(JSON.parse(offer) as RTCSessionDescriptionInit);
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    await sendProctorSignal(attemptId, viewId, 'answer', JSON.stringify(connection.localDescription));
  }

  async function loop() {
    let servers: RTCIceServer[] = [];
    try {
      servers = (await readProctorIce()).ice_servers;
    } catch {
      // Không lấy được máy chủ ICE thì chỉ kết nối trực tiếp được trong cùng mạng
    }
    const tick = async () => {
      if (!active) {
        return;
      }
      try {
        const reply = await pollProctor(attemptId, cursor);
        cursor = reply.cursor;
        onWatching(reply.watching);
        for (const [viewId, connection] of connections) {
          if (!reply.active_view_ids.includes(viewId)) {
            connection.close();
            connections.delete(viewId);
          }
        }
        for (const signal of reply.signals) {
          if (signal.kind === 'offer') {
            await respond(signal.view_id, signal.payload, servers);
          } else {
            await connections
              .get(signal.view_id)
              ?.addIceCandidate(JSON.parse(signal.payload) as RTCIceCandidateInit)
              .catch(() => undefined);
          }
        }
      } catch {
        // Lỗi mạng hoặc một thông điệp hỏng: lần hỏi sau thử lại, bài làm không bị ảnh hưởng
      }
      if (active) {
        timer = window.setTimeout(() => void tick(), LIVE_POLL_MILLISECONDS);
      }
    };
    await tick();
  }
  void loop();

  return {
    stop() {
      active = false;
      if (timer) {
        window.clearTimeout(timer);
      }
      for (const connection of connections.values()) {
        connection.close();
      }
      connections.clear();
    },
  };
}

export interface Recorder {
  // Ngừng ghi và chờ đoạn cuối lên máy chủ
  stop(): Promise<void>;
}

// Ghi hình từng đoạn ngắn rồi tải lên tuần tự; đoạn lỗi mạng được gửi lại vài lần, vẫn lỗi thì báo một lần và ngừng ghi tiếp
export function startRecorder(attemptId: string, stream: MediaStream, onProblem: () => void): Recorder {
  const mimeType = ['video/webm;codecs=vp8', 'video/webm'].find((type) => MediaRecorder.isTypeSupported(type));
  if (!mimeType) {
    onProblem();
    return { stop: async () => undefined };
  }
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: RECORDING_BITS_PER_SECOND });
  let sequence = 0;
  let chain: Promise<void> = Promise.resolve();
  let failed = false;
  recorder.ondataavailable = (event) => {
    if (event.data.size === 0 || failed) {
      return;
    }
    const seq = sequence;
    sequence += 1;
    chain = chain.then(async () => {
      for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt += 1) {
        try {
          await uploadRecordingChunk(attemptId, seq, event.data);
          return;
        } catch {
          await new Promise((resolve) => window.setTimeout(resolve, 1000 * attempt));
        }
      }
      if (!failed) {
        failed = true;
        onProblem();
      }
    });
  };
  recorder.start(RECORDING_TIMESLICE_MILLISECONDS);
  return {
    async stop() {
      if (recorder.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          recorder.addEventListener('stop', () => resolve(), { once: true });
          recorder.stop();
        });
      }
      await chain;
    },
  };
}
