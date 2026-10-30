import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EYE_CONDITIONS,
  PHYSICAL_EDUCATION_RESULTS,
  STUDENT_HEALTH_TERMS,
  type PhysicalEducationValue,
  type StudentHealthTermValue,
} from '@school-management/shared';
import { Alert, Button, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPreschool } from '../school-levels/working-level.js';
import { messageOf } from './health-api.js';
import {
  exportStudentHealth,
  pullGrowth,
  readStudentHealth,
  saveStudentHealth,
  type StudentHealthRow,
} from './student-health-api.js';

// 4.6.1 Nhập thông tin sức khỏe học sinh (DT-16 phần 16h, theo mục 4.6 của Sở): chọn đơn vị, lớp, học kỳ; nhập cân nặng,
// chiều cao, kết quả giáo dục thể chất, biết bơi, bệnh về mắt từng học sinh rồi "Ghi"; "Lấy dữ liệu từ 4.3" (chỉ khi làm việc ở
// cấp Mầm non vì 4.3 chỉ có ở Mầm non, YCTD-394) chép số đo gần nhất của các đợt cân đo trong học kỳ; "Xuất Excel" bảng
// của lớp. Bảng nhập theo từng ô nên giữ dạng bảng nhập liệu như 4.3.1 (DT-16 phần 16b)
const selectClass = 'rounded-lg border border-border bg-card px-3 py-2 text-content';
const inputClass = 'w-20 rounded-lg border border-border bg-card px-2 py-1 text-content';
const smallSelect = 'rounded-lg border border-border bg-card px-2 py-1 text-content';
const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const formatDate = (value: string | null) => (value ? value.split('-').reverse().join('/') : '');
// Học kỳ mặc định theo tháng hiện tại: tháng 8 đến tháng 12 là học kỳ I
const defaultTerm = (): StudentHealthTermValue =>
  Number(vietnamToday().slice(5, 7)) >= 8 ? 'first_term' : 'second_term';

interface DraftRow {
  weight_kg: string;
  height_cm: string;
  measured_on: string;
  physical_education: string;
  can_swim: string;
  eye_conditions: string[];
  note: string;
}

const draftOf = (row: StudentHealthRow): DraftRow => ({
  weight_kg: row.weight_kg?.toString() ?? '',
  height_cm: row.height_cm?.toString() ?? '',
  measured_on: row.measured_on ?? '',
  physical_education: row.physical_education ?? '',
  can_swim: row.can_swim === null ? '' : row.can_swim ? 'yes' : 'no',
  eye_conditions: row.eye_conditions,
  note: row.note ?? '',
});

export function StudentHealthPage() {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [classId, setClassId] = useState('');
  const [term, setTerm] = useState<StudentHealthTermValue>(defaultTerm);
  const [draft, setDraft] = useState<Record<string, DraftRow>>({});
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  const classes = useQuery({
    queryKey: ['classes', orgUnitId],
    queryFn: () => listClasses(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId),
  });
  const grid = useQuery({
    queryKey: ['student-health', classId, term],
    queryFn: () => readStudentHealth(classId, term),
    enabled: classId !== '',
    retry: false,
  });
  useEffect(() => {
    if (grid.data) {
      setDraft(Object.fromEntries(grid.data.rows.map((row) => [row.child_id, draftOf(row)])));
    }
  }, [grid.data]);

  const refresh = async (message: string) => {
    setToastMessage(message);
    await queryClient.invalidateQueries({ queryKey: ['student-health'] });
  };
  const save = useMutation({
    mutationFn: () =>
      saveStudentHealth(
        classId,
        term,
        (grid.data?.rows ?? []).map((row) => {
          const value = draft[row.child_id] ?? draftOf(row);
          return {
            child_id: row.child_id,
            weight_kg: value.weight_kg.trim() || null,
            height_cm: value.height_cm.trim() || null,
            measured_on: value.measured_on || null,
            physical_education: (value.physical_education || null) as PhysicalEducationValue | null,
            can_swim: value.can_swim === '' ? null : value.can_swim === 'yes',
            eye_conditions: value.eye_conditions,
            note: value.note.trim() || null,
          };
        }),
      ),
    onSuccess: (result) => refresh(`Đã ghi thông tin sức khỏe của ${result.saved_count} học sinh`),
  });
  const pull = useMutation({
    mutationFn: () => pullGrowth(classId, term),
    onSuccess: (result) =>
      refresh(
        `Đã lấy số đo của ${result.updated_count} học sinh từ 4.3` +
          (result.missing_count > 0 ? `; ${result.missing_count} học sinh chưa có số đo trong học kỳ` : ''),
      ),
  });
  const exportFile = useMutation({ mutationFn: () => exportStudentHealth(classId, term) });

  const editable = Boolean(grid.data?.can_edit);
  const hasPreschool = useHasPreschool();
  const update = (childId: string, patch: Partial<DraftRow>) =>
    setDraft((current) => {
      const base = current[childId] ?? {
        weight_kg: '',
        height_cm: '',
        measured_on: '',
        physical_education: '',
        can_swim: '',
        eye_conditions: [],
        note: '',
      };
      return { ...current, [childId]: { ...base, ...patch } };
    });
  const termLabel = STUDENT_HEALTH_TERMS.find((item) => item.value === term)?.label ?? '';
  const error = [classes.error, grid.error, save.error, pull.error, exportFile.error].find(Boolean);

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/student-health')}</h1>
        <div className="flex flex-wrap items-end gap-3">
          <UnitSelect
            units={unitChoice.units}
            selectedId={orgUnitId}
            onSelect={(id) => {
              unitChoice.select(id);
              setClassId('');
            }}
          />
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Lớp
            <select
              aria-label="Lớp"
              className={selectClass}
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
            >
              <option value="">Chọn lớp</option>
              {(classes.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Học kỳ
            <select
              aria-label="Học kỳ"
              className={selectClass}
              value={term}
              onChange={(event) => setTerm(event.target.value as StudentHealthTermValue)}
            >
              {STUDENT_HEALTH_TERMS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
        {grid.data ? (
          <section
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            aria-label="Bảng thông tin sức khỏe"
          >
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-section-title font-semibold text-text">
                Lớp {grid.data.class.name}, {termLabel}
                {grid.data.term_range
                  ? ` (${formatDate(grid.data.term_range.start_date)} – ${formatDate(grid.data.term_range.end_date)})`
                  : ''}
              </h2>
              {editable ? (
                <>
                  <Button type="button" variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
                    Ghi
                  </Button>
                  {hasPreschool ? (
                    <Button type="button" variant="secondary" disabled={pull.isPending} onClick={() => pull.mutate()}>
                      Lấy dữ liệu từ 4.3
                    </Button>
                  ) : null}
                </>
              ) : null}
              <Button type="button" variant="secondary" onClick={() => exportFile.mutate()}>
                Xuất Excel
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-content">
                <thead className="text-left text-label font-medium text-text-secondary">
                  <tr>
                    <th className="px-2 py-2">STT</th>
                    <th className="px-2 py-2">Họ tên</th>
                    <th className="px-2 py-2">Ngày sinh</th>
                    <th className="px-2 py-2">Giới tính</th>
                    <th className="px-2 py-2">Cân nặng (kg)</th>
                    <th className="px-2 py-2">Chiều cao (cm)</th>
                    <th className="px-2 py-2">Ngày đo</th>
                    <th className="px-2 py-2">Số đo 4.3 gần nhất</th>
                    <th className="px-2 py-2">Giáo dục thể chất</th>
                    <th className="px-2 py-2">Biết bơi</th>
                    <th className="px-2 py-2">Bệnh về mắt</th>
                    <th className="px-2 py-2">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {grid.data.rows.map((row, index) => {
                    const value = draft[row.child_id] ?? draftOf(row);
                    return (
                      <tr key={row.child_id} className="border-t border-border align-top">
                        <td className="px-2 py-2">{index + 1}</td>
                        <td className="px-2 py-2">{row.full_name}</td>
                        <td className="px-2 py-2">{formatDate(row.dob)}</td>
                        <td className="px-2 py-2">{row.gender === 'female' ? 'Nữ' : 'Nam'}</td>
                        <td className="px-2 py-2">
                          {editable ? (
                            <input
                              className={inputClass}
                              inputMode="decimal"
                              aria-label={`Cân nặng của ${row.full_name}`}
                              value={value.weight_kg}
                              onChange={(event) => update(row.child_id, { weight_kg: event.target.value })}
                            />
                          ) : (
                            (row.weight_kg ?? '')
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {editable ? (
                            <input
                              className={inputClass}
                              inputMode="decimal"
                              aria-label={`Chiều cao của ${row.full_name}`}
                              value={value.height_cm}
                              onChange={(event) => update(row.child_id, { height_cm: event.target.value })}
                            />
                          ) : (
                            (row.height_cm ?? '')
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {editable ? (
                            <input
                              type="date"
                              className={smallSelect}
                              aria-label={`Ngày đo của ${row.full_name}`}
                              value={value.measured_on}
                              onChange={(event) => update(row.child_id, { measured_on: event.target.value })}
                            />
                          ) : (
                            formatDate(row.measured_on)
                          )}
                        </td>
                        <td className="px-2 py-2 text-label text-text-secondary">
                          {row.latest_growth
                            ? `${row.latest_growth.round_name} (${formatDate(row.latest_growth.measured_on)}): ` +
                              `${row.latest_growth.weight_kg ?? '–'} kg, ${row.latest_growth.height_cm ?? '–'} cm`
                            : 'Chưa có'}
                        </td>
                        <td className="px-2 py-2">
                          {editable ? (
                            <select
                              className={smallSelect}
                              aria-label={`Giáo dục thể chất của ${row.full_name}`}
                              value={value.physical_education}
                              onChange={(event) => update(row.child_id, { physical_education: event.target.value })}
                            >
                              <option value="">Chưa đánh giá</option>
                              {PHYSICAL_EDUCATION_RESULTS.map((item) => (
                                <option key={item.value} value={item.value}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            (PHYSICAL_EDUCATION_RESULTS.find((item) => item.value === row.physical_education)?.label ??
                            '')
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {editable ? (
                            <select
                              className={smallSelect}
                              aria-label={`Biết bơi của ${row.full_name}`}
                              value={value.can_swim}
                              onChange={(event) => update(row.child_id, { can_swim: event.target.value })}
                            >
                              <option value="">Chưa ghi</option>
                              <option value="yes">Có</option>
                              <option value="no">Không</option>
                            </select>
                          ) : row.can_swim === null ? (
                            ''
                          ) : row.can_swim ? (
                            'Có'
                          ) : (
                            'Không'
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {editable ? (
                            <fieldset className="flex min-w-48 flex-wrap gap-x-3 gap-y-1">
                              <legend className="sr-only">Bệnh về mắt của {row.full_name}</legend>
                              {EYE_CONDITIONS.map((condition) => (
                                <label key={condition.value} className="flex items-center gap-1 text-label">
                                  <input
                                    type="checkbox"
                                    aria-label={`${condition.label} của ${row.full_name}`}
                                    checked={value.eye_conditions.includes(condition.value)}
                                    onChange={(event) =>
                                      update(row.child_id, {
                                        eye_conditions: event.target.checked
                                          ? [...value.eye_conditions, condition.value]
                                          : value.eye_conditions.filter((item) => item !== condition.value),
                                      })
                                    }
                                  />
                                  {condition.label}
                                </label>
                              ))}
                            </fieldset>
                          ) : (
                            row.eye_conditions
                              .map(
                                (item) => EYE_CONDITIONS.find((condition) => condition.value === item)?.label ?? item,
                              )
                              .join(', ')
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {editable ? (
                            <input
                              className="w-40 rounded-lg border border-border bg-card px-2 py-1 text-content"
                              aria-label={`Ghi chú của ${row.full_name}`}
                              value={value.note}
                              onChange={(event) => update(row.child_id, { note: event.target.value })}
                            />
                          ) : (
                            (row.note ?? '')
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-label text-text-secondary">
              Thông tin theo học kỳ dùng cho thống kê 5.3 (biết bơi, bệnh về mắt theo học kỳ). Dòng để trống mọi ô thì
              thông tin của học sinh trong học kỳ bị xóa khi Ghi.
            </p>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
