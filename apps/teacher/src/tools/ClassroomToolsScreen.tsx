import { useCallback, useEffect, useState } from 'react';
import { Alert, ApplicationHeader, Button } from '@school-management/ui';
import type { MyClass } from '../screens/ClassesScreen.js';
import { fetchRoster, messageOf } from './classroom-api.js';
import { refreshPolicy } from './classroom-policy.js';
import {
  clearClassroomData,
  flushQueue,
  queuedCount,
  readConfig,
  readRosters,
  saveRoster,
  type RosterSnapshot,
} from './classroom-store.js';
import { CallTool } from './CallTool.js';
import { GroupTool } from './GroupTool.js';
import { ScoreboardTool } from './ScoreboardTool.js';
import { TimerTool } from './TimerTool.js';
import { GamesTool } from './games/GamesTool.js';

// Công cụ lớp học trên ứng dụng giáo viên (DT-23 phần 23b, YCTD-212; tài liệu 32 mục 15.4): gọi tên ngẫu nhiên, chia nhóm, đếm
// ngược và bấm giờ, bảng điểm nhanh. Mở được khi mất mạng sau lần tải đầu nhờ service worker và bản chụp danh sách lớp gọn
// (hết hạn theo cấu hình của trường, xóa khi đăng xuất); các phân hệ khác của ứng dụng vẫn cần mạng (GD-108)
type Tab = 'call' | 'group' | 'timer' | 'score' | 'game';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'call', label: 'Gọi tên' },
  { key: 'group', label: 'Chia nhóm' },
  { key: 'timer', label: 'Đồng hồ' },
  { key: 'score', label: 'Bảng điểm' },
  // Trò chơi kiến thức và thẻ đáp án giấy (DT-23 phần 23c)
  { key: 'game', label: 'Trò chơi' },
];

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

export function ClassroomToolsScreen({
  classes,
  initialClassId,
  onBack,
  onCleared,
}: {
  // null: không có phiên (ngoại tuyến), lớp lấy từ các bản chụp còn hạn
  classes: MyClass[] | null;
  initialClassId?: string;
  onBack?(): void;
  onCleared?(): void;
}) {
  const online = useOnline();
  const [config, setConfig] = useState(readConfig);
  const [classId, setClassId] = useState(initialClassId ?? '');
  const [snapshot, setSnapshot] = useState<RosterSnapshot>();
  const [fromSaved, setFromSaved] = useState(false);
  const [tab, setTab] = useState<Tab>('call');
  const [pending, setPending] = useState(() => queuedCount());
  const [problem, setProblem] = useState<string>();

  const savedClasses = classes === null ? Object.values(readRosters(new Date())) : [];
  const options =
    classes === null
      ? savedClasses.map((item) => ({ id: item.class_id, name: item.class_name }))
      : classes.map((item) => ({ id: item.id, name: item.name }));

  // Có mạng: lấy cấu hình của trường (bật, tắt ngoại tuyến) rồi gửi nốt hàng đợi
  useEffect(() => {
    if (!online || classes === null) {
      return;
    }
    refreshPolicy()
      .then(setConfig)
      .catch(() => undefined)
      .finally(() => {
        void flushQueue().then(() => setPending(queuedCount()));
      });
  }, [online, classes]);

  useEffect(() => {
    setProblem(undefined);
    if (!classId) {
      setSnapshot(undefined);
      return;
    }
    const saved = readRosters(new Date())[classId];
    if (!online || classes === null) {
      setSnapshot(saved);
      setFromSaved(true);
      return;
    }
    let cancelled = false;
    fetchRoster(classId)
      .then((roster) => {
        if (cancelled) {
          return;
        }
        setSnapshot(saveRoster(roster, new Date()));
        setFromSaved(false);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (saved) {
          setSnapshot(saved);
          setFromSaved(true);
        } else {
          setSnapshot(undefined);
          setProblem(messageOf(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [classId, online, classes]);

  const onQueueChanged = useCallback(() => setPending(queuedCount()), []);
  const students = snapshot?.students ?? [];
  const myClass = classes?.find((item) => item.id === classId);

  return (
    <div className="min-h-screen">
      <ApplicationHeader title="Công cụ lớp học" />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        {onBack ? (
          <div>
            <Button onClick={onBack}>Quay lại</Button>
          </div>
        ) : null}
        {!online ? (
          <Alert tone="warning">
            Đang dùng ngoại tuyến: công cụ lớp học vẫn chạy với danh sách lớp đã lưu; các phân hệ khác cần có mạng
          </Alert>
        ) : null}
        {pending > 0 ? (
          <Alert tone="info">
            {pending} mục chờ gửi lên máy chủ{online ? '' : ': sẽ gửi khi có mạng'}
          </Alert>
        ) : null}
        <label className="flex flex-col gap-1 text-label font-medium text-text">
          Lớp
          <select
            aria-label="Lớp"
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-content text-text"
          >
            <option value="">Chọn lớp</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        {options.length === 0 ? (
          <p className="text-content text-text-secondary">
            {classes === null
              ? 'Chưa có danh sách lớp nào được lưu trên máy hoặc đã hết hạn. Cần có mạng để mở lớp lần đầu.'
              : 'Bạn chưa được phân công lớp nào.'}
          </p>
        ) : null}
        {problem ? <Alert tone="danger">{problem}</Alert> : null}
        {snapshot && fromSaved ? (
          <p className="text-label text-text-secondary">
            Danh sách lớp lưu trên máy lúc {timeOf(snapshot.saved_at)}
            {config ? `, giữ tối đa ${config.roster_ttl_hours} giờ` : ''}
          </p>
        ) : null}
        {snapshot ? (
          <>
            <div role="tablist" aria-label="Công cụ" className="grid grid-cols-5 gap-1">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.key}
                  onClick={() => setTab(item.key)}
                  className={`rounded-lg px-2 py-2 text-label font-medium ${
                    tab === item.key ? 'bg-brand text-white' : 'border border-border-strong bg-card text-text'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {tab === 'call' ? (
              <CallTool
                classId={snapshot.class_id}
                students={students}
                online={online}
                onQueueChanged={onQueueChanged}
              />
            ) : null}
            {tab === 'group' ? (
              <GroupTool
                classId={snapshot.class_id}
                students={students}
                online={online}
                onQueueChanged={onQueueChanged}
              />
            ) : null}
            {tab === 'timer' ? <TimerTool /> : null}
            {tab === 'game' ? <GamesTool snapshot={snapshot} online={online && classes !== null} /> : null}
            {tab === 'score' ? (
              <ScoreboardTool
                classId={snapshot.class_id}
                students={students}
                online={online}
                onQueueChanged={onQueueChanged}
                schoolLevel={myClass?.school_level ?? null}
                conductEnabled={config?.conduct_enabled === true}
              />
            ) : null}
          </>
        ) : null}
        {classes === null ? (
          <div>
            <Button
              onClick={() => {
                clearClassroomData();
                onCleared?.();
              }}
            >
              Xóa dữ liệu công cụ lớp học trên máy này
            </Button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
