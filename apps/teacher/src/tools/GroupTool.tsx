import { useEffect, useState } from 'react';
import { Alert, Button, TextField } from '@school-management/ui';
import { fetchGrouping, messageOf, saveGrouping } from './classroom-api.js';
import { splitIntoGroups, type Group } from './classroom-logic.ts';
import { readGrouping, writeGrouping, offlineAllowed } from './classroom-store.js';
import type { ToolProperties } from './CallTool.js';

// Chia nhóm ngẫu nhiên (DT-23 phần 23b, YCTD-212): theo số nhóm hoặc số người mỗi nhóm, chia lại khi cần, giữ bản chia gần nhất
// của lớp để bảng điểm nhanh dùng. Học sinh vắng hôm nay có thể loại khỏi bản chia
export function GroupTool({ classId, students, online }: ToolProperties) {
  const [by, setBy] = useState<'count' | 'size'>('count');
  const [value, setValue] = useState('4');
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
  }, [classId, online]);

  const nameOf = (childId: string) => students.find((student) => student.id === childId);
  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 50;

  const split = async () => {
    const pool = excludeAbsent ? students.filter((student) => !student.absent) : students;
    const next = splitIntoGroups(pool, { by, value: parsed }, Math.random);
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
      await saveGrouping(classId, next);
      setNotice({ tone: 'success', text: `Đã chia ${next.length} nhóm` });
    } catch (error) {
      setNotice({ tone: 'danger', text: messageOf(error) });
    }
  };

  return (
    <section aria-label="Chia nhóm ngẫu nhiên" className="flex flex-col gap-4">
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
      <Button variant="primary" disabled={!valid || students.length === 0} onClick={() => void split()}>
        {groups.length > 0 ? 'Chia lại' : 'Chia nhóm'}
      </Button>
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
