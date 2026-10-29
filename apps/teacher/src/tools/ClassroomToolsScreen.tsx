import { useCallback, useEffect, useId, useState } from 'react';
import { TEACHING_TOOL_SECTIONS, teachingToolsFor, type TeachingTool } from '@school-management/shared';
import { Alert, ApplicationHeader, Button } from '@school-management/ui';
import { requestJson } from '../session/api-client.js';
import type { MyClass } from '../screens/ClassesScreen.js';
import { fetchPlanModules, fetchRoster, messageOf } from './classroom-api.js';
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
import { AlphabetTool } from './mini/AlphabetTool.js';
import { ClockTool } from './mini/ClockTool.js';
import { FractionTool } from './mini/FractionTool.js';
import { MultiplicationTool } from './mini/MultiplicationTool.js';
import { CountingTool } from './mini/CountingTool.js';
import { DiceTool } from './mini/DiceTool.js';
import { NoiseLightTool } from './mini/NoiseLightTool.js';
import { ShapesColorsTool } from './mini/ShapesColorsTool.js';
import { StarBoardTool } from './mini/StarBoardTool.js';
import { VisualTimerTool } from './mini/VisualTimerTool.js';
import { WhiteboardTool } from './mini/WhiteboardTool.js';

// Hộp công cụ giảng dạy (DT-29, YCTD-325; trước đây là Công cụ lớp học của DT-23 phần 23b, YCTD-212; tài liệu 32 mục 15.4, 21):
// gom công cụ, mini app hỗ trợ giảng dạy của lớp đang chọn, lọc theo cấp của lớp (danh mục `TEACHING_TOOLS` ở gói chung), bỏ công
// cụ trường đã tắt và công cụ thuộc tính năng gói chưa bật. Công cụ chạy trên lớp mở được khi mất mạng sau lần tải đầu nhờ service
// worker và bản chụp danh sách lớp gọn (hết hạn theo cấu hình của trường, xóa khi đăng xuất); các phân hệ khác vẫn cần mạng (GD-108)

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

const NO_CLASSES: MyClass[] = [];

// Ô công cụ: nút chọn công cụ trên lớp (thẻ, công cụ hiện ở dưới) hoặc lối vào màn khác
function ToolTile({
  tool,
  selected,
  onSelect,
  asTab,
}: {
  tool: TeachingTool;
  selected: boolean;
  onSelect(): void;
  asTab: boolean;
}) {
  // Tên của ô chỉ là tên công cụ; mô tả ẩn khỏi tên và đọc riêng qua aria-describedby, để tên không lẫn chữ của mô tả
  // (mô tả "Hình và màu" có chữ "gọi tên")
  const descriptionId = useId();
  return (
    <button
      type="button"
      aria-describedby={descriptionId}
      {...(asTab ? { role: 'tab', 'aria-selected': selected } : {})}
      onClick={onSelect}
      className={`flex min-h-16 flex-col items-start gap-1 rounded-lg px-3 py-2 text-left ${
        selected ? 'bg-brand text-white' : 'border border-border-strong bg-card text-text'
      }`}
    >
      <span className="text-label font-semibold">{tool.label}</span>
      <span
        id={descriptionId}
        aria-hidden="true"
        className={`text-label ${selected ? 'text-white' : 'text-text-secondary'}`}
      >
        {tool.description}
      </span>
    </button>
  );
}

export function ClassroomToolsScreen({
  classes: givenClasses,
  initialClassId,
  onBack,
  onCleared,
  onOpenLink,
  embedded = false,
}: {
  // null: không có phiên (ngoại tuyến), lớp lấy từ các bản chụp còn hạn; undefined: màn tự tải lớp của tôi (mở thẳng bằng
  // đường dẫn ?man=hop-cong-cu)
  classes: MyClass[] | null | undefined;
  initialClassId?: string;
  onBack?(): void;
  onCleared?(): void;
  // Mở màn đã có của ứng dụng giáo viên từ nhóm "Giao bài và học trực tuyến"; không truyền thì nhóm đó ẩn
  onOpenLink?(toolKey: string, myClass: MyClass): void;
  // Đặt trong khung phải của chế độ lớp học (DT-26 phần 26d): bỏ đầu trang
  embedded?: boolean;
}) {
  const online = useOnline();
  const [loadedClasses, setLoadedClasses] = useState<MyClass[]>();
  useEffect(() => {
    if (givenClasses !== undefined) {
      return;
    }
    requestJson<MyClass[]>('/api/v1/classes?mine=true&status=active')
      .then(setLoadedClasses)
      .catch(() => setLoadedClasses([]));
  }, [givenClasses]);
  const classes = givenClasses === undefined ? (loadedClasses ?? NO_CLASSES) : givenClasses;
  const [planModules, setPlanModules] = useState<string[] | null>(null);
  const [config, setConfig] = useState(readConfig);
  const [classId, setClassId] = useState(initialClassId ?? '');
  const [snapshot, setSnapshot] = useState<RosterSnapshot>();
  const [fromSaved, setFromSaved] = useState(false);
  const [tab, setTab] = useState('call');
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
    fetchPlanModules()
      .then(setPlanModules)
      .catch(() => undefined);
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
        setSnapshot(saveRoster(roster, new Date(), classes.find((item) => item.id === classId)?.school_level));
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
  // Cấp của lớp: lớp của tôi (có mạng) hoặc bản chụp; bản chụp cũ không có cấp thì không lọc theo cấp
  const level = myClass?.school_level ?? snapshot?.school_level ?? null;
  const tools = snapshot ? teachingToolsFor({ level, disabled: config?.disabled_tools ?? [], planModules }) : [];
  const onClassTools = tools.filter((tool) => tool.section !== 'online');
  const linkTools = online && myClass && onOpenLink ? tools.filter((tool) => tool.section === 'online') : [];
  const activeTool = onClassTools.find((tool) => tool.key === tab) ?? onClassTools[0];
  const active = activeTool?.key;
  const loading = givenClasses === undefined && loadedClasses === undefined;

  return (
    <div className={embedded ? undefined : 'min-h-screen'}>
      {embedded ? null : <ApplicationHeader title="Hộp công cụ giảng dạy" />}
      <main
        className={embedded ? 'flex flex-col gap-4' : 'mx-auto flex max-w-md flex-col md:max-w-3xl gap-4 px-4 py-6'}
      >
        {onBack ? (
          <div>
            <Button onClick={onBack}>Quay lại</Button>
          </div>
        ) : null}
        {!online ? (
          <Alert tone="warning">
            Đang dùng ngoại tuyến: công cụ dùng trên lớp vẫn chạy với danh sách lớp đã lưu; các phân hệ khác cần có mạng
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
        {options.length === 0 && !loading ? (
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
            {TEACHING_TOOL_SECTIONS.filter((section) => section.key !== 'online').map((section) => {
              const items = onClassTools.filter((tool) => tool.section === section.key);
              return items.length > 0 ? (
                <section key={section.key} aria-label={section.label} className="flex flex-col gap-2">
                  <h2 className="text-content font-semibold text-text">{section.label}</h2>
                  <div role="tablist" aria-label={section.label} className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {items.map((tool) => (
                      <ToolTile
                        key={tool.key}
                        tool={tool}
                        asTab
                        selected={tool.key === active}
                        onSelect={() => setTab(tool.key)}
                      />
                    ))}
                  </div>
                </section>
              ) : null;
            })}
            {activeTool ? (
              <section aria-label={activeTool.label} className="flex flex-col gap-3 border-t border-border pt-4">
                <h2 className="text-section-title font-semibold text-text">{activeTool.label}</h2>
                {active === 'call' ? (
                  <CallTool
                    classId={snapshot.class_id}
                    students={students}
                    online={online}
                    onQueueChanged={onQueueChanged}
                  />
                ) : null}
                {active === 'group' ? (
                  <GroupTool
                    classId={snapshot.class_id}
                    students={students}
                    online={online}
                    onQueueChanged={onQueueChanged}
                  />
                ) : null}
                {active === 'timer' ? <TimerTool /> : null}
                {active === 'whiteboard' ? <WhiteboardTool /> : null}
                {active === 'dice' ? <DiceTool /> : null}
                {active === 'visual-timer' ? <VisualTimerTool /> : null}
                {active === 'noise-light' ? <NoiseLightTool /> : null}
                {active === 'star-board' ? <StarBoardTool key={snapshot.class_id} classId={snapshot.class_id} /> : null}
                {active === 'shapes-colors' ? <ShapesColorsTool /> : null}
                {active === 'counting' ? <CountingTool /> : null}
                {active === 'alphabet' ? <AlphabetTool /> : null}
                {active === 'multiplication' ? <MultiplicationTool /> : null}
                {active === 'ruled-board' ? <WhiteboardTool ruled /> : null}
                {active === 'clock-reading' ? <ClockTool /> : null}
                {active === 'fractions' ? <FractionTool /> : null}
                {active === 'games' ? <GamesTool snapshot={snapshot} online={online && classes !== null} /> : null}
                {active === 'scoreboard' ? (
                  <ScoreboardTool
                    classId={snapshot.class_id}
                    students={students}
                    online={online}
                    onQueueChanged={onQueueChanged}
                    schoolLevel={myClass?.school_level ?? null}
                    conductEnabled={config?.conduct_enabled === true}
                  />
                ) : null}
              </section>
            ) : (
              <p className="text-content text-text-secondary">Trường đã tắt mọi công cụ dùng trên lớp.</p>
            )}
            {linkTools.length > 0 && myClass && onOpenLink ? (
              <section
                aria-label="Giao bài và học trực tuyến"
                className="flex flex-col gap-2 border-t border-border pt-4"
              >
                <h2 className="text-content font-semibold text-text">Giao bài và học trực tuyến</h2>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {linkTools.map((tool) => (
                    <ToolTile
                      key={tool.key}
                      tool={tool}
                      asTab={false}
                      selected={false}
                      onSelect={() => onOpenLink(tool.key, myClass)}
                    />
                  ))}
                </div>
              </section>
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
