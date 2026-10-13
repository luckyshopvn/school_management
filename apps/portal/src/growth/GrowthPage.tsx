import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import { messageOf } from '../health/health-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useHasPermission } from '../session/permissions.js';
import { GrowthChart } from './GrowthChart.js';
import {
  createRound,
  downloadTemplate,
  importMeasurements,
  listRounds,
  readChildGrowth,
  readGrid,
  saveMeasurements,
  statusLabel,
  type GridRow,
  type ImportResult,
} from './growth-api.js';

// 4.3.1 Nhập kết quả sức khỏe nuôi dưỡng (DT-14 phần 14a, YCTD-102): y tế lập đợt cân đo, chọn lớp, nhập cân nặng, chiều
// cao từng học sinh hoặc nhập từ Excel; "Tính và lưu" ghi số đo rồi hiện tháng tuổi, BMI, kết quả theo chuẩn WHO do máy chủ
// tính; xem biểu đồ tăng trưởng của học sinh. Giáo viên chủ nhiệm, Ban Giám hiệu xem
const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const selectClass = 'rounded-lg border border-border bg-card px-3 py-2 text-content';
const inputClass = 'w-24 rounded-lg border border-border bg-card px-2 py-1 text-content';
const formatZ = (value: number | null) => (value === null ? '' : value.toFixed(2));

type Draft = Record<string, { weight_kg: string; height_cm: string }>;

function channelSummary(row: GridRow): string {
  const { weight_status, height_status, weight_height_status } = row.assessment;
  if (row.weight_kg === null && row.height_cm === null) {
    return '';
  }
  const abnormal = [weight_status, height_status, weight_height_status].filter(
    (status) => status !== null && status !== 'normal',
  );
  if (abnormal.length === 0) {
    return weight_status && height_status && weight_height_status ? 'Bình thường' : '';
  }
  return abnormal.map((status) => statusLabel(status)).join('; ');
}

export function GrowthPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.healthManage);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [roundId, setRoundId] = useState('');
  const [classId, setClassId] = useState('');
  const [name, setName] = useState('');
  const [measuredOn, setMeasuredOn] = useState(vietnamToday);
  const [draft, setDraft] = useState<Draft>({});
  const [chartChildId, setChartChildId] = useState<string>();
  const [importResult, setImportResult] = useState<ImportResult>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  const rounds = useQuery({
    queryKey: ['growth-rounds', orgUnitId],
    queryFn: () => listRounds(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId),
    retry: false,
  });
  const classes = useQuery({
    queryKey: ['classes', orgUnitId],
    queryFn: () => listClasses(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId),
  });
  const grid = useQuery({
    queryKey: ['growth-grid', roundId, classId],
    queryFn: () => readGrid(roundId, classId),
    enabled: roundId !== '' && classId !== '',
    retry: false,
  });
  const chart = useQuery({
    queryKey: ['child-growth', chartChildId],
    queryFn: () => readChildGrowth(chartChildId ?? ''),
    enabled: Boolean(chartChildId),
    retry: false,
  });

  // Nạp số đo đã lưu vào ô nhập mỗi khi đổi lớp hoặc sau khi lưu
  useEffect(() => {
    if (grid.data) {
      setDraft(
        Object.fromEntries(
          grid.data.rows.map((row) => [
            row.child_id,
            { weight_kg: row.weight_kg?.toString() ?? '', height_cm: row.height_cm?.toString() ?? '' },
          ]),
        ),
      );
    }
  }, [grid.data]);

  const create = useMutation({
    mutationFn: () => createRound({ org_unit_id: orgUnitId ?? '', name, measured_on: measuredOn }),
    onSuccess: async (round) => {
      setName('');
      setRoundId(round.id);
      setToastMessage('Đã lập đợt cân đo');
      await queryClient.invalidateQueries({ queryKey: ['growth-rounds'] });
    },
  });
  const save = useMutation({
    mutationFn: () =>
      saveMeasurements(
        roundId,
        (grid.data?.rows ?? []).map((row) => ({
          child_id: row.child_id,
          weight_kg: draft[row.child_id]?.weight_kg.trim() || null,
          height_cm: draft[row.child_id]?.height_cm.trim() || null,
          note: row.note,
        })),
      ),
    onSuccess: async (result) => {
      setToastMessage(`Đã tính và lưu ${result.saved_count} học sinh`);
      await queryClient.invalidateQueries({ queryKey: ['growth-grid'] });
      await queryClient.invalidateQueries({ queryKey: ['growth-rounds'] });
    },
  });
  const upload = useMutation({
    mutationFn: (file: File) => importMeasurements(roundId, file),
    onSuccess: async (result) => {
      setImportResult(result);
      if (result.errors.length === 0) {
        setToastMessage(`Đã nhập số đo của ${result.saved_count} học sinh`);
        await queryClient.invalidateQueries({ queryKey: ['growth-grid'] });
        await queryClient.invalidateQueries({ queryKey: ['growth-rounds'] });
      }
    },
  });
  const template = useMutation({ mutationFn: () => downloadTemplate(roundId, classId) });

  const editable = Boolean(grid.data?.can_edit);
  const setValue = (childId: string, key: 'weight_kg' | 'height_cm', value: string) =>
    setDraft((current) => ({
      ...current,
      [childId]: { weight_kg: '', height_cm: '', ...current[childId], [key]: value },
    }));

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">4.3.1 Nhập kết quả sức khỏe nuôi dưỡng</h1>
        <div className="flex flex-wrap items-end gap-3">
          <UnitSelect
            units={unitChoice.units}
            selectedId={orgUnitId}
            onSelect={(id) => {
              unitChoice.select(id);
              setRoundId('');
              setClassId('');
            }}
          />
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Đợt cân đo
            <select
              aria-label="Đợt cân đo"
              className={selectClass}
              value={roundId}
              onChange={(event) => setRoundId(event.target.value)}
            >
              <option value="">Chọn đợt</option>
              {(rounds.data ?? []).map((round) => (
                <option key={round.id} value={round.id}>
                  {round.name} ({round.measured_on.split('-').reverse().join('/')})
                </option>
              ))}
            </select>
          </label>
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
        </div>
        {rounds.error ? <Alert tone="danger">{messageOf(rounds.error)}</Alert> : null}

        {canManage ? (
          <form
            className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4"
            aria-label="Lập đợt cân đo"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <TextField label="Tên đợt cân đo" value={name} onChange={(event) => setName(event.target.value)} />
            <TextField
              label="Ngày cân đo"
              type="date"
              value={measuredOn}
              onChange={(event) => setMeasuredOn(event.target.value)}
            />
            <Button type="submit" variant="secondary" disabled={create.isPending || name.trim() === '' || !orgUnitId}>
              Lập đợt
            </Button>
            {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
          </form>
        ) : null}

        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        {grid.data ? (
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Bảng cân đo">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-section-title font-semibold text-text">
                Lớp {grid.data.class.name}, {grid.data.round.name}
              </h2>
              {editable ? (
                <>
                  <Button type="button" variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
                    Tính và lưu
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => template.mutate()}>
                    Tải tệp mẫu
                  </Button>
                  <label className="flex items-center gap-2 text-label text-text">
                    Nhập từ Excel
                    <input
                      type="file"
                      accept=".xlsx"
                      aria-label="Tệp Excel số đo"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          upload.mutate(file);
                        }
                        event.target.value = '';
                      }}
                    />
                  </label>
                </>
              ) : null}
            </div>
            {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
            {upload.error ? <Alert tone="danger">{messageOf(upload.error)}</Alert> : null}
            {template.error ? <Alert tone="danger">{messageOf(template.error)}</Alert> : null}
            {importResult && importResult.errors.length > 0 ? (
              <Alert tone="danger">
                Tệp có lỗi, chưa lưu dòng nào:{' '}
                {importResult.errors
                  .map((error) => `dòng ${error.row}${error.column ? `, cột ${error.column}` : ''}: ${error.message}`)
                  .join('; ')}
              </Alert>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full text-content">
                <thead className="text-left text-label font-medium text-text-secondary">
                  <tr>
                    <th className="px-2 py-2">STT</th>
                    <th className="px-2 py-2">Họ tên</th>
                    <th className="px-2 py-2">Ngày sinh</th>
                    <th className="px-2 py-2">Giới tính</th>
                    <th className="px-2 py-2">Tháng tuổi</th>
                    <th className="px-2 py-2">Cân nặng (kg)</th>
                    <th className="px-2 py-2">Chiều cao (cm)</th>
                    <th className="px-2 py-2">BMI</th>
                    <th className="px-2 py-2">Kết quả cân nặng</th>
                    <th className="px-2 py-2">Kết quả chiều cao</th>
                    <th className="px-2 py-2">Cân nặng theo chiều cao</th>
                    <th className="px-2 py-2">Kênh tăng trưởng</th>
                    <th className="px-2 py-2">Biểu đồ</th>
                  </tr>
                </thead>
                <tbody>
                  {grid.data.rows.map((row, index) => (
                    <tr key={row.child_id} className="border-t border-border">
                      <td className="px-2 py-2">{index + 1}</td>
                      <td className="px-2 py-2">{row.full_name}</td>
                      <td className="px-2 py-2">{row.dob.split('-').reverse().join('/')}</td>
                      <td className="px-2 py-2">{row.gender === 'female' ? 'Nữ' : 'Nam'}</td>
                      <td className="px-2 py-2">{row.assessment.age_months}</td>
                      <td className="px-2 py-2">
                        {editable ? (
                          <input
                            className={inputClass}
                            inputMode="decimal"
                            aria-label={`Cân nặng của ${row.full_name}`}
                            value={draft[row.child_id]?.weight_kg ?? ''}
                            onChange={(event) => setValue(row.child_id, 'weight_kg', event.target.value)}
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
                            value={draft[row.child_id]?.height_cm ?? ''}
                            onChange={(event) => setValue(row.child_id, 'height_cm', event.target.value)}
                          />
                        ) : (
                          (row.height_cm ?? '')
                        )}
                      </td>
                      <td className="px-2 py-2">{row.assessment.bmi ?? ''}</td>
                      <td className="px-2 py-2" title={formatZ(row.assessment.weight_for_age_z)}>
                        {statusLabel(row.assessment.weight_status)}
                      </td>
                      <td className="px-2 py-2" title={formatZ(row.assessment.height_for_age_z)}>
                        {statusLabel(row.assessment.height_status)}
                      </td>
                      <td
                        className="px-2 py-2"
                        title={formatZ(row.assessment.weight_for_height_z ?? row.assessment.bmi_for_age_z)}
                      >
                        {statusLabel(row.assessment.weight_height_status)}
                        {row.assessment.weight_height_basis === 'bmi_for_age' ? ' (theo BMI)' : ''}
                      </td>
                      <td className="px-2 py-2" data-testid={`kenh-${row.child_id}`}>
                        {channelSummary(row)}
                      </td>
                      <td className="px-2 py-2">
                        <Button
                          type="button"
                          variant="text"
                          aria-label={`Biểu đồ của ${row.full_name}`}
                          onClick={() => setChartChildId(row.child_id)}
                        >
                          Xem
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-label text-text-secondary">
              Kết quả tính theo chuẩn tăng trưởng WHO: dưới −2SD là suy dinh dưỡng; cân nặng theo chiều cao trên +2SD là
              thừa cân, trên +3SD là béo phì; từ 61 tháng tuổi dùng BMI theo tuổi. Di chuột lên kết quả để xem chỉ số Z.
            </p>
          </section>
        ) : null}

        {chartChildId ? (
          <section
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            aria-label="Biểu đồ tăng trưởng"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-section-title font-semibold text-text">
                Biểu đồ tăng trưởng {chart.data ? `của ${chart.data.child.full_name}` : ''}
              </h2>
              <Button type="button" variant="text" onClick={() => setChartChildId(undefined)}>
                Đóng biểu đồ
              </Button>
            </div>
            {chart.error ? <Alert tone="danger">{messageOf(chart.error)}</Alert> : null}
            {chart.data ? <GrowthChart data={chart.data} /> : null}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
