import { useEffect, useMemo, useState } from 'react';
import { Alert, Button } from '@school-management/ui';
import {
  confirmSession,
  discardSession,
  fetchCriteria,
  fetchGrouping,
  isNetworkError,
  messageOf,
  type ConductCriterion,
} from './classroom-api.js';
import { tallyScores, type Group } from './classroom-logic.ts';
import {
  flushQueue,
  queueBoardDiscard,
  readBoards,
  readGrouping,
  writeBoard,
  type LocalScore,
  type ScoreBoard,
} from './classroom-store.js';
import type { ToolProperties } from './CallTool.js';

// Bảng điểm nhanh (DT-23 phần 23b, YCTD-212): cộng, trừ điểm theo nhóm hoặc theo học sinh trong buổi học. Mỗi lần bấm là một
// dòng có `client_id`, gửi máy chủ ngay hoặc giữ trên máy rồi gửi khi có mạng (máy chủ chống trùng, cộng theo thời điểm bấm).
// Điểm chỉ vào nề nếp, thi đua (DT-21) khi giáo viên chọn tiêu chí và xác nhận; không xác nhận thì bỏ buổi và không có gì vào nề nếp
const STEPS = [1, 2, 5, -1];

export interface ScoreboardProperties extends ToolProperties {
  // Cấp học của lớp để lọc tiêu chí nề nếp; chưa biết (ngoại tuyến) thì không ghi vào nề nếp được
  schoolLevel: string | null;
  conductEnabled: boolean;
}

function newBoard(): ScoreBoard {
  return { session_key: crypto.randomUUID(), events: [] };
}

export function ScoreboardTool({
  classId,
  students,
  online,
  schoolLevel,
  conductEnabled,
  onQueueChanged,
}: ScoreboardProperties) {
  const [board, setBoard] = useState<ScoreBoard>(() => readBoards()[classId] ?? newBoard());
  const [mode, setMode] = useState<'group' | 'student'>('group');
  const [groups, setGroups] = useState<Group[]>(() => readGrouping(classId));
  const [criteria, setCriteria] = useState<ConductCriterion[]>([]);
  const [criterionId, setCriterionId] = useState('');
  const [notice, setNotice] = useState<{ tone: 'danger' | 'info' | 'success'; text: string }>();

  useEffect(() => {
    setBoard(readBoards()[classId] ?? newBoard());
    setGroups(readGrouping(classId));
    if (online) {
      fetchGrouping(classId)
        .then((saved) => saved.groups.length > 0 && setGroups(saved.groups))
        .catch(() => undefined);
    }
  }, [classId, online]);

  useEffect(() => {
    if (!conductEnabled || !online || !schoolLevel) {
      return;
    }
    fetchCriteria(schoolLevel)
      .then((items) => setCriteria(items.filter((item) => item.status === 'active')))
      .catch(() => setCriteria([]));
  }, [conductEnabled, online, schoolLevel]);

  const persist = (next: ScoreBoard) => {
    setBoard(next);
    writeBoard(classId, next);
  };

  const totals = useMemo(() => tallyScores(board.events), [board.events]);
  const pendingNet = totals.reduce((sum, total) => sum + total.pending, 0);
  const unsynced = board.events.filter((event) => !event.synced).length;

  const add = async (kind: 'group' | 'student', key: string, delta: number) => {
    const event: LocalScore = {
      client_id: crypto.randomUUID(),
      target_kind: kind,
      key,
      delta,
      occurred_at: new Date().toISOString(),
      confirmed: false,
      synced: false,
    };
    const next = { ...board, events: [...board.events, event] };
    persist(next);
    onQueueChanged();
    if (!online) {
      setNotice({ tone: 'info', text: 'Chưa có mạng: điểm được giữ trên máy và sẽ gửi khi có mạng' });
      return;
    }
    await flushQueue();
    const synced = readBoards()[classId];
    if (synced) {
      setBoard(synced);
    }
    onQueueChanged();
  };

  const confirm = async () => {
    setNotice(undefined);
    try {
      await flushQueue();
      const result = await confirmSession(classId, board.session_key, { criterion_id: criterionId });
      const next: ScoreBoard = {
        ...board,
        events: board.events.map((event) => (event.confirmed ? event : { ...event, confirmed: true, synced: true })),
      };
      persist(next);
      setNotice({ tone: 'success', text: `Đã ghi vào nề nếp, thi đua: ${result.quantity} lần` });
    } catch (error) {
      setNotice({ tone: 'danger', text: messageOf(error) });
    }
  };

  const discard = async () => {
    setNotice(undefined);
    try {
      if (online) {
        await discardSession(classId, board.session_key);
      } else if (board.events.some((event) => event.synced && !event.confirmed)) {
        queueBoardDiscard(classId, board.session_key);
      }
    } catch (error) {
      if (!isNetworkError(error)) {
        setNotice({ tone: 'danger', text: messageOf(error) });
        return;
      }
      queueBoardDiscard(classId, board.session_key);
    }
    writeBoard(classId, null);
    setBoard(newBoard());
    onQueueChanged();
    setNotice({ tone: 'info', text: 'Đã bỏ buổi: không có điểm nào vào nề nếp' });
  };

  const targets =
    mode === 'group'
      ? groups.map((group) => ({ key: group.name, label: group.name }))
      : students.map((student) => ({ key: student.id, label: `${student.order_no}. ${student.full_name}` }));
  const totalOf = (key: string) => totals.find((total) => total.target_kind === mode && total.key === key)?.total ?? 0;
  const wantedKind = pendingNet > 0 ? 'plus' : 'minus';
  const usableCriteria = criteria.filter((criterion) => criterion.kind === wantedKind);
  const canConfirm = conductEnabled && online && pendingNet !== 0 && criterionId !== '';

  return (
    <section aria-label="Bảng điểm nhanh" className="flex flex-col gap-4">
      <div className="flex gap-2" role="group" aria-label="Chấm theo">
        <Button variant={mode === 'group' ? 'primary' : 'secondary'} onClick={() => setMode('group')}>
          Theo nhóm
        </Button>
        <Button variant={mode === 'student' ? 'primary' : 'secondary'} onClick={() => setMode('student')}>
          Theo học sinh
        </Button>
      </div>
      {mode === 'group' && groups.length === 0 ? (
        <Alert tone="info">Chưa có nhóm: vào "Chia nhóm" để chia lớp rồi quay lại chấm điểm theo nhóm</Alert>
      ) : null}
      <ul aria-label="Bảng điểm" className="flex flex-col gap-2">
        {targets.map((target) => (
          <li
            key={target.key}
            className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3"
          >
            <span className="flex flex-col">
              <span className="text-content font-semibold text-text">{target.label}</span>
              <span className="text-label text-text-secondary" aria-label={`Điểm ${target.label}`}>
                {totalOf(target.key)} điểm
              </span>
            </span>
            <span className="flex gap-1">
              {STEPS.map((step) => (
                <Button
                  key={step}
                  aria-label={`${step > 0 ? 'Cộng' : 'Trừ'} ${Math.abs(step)} điểm cho ${target.label}`}
                  onClick={() => void add(mode, target.key, step)}
                >
                  {step > 0 ? `+${step}` : `−${Math.abs(step)}`}
                </Button>
              ))}
            </span>
          </li>
        ))}
      </ul>
      {unsynced > 0 ? <p className="text-label text-text-secondary">{unsynced} dòng điểm chờ gửi lên máy chủ</p> : null}
      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
        <h2 className="text-content font-semibold text-text">Ghi vào nề nếp, thi đua</h2>
        {!conductEnabled ? (
          <p className="text-label text-text-secondary">
            Trường chưa bật nề nếp, thi đua lớp; điểm chỉ dùng trong buổi
          </p>
        ) : !online ? (
          <p className="text-label text-text-secondary">Cần có mạng để ghi vào nề nếp, thi đua</p>
        ) : pendingNet === 0 ? (
          <p className="text-label text-text-secondary">Chưa có điểm nào để ghi (tổng điểm chưa ghi bằng 0)</p>
        ) : (
          <>
            <p className="text-label text-text-secondary">
              Tổng điểm chưa ghi: {pendingNet > 0 ? '+' : ''}
              {pendingNet}. Chọn tiêu chí {wantedKind === 'plus' ? 'cộng điểm' : 'trừ điểm'} để ghi cho cả lớp.
            </p>
            <label className="flex flex-col gap-1 text-label font-medium text-text">
              Tiêu chí
              <select
                aria-label="Tiêu chí"
                value={criterionId}
                onChange={(event) => setCriterionId(event.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-content text-text"
              >
                <option value="">Chọn tiêu chí</option>
                {usableCriteria.map((criterion) => (
                  <option key={criterion.id} value={criterion.id}>
                    {criterion.name} ({criterion.kind === 'plus' ? '+' : '−'}
                    {criterion.points})
                  </option>
                ))}
              </select>
            </label>
            <Button variant="primary" disabled={!canConfirm} onClick={() => void confirm()}>
              Ghi vào nề nếp
            </Button>
          </>
        )}
      </div>
      <Button variant="danger" onClick={() => void discard()}>
        Bỏ buổi này (không ghi vào nề nếp)
      </Button>
    </section>
  );
}
