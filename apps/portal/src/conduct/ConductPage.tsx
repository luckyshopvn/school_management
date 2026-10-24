import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES, type SchoolLevelCode } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClassChildren } from '../child-groups/child-groups-api.js';
import { listClasses } from '../classes/classes-api.js';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useEnabledSchoolLevels } from '../school-levels/enabled-levels.js';
import { useHasPermission } from '../session/permissions.js';
import {
  createConductCriterion,
  deleteConductEntry,
  listConductCriteria,
  listConductEntries,
  listRedStars,
  loadDefaultCriteria,
  messageOf,
  PERIOD_LABELS,
  readConductRanking,
  readConductSettings,
  recordConductEntry,
  saveRedStar,
  updateConductCriterion,
  vietnamToday,
  weekOf,
  type ConductKind,
  type ConductPeriod,
} from './conduct-api.js';

// Nề nếp, thi đua lớp Tiểu học (DT-20 phần 20b, YCTD-159), tuỳ trường bật ở 1.4 Cấu hình trường. Ba thẻ: ghi điểm theo lớp
// và ngày (giáo viên trực ghi, ghi thay đội cờ đỏ ở ô "Người báo"), xếp hạng lớp theo tuần, tháng, học kỳ, và bộ tiêu chí
// cộng, trừ điểm của trường. THCS, THPT (DT-21 phần 21d, YCTD-171): chọn cấp khi trường có nhiều cấp; thẻ Đội sao đỏ (học
// sinh không có tài khoản); ghi điểm chọn sao đỏ báo; xếp hạng có cột điểm theo xếp loại tiết ở sổ đầu bài nếu cấp bật
type Tab = 'entries' | 'ranking' | 'criteria' | 'red-stars';
const TAB_LABELS: Record<Tab, string> = {
  entries: 'Ghi điểm',
  ranking: 'Xếp hạng',
  criteria: 'Tiêu chí',
  'red-stars': 'Đội sao đỏ',
};
const isSecondary = (level: SchoolLevelCode) => level === 'THCS' || level === 'THPT';
const SELECT_CLASS = 'rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';

function EntriesTab({
  level,
  orgUnitId,
  onSaved,
}: {
  level: SchoolLevelCode;
  orgUnitId: string | undefined;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(vietnamToday());
  const [criterionId, setCriterionId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reportedBy, setReportedBy] = useState('');
  const [reporterChildId, setReporterChildId] = useState('');
  const [note, setNote] = useState('');
  const classes = useQuery({
    queryKey: ['classes', orgUnitId],
    queryFn: () => listClasses(orgUnitId ?? ''),
    enabled: orgUnitId !== undefined,
  });
  const levelClasses = (classes.data ?? []).filter((item) => item.status === 'active' && item.school_level === level);
  const selectedClassId = levelClasses.some((item) => item.id === classId) ? classId : levelClasses[0]?.id || '';
  const criteria = useQuery({ queryKey: ['conduct-criteria', level], queryFn: () => listConductCriteria(level) });
  const redStars = useQuery({
    queryKey: ['red-stars', level],
    queryFn: () => listRedStars(level),
    enabled: isSecondary(level),
  });
  // Sao đỏ không chấm lớp mình nên chỉ hiện sao đỏ của lớp khác
  const reporters = (redStars.data ?? []).filter(
    (member) => member.status === 'active' && member.class_id !== selectedClassId,
  );
  const activeCriteria = (criteria.data ?? []).filter((item) => item.status === 'active');
  const selectedCriterionId = criterionId || activeCriteria[0]?.id || '';
  const week = weekOf(date || vietnamToday());
  const entriesKey = ['conduct-entries', selectedClassId, week.from];
  const entries = useQuery({
    queryKey: entriesKey,
    queryFn: () => listConductEntries({ ...week, class_id: selectedClassId }),
    enabled: selectedClassId !== '',
  });
  const record = useMutation({
    mutationFn: () =>
      recordConductEntry({
        class_id: selectedClassId,
        criterion_id: selectedCriterionId,
        date,
        quantity: Number(quantity),
        note: note || null,
        reported_by: reportedBy || null,
        reporter_child_id: reporterChildId || null,
      }),
    onSuccess: async () => {
      setNote('');
      await queryClient.invalidateQueries({ queryKey: entriesKey });
      onSaved('Đã ghi điểm nề nếp');
    },
  });
  const remove = useMutation({
    mutationFn: deleteConductEntry,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: entriesKey });
      onSaved('Đã xóa dòng nề nếp');
    },
  });
  const total = (entries.data ?? []).reduce((sum, entry) => sum + entry.points, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Lớp
          <select value={selectedClassId} onChange={(event) => setClassId(event.target.value)} className={SELECT_CLASS}>
            {levelClasses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <TextField label="Ngày" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Tiêu chí
          <select
            value={selectedCriterionId}
            onChange={(event) => setCriterionId(event.target.value)}
            className={SELECT_CLASS}
          >
            {activeCriteria.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.kind === 'plus' ? '+' : '-'}
                {item.points})
              </option>
            ))}
          </select>
        </label>
        <TextField
          label="Số lần"
          inputMode="numeric"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
        {isSecondary(level) ? (
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Sao đỏ báo
            <select
              value={reporterChildId}
              onChange={(event) => setReporterChildId(event.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Giáo viên trực tự ghi</option>
              {reporters.map((member) => (
                <option key={member.child_id} value={member.child_id}>
                  {member.full_name} ({member.class_name ?? ''})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <TextField
            label="Người báo (đội cờ đỏ)"
            value={reportedBy}
            onChange={(event) => setReportedBy(event.target.value)}
          />
        )}
        <TextField label="Ghi chú" value={note} onChange={(event) => setNote(event.target.value)} />
        <Button
          variant="primary"
          disabled={record.isPending || selectedClassId === '' || selectedCriterionId === ''}
          onClick={() => record.mutate()}
        >
          Ghi điểm
        </Button>
      </div>
      {activeCriteria.length === 0 && criteria.data ? (
        <Alert tone="info">Chưa có tiêu chí. Khai báo ở thẻ Tiêu chí.</Alert>
      ) : null}
      {record.error ? <Alert tone="danger">{messageOf(record.error)}</Alert> : null}
      {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      <p className="text-content text-text-secondary">
        Tuần {week.from.split('-').reverse().join('/')} đến {week.to.split('-').reverse().join('/')}: tổng{' '}
        {total > 0 ? `+${total}` : total} điểm
      </p>
      <table className="w-full text-content" aria-label="Điểm nề nếp trong tuần">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-3 py-2">Ngày</th>
            <th className="px-3 py-2">Tiêu chí</th>
            <th className="px-3 py-2">Điểm</th>
            <th className="px-3 py-2">Người báo, ghi chú</th>
            <th className="px-3 py-2">Người ghi</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {(entries.data ?? []).map((entry) => (
            <tr key={entry.id} className="border-t border-border">
              <td className="px-3 py-2">{entry.entry_date.split('-').reverse().join('/')}</td>
              <td className="px-3 py-2">
                {entry.criterion_name}
                {entry.quantity > 1 ? ` × ${entry.quantity}` : ''}
              </td>
              <td className="px-3 py-2">{entry.points > 0 ? `+${entry.points}` : entry.points}</td>
              <td className="px-3 py-2">
                {[entry.reporter_name ? `Sao đỏ ${entry.reporter_name}` : null, entry.reported_by, entry.note]
                  .filter(Boolean)
                  .join(' · ')}
              </td>
              <td className="px-3 py-2">{entry.recorded_by_name}</td>
              <td className="px-3 py-2">
                <Button
                  aria-label={`Xóa ${entry.criterion_name} ngày ${entry.entry_date}`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(entry.id)}
                >
                  Xóa
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RankingTab({ level, orgUnitId }: { level: SchoolLevelCode; orgUnitId: string | undefined }) {
  const [period, setPeriod] = useState<ConductPeriod>('week');
  const [date, setDate] = useState(vietnamToday());
  const ranking = useQuery({
    queryKey: ['conduct-ranking', level, orgUnitId, period, date],
    queryFn: () => readConductRanking({ period, date, org_unit_id: orgUnitId, school_level: level }),
    enabled: date !== '',
    retry: false,
  });
  const data = ranking.data;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Kỳ
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as ConductPeriod)}
            className={SELECT_CLASS}
          >
            {(Object.keys(PERIOD_LABELS) as ConductPeriod[]).map((code) => (
              <option key={code} value={code}>
                {PERIOD_LABELS[code]}
              </option>
            ))}
          </select>
        </label>
        <TextField label="Ngày trong kỳ" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>
      {ranking.error ? <Alert tone="warning">{messageOf(ranking.error)}</Alert> : null}
      {data ? (
        <>
          <p className="text-content text-text-secondary">
            Từ {data.from.split('-').reverse().join('/')} đến {data.to.split('-').reverse().join('/')} ({data.weeks}{' '}
            tuần), điểm nền {data.base_points} mỗi tuần
            {data.weeks > 1 ? '; điểm là trung bình các tuần' : ''}
            {data.lesson_points
              ? `; điểm tiết theo xếp loại ở sổ đầu bài: A ${data.lesson_points.A}, B ${data.lesson_points.B}, C ${data.lesson_points.C}, D ${data.lesson_points.D}`
              : ''}
          </p>
          <table className="w-full text-content" aria-label="Xếp hạng thi đua lớp">
            <thead className="text-left text-label font-medium text-text-secondary">
              <tr>
                <th className="px-3 py-2">Hạng</th>
                <th className="px-3 py-2">Lớp</th>
                <th className="px-3 py-2">Điểm cộng</th>
                <th className="px-3 py-2">Điểm trừ</th>
                {data.lesson_points ? <th className="px-3 py-2">Điểm tiết</th> : null}
                <th className="px-3 py-2">Điểm</th>
              </tr>
            </thead>
            <tbody>
              {data.classes.map((row) => (
                <tr key={row.class_id} className="border-t border-border">
                  <td className="px-3 py-2 font-semibold">{row.rank}</td>
                  <td className="px-3 py-2">{row.class_name}</td>
                  <td className="px-3 py-2">{row.plus_points}</td>
                  <td className="px-3 py-2">{row.minus_points}</td>
                  {data.lesson_points ? <td className="px-3 py-2">{row.lesson_points}</td> : null}
                  <td className="px-3 py-2 font-semibold">{row.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
}

function CriteriaTab({
  level,
  canManage,
  onSaved,
}: {
  level: SchoolLevelCode;
  canManage: boolean;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const criteria = useQuery({ queryKey: ['conduct-criteria', level], queryFn: () => listConductCriteria(level) });
  const [draft, setDraft] = useState({ code: '', name: '', kind: 'minus' as ConductKind, points: '1' });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['conduct-criteria'] });
    onSaved(message);
  };
  const create = useMutation({
    mutationFn: () => createConductCriterion(level, { ...draft, points: Number(draft.points) }),
    onSuccess: async () => {
      setDraft({ code: '', name: '', kind: 'minus', points: '1' });
      await refresh('Đã thêm tiêu chí');
    },
  });
  const defaults = useMutation({
    mutationFn: () => loadDefaultCriteria(level),
    onSuccess: (result) => refresh(`Đã nạp ${result.created.length} tiêu chí mặc định`),
  });
  const toggle = useMutation({
    mutationFn: (input: { id: string; status: 'active' | 'inactive' }) =>
      updateConductCriterion(input.id, { status: input.status }),
    onSuccess: () => refresh('Đã cập nhật tiêu chí'),
  });
  const error = create.error ?? defaults.error ?? toggle.error;
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {canManage ? (
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            label="Mã tiêu chí"
            value={draft.code}
            onChange={(event) => setDraft({ ...draft, code: event.target.value })}
          />
          <TextField
            label="Tên tiêu chí"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Loại
            <select
              value={draft.kind}
              onChange={(event) => setDraft({ ...draft, kind: event.target.value as ConductKind })}
              className={SELECT_CLASS}
            >
              <option value="plus">Cộng điểm</option>
              <option value="minus">Trừ điểm</option>
            </select>
          </label>
          <TextField
            label="Số điểm mỗi lần"
            inputMode="numeric"
            value={draft.points}
            onChange={(event) => setDraft({ ...draft, points: event.target.value })}
          />
          <Button variant="primary" disabled={create.isPending} onClick={() => create.mutate()}>
            Thêm tiêu chí
          </Button>
          <Button disabled={defaults.isPending} onClick={() => defaults.mutate()}>
            Nạp bộ tiêu chí mặc định
          </Button>
        </div>
      ) : null}
      <table className="w-full text-content" aria-label="Tiêu chí nề nếp">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-3 py-2">Mã</th>
            <th className="px-3 py-2">Tiêu chí</th>
            <th className="px-3 py-2">Điểm</th>
            <th className="px-3 py-2">Trạng thái</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {(criteria.data ?? []).map((item) => (
            <tr key={item.id} className="border-t border-border">
              <td className="px-3 py-2">{item.code}</td>
              <td className="px-3 py-2">{item.name}</td>
              <td className="px-3 py-2">
                {item.kind === 'plus' ? '+' : '-'}
                {item.points}
              </td>
              <td className="px-3 py-2">{item.status === 'active' ? 'Đang dùng' : 'Ngừng dùng'}</td>
              <td className="px-3 py-2">
                {canManage ? (
                  <Button
                    disabled={toggle.isPending}
                    onClick={() =>
                      toggle.mutate({ id: item.id, status: item.status === 'active' ? 'inactive' : 'active' })
                    }
                  >
                    {item.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Đội sao đỏ của cấp: thêm học sinh của lớp, ghi nhiệm vụ; ngừng hoặc cho hoạt động lại
function RedStarsTab({
  level,
  orgUnitId,
  canManage,
  onSaved,
}: {
  level: SchoolLevelCode;
  orgUnitId: string | undefined;
  canManage: boolean;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState('');
  const [childId, setChildId] = useState('');
  const [duty, setDuty] = useState('');
  const members = useQuery({ queryKey: ['red-stars', level], queryFn: () => listRedStars(level) });
  const classes = useQuery({
    queryKey: ['classes', orgUnitId],
    queryFn: () => listClasses(orgUnitId ?? ''),
    enabled: orgUnitId !== undefined,
  });
  const levelClasses = (classes.data ?? []).filter((item) => item.status === 'active' && item.school_level === level);
  const students = useQuery({
    queryKey: ['class-children', orgUnitId, classId],
    queryFn: () => listClassChildren(orgUnitId ?? '', classId),
    enabled: Boolean(orgUnitId && classId),
  });
  const save = useMutation({
    mutationFn: (input: { childId: string; duty?: string | null; status?: 'active' | 'inactive' }) =>
      saveRedStar(input.childId, { duty: input.duty, status: input.status }),
    onSuccess: async () => {
      setChildId('');
      setDuty('');
      await queryClient.invalidateQueries({ queryKey: ['red-stars'] });
      onSaved('Đã cập nhật đội sao đỏ');
    },
  });
  return (
    <div className="flex flex-col gap-4">
      <p className="text-content text-text-secondary">
        Sao đỏ là học sinh, không có tài khoản: giáo viên trực ghi điểm thay và chọn sao đỏ báo; sao đỏ không chấm lớp
        mình.
      </p>
      {canManage ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Lớp của học sinh
            <select value={classId} onChange={(event) => setClassId(event.target.value)} className={SELECT_CLASS}>
              <option value="">Chọn lớp</option>
              {levelClasses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Học sinh
            <select value={childId} onChange={(event) => setChildId(event.target.value)} className={SELECT_CLASS}>
              <option value="">Chọn học sinh</option>
              {(students.data ?? []).map((student) => (
                <option key={student.id} value={student.id}>
                  {student.full_name}
                </option>
              ))}
            </select>
          </label>
          <TextField label="Nhiệm vụ" value={duty} onChange={(event) => setDuty(event.target.value)} />
          <Button
            variant="primary"
            disabled={save.isPending || childId === ''}
            onClick={() => save.mutate({ childId, duty: duty || null, status: 'active' })}
          >
            Thêm vào đội sao đỏ
          </Button>
        </div>
      ) : null}
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <table className="w-full text-content" aria-label="Đội sao đỏ">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-3 py-2">Học sinh</th>
            <th className="px-3 py-2">Lớp</th>
            <th className="px-3 py-2">Nhiệm vụ</th>
            <th className="px-3 py-2">Trạng thái</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {(members.data ?? []).map((member) => (
            <tr key={member.child_id} className="border-t border-border">
              <td className="px-3 py-2">{member.full_name}</td>
              <td className="px-3 py-2">{member.class_name ?? ''}</td>
              <td className="px-3 py-2">{member.duty ?? ''}</td>
              <td className="px-3 py-2">{member.status === 'active' ? 'Đang hoạt động' : 'Đã ngừng'}</td>
              <td className="px-3 py-2">
                {canManage ? (
                  <Button
                    disabled={save.isPending}
                    onClick={() =>
                      save.mutate({
                        childId: member.child_id,
                        duty: member.duty,
                        status: member.status === 'active' ? 'inactive' : 'active',
                      })
                    }
                  >
                    {member.status === 'active' ? 'Ngừng' : 'Hoạt động lại'}
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ConductPage() {
  const canManage = useHasPermission(PERMISSION_CODES.conductManage);
  const unitChoice = useUnitChoice();
  const enabled = useEnabledSchoolLevels();
  const levels = enabled.levels.filter((item) => item.value !== 'MN');
  const [chosenLevel, setChosenLevel] = useState<SchoolLevelCode>();
  const level =
    chosenLevel && levels.some((item) => item.value === chosenLevel) ? chosenLevel : (levels[0]?.value ?? 'TH');
  const [tab, setTab] = useState<Tab>('entries');
  const tabs = (Object.keys(TAB_LABELS) as Tab[]).filter((code) => code !== 'red-stars' || isSecondary(level));
  const shownTab = tabs.includes(tab) ? tab : 'entries';
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const settings = useQuery({ queryKey: ['conduct-settings'], queryFn: readConductSettings });
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/conduct')}</h1>
        {settings.data && !settings.data.enabled ? (
          <Alert tone="info">
            Trường chưa bật nề nếp, thi đua lớp. Ban Giám hiệu bật ở 1.4 Cấu hình trường; khi chưa bật vẫn khai báo được
            tiêu chí nhưng chưa ghi điểm được.
          </Alert>
        ) : null}
        <div className="flex flex-wrap items-end gap-4">
          <UnitSelect units={unitChoice.units} selectedId={unitChoice.selectedId} onSelect={unitChoice.select} />
          {levels.length > 1 ? (
            <label className="flex flex-col gap-2 text-label font-medium text-text">
              Cấp học
              <select
                value={level}
                onChange={(event) => setChosenLevel(event.target.value as SchoolLevelCode)}
                className={SELECT_CLASS}
              >
                {levels.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="flex gap-2" role="tablist" aria-label="Nề nếp, thi đua lớp">
            {tabs.map((code) => (
              <Button
                key={code}
                role="tab"
                aria-selected={shownTab === code}
                variant={shownTab === code ? 'primary' : 'secondary'}
                onClick={() => setTab(code)}
              >
                {TAB_LABELS[code]}
              </Button>
            ))}
          </div>
        </div>
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
          {shownTab === 'entries' ? (
            <EntriesTab level={level} orgUnitId={unitChoice.selectedId} onSaved={setToastMessage} />
          ) : null}
          {shownTab === 'ranking' ? <RankingTab level={level} orgUnitId={unitChoice.selectedId} /> : null}
          {shownTab === 'criteria' ? (
            <CriteriaTab level={level} canManage={canManage} onSaved={setToastMessage} />
          ) : null}
          {shownTab === 'red-stars' ? (
            <RedStarsTab
              level={level}
              orgUnitId={unitChoice.selectedId}
              canManage={canManage}
              onSaved={setToastMessage}
            />
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
