import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import type { Calendar } from './academic-years-api.js';

// Phần lịch năm học của MH-45: học kỳ 1, học kỳ 2, kỳ hè, ngày học trong tuần (BR-91)
const WEEKDAYS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Thứ hai' },
  { value: 2, label: 'Thứ ba' },
  { value: 3, label: 'Thứ tư' },
  { value: 4, label: 'Thứ năm' },
  { value: 5, label: 'Thứ sáu' },
  { value: 6, label: 'Thứ bảy' },
  { value: 7, label: 'Chủ nhật' },
];

const EMPTY_RANGE = { start_date: '', end_date: '' };

export function CalendarForm({
  calendar,
  editable,
  onSave,
}: {
  calendar: Calendar;
  editable: boolean;
  onSave(calendar: Calendar): Promise<void>;
}) {
  const [firstTerm, setFirstTerm] = useState(calendar.first_term);
  const [secondTerm, setSecondTerm] = useState(calendar.second_term);
  const [hasSummer, setHasSummer] = useState(calendar.summer_term !== null);
  const [summerTerm, setSummerTerm] = useState(calendar.summer_term ?? EMPTY_RANGE);
  const [schoolDays, setSchoolDays] = useState(calendar.school_days_of_week);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFirstTerm(calendar.first_term);
    setSecondTerm(calendar.second_term);
    setHasSummer(calendar.summer_term !== null);
    setSummerTerm(calendar.summer_term ?? EMPTY_RANGE);
    setSchoolDays(calendar.school_days_of_week);
  }, [calendar]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);
    setFieldErrors({});
    setSaving(true);
    try {
      await onSave({
        first_term: firstTerm,
        second_term: secondTerm,
        summer_term: hasSummer ? summerTerm : null,
        school_days_of_week: schoolDays,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
        setFieldErrors(Object.fromEntries(error.details.map((detail) => [detail.field, detail.message])));
      } else {
        setErrorMessage('Không kết nối được tới máy chủ, vui lòng thử lại');
      }
    } finally {
      setSaving(false);
    }
  }

  const fieldError = (prefix: string) =>
    fieldErrors[prefix] ?? fieldErrors[`${prefix}.start_date`] ?? fieldErrors[`${prefix}.end_date`];

  const rangeFields = (
    label: string,
    prefix: string,
    range: { start_date: string; end_date: string },
    setRange: (range: { start_date: string; end_date: string }) => void,
  ) => (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-label font-semibold text-text">{label}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          label="Từ ngày"
          type="date"
          value={range.start_date}
          disabled={!editable}
          onChange={(event) => setRange({ ...range, start_date: event.target.value })}
        />
        <TextField
          label="Đến ngày"
          type="date"
          value={range.end_date}
          disabled={!editable}
          onChange={(event) => setRange({ ...range, end_date: event.target.value })}
        />
      </div>
      {fieldError(prefix) ? <p className="text-label text-danger">{fieldError(prefix)}</p> : null}
    </fieldset>
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {rangeFields('Học kỳ 1', 'first_term', firstTerm, setFirstTerm)}
      {rangeFields('Học kỳ 2', 'second_term', secondTerm, setSecondTerm)}
      <label className="flex items-center gap-2 text-label font-medium text-text">
        <input
          type="checkbox"
          checked={hasSummer}
          disabled={!editable}
          onChange={(event) => setHasSummer(event.target.checked)}
        />
        Có kỳ hè
      </label>
      {hasSummer ? rangeFields('Kỳ hè', 'summer_term', summerTerm, setSummerTerm) : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-label font-semibold text-text">Ngày học trong tuần</legend>
        <div className="flex flex-wrap gap-4">
          {WEEKDAYS.map((day) => (
            <label key={day.value} className="flex items-center gap-2 text-content text-text">
              <input
                type="checkbox"
                checked={schoolDays.includes(day.value)}
                disabled={!editable}
                onChange={(event) =>
                  setSchoolDays(
                    event.target.checked
                      ? [...schoolDays, day.value].sort((left, right) => left - right)
                      : schoolDays.filter((value) => value !== day.value),
                  )
                }
              />
              {day.label}
            </label>
          ))}
        </div>
        {fieldErrors.school_days_of_week ? (
          <p className="text-label text-danger">{fieldErrors.school_days_of_week}</p>
        ) : null}
      </fieldset>
      {editable ? (
        <div>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Lưu lịch năm học'}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
