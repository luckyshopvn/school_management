import { useEffect, useState } from 'react';
import { Alert, Button, FORM_CONTROL_CLASS, TextField } from '@school-management/ui';
import {
  fetchGroupSet,
  fetchGroupSets,
  fetchGroupSubjects,
  fetchGrouping,
  messageOf,
  previewGroups,
  saveGrouping,
  type GroupSetSummary,
  type ServerSplitMethod,
} from './classroom-api.js';
import { splitIntoGroups, type Group } from './classroom-logic.ts';
import { readGrouping, writeGrouping, offlineAllowed } from './classroom-store.js';
import type { ToolProperties } from './CallTool.js';

// Chia nhóm (DT-23 phần 23b, YCTD-212; DT-28 phần 28a, YCTD-271): ngẫu nhiên theo số nhóm hoặc số người mỗi nhóm (chạy trên
// máy, dùng được khi mất mạng), hoặc cân bằng nam nữ, trộn năng lực, gom theo năng lực (máy chủ chia, cần mạng; mức năng lực
// không hiện ra). Bản chia lưu thành bộ nhóm của công cụ lớp học để bảng điểm nhanh dùng; chọn được bộ nhóm sẵn có của lớp.
// Học sinh vắng hôm nay có thể loại khỏi bản chia
type Method = 'random' | ServerSplitMethod;

const METHOD_LABELS: Record<Method, string> = {
  random: 'Ngẫu nhiên',
  gender_balanced: 'Cân bằng nam nữ',
  ability_mixed: 'Trộn năng lực trong mỗi nhóm',
  ability_tiered: 'Gom theo năng lực',
};

const plain = (groups: Group[]): Group[] => groups.map(({ name, child_ids }) => ({ name, child_ids }));

export function GroupTool({ classId, students, online }: ToolProperties) {
  const [by, setBy] = useState<'count' | 'size'>('count');
  const [value, setValue] = useState('4');
  const [method, setMethod] = useState<Method>('random');
  const [subjectId, setSubjectId] = useState('');
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [sets, setSets] = useState<GroupSetSummary[]>([]);
  const [excludeAbsent, setExcludeAbsent] = useState(true);
  const [groups, setGroups] = useState<Group[]>(() => readGrouping(classId));
  const [notice, setNotice] = useState<{ tone: 'danger' | 'info' | 'success'; text: string }>();

  useEffect(() => {
    setGroups(readGrouping(classId));
    if (!online) {
      return;
    }
    fetchGrouping(classId)
      .then((saved) => {
        if (saved.groups.length > 0) {
          setGroups(saved.groups);
          if (offlineAllowed()) {
            writeGrouping(classId, saved.groups);
          }
        }
      })
      .catch(() => undefined);
    fetchGroupSets(classId)
      .then((rows) => setSets(rows.filter((row) => row.purpose !== 'classroom')))
      .catch(() => setSets([]));
  }, [classId, online]);

  useEffect(() => {
    if (online && method.startsWith('ability') && subjects.length === 0) {
      fetchGroupSubjects(classId)
        .then(setSubjects)
        .catch(() => setSubjects([]));
    }
  }, [classId, method, online, subjects.length]);

  const nameOf = (childId: string) => students.find((student) => student.id === childId);
  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 50;
  const needsServer = method !== 'random';
  const needsSubject = method.startsWith('ability');

  const keep = async (next: Group[], groupSetId?: string) => {
    setGroups(next);
    if (offlineAllowed()) {
      writeGrouping(classId, next);
    }
    if (next.length === 0) {
      setNotice({ tone: 'info', text: 'Lớp không có học sinh để chia nhóm' });
      return;
    }
    if (!online) {
      setNotice({ tone: 'info', text: 'Đã chia nhóm; bản chia được giữ trên máy' });
      return;
    }
    try {
      await saveGrouping(classId, next, groupSetId);
      setNotice({ tone: 'success', text: `Đã chia ${next.length} nhóm` });
    } catch (error) {
      setNotice({ tone: 'danger', text: messageOf(error) });
    }
  };

  const split = async () => {
    if (!needsServer) {
      const pool = excludeAbsent ? students.filter((student) => !student.absent) : students;
      await keep(splitIntoGroups(pool, { by, value: parsed }, Math.random));
      return;
    }
    try {
      const preview = await previewGroups({
        class_id: classId,
        subject_id: needsSubject ? subjectId : null,
        method: method as ServerSplitMethod,
        by,
        value: parsed,
        exclude_absent: excludeAbsent,
      });
      await keep(plain(preview.groups));
      if (preview.violations.length > 0) {
        setNotice({ tone: 'info', text: 'Đã chia nhóm; có ràng buộc không thỏa được, xem lại các nhóm' });
      }
    } catch (error) {
      setNotice({ tone: 'danger', text: messageOf(error) });
    }
  };

  const applySet = async (groupSetId: string) => {
    if (groupSetId === '') {
      return;
    }
    try {
      const set = await fetchGroupSet(groupSetId);
      await keep(plain(set.groups), groupSetId);
    } catch (error) {
      setNotice({ tone: 'danger', text: messageOf(error) });
    }
  };

  return (
    <section aria-label="Chia nhóm ngẫu nhiên" className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-label font-medium text-text">
        Kiểu chia
        <select
          className={FORM_CONTROL_CLASS}
          value={method}
          onChange={(event) => setMethod(event.target.value as Method)}
        >
          {(Object.keys(METHOD_LABELS) as Method[]).map((key) => (
            <option key={key} value={key} disabled={key !== 'random' && !online}>
              {METHOD_LABELS[key]}
              {key !== 'random' && !online ? ' (cần mạng)' : ''}
            </option>
          ))}
        </select>
      </label>
      {needsSubject ? (
        <label className="flex flex-col gap-1 text-label font-medium text-text">
          Môn lấy kết quả học tập
          <select
            className={FORM_CONTROL_CLASS}
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
          >
            <option value="">Chọn môn</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          <span className="text-label font-normal text-text-secondary">
            Dùng điểm trung bình môn (THCS, THPT) hoặc mức đạt môn (Tiểu học) gần nhất; mức của từng học sinh không hiện
            ra
          </span>
        </label>
      ) : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-label font-medium text-text">Cách chia</legend>
        <label className="flex items-center gap-2 text-content text-text">
          <input type="radio" name="cach-chia" checked={by === 'count'} onChange={() => setBy('count')} />
          Theo số nhóm
        </label>
        <label className="flex items-center gap-2 text-content text-text">
          <input type="radio" name="cach-chia" checked={by === 'size'} onChange={() => setBy('size')} />
          Theo số người mỗi nhóm
        </label>
      </fieldset>
      <TextField
        label={by === 'count' ? 'Số nhóm' : 'Số người mỗi nhóm'}
        type="number"
        min={1}
        max={50}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        error={valid ? undefined : 'Nhập số từ 1 đến 50'}
      />
      <label className="flex items-center gap-2 text-content text-text">
        <input type="checkbox" checked={excludeAbsent} onChange={(event) => setExcludeAbsent(event.target.checked)} />
        Loại học sinh vắng hôm nay
      </label>
      <Button
        variant="primary"
        disabled={!valid || students.length === 0 || (needsServer && !online) || (needsSubject && subjectId === '')}
        onClick={() => void split()}
      >
        {groups.length > 0 ? 'Chia lại' : 'Chia nhóm'}
      </Button>
      {online && sets.length > 0 ? (
        <label className="flex flex-col gap-1 text-label font-medium text-text">
          Dùng bộ nhóm có sẵn của lớp
          <select className={FORM_CONTROL_CLASS} value="" onChange={(event) => void applySet(event.target.value)}>
            <option value="">Chọn bộ nhóm</option>
            {sets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name} ({set.group_count} nhóm{set.subject_name ? `, ${set.subject_name}` : ''})
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
      <ul aria-label="Các nhóm" className="flex flex-col gap-2">
        {groups.map((group) => (
          <li key={group.name} className="rounded-xl border border-border bg-card p-3">
            <p className="text-content font-semibold text-text">
              {group.name} <span className="text-label text-text-secondary">({group.child_ids.length} học sinh)</span>
            </p>
            <p className="text-label text-text-secondary">
              {group.child_ids.map((id) => nameOf(id)?.full_name ?? 'Học sinh').join(', ')}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
