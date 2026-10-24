import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  GRADUATION_MINUTES_LABELS,
  GRADUATION_OUTCOME_LABELS,
  GRADUATION_SUBMISSION_LABELS,
  PERMISSION_CODES,
  type GraduationConfig,
  type GraduationLevel,
  type GraduationMinutesKind,
} from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useEnabledSchoolLevels } from '../school-levels/enabled-levels.js';
import { useHasPermission } from '../session/permissions.js';
import {
  addMinutes,
  addRoom,
  assignExamNumbers,
  assignRooms,
  confirmSession,
  createGraduationSession,
  downloadFile,
  evaluateSession,
  generateCandidates,
  listGraduationSessions,
  markDossierSent,
  markSubmissionSent,
  messageOf,
  prepareDossiers,
  readGraduationConfig,
  readGraduationView,
  saveCandidateScores,
  saveGraduationConfig,
  updateCandidate,
  type GraduationCandidate,
  type GraduationView,
} from './graduation-api.js';

// 7.17 Xét tốt nghiệp, hồ sơ thi (DT-21 phần 21f, YCTD-174): kỳ xét (THCS) hoặc kỳ thi tốt nghiệp (THPT) của năm học; danh
// sách thí sinh lập từ học sinh khối cuối cấp (điều kiện theo xếp loại cả năm của sổ điểm); THPT thêm bài thi, số báo danh, phòng
// thi, điểm thi; xét kết quả, công nhận có biên bản hội đồng, giấy chứng nhận; tệp xuất và đánh dấu đã gửi; hồ sơ chuyển cấp
// THCS. Người có `P02.student-record.approve` toàn trường quản lý, người có quyền xem đánh giá chỉ xem
type Tab = 'candidates' | 'rooms' | 'scores' | 'results' | 'minutes' | 'dossiers' | 'config';
const TAB_LABELS: Record<Tab, string> = {
  candidates: 'Thí sinh',
  rooms: 'Phòng thi',
  scores: 'Điểm thi',
  results: 'Kết quả, công nhận',
  minutes: 'Biên bản, tệp xuất',
  dossiers: 'Hồ sơ chuyển cấp',
  config: 'Cấu hình',
};
const SELECT_CLASS = 'rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const CELL_INPUT = 'w-20 rounded border border-border bg-card px-2 py-1 text-content';

const nameOf = (view: GraduationView, code: string) => view.subjects.find((item) => item.code === code)?.name ?? code;
const numberOrNull = (text: string): number | null | undefined => {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
};

function CandidateEditor({
  view,
  candidate,
  canManage,
  onSaved,
}: {
  view: GraduationView;
  candidate: GraduationCandidate;
  canManage: boolean;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const { config } = view;
  const [subjects, setSubjects] = useState<string[]>(candidate.exam_subjects);
  const [exempt, setExempt] = useState<string[]>(candidate.exempt_subjects);
  const [priority, setPriority] = useState(String(candidate.priority_points));
  const [incentive, setIncentive] = useState(String(candidate.incentive_points));
  const [grades, setGrades] = useState({
    g10: candidate.grades.g10 === null ? '' : String(candidate.grades.g10),
    g11: candidate.grades.g11 === null ? '' : String(candidate.grades.g11),
    g12: candidate.grades.g12 === null ? '' : String(candidate.grades.g12),
  });
  const save = useMutation({
    mutationFn: () =>
      updateCandidate(candidate.id, {
        priority_points: numberOrNull(priority) ?? 0,
        incentive_points: numberOrNull(incentive) ?? 0,
        ...(subjects.length > 0 ? { exam_subjects: subjects, exempt_subjects: exempt } : {}),
        grades: {
          g10: numberOrNull(grades.g10) ?? null,
          g11: numberOrNull(grades.g11) ?? null,
          g12: numberOrNull(grades.g12) ?? null,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['graduation-view'] });
      onSaved('Đã ghi hồ sơ dự thi');
    },
  });
  const toggle = (list: string[], set: (value: string[]) => void, code: string) =>
    set(list.includes(code) ? list.filter((item) => item !== code) : [...list, code]);
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-border p-4"
      aria-label={`Hồ sơ dự thi ${candidate.full_name}`}
    >
      <h3 className="text-content font-semibold">Hồ sơ dự thi của {candidate.full_name}</h3>
      <fieldset className="flex flex-wrap gap-4">
        <legend className="text-label font-medium text-text">
          Bài thi (bắt buộc và {config.elective_count} bài tự chọn)
        </legend>
        {[...config.required_subjects, ...config.elective_pool].map((code) => (
          <label key={code} className="flex items-center gap-2 text-content">
            <input
              type="checkbox"
              disabled={!canManage || !candidate.eligible}
              checked={subjects.includes(code)}
              onChange={() => toggle(subjects, setSubjects, code)}
            />
            {nameOf(view, code)}
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-wrap gap-4">
        <legend className="text-label font-medium text-text">Miễn thi</legend>
        {subjects.map((code) => (
          <label key={code} className="flex items-center gap-2 text-content">
            <input
              type="checkbox"
              disabled={!canManage}
              checked={exempt.includes(code)}
              onChange={() => toggle(exempt, setExempt, code)}
            />
            {nameOf(view, code)}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-3">
        {[
          ['Điểm ưu tiên', priority, setPriority],
          ['Điểm khuyến khích', incentive, setIncentive],
        ].map(([label, value, set]) => (
          <label key={label as string} className="flex flex-col gap-1 text-label font-medium text-text">
            {label as string}
            <input
              className={CELL_INPUT}
              disabled={!canManage}
              value={value as string}
              onChange={(event) => (set as (text: string) => void)(event.target.value)}
            />
          </label>
        ))}
        {(['g10', 'g11', 'g12'] as const).map((key) => (
          <label key={key} className="flex flex-col gap-1 text-label font-medium text-text">
            {`Điểm trung bình lớp ${key.slice(1)}`}
            <input
              className={CELL_INPUT}
              disabled={!canManage}
              value={grades[key]}
              onChange={(event) => setGrades({ ...grades, [key]: event.target.value })}
            />
          </label>
        ))}
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      {canManage ? (
        <div>
          <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
            Ghi hồ sơ dự thi
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function CandidatesTab({
  view,
  canManage,
  onSaved,
}: {
  view: GraduationView;
  canManage: boolean;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const open = view.session.status === 'open';
  const thpt = view.session.school_level === 'THPT';
  const [selected, setSelected] = useState<string>();
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['graduation-view'] });
    onSaved(message);
  };
  const generate = useMutation({
    mutationFn: () => generateCandidates(view.session.id),
    onSuccess: (result) => refresh(`Đã lập danh sách: thêm ${result.created}, cập nhật ${result.updated}`),
  });
  const numbers = useMutation({
    mutationFn: () => assignExamNumbers(view.session.id),
    onSuccess: (result) => refresh(`Đã đánh ${result.assigned} số báo danh`),
  });
  const candidate = view.candidates.find((item) => item.id === selected);
  return (
    <section className="flex flex-col gap-3" aria-label="Thí sinh">
      {generate.error ? <Alert tone="danger">{messageOf(generate.error)}</Alert> : null}
      {numbers.error ? <Alert tone="danger">{messageOf(numbers.error)}</Alert> : null}
      {canManage && open ? (
        <div className="flex gap-2">
          <Button variant="primary" disabled={generate.isPending} onClick={() => generate.mutate()}>
            Lập danh sách thí sinh
          </Button>
          {thpt ? (
            <Button disabled={numbers.isPending} onClick={() => numbers.mutate()}>
              Đánh số báo danh
            </Button>
          ) : null}
        </div>
      ) : null}
      <table className="w-full text-content" aria-label="Danh sách thí sinh">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            {thpt ? <th className="px-2 py-2">Số báo danh</th> : null}
            <th className="px-2 py-2">Học sinh</th>
            <th className="px-2 py-2">Lớp</th>
            <th className="px-2 py-2">Điều kiện</th>
            {thpt ? <th className="px-2 py-2">Bài thi</th> : null}
            {thpt ? <th className="px-2 py-2">Phòng</th> : null}
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {view.candidates.map((row) => (
            <tr key={row.id} className="border-t border-border align-top">
              {thpt ? <td className="px-2 py-2">{row.exam_number ?? ''}</td> : null}
              <td className="px-2 py-2 font-medium">{row.full_name}</td>
              <td className="px-2 py-2">{row.class_name}</td>
              <td className="px-2 py-2">
                {row.eligible ? (
                  <StatusBadge tone="success" label="Đủ điều kiện" />
                ) : (
                  <StatusBadge tone="danger" label={row.eligibility_note ?? 'Chưa đủ điều kiện'} />
                )}
              </td>
              {thpt ? (
                <td className="px-2 py-2">{row.exam_subjects.map((code) => nameOf(view, code)).join(', ')}</td>
              ) : null}
              {thpt ? (
                <td className="px-2 py-2">{view.rooms.find((room) => room.id === row.room_id)?.code ?? ''}</td>
              ) : null}
              <td className="px-2 py-2 text-right">
                {thpt ? (
                  <Button variant="text" onClick={() => setSelected(selected === row.id ? undefined : row.id)}>
                    {`Hồ sơ dự thi ${row.full_name}`}
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
          {view.candidates.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-2 py-2 text-text-secondary">
                Chưa có thí sinh. Bấm "Lập danh sách thí sinh".
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {thpt && candidate ? (
        <CandidateEditor
          key={candidate.id}
          view={view}
          candidate={candidate}
          canManage={canManage && open}
          onSaved={onSaved}
        />
      ) : null}
    </section>
  );
}

function RoomsTab({
  view,
  canManage,
  onSaved,
}: {
  view: GraduationView;
  canManage: boolean;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('24');
  const [proctors, setProctors] = useState('');
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['graduation-view'] });
    onSaved(message);
  };
  const add = useMutation({
    mutationFn: () => addRoom(view.session.id, { code, name, capacity: Number(capacity), proctors: proctors || null }),
    onSuccess: () => {
      setCode('');
      setName('');
      return refresh('Đã thêm phòng thi');
    },
  });
  const assign = useMutation({
    mutationFn: () => assignRooms(view.session.id),
    onSuccess: (result) => refresh(`Đã xếp ${result.assigned} thí sinh vào phòng`),
  });
  const open = view.session.status === 'open';
  return (
    <section className="flex flex-col gap-3" aria-label="Phòng thi">
      <table className="w-full text-content" aria-label="Danh sách phòng thi">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-2 py-2">Mã</th>
            <th className="px-2 py-2">Tên phòng</th>
            <th className="px-2 py-2">Sức chứa</th>
            <th className="px-2 py-2">Thí sinh</th>
            <th className="px-2 py-2">Giám thị</th>
          </tr>
        </thead>
        <tbody>
          {view.rooms.map((room) => (
            <tr key={room.id} className="border-t border-border">
              <td className="px-2 py-2">{room.code}</td>
              <td className="px-2 py-2">{room.name}</td>
              <td className="px-2 py-2">{room.capacity}</td>
              <td className="px-2 py-2">{view.candidates.filter((row) => row.room_id === room.id).length}</td>
              <td className="px-2 py-2">{room.proctors ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {add.error ? <Alert tone="danger">{messageOf(add.error)}</Alert> : null}
      {assign.error ? <Alert tone="danger">{messageOf(assign.error)}</Alert> : null}
      {canManage && open ? (
        <form
          aria-label="Thêm phòng thi"
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate();
          }}
        >
          <label className="text-label font-medium text-text">
            Mã phòng
            <input
              className={`mt-2 block ${FORM_CONTROL_CLASS}`}
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <label className="text-label font-medium text-text">
            Tên phòng
            <input
              className={`mt-2 block ${FORM_CONTROL_CLASS}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="text-label font-medium text-text">
            Sức chứa
            <input className={CELL_INPUT} value={capacity} onChange={(event) => setCapacity(event.target.value)} />
          </label>
          <label className="text-label font-medium text-text">
            Giám thị
            <input
              className={`mt-2 block ${FORM_CONTROL_CLASS}`}
              value={proctors}
              onChange={(event) => setProctors(event.target.value)}
            />
          </label>
          <Button type="submit" variant="primary" disabled={!code || !name || add.isPending}>
            Thêm phòng
          </Button>
          <Button disabled={assign.isPending} onClick={() => assign.mutate()}>
            Xếp thí sinh vào phòng
          </Button>
        </form>
      ) : null}
    </section>
  );
}

function ScoresTab({
  view,
  canManage,
  onSaved,
}: {
  view: GraduationView;
  canManage: boolean;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        view.candidates.map((row) => [
          row.id,
          Object.fromEntries(row.scores.map((item) => [item.subject_code, String(item.score)])),
        ]),
      ),
    );
  }, [view]);
  const save = useMutation({
    mutationFn: async (row: GraduationCandidate) => {
      const taking = row.exam_subjects.filter((code) => !row.exempt_subjects.includes(code));
      await saveCandidateScores(
        row.id,
        taking.map((code) => ({ subject_code: code, score: numberOrNull(drafts[row.id]?.[code] ?? '') ?? null })),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['graduation-view'] });
      onSaved('Đã ghi điểm thi');
    },
  });
  const open = view.session.status === 'open';
  return (
    <section className="flex flex-col gap-3" aria-label="Điểm thi">
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <table className="w-full text-content" aria-label="Bảng điểm thi">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-2 py-2">Số báo danh</th>
            <th className="px-2 py-2">Học sinh</th>
            <th className="px-2 py-2">Điểm các bài thi</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {view.candidates
            .filter((row) => row.eligible)
            .map((row) => (
              <tr key={row.id} className="border-t border-border align-top">
                <td className="px-2 py-2">{row.exam_number ?? ''}</td>
                <td className="px-2 py-2 font-medium">{row.full_name}</td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap gap-3">
                    {row.exam_subjects
                      .filter((code) => !row.exempt_subjects.includes(code))
                      .map((code) => (
                        <label key={code} className="flex items-center gap-2 text-label">
                          {nameOf(view, code)}
                          <input
                            aria-label={`Điểm ${nameOf(view, code)} ${row.full_name}`}
                            className={CELL_INPUT}
                            disabled={!canManage || !open}
                            value={drafts[row.id]?.[code] ?? ''}
                            onChange={(event) =>
                              setDrafts({ ...drafts, [row.id]: { ...drafts[row.id], [code]: event.target.value } })
                            }
                          />
                        </label>
                      ))}
                    {row.exam_subjects.length === 0 ? (
                      <span className="text-text-secondary">Chưa đăng ký bài thi</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-2 py-2 text-right">
                  {canManage && open && row.exam_subjects.length > 0 ? (
                    <Button variant="text" onClick={() => save.mutate(row)}>
                      {`Ghi điểm ${row.full_name}`}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </section>
  );
}

function ResultsTab({
  view,
  canManage,
  onSaved,
}: {
  view: GraduationView;
  canManage: boolean;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['graduation-view'] });
    onSaved(message);
  };
  const evaluate = useMutation({
    mutationFn: () => evaluateSession(view.session.id),
    onSuccess: (result) =>
      refresh(
        `Đã xét kết quả: ${result.proposed} đề xuất${result.incomplete > 0 ? `, ${result.incomplete} thí sinh thiếu điểm` : ''}`,
      ),
  });
  const confirm = useMutation({
    mutationFn: () => confirmSession(view.session.id),
    onSuccess: (result) => refresh(`Đã công nhận tốt nghiệp ${result.graduated} trên ${result.total} thí sinh`),
  });
  const certificate = useMutation({
    mutationFn: (row: GraduationCandidate) =>
      downloadFile(
        `/api/v1/graduation/candidates/${row.id}/certificate`,
        `giay-chung-nhan-${row.decision?.certificate_no ?? row.id}.pdf`,
      ),
  });
  const open = view.session.status === 'open';
  return (
    <section className="flex flex-col gap-3" aria-label="Kết quả, công nhận">
      {evaluate.error ? <Alert tone="danger">{messageOf(evaluate.error)}</Alert> : null}
      {confirm.error ? <Alert tone="danger">{messageOf(confirm.error)}</Alert> : null}
      {certificate.error ? <Alert tone="danger">{messageOf(certificate.error)}</Alert> : null}
      {canManage && open ? (
        <div className="flex gap-2">
          <Button disabled={evaluate.isPending} onClick={() => evaluate.mutate()}>
            Xét kết quả
          </Button>
          <Button variant="primary" disabled={confirm.isPending} onClick={() => confirm.mutate()}>
            Công nhận tốt nghiệp
          </Button>
        </div>
      ) : null}
      {open ? (
        <p className="text-label text-text-secondary">
          Công nhận cần có biên bản họp hội đồng xét tốt nghiệp (tab "Biên bản, tệp xuất").
        </p>
      ) : (
        <StatusBadge tone="success" label="Đã công nhận kết quả" />
      )}
      <table className="w-full text-content" aria-label="Kết quả xét tốt nghiệp">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-2 py-2">Học sinh</th>
            <th className="px-2 py-2">Điểm xét</th>
            <th className="px-2 py-2">Kết quả</th>
            <th className="px-2 py-2">Số giấy chứng nhận</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {view.candidates.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="px-2 py-2 font-medium">{row.full_name}</td>
              <td className="px-2 py-2">{row.decision?.score ?? ''}</td>
              <td className="px-2 py-2">
                {row.decision
                  ? `${GRADUATION_OUTCOME_LABELS[row.decision.outcome]}${row.decision.status === 'proposed' ? ' (đề xuất)' : ''}${
                      row.decision.note ? `: ${row.decision.note}` : ''
                    }`
                  : 'Chưa xét'}
              </td>
              <td className="px-2 py-2">{row.decision?.certificate_no ?? ''}</td>
              <td className="px-2 py-2 text-right">
                {row.decision?.status === 'confirmed' && row.decision.certificate_no ? (
                  <Button variant="text" onClick={() => certificate.mutate(row)}>
                    {`Giấy chứng nhận ${row.full_name}`}
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function MinutesTab({
  view,
  canManage,
  onSaved,
}: {
  view: GraduationView;
  canManage: boolean;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<GraduationMinutesKind>('council');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [note, setNote] = useState('');
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['graduation-view'] });
    onSaved(message);
  };
  const add = useMutation({
    mutationFn: () => addMinutes(view.session.id, { kind, title, content }),
    onSuccess: () => {
      setTitle('');
      setContent('');
      return refresh('Đã lập biên bản');
    },
  });
  const file = useMutation({
    mutationFn: (input: { path: string; name: string }) => downloadFile(input.path, input.name),
    onSuccess: () => refresh('Đã tạo tệp'),
  });
  const sent = useMutation({
    mutationFn: (id: string) => markSubmissionSent(id, note || null),
    onSuccess: () => refresh('Đã đánh dấu đã gửi'),
  });
  return (
    <section className="flex flex-col gap-4" aria-label="Biên bản, tệp xuất">
      {add.error ? <Alert tone="danger">{messageOf(add.error)}</Alert> : null}
      {file.error ? <Alert tone="danger">{messageOf(file.error)}</Alert> : null}
      {sent.error ? <Alert tone="danger">{messageOf(sent.error)}</Alert> : null}
      <ul className="flex flex-col gap-1 text-content" aria-label="Biên bản">
        {view.minutes.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            {GRADUATION_MINUTES_LABELS[item.kind]}: {item.title} ({item.created_by_name})
            <Button
              variant="text"
              onClick={() =>
                file.mutate({
                  path: `/api/v1/graduation/minutes/${item.id}/file`,
                  name: `bien-ban-${item.id.slice(0, 8)}.pdf`,
                })
              }
            >
              {`Tải biên bản ${item.title}`}
            </Button>
          </li>
        ))}
        {view.minutes.length === 0 ? <li className="text-text-secondary">Chưa có biên bản.</li> : null}
      </ul>
      {canManage ? (
        <form
          aria-label="Lập biên bản"
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate();
          }}
        >
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-label font-medium text-text">
              Loại biên bản
              <select
                aria-label="Loại biên bản"
                className={`mt-2 block ${SELECT_CLASS}`}
                value={kind}
                onChange={(event) => setKind(event.target.value as GraduationMinutesKind)}
              >
                {Object.entries(GRADUATION_MINUTES_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-label font-medium text-text">
              Tiêu đề
              <input
                className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
          </div>
          <label className="text-label font-medium text-text">
            Nội dung biên bản
            <textarea
              className={`mt-2 block min-h-24 w-full ${FORM_CONTROL_CLASS}`}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </label>
          <div>
            <Button type="submit" variant="primary" disabled={!title || !content || add.isPending}>
              Lập biên bản
            </Button>
          </div>
        </form>
      ) : null}
      <h3 className="text-content font-semibold">Tệp xuất theo bố cục chung</h3>
      {canManage ? (
        <div className="flex gap-2">
          {(Object.keys(GRADUATION_SUBMISSION_LABELS) as Array<'candidates' | 'results'>).map((kindKey) => (
            <Button
              key={kindKey}
              onClick={() =>
                file.mutate({
                  path: `/api/v1/graduation/sessions/${view.session.id}/export?kind=${kindKey}`,
                  name: `${kindKey}-${view.session.academic_year_name}.xlsx`,
                })
              }
            >
              {`Xuất ${GRADUATION_SUBMISSION_LABELS[kindKey].toLowerCase()}`}
            </Button>
          ))}
        </div>
      ) : null}
      <ul className="flex flex-col gap-1 text-content" aria-label="Tệp đã xuất">
        {view.submissions.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            {item.file_name} ({GRADUATION_SUBMISSION_LABELS[item.kind]}, {item.exported_by_name})
            {item.status === 'sent' ? (
              <StatusBadge tone="success" label={`Đã gửi${item.note ? `: ${item.note}` : ''}`} />
            ) : canManage ? (
              <>
                <input
                  aria-label="Ghi chú gửi"
                  className={FORM_CONTROL_CLASS}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <Button variant="text" onClick={() => sent.mutate(item.id)}>
                  {`Đánh dấu đã gửi ${item.file_name}`}
                </Button>
              </>
            ) : (
              <StatusBadge tone="neutral" label="Chưa gửi" />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function DossiersTab({
  view,
  canManage,
  onSaved,
}: {
  view: GraduationView;
  canManage: boolean;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [destination, setDestination] = useState('');
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['graduation-view'] });
    onSaved(message);
  };
  const prepare = useMutation({
    mutationFn: () => prepareDossiers(view.session.id, destination || null),
    onSuccess: (result) =>
      refresh(
        `Đã lập ${result.created} hồ sơ chuyển cấp${result.skipped.length > 0 ? `, bỏ qua ${result.skipped.length} học sinh chưa có học bạ đã kí` : ''}`,
      ),
  });
  const sent = useMutation({ mutationFn: markDossierSent, onSuccess: () => refresh('Đã đánh dấu hồ sơ đã gửi') });
  return (
    <section className="flex flex-col gap-3" aria-label="Hồ sơ chuyển cấp">
      {prepare.error ? <Alert tone="danger">{messageOf(prepare.error)}</Alert> : null}
      {sent.error ? <Alert tone="danger">{messageOf(sent.error)}</Alert> : null}
      <p className="text-label text-text-secondary">
        Lập cho học sinh đã được công nhận tốt nghiệp THCS và có học bạ năm học đã được Hiệu trưởng kí; kết nối tuyển
        sinh đầu cấp THPT làm ở bước sau.
      </p>
      {canManage ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-label font-medium text-text">
            Trường tiếp nhận
            <input
              className={`mt-2 block ${FORM_CONTROL_CLASS}`}
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            />
          </label>
          <Button variant="primary" disabled={prepare.isPending} onClick={() => prepare.mutate()}>
            Lập hồ sơ chuyển cấp
          </Button>
        </div>
      ) : null}
      <table className="w-full text-content" aria-label="Hồ sơ chuyển cấp THCS">
        <tbody>
          {view.dossiers.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="px-2 py-2 font-medium">{row.full_name}</td>
              <td className="px-2 py-2">{row.destination ?? ''}</td>
              <td className="px-2 py-2">
                {row.status === 'sent' ? (
                  <StatusBadge tone="success" label="Đã gửi" />
                ) : (
                  <StatusBadge tone="info" label="Đã lập" />
                )}
              </td>
              <td className="px-2 py-2 text-right">
                {canManage && row.status === 'prepared' ? (
                  <Button variant="text" onClick={() => sent.mutate(row.id)}>
                    {`Đánh dấu đã gửi hồ sơ ${row.full_name}`}
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ConfigTab({ level, onSaved }: { level: GraduationLevel; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: ['graduation-config', level], queryFn: () => readGraduationConfig(level) });
  const [draft, setDraft] = useState<GraduationConfig>();
  useEffect(() => setDraft(config.data?.config), [config.data]);
  const save = useMutation({
    mutationFn: () => saveGraduationConfig(level, draft as GraduationConfig),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['graduation-config'] });
      await queryClient.invalidateQueries({ queryKey: ['graduation-view'] });
      onSaved('Đã ghi cấu hình xét tốt nghiệp');
    },
  });
  if (!draft) {
    return null;
  }
  const num = (text: string) => Number(text.replace(',', '.'));
  const fields: Array<[string, string, number, (value: number) => GraduationConfig]> = [
    [
      'Hệ số bài thi',
      'weights-exam',
      draft.weights.exam,
      (value) => ({ ...draft, weights: { ...draft.weights, exam: value } }),
    ],
    [
      'Hệ số học bạ',
      'weights-school',
      draft.weights.school,
      (value) => ({ ...draft, weights: { ...draft.weights, school: value } }),
    ],
    ['Điểm đạt', 'pass', draft.pass_score, (value) => ({ ...draft, pass_score: value })],
    ['Điểm liệt (từ mức này trở xuống)', 'floor', draft.floor_score, (value) => ({ ...draft, floor_score: value })],
    ['Số bài thi tự chọn', 'electives', draft.elective_count, (value) => ({ ...draft, elective_count: value })],
    ['Điểm ưu tiên tối đa', 'priority', draft.max_priority, (value) => ({ ...draft, max_priority: value })],
    ['Điểm khuyến khích tối đa', 'incentive', draft.max_incentive, (value) => ({ ...draft, max_incentive: value })],
  ];
  return (
    <section className="flex flex-col gap-3" aria-label="Cấu hình xét tốt nghiệp">
      <p className="text-label text-text-secondary">
        Hệ số, điểm đạt, điểm liệt theo quy chế thi tốt nghiệp hiện hành; đối chiếu văn bản gốc và đổi theo năm khi quy
        chế đổi.
      </p>
      <div className="flex flex-wrap gap-4">
        {fields.map(([label, key, value, apply]) => (
          <label key={key} className="flex flex-col gap-2 text-label font-medium text-text">
            {label}
            <input
              aria-label={label}
              className={CELL_INPUT}
              value={value}
              onChange={(event) => setDraft(apply(num(event.target.value)))}
            />
          </label>
        ))}
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div>
        <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
          Ghi cấu hình
        </Button>
      </div>
    </section>
  );
}

function CreateSession({ level, onCreated }: { level: GraduationLevel; onCreated(id: string, message: string): void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [examDate, setExamDate] = useState('');
  const create = useMutation({
    mutationFn: () => createGraduationSession(level, name, examDate || null),
    onSuccess: async (session) => {
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['graduation-sessions'] });
      onCreated(session.id, `Đã tạo ${session.name}`);
    },
  });
  return (
    <form
      aria-label="Tạo kỳ xét tốt nghiệp"
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <label className="text-label font-medium text-text">
        Tên kỳ
        <input
          className={`mt-2 block ${FORM_CONTROL_CLASS}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {level === 'THPT' ? (
        <label className="text-label font-medium text-text">
          Ngày thi
          <input
            type="date"
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={examDate}
            onChange={(event) => setExamDate(event.target.value)}
          />
        </label>
      ) : null}
      <Button type="submit" variant="primary" disabled={!name || create.isPending}>
        Tạo kỳ
      </Button>
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
    </form>
  );
}

export function GraduationPage() {
  const canManage = useHasPermission(PERMISSION_CODES.studentRecordApprove);
  const enabled = useEnabledSchoolLevels();
  const levels = enabled.levels.filter(
    (item): item is { value: GraduationLevel; label: string } => item.value === 'THCS' || item.value === 'THPT',
  );
  const [chosenLevel, setChosenLevel] = useState<GraduationLevel>();
  const level: GraduationLevel = levels.find((item) => item.value === chosenLevel)?.value ?? levels[0]?.value ?? 'THPT';
  const [sessionId, setSessionId] = useState('');
  const [tab, setTab] = useState<Tab>('candidates');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const sessions = useQuery({
    queryKey: ['graduation-sessions', level],
    queryFn: () => listGraduationSessions(level),
    enabled: levels.length > 0,
  });
  const selectedId = (sessions.data ?? []).find((item) => item.id === sessionId)?.id ?? sessions.data?.[0]?.id ?? '';
  const view = useQuery({
    queryKey: ['graduation-view', selectedId],
    queryFn: () => readGraduationView(selectedId),
    enabled: selectedId !== '',
    retry: false,
  });
  const tabs = (Object.keys(TAB_LABELS) as Tab[]).filter((code) => {
    if (code === 'config') {
      return canManage;
    }
    if (code === 'dossiers') {
      return level === 'THCS';
    }
    if (code === 'rooms' || code === 'scores') {
      return level === 'THPT';
    }
    return true;
  });
  const activeTab = tabs.includes(tab) ? tab : 'candidates';
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/graduation')}</h1>
        {levels.length === 0 ? (
          <Alert tone="info">Trường chưa bật cấp THCS hoặc THPT; bật cấp học ở 1.4 Cấu hình trường.</Alert>
        ) : null}
        <div className="flex flex-wrap items-end gap-4">
          {levels.length > 1 ? (
            <label className="flex flex-col gap-2 text-label font-medium text-text">
              Cấp học
              <select
                aria-label="Cấp học"
                className={SELECT_CLASS}
                value={level}
                onChange={(event) => {
                  setChosenLevel(event.target.value as GraduationLevel);
                  setSessionId('');
                }}
              >
                {levels.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {(sessions.data ?? []).length > 0 ? (
            <label className="flex flex-col gap-2 text-label font-medium text-text">
              Kỳ
              <select
                aria-label="Kỳ"
                className={SELECT_CLASS}
                value={selectedId}
                onChange={(event) => setSessionId(event.target.value)}
              >
                {(sessions.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        {sessions.error ? <Alert tone="danger">{messageOf(sessions.error)}</Alert> : null}
        {canManage && levels.length > 0 ? (
          <CreateSession
            level={level}
            onCreated={(id, message) => {
              setSessionId(id);
              setToastMessage(message);
            }}
          />
        ) : null}
        {view.error ? <Alert tone="danger">{messageOf(view.error)}</Alert> : null}
        {view.data ? (
          <>
            <div role="tablist" className="flex flex-wrap gap-2">
              {tabs.map((code) => (
                <Button
                  key={code}
                  role="tab"
                  aria-selected={activeTab === code}
                  variant={activeTab === code ? 'primary' : 'secondary'}
                  onClick={() => setTab(code)}
                >
                  {TAB_LABELS[code]}
                </Button>
              ))}
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              {activeTab === 'candidates' ? (
                <CandidatesTab view={view.data} canManage={canManage} onSaved={setToastMessage} />
              ) : null}
              {activeTab === 'rooms' ? (
                <RoomsTab view={view.data} canManage={canManage} onSaved={setToastMessage} />
              ) : null}
              {activeTab === 'scores' ? (
                <ScoresTab view={view.data} canManage={canManage} onSaved={setToastMessage} />
              ) : null}
              {activeTab === 'results' ? (
                <ResultsTab view={view.data} canManage={canManage} onSaved={setToastMessage} />
              ) : null}
              {activeTab === 'minutes' ? (
                <MinutesTab view={view.data} canManage={canManage} onSaved={setToastMessage} />
              ) : null}
              {activeTab === 'dossiers' ? (
                <DossiersTab view={view.data} canManage={canManage} onSaved={setToastMessage} />
              ) : null}
              {activeTab === 'config' ? <ConfigTab level={level} onSaved={setToastMessage} /> : null}
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
