import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TIMETABLE_WEEKDAY_LABELS, type SchoolLevelCode } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError, requestJson } from '../session/api-client.js';
import { useEnabledSchoolLevels } from '../school-levels/enabled-levels.js';
import {
  applyVariant,
  cancelGeneration,
  listGenerationRuns,
  readGenerationRun,
  readGeneratorSettings,
  readPrecheck,
  readSubjectRules,
  readTeacherBusy,
  readVariant,
  saveGeneratorSettings,
  saveSubjectRules,
  saveTeacherBusy,
  startGeneration,
  type GenerationRun,
  type GeneratorSettings,
  type SubjectRule,
} from './timetable-generator-api.js';
import { ReadOnlyGrid } from './TimetablesPage.js';

// 7.5 Xếp thời khoá biểu tự động (DT-20 phần 22c2, YCTD-164): mức quan trọng của ràng buộc, quy tắc xếp của môn, tiết giáo
// viên báo bận; kiểm tra dữ liệu trước khi xếp; chạy máy xếp ở tiến trình chạy nền có giới hạn thời gian, theo dõi tiến độ;
// so các phương án (điểm phạt theo ràng buộc, vi phạm bắt buộc), xem trước theo lớp; chọn phương án thành bản nháp ở 7.4 để
// sửa tay, kiểm tra xung đột, ban hành
const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

const STATUS_LABELS: Record<GenerationRun['status'], string> = {
  queued: 'Đang chờ',
  running: 'Đang xếp',
  completed: 'Đã xong',
  failed: 'Lỗi',
  cancelled: 'Đã huỷ',
};

const WEIGHTS = Array.from({ length: 11 }, (_, index) => index);

function WeightsSection({ level, onSaved }: { level: SchoolLevelCode; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['generator-settings', level], queryFn: () => readGeneratorSettings(level) });
  const [draft, setDraft] = useState<Pick<GeneratorSettings, 'weights' | 'time_limit_seconds' | 'variant_count'>>();
  useEffect(() => {
    if (settings.data) {
      setDraft({
        weights: settings.data.weights,
        time_limit_seconds: settings.data.time_limit_seconds,
        variant_count: settings.data.variant_count,
      });
    }
  }, [settings.data]);
  const save = useMutation({
    mutationFn: () => saveGeneratorSettings(level, draft as NonNullable<typeof draft>),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['generator-settings'] });
      onSaved('Đã lưu mức quan trọng của ràng buộc');
    },
  });
  if (!settings.data || !draft) {
    return null;
  }
  return (
    <section className="flex flex-col gap-3" aria-label="Ràng buộc">
      <h2 className="text-section-title font-semibold text-text">Ràng buộc và mức quan trọng</h2>
      <p className="text-label text-text-secondary">
        Ràng buộc bắt buộc luôn được giữ: {settings.data.hard_constraints.map((item) => item.label).join('; ')}. Ràng
        buộc mềm có mức 0 (tắt) đến 10 (quan trọng nhất).
      </p>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {settings.data.soft_constraints.map((item) => (
          <label key={item.code} className="text-label font-medium text-text">
            {item.label}
            <select
              aria-label={`Mức quan trọng: ${item.label}`}
              className={`mt-2 block ${FORM_CONTROL_CLASS}`}
              value={draft.weights[item.code]}
              onChange={(event) =>
                setDraft({ ...draft, weights: { ...draft.weights, [item.code]: Number(event.target.value) } })
              }
            >
              {WEIGHTS.map((weight) => (
                <option key={weight} value={weight}>
                  {weight === 0 ? '0 (tắt)' : weight}
                  {weight === item.default_weight ? ' (mặc định)' : ''}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="text-label font-medium text-text">
          Giới hạn thời gian (giây)
          <input
            type="number"
            min={5}
            max={600}
            aria-label="Giới hạn thời gian (giây)"
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={draft.time_limit_seconds}
            onChange={(event) => setDraft({ ...draft, time_limit_seconds: Number(event.target.value) })}
          />
        </label>
        <label className="text-label font-medium text-text">
          Số phương án
          <select
            aria-label="Số phương án"
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={draft.variant_count}
            onChange={(event) => setDraft({ ...draft, variant_count: Number(event.target.value) })}
          >
            {[1, 2, 3, 4, 5].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          Lưu ràng buộc
        </Button>
      </div>
    </section>
  );
}

function SubjectRulesSection({ level, onSaved }: { level: SchoolLevelCode; onSaved(message: string): void }) {
  const rules = useQuery({ queryKey: ['subject-rules', level], queryFn: () => readSubjectRules(level) });
  const [draft, setDraft] = useState<SubjectRule[]>([]);
  useEffect(() => {
    setDraft(rules.data?.subjects ?? []);
  }, [rules.data]);
  const save = useMutation({
    mutationFn: () => saveSubjectRules(level, draft),
    onSuccess: () => onSaved('Đã lưu quy tắc xếp của môn'),
  });
  const update = (subjectId: string, changes: Partial<SubjectRule>) =>
    setDraft((current) => current.map((rule) => (rule.subject_id === subjectId ? { ...rule, ...changes } : rule)));
  return (
    <section className="flex flex-col gap-3" aria-label="Quy tắc xếp của môn">
      <h2 className="text-section-title font-semibold text-text">Quy tắc xếp của môn</h2>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div className="overflow-x-auto">
        <table className="w-full text-content" aria-label="Quy tắc của môn">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-2">Môn</th>
              <th className="px-3 py-2">Tiết đôi</th>
              <th className="px-3 py-2">Tránh tiết cuối buổi</th>
              <th className="px-3 py-2">Tối đa tiết/ngày</th>
              <th className="px-3 py-2">Phòng riêng</th>
            </tr>
          </thead>
          <tbody>
            {draft.map((rule) => (
              <tr key={rule.subject_id} className="border-t border-border">
                <td className="px-3 py-2">{rule.subject_name}</td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Tiết đôi: ${rule.subject_name}`}
                    checked={rule.double_period}
                    onChange={(event) => update(rule.subject_id, { double_period: event.target.checked })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Tránh tiết cuối: ${rule.subject_name}`}
                    checked={rule.avoid_last_period}
                    onChange={(event) => update(rule.subject_id, { avoid_last_period: event.target.checked })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    aria-label={`Tối đa tiết/ngày: ${rule.subject_name}`}
                    className={`w-20 ${FORM_CONTROL_CLASS}`}
                    value={rule.max_per_day ?? ''}
                    onChange={(event) =>
                      update(rule.subject_id, { max_per_day: event.target.value ? Number(event.target.value) : null })
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    aria-label={`Phòng riêng: ${rule.subject_name}`}
                    className={FORM_CONTROL_CLASS}
                    value={rule.room_id ?? ''}
                    onChange={(event) => update(rule.subject_id, { room_id: event.target.value || null })}
                  >
                    <option value="">Không</option>
                    {(rules.data?.rooms ?? []).map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <Button disabled={save.isPending || draft.length === 0} onClick={() => save.mutate()}>
          Lưu quy tắc của môn
        </Button>
      </div>
    </section>
  );
}

function TeacherBusySection({ level, onSaved }: { level: SchoolLevelCode; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const busy = useQuery({ queryKey: ['teacher-busy', level], queryFn: () => readTeacherBusy(level) });
  const [teacherId, setTeacherId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const teacher = busy.data?.teachers.find((item) => item.teacher_user_id === teacherId);
  useEffect(() => {
    setSelected(new Set((teacher?.busy ?? []).map((slot) => `${slot.weekday}:${slot.period_no}`)));
  }, [teacher]);
  const save = useMutation({
    mutationFn: () =>
      saveTeacherBusy(
        teacherId,
        [...selected].map((key) => {
          const [weekday, period] = key.split(':').map(Number);
          return { weekday: weekday ?? 1, period_no: period ?? 1 };
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teacher-busy'] });
      onSaved('Đã lưu tiết giáo viên báo bận');
    },
  });
  const days = busy.data?.school_days ?? [];
  return (
    <section className="flex flex-col gap-3" aria-label="Giáo viên báo bận">
      <h2 className="text-section-title font-semibold text-text">Tiết giáo viên báo bận</h2>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <label className="text-label font-medium text-text">
        Giáo viên
        <select
          aria-label="Giáo viên báo bận"
          className={`mt-2 block ${FORM_CONTROL_CLASS}`}
          value={teacherId}
          onChange={(event) => setTeacherId(event.target.value)}
        >
          <option value="">Chọn giáo viên</option>
          {(busy.data?.teachers ?? []).map((item) => (
            <option key={item.teacher_user_id} value={item.teacher_user_id}>
              {item.teacher_name}
              {item.busy.length > 0 ? ` (bận ${item.busy.length} tiết)` : ''}
            </option>
          ))}
        </select>
      </label>
      {teacher ? (
        <>
          <table className="text-content" aria-label="Lưới tiết bận">
            <thead className="text-left text-label font-medium text-text-secondary">
              <tr>
                <th className="px-3 py-2">Tiết</th>
                {days.map((day) => (
                  <th key={day} className="px-3 py-2">
                    {TIMETABLE_WEEKDAY_LABELS[day]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(busy.data?.slots ?? []).map((slot) => (
                <tr key={slot.period_no} className="border-t border-border">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    Tiết {slot.period_no}
                  </th>
                  {days.map((day) => {
                    const key = `${day}:${slot.period_no}`;
                    return (
                      <td key={day} className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Bận ${TIMETABLE_WEEKDAY_LABELS[day]} tiết ${slot.period_no}`}
                          checked={selected.has(key)}
                          onChange={(event) =>
                            setSelected((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(key);
                              else next.delete(key);
                              return next;
                            })
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              Lưu tiết bận
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}

function VariantApply({
  runId,
  variantNo,
  onApplied,
}: {
  runId: string;
  variantNo: number;
  onApplied(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(`Phương án ${variantNo}`);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const apply = useMutation({
    mutationFn: () => applyVariant(runId, variantNo, { name, effective_from: effectiveFrom }),
    onSuccess: async (version) => {
      await queryClient.invalidateQueries({ queryKey: ['generation-run', runId] });
      await queryClient.invalidateQueries({ queryKey: ['timetable-versions'] });
      onApplied(`Đã tạo bản nháp ${version.name}; mở 7.4 Thời khoá biểu để sửa và ban hành`);
    },
  });
  return (
    <div className="flex flex-wrap items-end gap-2">
      {apply.error ? <Alert tone="danger">{messageOf(apply.error)}</Alert> : null}
      <label className="text-label font-medium text-text">
        Tên bản nháp
        <input
          aria-label={`Tên bản nháp phương án ${variantNo}`}
          className={`mt-2 block ${FORM_CONTROL_CLASS}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="text-label font-medium text-text">
        Áp dụng từ
        <input
          type="date"
          aria-label={`Áp dụng từ phương án ${variantNo}`}
          className={`mt-2 block ${FORM_CONTROL_CLASS}`}
          value={effectiveFrom}
          onChange={(event) => setEffectiveFrom(event.target.value)}
        />
      </label>
      <Button
        variant="primary"
        disabled={!name.trim() || !effectiveFrom || apply.isPending}
        onClick={() => apply.mutate()}
      >
        Tạo bản nháp từ phương án {variantNo}
      </Button>
    </div>
  );
}

function RunDetail({ runId, onMessage }: { runId: string; onMessage(message: string): void }) {
  const queryClient = useQueryClient();
  const run = useQuery({
    queryKey: ['generation-run', runId],
    queryFn: () => readGenerationRun(runId),
    refetchInterval: (query) =>
      query.state.data && (query.state.data.status === 'queued' || query.state.data.status === 'running')
        ? 1000
        : false,
  });
  const cancel = useMutation({
    mutationFn: () => cancelGeneration(runId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['generation-run', runId] });
      onMessage('Đã gửi yêu cầu huỷ');
    },
  });
  const [preview, setPreview] = useState<number>();
  const [classId, setClassId] = useState('');
  const variant = useQuery({
    queryKey: ['generation-variant', runId, preview],
    queryFn: () => readVariant(runId, preview ?? 1),
    enabled: preview !== undefined,
  });
  useEffect(() => {
    if (run.data && run.data.status !== 'queued' && run.data.status !== 'running') {
      void queryClient.invalidateQueries({ queryKey: ['generation-runs'] });
    }
  }, [run.data, queryClient]);
  const data = run.data;
  if (!data) {
    return null;
  }
  const classes = [...new Map((variant.data?.lessons ?? []).map((lesson) => [lesson.class_id, lesson.class_name]))];
  const active = data.status === 'queued' || data.status === 'running';
  return (
    <section className="flex flex-col gap-3" aria-label="Lần xếp">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge
          tone={data.status === 'completed' ? 'success' : data.status === 'failed' ? 'danger' : 'neutral'}
          label={STATUS_LABELS[data.status]}
        />
        {active ? (
          <>
            <progress max={100} value={data.percent} aria-label="Tiến độ xếp" className="w-48" />
            <span className="text-label text-text-secondary">{data.percent}%</span>
            <Button variant="text" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
              Huỷ lần xếp
            </Button>
          </>
        ) : null}
      </div>
      {data.message ? <Alert tone={data.status === 'failed' ? 'danger' : 'info'}>{data.message}</Alert> : null}
      {data.issues.length > 0 ? (
        <ul className="flex flex-col gap-1 text-content" aria-label="Vấn đề của dữ liệu">
          {data.issues.map((issue, index) => (
            <li key={index} className={issue.severity === 'hard' ? 'text-danger' : 'text-text-secondary'}>
              {issue.severity === 'hard' ? 'Không thể xếp đủ: ' : 'Lưu ý: '}
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
      {data.variants.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-content" aria-label="Các phương án">
            <thead className="text-left text-label font-medium text-text-secondary">
              <tr>
                <th className="px-3 py-2">Phương án</th>
                <th className="px-3 py-2">Điểm phạt</th>
                <th className="px-3 py-2">Vi phạm bắt buộc</th>
                <th className="px-3 py-2">Ràng buộc mềm (điểm phạt × mức)</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.variants.map((item) => (
                <tr key={item.variant_no} className="border-t border-border align-top">
                  <td className="px-3 py-2">Phương án {item.variant_no}</td>
                  <td className="px-3 py-2">{item.score}</td>
                  <td className="px-3 py-2">
                    {item.hard_count === 0 ? (
                      <StatusBadge tone="success" label="Không" />
                    ) : (
                      <details>
                        <summary className="text-danger">{item.hard_count} vi phạm</summary>
                        <ul className="text-label">
                          {item.violations.map((violation, index) => (
                            <li key={index}>{violation.message}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                  <td className="px-3 py-2 text-label">
                    {item.soft
                      .filter((soft) => soft.penalty > 0)
                      .map((soft) => `${soft.label}: ${soft.penalty} × ${soft.weight}`)
                      .join('; ') || 'Không'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="text" onClick={() => setPreview(item.variant_no)}>
                      Xem
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {preview !== undefined ? (
        <section className="flex flex-col gap-3" aria-label={`Xem phương án ${preview}`}>
          <h3 className="font-semibold text-text">Phương án {preview}</h3>
          {data.variants.find((item) => item.variant_no === preview)?.version_name ? (
            <Alert tone="info">
              Đã tạo bản nháp {data.variants.find((item) => item.variant_no === preview)?.version_name} từ phương án này
            </Alert>
          ) : null}
          <VariantApply runId={runId} variantNo={preview} onApplied={onMessage} />
          <label className="text-label font-medium text-text">
            Lớp
            <select
              aria-label="Lớp xem trước"
              className={`mt-2 block ${FORM_CONTROL_CLASS}`}
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
            >
              <option value="">Chọn lớp</option>
              {classes.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {classId && variant.data ? (
            <ReadOnlyGrid
              slots={variant.data.slots}
              lessons={variant.data.lessons.filter((lesson) => lesson.class_id === classId)}
              mode="class"
            />
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

export function TimetableGeneratorPage() {
  const enabled = useEnabledSchoolLevels();
  const levels = enabled.levels.filter((level) => level.value !== 'MN');
  const [chosenLevel, setChosenLevel] = useState<SchoolLevelCode>();
  const level = levels.find((item) => item.value === chosenLevel)?.value ?? levels[0]?.value;
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const precheck = useQuery({
    queryKey: ['generator-precheck', level],
    queryFn: () => readPrecheck(level ?? 'TH'),
    enabled: Boolean(level),
  });
  const runs = useQuery({
    queryKey: ['generation-runs', level],
    queryFn: () => listGenerationRuns(level ?? 'TH'),
    enabled: Boolean(level),
  });
  const [runId, setRunId] = useState('');
  const shownRun = runId || runs.data?.[0]?.id || '';
  const start = useMutation({
    mutationFn: () => startGeneration(level ?? 'TH'),
    onSuccess: async (run) => {
      setRunId(run.id);
      await queryClient.invalidateQueries({ queryKey: ['generation-runs'] });
    },
  });
  // Đổi cấp thì bỏ lần xếp đang xem
  useEffect(() => setRunId(''), [level]);

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/timetable-generator')}</h1>
        {!level ? (
          <Alert tone="info">Trường chưa bật cấp Tiểu học, THCS hoặc THPT; bật cấp học ở 1.4 Cấu hình trường.</Alert>
        ) : (
          <>
            {levels.length > 1 ? (
              <label className="text-label font-medium text-text">
                Cấp học
                <select
                  aria-label="Cấp học"
                  className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                  value={level}
                  onChange={(event) => setChosenLevel(event.target.value as SchoolLevelCode)}
                >
                  {levels.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <section className="flex flex-col gap-3" aria-label="Xếp tự động">
              <h2 className="text-section-title font-semibold text-text">Xếp tự động</h2>
              {precheck.data ? (
                <p className="text-content text-text">
                  {precheck.data.classes} lớp, {precheck.data.teachers} giáo viên, {precheck.data.lessons} tiết mỗi tuần
                  cần xếp vào {precheck.data.slots} ô của khung giờ.
                </p>
              ) : null}
              {(precheck.data?.issues ?? []).map((issue, index) => (
                <Alert key={index} tone={issue.severity === 'hard' ? 'danger' : 'warning'}>
                  {issue.message}
                </Alert>
              ))}
              {start.error ? <Alert tone="danger">{messageOf(start.error)}</Alert> : null}
              <div className="flex flex-wrap items-end gap-2">
                <Button
                  variant="primary"
                  disabled={start.isPending || !precheck.data || precheck.data.lessons === 0}
                  onClick={() => start.mutate()}
                >
                  Xếp thời khoá biểu
                </Button>
                {(runs.data ?? []).length > 1 ? (
                  <label className="text-label font-medium text-text">
                    Lần xếp
                    <select
                      aria-label="Lần xếp"
                      className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                      value={shownRun}
                      onChange={(event) => setRunId(event.target.value)}
                    >
                      {(runs.data ?? []).map((run) => (
                        <option key={run.id} value={run.id}>
                          {new Date(run.created_at).toLocaleString('vi-VN')} · {STATUS_LABELS[run.status]}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              {shownRun ? <RunDetail key={shownRun} runId={shownRun} onMessage={setToastMessage} /> : null}
            </section>
            <WeightsSection level={level} onSaved={setToastMessage} />
            <SubjectRulesSection level={level} onSaved={setToastMessage} />
            <TeacherBusySection
              level={level}
              onSaved={async (message) => {
                setToastMessage(message);
                await queryClient.invalidateQueries({ queryKey: ['generator-precheck'] });
              }}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}

// Lớp đang hoạt động của một cấp, dùng ở 7.6, 7.7
export const listLevelClasses = (level: SchoolLevelCode): Promise<Array<{ id: string; name: string }>> =>
  requestJson(`/api/v1/classes?school_level=${level}&status=active`);
