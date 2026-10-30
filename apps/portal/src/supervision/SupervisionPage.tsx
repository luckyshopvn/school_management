import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { listGradeLevels } from '../catalogs/catalogs-api.js';
import { listConductCriteria, messageOf, vietnamToday } from '../conduct/conduct-api.js';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useEnabledSchoolLevels } from '../school-levels/enabled-levels.js';
import {
  createAssignment,
  createRuleItem,
  createZone,
  findOnDuty,
  KIND_LABELS,
  listAssignments,
  listRuleItems,
  listStaffOptions,
  listZones,
  loadDefaultRuleItems,
  NOTICE_LABELS,
  updateAssignment,
  updateRuleItem,
  updateZone,
  WEEKDAY_LABELS,
  type ParentNotice,
  type RuleKind,
  type SupervisionLevel,
} from './supervision-api.js';

// 4.10 Nội quy, phân công giám thị (YCTD-391, lát L1; màn hình 8 của bản mẫu): Ban Giám hiệu khai báo danh mục nội quy theo cấp
// (mục có thể gắn tiêu chí nề nếp lớp để ghi nhận từng học sinh ghi thêm điểm cho lớp), khu vực trong trường và phân công giám
// thị trực theo khối, khu vực, thứ, giờ; ô "Ai đang trực" tra người trực một khu vực ở một thời điểm, cùng cách tra mà cảnh báo
// camera dùng
type Tab = 'rules' | 'zones' | 'assignments';
const TAB_LABELS: Record<Tab, string> = {
  rules: 'Nội quy',
  zones: 'Khu vực',
  assignments: 'Phân công trực',
};
const SELECT_CLASS = 'rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const LABEL_CLASS = 'flex flex-col gap-2 text-label font-medium text-text';

function RulesTab({ level, onSaved }: { level: SupervisionLevel; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const items = useQuery({ queryKey: ['supervision-rules', level], queryFn: () => listRuleItems(level) });
  const criteria = useQuery({ queryKey: ['conduct-criteria', level], queryFn: () => listConductCriteria(level) });
  const empty = {
    code: '',
    name: '',
    kind: 'violation' as RuleKind,
    notice: 'daily_digest' as ParentNotice,
    criterion: '',
  };
  const [draft, setDraft] = useState(empty);
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['supervision-rules'] });
    onSaved(message);
  };
  const create = useMutation({
    mutationFn: () =>
      createRuleItem({
        code: draft.code,
        name: draft.name,
        kind: draft.kind,
        school_level: level,
        parent_notice: draft.notice,
        class_criterion_id: draft.criterion || null,
      }),
    onSuccess: async () => {
      setDraft(empty);
      await refresh('Đã thêm mục nội quy');
    },
  });
  const defaults = useMutation({
    mutationFn: () => loadDefaultRuleItems(level),
    onSuccess: (result) => refresh(`Đã nạp ${result.created.length} mục nội quy mặc định`),
  });
  const update = useMutation({
    mutationFn: (input: { id: string; changes: Parameters<typeof updateRuleItem>[1] }) =>
      updateRuleItem(input.id, input.changes),
    onSuccess: () => refresh('Đã cập nhật mục nội quy'),
  });
  // Tiêu chí nề nếp gắn được: đang dùng, trừ điểm cho vi phạm, cộng điểm cho khen
  const criteriaFor = (kind: RuleKind) =>
    (criteria.data ?? []).filter(
      (criterion) => criterion.status === 'active' && (criterion.kind === 'minus') === (kind === 'violation'),
    );
  const error = create.error ?? defaults.error ?? update.error;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-label text-text-secondary">
        Ghi nhận vi phạm, khen không tự trừ điểm rèn luyện của học sinh. Mục có gắn tiêu chí nề nếp thì ghi thêm điểm
        cho lớp của học sinh.
      </p>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <div className="flex flex-wrap items-end gap-3">
        <TextField
          label="Mã"
          value={draft.code}
          onChange={(event) => setDraft({ ...draft, code: event.target.value })}
        />
        <TextField
          label="Tên mục nội quy"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
        <label className={LABEL_CLASS}>
          Loại
          <select
            value={draft.kind}
            onChange={(event) => setDraft({ ...draft, kind: event.target.value as RuleKind, criterion: '' })}
            className={SELECT_CLASS}
          >
            <option value="violation">Vi phạm</option>
            <option value="commendation">Khen</option>
          </select>
        </label>
        <label className={LABEL_CLASS}>
          Báo phụ huynh
          <select
            value={draft.notice}
            onChange={(event) => setDraft({ ...draft, notice: event.target.value as ParentNotice })}
            className={SELECT_CLASS}
          >
            {(Object.keys(NOTICE_LABELS) as ParentNotice[]).map((notice) => (
              <option key={notice} value={notice}>
                {NOTICE_LABELS[notice]}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL_CLASS}>
          Tiêu chí nề nếp lớp
          <select
            value={draft.criterion}
            onChange={(event) => setDraft({ ...draft, criterion: event.target.value })}
            className={SELECT_CLASS}
          >
            <option value="">Không gắn</option>
            {criteriaFor(draft.kind).map((criterion) => (
              <option key={criterion.id} value={criterion.id}>
                {criterion.name} ({criterion.kind === 'plus' ? '+' : '-'}
                {criterion.points})
              </option>
            ))}
          </select>
        </label>
        <Button variant="primary" disabled={create.isPending} onClick={() => create.mutate()}>
          Thêm mục
        </Button>
        <Button disabled={defaults.isPending} onClick={() => defaults.mutate()}>
          Nạp bộ nội quy mặc định
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-content" aria-label="Danh mục nội quy">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-2">Mã</th>
              <th className="px-3 py-2">Mục nội quy</th>
              <th className="px-3 py-2">Loại</th>
              <th className="px-3 py-2">Báo phụ huynh</th>
              <th className="px-3 py-2">Tiêu chí nề nếp lớp</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(items.data ?? []).map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="px-3 py-2">{item.code}</td>
                <td className="px-3 py-2">{item.name}</td>
                <td className="px-3 py-2">{KIND_LABELS[item.kind]}</td>
                <td className="px-3 py-2">
                  <select
                    aria-label={`Báo phụ huynh của ${item.name}`}
                    value={item.parent_notice}
                    disabled={update.isPending}
                    onChange={(event) =>
                      update.mutate({ id: item.id, changes: { parent_notice: event.target.value as ParentNotice } })
                    }
                    className={SELECT_CLASS}
                  >
                    {(Object.keys(NOTICE_LABELS) as ParentNotice[]).map((notice) => (
                      <option key={notice} value={notice}>
                        {NOTICE_LABELS[notice]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    aria-label={`Tiêu chí nề nếp lớp của ${item.name}`}
                    value={item.class_criterion_id ?? ''}
                    disabled={update.isPending}
                    onChange={(event) =>
                      update.mutate({ id: item.id, changes: { class_criterion_id: event.target.value || null } })
                    }
                    className={SELECT_CLASS}
                  >
                    <option value="">Không gắn</option>
                    {criteriaFor(item.kind).map((criterion) => (
                      <option key={criterion.id} value={criterion.id}>
                        {criterion.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">{item.status === 'active' ? 'Đang dùng' : 'Ngừng dùng'}</td>
                <td className="px-3 py-2">
                  <Button
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate({
                        id: item.id,
                        changes: { status: item.status === 'active' ? 'inactive' : 'active' },
                      })
                    }
                  >
                    {item.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ZonesTab({ onSaved }: { onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const zones = useQuery({ queryKey: ['supervision-zones'], queryFn: listZones });
  const [draft, setDraft] = useState({ name: '', description: '' });
  const [checkZone, setCheckZone] = useState('');
  const [checkAt, setCheckAt] = useState(`${vietnamToday()}T07:30`);
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['supervision-zones'] });
    onSaved(message);
  };
  const create = useMutation({
    mutationFn: () => createZone({ name: draft.name, description: draft.description || null }),
    onSuccess: async () => {
      setDraft({ name: '', description: '' });
      await refresh('Đã thêm khu vực');
    },
  });
  const toggle = useMutation({
    mutationFn: (input: { id: string; status: 'active' | 'inactive' }) =>
      updateZone(input.id, { status: input.status }),
    onSuccess: () => refresh('Đã cập nhật khu vực'),
  });
  // Giờ nhập ở ô là giờ Việt Nam; đổi sang thời điểm tuyệt đối bằng múi giờ +07:00
  const onDuty = useMutation({ mutationFn: () => findOnDuty(checkZone, `${checkAt}:00+07:00`) });
  const error = create.error ?? toggle.error ?? onDuty.error;
  const activeZones = (zones.data ?? []).filter((zone) => zone.status === 'active');
  return (
    <div className="flex flex-col gap-4">
      <p className="text-label text-text-secondary">
        Ghi nhận và cảnh báo chỉ ghi tên khu vực trong trường, không ghi tọa độ.
      </p>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <div className="flex flex-wrap items-end gap-3">
        <TextField
          label="Tên khu vực"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
        <TextField
          label="Mô tả"
          value={draft.description}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
        />
        <Button variant="primary" disabled={create.isPending} onClick={() => create.mutate()}>
          Thêm khu vực
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-content" aria-label="Khu vực trong trường">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-2">Khu vực</th>
              <th className="px-3 py-2">Mô tả</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(zones.data ?? []).map((zone) => (
              <tr key={zone.id} className="border-t border-border">
                <td className="px-3 py-2">{zone.name}</td>
                <td className="px-3 py-2">{zone.description}</td>
                <td className="px-3 py-2">{zone.status === 'active' ? 'Đang dùng' : 'Ngừng dùng'}</td>
                <td className="px-3 py-2">
                  <Button
                    disabled={toggle.isPending}
                    onClick={() =>
                      toggle.mutate({ id: zone.id, status: zone.status === 'active' ? 'inactive' : 'active' })
                    }
                  >
                    {zone.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="flex flex-col gap-3 rounded-xl border border-border p-4" aria-label="Ai đang trực">
        <h3 className="text-content font-semibold text-text">Ai đang trực</h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className={LABEL_CLASS}>
            Khu vực
            <select value={checkZone} onChange={(event) => setCheckZone(event.target.value)} className={SELECT_CLASS}>
              <option value="">Chọn khu vực</option>
              {activeZones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Thời điểm"
            type="datetime-local"
            value={checkAt}
            onChange={(event) => setCheckAt(event.target.value)}
          />
          <Button disabled={!checkZone || !checkAt || onDuty.isPending} onClick={() => onDuty.mutate()}>
            Tra
          </Button>
        </div>
        {onDuty.data ? (
          <p className="text-content text-text">
            {onDuty.data.length > 0
              ? onDuty.data.map((row) => row.full_name).join(', ')
              : 'Không ai được phân công; cảnh báo sẽ gửi Ban Giám hiệu.'}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function AssignmentsTab({ level, onSaved }: { level: SupervisionLevel; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const assignments = useQuery({ queryKey: ['supervision-assignments', level], queryFn: () => listAssignments(level) });
  const staff = useQuery({ queryKey: ['supervision-staff'], queryFn: listStaffOptions });
  const zones = useQuery({ queryKey: ['supervision-zones'], queryFn: listZones });
  const grades = useQuery({ queryKey: ['grade-levels'], queryFn: listGradeLevels });
  const empty = {
    staffId: '',
    grades: [] as string[],
    zones: [] as string[],
    weekdays: [1, 2, 3, 4, 5],
    start: '06:30',
    end: '11:30',
    note: '',
  };
  const [draft, setDraft] = useState(empty);
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['supervision-assignments'] });
    onSaved(message);
  };
  const create = useMutation({
    mutationFn: () =>
      createAssignment({
        staff_id: draft.staffId,
        school_level: level,
        grade_levels: draft.grades,
        zone_ids: draft.zones,
        weekdays: draft.weekdays,
        start_time: draft.start,
        end_time: draft.end,
        note: draft.note || null,
      }),
    onSuccess: async () => {
      setDraft(empty);
      await refresh('Đã phân công trực');
    },
  });
  const toggle = useMutation({
    mutationFn: (input: { id: string; status: 'active' | 'inactive' }) =>
      updateAssignment(input.id, { status: input.status }),
    onSuccess: () => refresh('Đã cập nhật phân công'),
  });
  const levelGrades = (grades.data ?? []).filter((grade) => grade.school_level === level && grade.status === 'active');
  const activeZones = (zones.data ?? []).filter((zone) => zone.status === 'active');
  const zoneName = new Map((zones.data ?? []).map((zone) => [zone.id, zone.name]));
  const toggleIn = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  const error = create.error ?? toggle.error;
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className={LABEL_CLASS}>
            Giám thị
            <select
              value={draft.staffId}
              onChange={(event) => setDraft({ ...draft, staffId: event.target.value })}
              className={SELECT_CLASS}
            >
              <option value="">Chọn nhân sự</option>
              {(staff.data ?? []).map((person) => (
                <option key={person.id} value={person.id}>
                  {person.full_name}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Từ giờ"
            type="time"
            value={draft.start}
            onChange={(event) => setDraft({ ...draft, start: event.target.value })}
          />
          <TextField
            label="Đến giờ"
            type="time"
            value={draft.end}
            onChange={(event) => setDraft({ ...draft, end: event.target.value })}
          />
          <TextField
            label="Ghi chú"
            value={draft.note}
            onChange={(event) => setDraft({ ...draft, note: event.target.value })}
          />
        </div>
        <fieldset className="flex flex-wrap gap-3">
          <legend className="mb-1 text-label font-medium text-text">Thứ trong tuần</legend>
          {WEEKDAY_LABELS.map((label, index) => (
            <label key={label} className="flex min-h-11 items-center gap-2 text-content">
              <input
                type="checkbox"
                checked={draft.weekdays.includes(index + 1)}
                onChange={() => setDraft({ ...draft, weekdays: toggleIn(draft.weekdays, index + 1) })}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <fieldset className="flex flex-wrap gap-3">
          <legend className="mb-1 text-label font-medium text-text">Khối (không chọn là mọi khối)</legend>
          {levelGrades.map((grade) => (
            <label key={grade.code} className="flex min-h-11 items-center gap-2 text-content">
              <input
                type="checkbox"
                checked={draft.grades.includes(grade.code)}
                onChange={() => setDraft({ ...draft, grades: toggleIn(draft.grades, grade.code) })}
              />
              {grade.name}
            </label>
          ))}
        </fieldset>
        <fieldset className="flex flex-wrap gap-3">
          <legend className="mb-1 text-label font-medium text-text">Khu vực (không chọn là mọi khu vực)</legend>
          {activeZones.map((zone) => (
            <label key={zone.id} className="flex min-h-11 items-center gap-2 text-content">
              <input
                type="checkbox"
                checked={draft.zones.includes(zone.id)}
                onChange={() => setDraft({ ...draft, zones: toggleIn(draft.zones, zone.id) })}
              />
              {zone.name}
            </label>
          ))}
        </fieldset>
        <div>
          <Button variant="primary" disabled={create.isPending} onClick={() => create.mutate()}>
            Phân công
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-content" aria-label="Phân công giám thị trực">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-2">Giám thị</th>
              <th className="px-3 py-2">Thứ</th>
              <th className="px-3 py-2">Giờ</th>
              <th className="px-3 py-2">Khối</th>
              <th className="px-3 py-2">Khu vực</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(assignments.data ?? []).map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-3 py-2">{row.staff_name}</td>
                <td className="px-3 py-2">{row.weekdays.map((day) => WEEKDAY_LABELS[day - 1]).join(', ')}</td>
                <td className="px-3 py-2">
                  {row.start_time} – {row.end_time}
                </td>
                <td className="px-3 py-2">{row.grade_levels.length > 0 ? row.grade_levels.join(', ') : 'Mọi khối'}</td>
                <td className="px-3 py-2">
                  {row.zone_ids.length > 0
                    ? row.zone_ids.map((zoneId) => zoneName.get(zoneId) ?? '').join(', ')
                    : 'Mọi khu vực'}
                </td>
                <td className="px-3 py-2">{row.status === 'active' ? 'Đang dùng' : 'Ngừng'}</td>
                <td className="px-3 py-2">
                  <Button
                    disabled={toggle.isPending}
                    onClick={() =>
                      toggle.mutate({ id: row.id, status: row.status === 'active' ? 'inactive' : 'active' })
                    }
                  >
                    {row.status === 'active' ? 'Ngừng' : 'Dùng lại'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SupervisionPage() {
  const enabled = useEnabledSchoolLevels();
  const levels = enabled.levels.filter((item) => item.value !== 'MN') as Array<{
    value: SupervisionLevel;
    label: string;
  }>;
  const [chosenLevel, setChosenLevel] = useState<SupervisionLevel>();
  const level =
    chosenLevel && levels.some((item) => item.value === chosenLevel) ? chosenLevel : (levels[0]?.value ?? 'THCS');
  const [tab, setTab] = useState<Tab>('rules');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/supervision')}</h1>
        <div className="flex flex-wrap items-end gap-4">
          {levels.length > 1 && tab !== 'zones' ? (
            <label className={LABEL_CLASS}>
              Cấp học
              <select
                value={level}
                onChange={(event) => setChosenLevel(event.target.value as SupervisionLevel)}
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
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Nội quy, phân công giám thị">
            {(Object.keys(TAB_LABELS) as Tab[]).map((code) => (
              <Button
                key={code}
                role="tab"
                aria-selected={tab === code}
                variant={tab === code ? 'primary' : 'secondary'}
                onClick={() => setTab(code)}
              >
                {TAB_LABELS[code]}
              </Button>
            ))}
          </div>
        </div>
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
          {tab === 'rules' ? <RulesTab level={level} onSaved={setToastMessage} /> : null}
          {tab === 'zones' ? <ZonesTab onSaved={setToastMessage} /> : null}
          {tab === 'assignments' ? <AssignmentsTab level={level} onSaved={setToastMessage} /> : null}
        </section>
      </div>
    </AppShell>
  );
}
