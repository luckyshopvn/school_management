import { useEffect, useState } from 'react';
import { Alert, Button } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import type { SchoolWeek } from './academic-years-api.js';

// Danh sách tuần và tuần nghỉ của MH-45 (BR-91)
function formatDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export function WeeksTable({
  weeks,
  editable,
  onSave,
}: {
  weeks: SchoolWeek[];
  editable: boolean;
  onSave(changes: Array<Pick<SchoolWeek, 'week_no' | 'is_off' | 'note'>>): Promise<void>;
}) {
  const [draft, setDraft] = useState(weeks);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(weeks), [weeks]);

  const changes = draft.filter((week, index) => {
    const original = weeks[index];
    return original && (original.is_off !== week.is_off || (original.note ?? '') !== (week.note ?? ''));
  });

  async function save() {
    setErrorMessage(undefined);
    setSaving(true);
    try {
      await onSave(changes.map(({ week_no, is_off, note }) => ({ week_no, is_off, note: note || null })));
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại');
    } finally {
      setSaving(false);
    }
  }

  if (weeks.length === 0) {
    return <p className="text-content text-text-secondary">Lưu lịch năm học để hệ thống đánh số tuần.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      <div className="max-h-[480px] overflow-auto rounded-lg border border-border">
        <table className="w-full text-content">
          <thead className="sticky top-0 bg-page text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-2">Tuần</th>
              <th className="px-3 py-2">Từ ngày</th>
              <th className="px-3 py-2">Đến ngày</th>
              <th className="px-3 py-2">Tuần nghỉ</th>
              <th className="px-3 py-2">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {draft.map((week, index) => (
              <tr key={week.week_no} className={`border-t border-border ${week.is_off ? 'bg-warning/5' : ''}`}>
                <td className="px-3 py-2 font-medium">{week.week_no}</td>
                <td className="px-3 py-2">{formatDate(week.start_date)}</td>
                <td className="px-3 py-2">{formatDate(week.end_date)}</td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Tuần ${week.week_no} là tuần nghỉ`}
                    checked={week.is_off}
                    disabled={!editable}
                    onChange={(event) =>
                      setDraft(
                        draft.map((item, position) =>
                          position === index ? { ...item, is_off: event.target.checked } : item,
                        ),
                      )
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`Ghi chú tuần ${week.week_no}`}
                    className="w-full rounded border border-border px-2 py-1 disabled:bg-transparent disabled:border-transparent"
                    value={week.note ?? ''}
                    disabled={!editable}
                    onChange={(event) =>
                      setDraft(
                        draft.map((item, position) =>
                          position === index ? { ...item, note: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable ? (
        <div>
          <Button onClick={() => void save()} disabled={saving || changes.length === 0}>
            {saving ? 'Đang lưu…' : 'Lưu tuần nghỉ'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
