import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PROCTOR_CONSENT_SCOPE_LABELS, PROCTOR_MAX_LIVE_VIEWS } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge } from '@school-management/ui';
import { messageOf } from '../exams/exam-filters.js';
import { fetchWithSession } from '../session/api-client.js';
import {
  endProctorView,
  pollProctorView,
  readAssignmentConsents,
  readAttemptProctor,
  readProctorIce,
  recordSchoolConsent,
  sendProctorSignal,
  startProctorView,
  type AssignmentDetail,
} from './online-exams-api.js';

// Giám thị camera (DT-23 phần 23e, YCTD-215): lưới camera trực tiếp của học sinh đang làm bài (WebRTC, hình đi thẳng từ trình duyệt
// học sinh tới trình duyệt giáo viên, máy chủ chỉ chuyển thông điệp báo hiệu), tình trạng đồng ý của cha mẹ, nhật ký người xem và xem
// lại bản ghi. Sự kiện và hình chỉ là căn cứ để giáo viên xét, không tự trừ điểm
const POLL_MILLISECONDS = 1000;
const formatTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'medium',
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(new Date(iso))
    : '';

type LiveState = 'connecting' | 'live' | 'ended' | 'failed';

// Mở một phiên xem: giáo viên là bên gọi (offer, chỉ nhận hình), học sinh trả lời; trả hàm dừng
async function connectLive(
  attemptId: string,
  onStream: (stream: MediaStream) => void,
  onState: (state: LiveState, detail?: string) => void,
): Promise<() => void> {
  const { view_id: viewId } = await startProctorView(attemptId);
  let servers: RTCIceServer[] = [];
  try {
    servers = (await readProctorIce()).ice_servers;
  } catch {
    // Không có máy chủ ICE thì chỉ kết nối được trong cùng mạng
  }
  const connection = new RTCPeerConnection({ iceServers: servers });
  connection.addTransceiver('video', { direction: 'recvonly' });
  connection.ontrack = (event) => {
    const [stream] = event.streams;
    if (stream) {
      onStream(stream);
      onState('live');
    }
  };
  connection.onicecandidate = (event) => {
    if (event.candidate) {
      void sendProctorSignal(viewId, 'ice', JSON.stringify(event.candidate.toJSON())).catch(() => undefined);
    }
  };
  connection.onconnectionstatechange = () => {
    if (connection.connectionState === 'failed') {
      onState('failed', 'Không kết nối được tới máy học sinh');
    }
  };
  await connection.setLocalDescription(await connection.createOffer());
  await sendProctorSignal(viewId, 'offer', JSON.stringify(connection.localDescription));
  let cursor = 0;
  let active = true;
  let timer: number | undefined;
  const pendingIce: RTCIceCandidateInit[] = [];
  const tick = async () => {
    if (!active) {
      return;
    }
    try {
      const reply = await pollProctorView(viewId, cursor);
      if (reply.ended) {
        onState('ended');
        active = false;
        connection.close();
        return;
      }
      for (const signal of reply.signals) {
        cursor = Math.max(cursor, signal.id);
        if (signal.kind === 'answer') {
          await connection.setRemoteDescription(JSON.parse(signal.payload) as RTCSessionDescriptionInit);
          for (const candidate of pendingIce.splice(0)) {
            await connection.addIceCandidate(candidate).catch(() => undefined);
          }
        } else if (connection.remoteDescription) {
          await connection.addIceCandidate(JSON.parse(signal.payload) as RTCIceCandidateInit).catch(() => undefined);
        } else {
          pendingIce.push(JSON.parse(signal.payload) as RTCIceCandidateInit);
        }
      }
    } catch {
      // Lỗi mạng ngắn: lần hỏi sau thử lại
    }
    if (active) {
      timer = window.setTimeout(() => void tick(), POLL_MILLISECONDS);
    }
  };
  void tick();
  return () => {
    active = false;
    if (timer) {
      window.clearTimeout(timer);
    }
    connection.close();
    void endProctorView(viewId).catch(() => undefined);
  };
}

function LiveTile({ attemptId, name, onClose }: { attemptId: string; name: string; onClose(): void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<LiveState>('connecting');
  const [detail, setDetail] = useState<string>();
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    connectLive(
      attemptId,
      (stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      },
      (next, message) => {
        setState(next);
        setDetail(message);
      },
    )
      .then((close) => {
        if (cancelled) {
          close();
        } else {
          stop = close;
        }
      })
      .catch((error) => {
        setState('failed');
        setDetail(messageOf(error));
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [attemptId]);
  return (
    <figure aria-label={`Camera của ${name}`} className="flex flex-col gap-1 rounded border border-border p-2">
      <video ref={videoRef} muted playsInline autoPlay className="aspect-video w-full rounded bg-black object-cover" />
      <figcaption className="flex flex-wrap items-center gap-2 text-label text-text">
        <span className="flex-1">{name}</span>
        <StatusBadge
          tone={state === 'live' ? 'success' : state === 'connecting' ? 'warning' : 'danger'}
          label={
            state === 'live'
              ? 'Đang xem'
              : state === 'connecting'
                ? 'Đang kết nối…'
                : state === 'ended'
                  ? 'Đã ngắt (học sinh nộp bài hoặc phiên kết thúc)'
                  : 'Không xem được'
          }
        />
        <Button variant="text" onClick={onClose}>
          Ngừng xem
        </Button>
      </figcaption>
      {detail ? <p className="text-label text-text-secondary">{detail}</p> : null}
    </figure>
  );
}

// Lưới camera: chọn từng học sinh đang làm bài hoặc xem tất cả; mỗi phiên xem được ghi vào nhật ký người xem
export function ProctorGrid({ data }: { data: AssignmentDetail }) {
  const [watching, setWatching] = useState<string[]>([]);
  const running = data.students.flatMap((student) =>
    student.attempts
      .filter((attempt) => attempt.status === 'in_progress' && attempt.camera_state === 'granted')
      .map((attempt) => ({ attemptId: attempt.id, name: student.full_name })),
  );
  const toggle = (attemptId: string) =>
    setWatching((current) =>
      current.includes(attemptId) ? current.filter((id) => id !== attemptId) : [...current, attemptId],
    );
  return (
    <section aria-label="Camera trực tiếp" className="flex flex-col gap-2 rounded border border-border p-3">
      <h2 className="text-section-title font-semibold text-text">Camera trực tiếp</h2>
      <p className="text-label text-text-secondary">
        Hình đi thẳng từ máy học sinh tới máy thầy cô, không lưu ở máy chủ; học sinh thấy thông báo khi có người xem và
        mỗi lần xem được ghi lại. Học sinh dưới 16 tuổi chỉ xem được khi cha mẹ đã đồng ý. Một bài xem tối đa{' '}
        {PROCTOR_MAX_LIVE_VIEWS} camera cùng lúc.
      </p>
      {running.length === 0 ? (
        <p className="text-content text-text-secondary">Chưa có học sinh nào đang làm bài với camera đã bật.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setWatching(running.slice(0, PROCTOR_MAX_LIVE_VIEWS).map((item) => item.attemptId))}>
            Xem tất cả ({running.length})
          </Button>
          <Button onClick={() => setWatching([])} disabled={watching.length === 0}>
            Ngừng xem tất cả
          </Button>
          {running.map((item) => (
            <Button
              key={item.attemptId}
              variant={watching.includes(item.attemptId) ? 'primary' : 'secondary'}
              aria-label={`Xem camera của ${item.name}`}
              onClick={() => toggle(item.attemptId)}
            >
              {item.name}
            </Button>
          ))}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {watching.map((attemptId) => {
          const item = running.find((row) => row.attemptId === attemptId);
          return (
            <LiveTile
              key={attemptId}
              attemptId={attemptId}
              name={item?.name ?? 'Học sinh'}
              onClose={() => setWatching((current) => current.filter((id) => id !== attemptId))}
            />
          );
        })}
      </div>
    </section>
  );
}

// Tình trạng đồng ý của cha mẹ trong bài giao; người quản lý đề, kiểm tra ghi nhận văn bản đồng ý của cha mẹ
export function ProctorConsents({ data }: { data: AssignmentDetail }) {
  const queryClient = useQueryClient();
  const consents = useQuery({
    queryKey: ['online-exam-consents', data.id],
    queryFn: () => readAssignmentConsents(data.id),
  });
  const [guardian, setGuardian] = useState('');
  const record = useMutation({
    mutationFn: (input: { child_id: string; scope: 'live' | 'record'; granted: boolean }) =>
      recordSchoolConsent({ ...input, ...(input.granted ? { guardian_name: guardian.trim() } : {}) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['online-exam-consents', data.id] }),
  });
  const scopes = (['live', 'record'] as const).filter((scope) =>
    scope === 'live' ? data.proctor_live : data.proctor_record,
  );
  return (
    <section aria-label="Đồng ý của cha mẹ" className="flex flex-col gap-2 rounded border border-border p-3">
      <h2 className="text-section-title font-semibold text-text">Đồng ý của cha mẹ</h2>
      <p className="text-label text-text-secondary">
        Học sinh dưới 16 tuổi chỉ vào được bài có giám sát khi cha mẹ đã đồng ý từng loại (trên ứng dụng phụ huynh, hoặc
        trường ghi nhận văn bản). Người quản lý đề, kiểm tra nhập họ tên người đồng ý rồi bấm Ghi nhận; thu hồi có hiệu
        lực ngay.
      </p>
      <label className="text-label font-medium text-text">
        Người đồng ý (khi ghi nhận văn bản)
        <input
          aria-label="Người đồng ý"
          className={`mt-2 block w-72 ${FORM_CONTROL_CLASS}`}
          value={guardian}
          maxLength={120}
          onChange={(event) => setGuardian(event.target.value)}
        />
      </label>
      {consents.error ? <Alert tone="danger">{messageOf(consents.error)}</Alert> : null}
      {record.error ? <Alert tone="danger">{messageOf(record.error)}</Alert> : null}
      <div className="overflow-x-auto">
        <table className="w-full text-content" aria-label="Tình trạng đồng ý">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-2">Học sinh</th>
              <th className="px-3 py-2">Cần cha mẹ đồng ý</th>
              {scopes.map((scope) => (
                <th key={scope} className="px-3 py-2">
                  {PROCTOR_CONSENT_SCOPE_LABELS[scope]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(consents.data?.students ?? []).map((student) => (
              <tr key={student.child_id} className="border-t border-border">
                <td className="px-3 py-2">{student.full_name}</td>
                <td className="px-3 py-2">
                  {student.needs_parent_consent ? 'Có (dưới 16 tuổi)' : 'Không (từ 16 tuổi)'}
                </td>
                {scopes.map((scope) => {
                  const current = student.consents[scope];
                  return (
                    <td key={scope} className="px-3 py-2">
                      {current ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <StatusBadge
                            tone="success"
                            label={`Đã đồng ý (${current.source === 'parent' ? 'ứng dụng' : 'văn bản'})`}
                          />
                          <Button
                            variant="text"
                            aria-label={`Thu hồi ${PROCTOR_CONSENT_SCOPE_LABELS[scope]} của ${student.full_name}`}
                            onClick={() => record.mutate({ child_id: student.child_id, scope, granted: false })}
                            disabled={record.isPending}
                          >
                            Thu hồi
                          </Button>
                        </span>
                      ) : (
                        <span className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone={student.needs_parent_consent ? 'warning' : 'neutral'} label="Chưa" />
                          <Button
                            variant="text"
                            aria-label={`Ghi nhận ${PROCTOR_CONSENT_SCOPE_LABELS[scope]} của ${student.full_name}`}
                            onClick={() => record.mutate({ child_id: student.child_id, scope, granted: true })}
                            disabled={record.isPending || guardian.trim() === ''}
                          >
                            Ghi nhận
                          </Button>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Trong bài làm của một học sinh: thông báo đã xác nhận, nhật ký người xem, xem lại bản ghi (phát qua máy chủ, không có nút tải xuống)
export function AttemptProctorInfo({ attemptId }: { attemptId: string }) {
  const queryClient = useQueryClient();
  const info = useQuery({
    queryKey: ['online-exam-attempt-proctor', attemptId],
    queryFn: () => readAttemptProctor(attemptId),
  });
  const [videoUrl, setVideoUrl] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const [loading, setLoading] = useState(false);
  useEffect(
    () => () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    },
    [videoUrl],
  );
  const data = info.data;
  if (!data || (!data.proctor_live && !data.proctor_record)) {
    return null;
  }
  const watch = async () => {
    setLoading(true);
    setProblem(undefined);
    try {
      const response = await fetchWithSession(`/api/v1/online-exams/attempts/${attemptId}/recording`);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? 'Không xem lại được bản ghi');
      }
      setVideoUrl(URL.createObjectURL(await response.blob()));
      await queryClient.invalidateQueries({ queryKey: ['online-exam-attempt-proctor', attemptId] });
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Không xem lại được bản ghi');
    } finally {
      setLoading(false);
    }
  };
  return (
    <section aria-label="Giám sát bằng camera" className="flex flex-col gap-2 rounded border border-border p-2">
      <h4 className="text-label font-semibold text-text">Giám sát bằng camera</h4>
      <p className="text-label text-text-secondary">
        Học sinh xác nhận thông báo lúc {data.notice_at ? formatTime(data.notice_at) : '—'}. Xem trực tiếp:{' '}
        {data.proctor_live ? 'bật' : 'tắt'}; ghi hình: {data.proctor_record ? 'bật' : 'tắt'}.
      </p>
      {data.recording ? (
        <div className="flex flex-col gap-2">
          <p className="text-content text-text">
            Bản ghi: {data.recording.chunks} đoạn (khoảng {Math.round(data.recording.approx_seconds / 60)} phút), tự xoá
            sau {formatTime(data.recording.expires_at)}.
          </p>
          {data.can_watch_recording ? (
            videoUrl ? (
              <video
                aria-label="Bản ghi camera"
                src={videoUrl}
                controls
                controlsList="nodownload noremoteplayback"
                disablePictureInPicture
                onContextMenu={(event) => event.preventDefault()}
                className="aspect-video max-w-xl rounded bg-black"
              />
            ) : (
              <div>
                <Button onClick={() => void watch()} disabled={loading}>
                  {loading ? 'Đang tải…' : 'Xem lại bản ghi'}
                </Button>
              </div>
            )
          ) : (
            <p className="text-label text-text-secondary">Chỉ người giao bài và người quản lý xem lại được bản ghi.</p>
          )}
          {problem ? <Alert tone="danger">{problem}</Alert> : null}
        </div>
      ) : data.proctor_record ? (
        <p className="text-label text-text-secondary">Chưa có bản ghi (chưa ghi hoặc đã hết hạn giữ).</p>
      ) : null}
      <ul className="flex flex-col gap-1 text-content text-text" aria-label="Nhật ký người xem">
        {data.views.length === 0 ? (
          <li className="text-text-secondary">Chưa có ai xem camera hay bản ghi của bài này.</li>
        ) : null}
        {data.views.map((view, index) => (
          <li key={`${view.started_at}-${index}`}>
            {formatTime(view.started_at)}: {view.viewer_name}{' '}
            {view.kind === 'live' ? 'xem trực tiếp' : 'xem lại bản ghi'}
            {view.ended_at && view.kind === 'live' ? ` (đến ${formatTime(view.ended_at)})` : ''}
          </li>
        ))}
      </ul>
    </section>
  );
}
