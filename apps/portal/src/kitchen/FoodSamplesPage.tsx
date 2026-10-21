import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FOOD_SAMPLE_FORMS,
  FOOD_SAMPLE_MINIMUM,
  FOOD_SAMPLE_STATUSES,
  FOOD_SAMPLE_TEMPERATURE,
  PERMISSION_CODES,
} from '@school-management/shared';
import {
  Alert,
  Button,
  DataGrid,
  StatusBadge,
  TextField,
  Toast,
  type DataGridColumn,
  type StatusTone,
} from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { SelectBox } from '../facilities/facilities-ui.js';
import { fieldErrorsOf } from '../facilities/facilities-api.js';
import { AppShell } from '../pages/AppShell.js';
import { matchesSearch } from '../pages/grid-search.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import {
  addDays,
  createSample,
  destroySamples,
  downloadBook,
  formatDay,
  formatMoment,
  holdSample,
  listSampleSuggestions,
  listSamples,
  localMomentNow,
  releaseSample,
  type FoodSample,
  type SampleSuggestion,
} from './food-safety-api.js';
import { MEAL_LABELS, MEAL_TYPES, messageOf, vietnamToday, type MealType } from './kitchen-api.js';

// 3.2 Lưu và hủy mẫu thức ăn (DT-18 phần 22b, YCTD-146; BR-143) theo mẫu số 5 của Quyết định 1246/QĐ-BYT: mỗi món một mẫu
// (tối thiểu 100 g thức ăn đặc, 150 ml thức ăn lỏng; bảo quản 2–8 °C), lưu ít nhất 24 giờ rồi hủy, ghi người hủy và chất lượng
// mẫu; khi có phản ánh, nghi ngộ độc thì giữ mẫu, mẫu giữ không hủy được. In sổ lưu mẫu và nhãn mẫu theo khoảng ngày
function sampleState(row: FoodSample): { label: string; tone: StatusTone } {
  if (row.status === 'destroyed') {
    return { label: 'Đã hủy', tone: 'neutral' };
  }
  if (row.status === 'held') {
    return { label: 'Giữ mẫu, chưa được hủy', tone: 'danger' };
  }
  return row.destroy_state === 'due' ? { label: 'Đến hạn hủy', tone: 'warning' } : { label: 'Đang lưu', tone: 'info' };
}

const COLUMNS: Array<DataGridColumn<FoodSample>> = [
  {
    id: 'dish',
    header: 'Tên mẫu',
    alwaysVisible: true,
    cell: (row) => <span className="font-medium">{row.dish_name}</span>,
  },
  { id: 'date', header: 'Ngày', cell: (row) => formatDay(row.sample_date) },
  { id: 'meal', header: 'Bữa', cell: (row) => MEAL_LABELS[row.meal_type] },
  { id: 'servings', header: 'Số suất', cell: (row) => row.servings },
  {
    id: 'quantity',
    header: 'Khối lượng (g/ml)',
    cell: (row) => `${row.quantity.toLocaleString('vi-VN')} ${row.food_form === 'liquid' ? 'ml' : 'g'}`,
  },
  { id: 'container', header: 'Dụng cụ', cell: (row) => row.container },
  { id: 'temperature', header: 'Nhiệt độ', cell: (row) => `${row.storage_temperature} °C` },
  { id: 'sampled_at', header: 'Lấy lúc', cell: (row) => formatMoment(row.sampled_at) },
  { id: 'sampled_by', header: 'Người lưu', cell: (row) => row.sampled_by_name },
  { id: 'earliest', header: 'Hủy được từ', cell: (row) => formatMoment(row.earliest_destroy_at) },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) => {
      const state = sampleState(row);
      return (
        <span className="flex flex-col gap-1">
          <StatusBadge tone={state.tone} label={state.label} />
          {row.status === 'held' && row.hold_reason ? (
            <span className="text-label text-text-secondary">{row.hold_reason}</span>
          ) : null}
        </span>
      );
    },
  },
  { id: 'destroyed_by', header: 'Người hủy', cell: (row) => row.destroyed_by_name ?? '' },
  { id: 'destroyed_at', header: 'Thời điểm hủy', cell: (row) => formatMoment(row.destroyed_at) },
  { id: 'quality', header: 'Chất lượng mẫu', hiddenByDefault: true, cell: (row) => row.quality_note ?? '' },
  { id: 'note', header: 'Ghi chú', hiddenByDefault: true, cell: (row) => row.note ?? '' },
];

function SampleForm({ orgUnitId, onSaved }: { orgUnitId: string; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const [sampleDate, setSampleDate] = useState(vietnamToday());
  const [form, setForm] = useState({
    meal_type: 'lunch' as MealType,
    dish_id: null as string | null,
    dish_name: '',
    servings: '',
    food_form: 'solid' as 'solid' | 'liquid',
    quantity: String(FOOD_SAMPLE_MINIMUM.solid),
    container: 'Hộp inox có nắp',
    storage_temperature: '4',
    sampled_at: localMomentNow(),
    note: '',
  });
  const suggestions = useQuery({
    queryKey: ['food-sample-suggestions', orgUnitId, sampleDate],
    queryFn: () => listSampleSuggestions(orgUnitId, sampleDate),
    enabled: Boolean(sampleDate),
  });
  const save = useMutation({
    mutationFn: () =>
      createSample({
        org_unit_id: orgUnitId,
        sample_date: sampleDate,
        meal_type: form.meal_type,
        dish_id: form.dish_id,
        dish_name: form.dish_name,
        servings: form.servings === '' ? null : Number(form.servings),
        food_form: form.food_form,
        quantity: form.quantity === '' ? null : Number(form.quantity),
        container: form.container,
        storage_temperature: form.storage_temperature === '' ? null : Number(form.storage_temperature),
        sampled_at: form.sampled_at,
        note: form.note || null,
      }),
    onSuccess: async (sample) => {
      await queryClient.invalidateQueries({ queryKey: ['food-samples'] });
      await queryClient.invalidateQueries({ queryKey: ['food-sample-suggestions'] });
      setForm({ ...form, dish_id: null, dish_name: '', servings: '', note: '', sampled_at: localMomentNow() });
      onSaved(`Đã lưu mẫu ${sample.dish_name}`);
    },
  });
  const errors = fieldErrorsOf(save.error);
  const pick = (suggestion: SampleSuggestion) =>
    setForm({
      ...form,
      meal_type: suggestion.meal_type ?? form.meal_type,
      dish_id: suggestion.dish_id,
      dish_name: suggestion.dish_name ?? '',
      servings: String(suggestion.servings),
    });
  const minimum = FOOD_SAMPLE_MINIMUM[form.food_form];
  const unit = form.food_form === 'liquid' ? 'ml' : 'g';
  return (
    <form
      aria-label="Lưu mẫu thức ăn"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-3 md:grid-cols-4">
        <TextField
          label="Ngày lưu mẫu"
          type="date"
          value={sampleDate}
          error={errors.sample_date}
          onChange={(event) => setSampleDate(event.target.value)}
        />
      </div>
      {suggestions.data && suggestions.data.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-label font-medium text-text">Món của ngày theo thực đơn đã công bố</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.data.map((suggestion) => (
              <Button
                key={`${suggestion.meal_type}-${suggestion.dish_id ?? suggestion.dish_name}`}
                variant={suggestion.sampled ? 'text' : 'secondary'}
                aria-label={`Chọn món ${suggestion.dish_name ?? ''} ${suggestion.meal_type ? MEAL_LABELS[suggestion.meal_type] : ''}`}
                onClick={() => pick(suggestion)}
              >
                {suggestion.meal_type ? `${MEAL_LABELS[suggestion.meal_type]}: ` : ''}
                {suggestion.dish_name} – {suggestion.servings} suất
                {suggestion.required ? ' (bắt buộc lưu mẫu)' : ''}
                {suggestion.sampled ? ' – đã lưu' : ''}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-4">
        <SelectBox
          label="Bữa"
          value={form.meal_type}
          options={MEAL_TYPES.map((meal) => ({ value: meal, label: MEAL_LABELS[meal] }))}
          error={errors.meal_type}
          onChange={(value) => setForm({ ...form, meal_type: value as MealType })}
        />
        <TextField
          label="Tên món"
          value={form.dish_name}
          error={errors.dish_name}
          onChange={(event) => setForm({ ...form, dish_name: event.target.value, dish_id: null })}
        />
        <TextField
          label="Số suất"
          type="number"
          min={0}
          value={form.servings}
          error={errors.servings}
          onChange={(event) => setForm({ ...form, servings: event.target.value })}
        />
        <SelectBox
          label="Dạng thức ăn"
          value={form.food_form}
          options={FOOD_SAMPLE_FORMS}
          error={errors.food_form}
          onChange={(value) => {
            const next = value as 'solid' | 'liquid';
            setForm({ ...form, food_form: next, quantity: String(FOOD_SAMPLE_MINIMUM[next]) });
          }}
        />
        <div className="flex flex-col gap-1">
          <TextField
            label={`Khối lượng (${unit})`}
            type="number"
            min={0}
            value={form.quantity}
            error={errors.quantity}
            onChange={(event) => setForm({ ...form, quantity: event.target.value })}
          />
          <p className="text-label text-text-secondary">
            Tối thiểu {minimum} {unit}
          </p>
        </div>
        <TextField
          label="Dụng cụ chứa"
          value={form.container}
          error={errors.container}
          onChange={(event) => setForm({ ...form, container: event.target.value })}
        />
        <div className="flex flex-col gap-1">
          <TextField
            label="Nhiệt độ bảo quản (°C)"
            type="number"
            step="0.1"
            value={form.storage_temperature}
            error={errors.storage_temperature}
            onChange={(event) => setForm({ ...form, storage_temperature: event.target.value })}
          />
          <p className="text-label text-text-secondary">
            Từ {FOOD_SAMPLE_TEMPERATURE.minimum} đến {FOOD_SAMPLE_TEMPERATURE.maximum} °C
          </p>
        </div>
        <TextField
          label="Thời điểm lấy mẫu"
          type="datetime-local"
          value={form.sampled_at}
          error={errors.sampled_at}
          onChange={(event) => setForm({ ...form, sampled_at: event.target.value })}
        />
        <TextField
          label="Ghi chú"
          value={form.note}
          onChange={(event) => setForm({ ...form, note: event.target.value })}
        />
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Lưu mẫu
        </Button>
      </div>
    </form>
  );
}

export function FoodSamplesPage() {
  const canInspect = useHasPermission(PERMISSION_CODES.foodSafetyInspect);
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const grid = useGridSettings('food-samples');
  const today = vietnamToday();
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [qualityNote, setQualityNote] = useState('');
  const [holding, setHolding] = useState<FoodSample>();
  const [holdReason, setHoldReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const filters = { org_unit_id: orgUnitId, from, to, status };
  const list = useQuery({
    queryKey: ['food-samples', filters],
    queryFn: () => listSamples(filters),
    enabled: Boolean(orgUnitId),
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['food-samples'] });
    setToastMessage(message);
  };
  const destroy = useMutation({
    mutationFn: (ids: string[]) => destroySamples(ids, qualityNote || null),
    onSuccess: async (rows) => {
      setQualityNote('');
      await refresh(`Đã hủy ${rows.length} mẫu`);
    },
  });
  const hold = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string | null }) =>
      reason === null ? releaseSample(id) : holdSample(id, reason),
    onSuccess: async (sample) => {
      setHolding(undefined);
      setHoldReason('');
      await refresh(sample.status === 'held' ? `Đã giữ mẫu ${sample.dish_name}` : `Đã bỏ giữ mẫu ${sample.dish_name}`);
    },
  });
  const print = useMutation({
    mutationFn: ({ book, format }: { book: 'samples' | 'labels'; format: 'pdf' | 'xlsx' }) =>
      downloadBook({ org_unit_id: orgUnitId ?? '', from, to, book, format }),
  });
  const rows = (list.data ?? []).filter((row) => matchesSearch(search, row.dish_name, row.container));
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/food-safety/samples')}</h1>
        <div className="grid gap-3 md:grid-cols-4">
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
          <TextField label="Từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <TextField label="Đến ngày" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          <SelectBox
            label="Trạng thái"
            value={status}
            options={FOOD_SAMPLE_STATUSES}
            emptyLabel="Mọi trạng thái"
            onChange={setStatus}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={print.isPending || !orgUnitId}
            onClick={() => print.mutate({ book: 'samples', format: 'pdf' })}
          >
            In sổ lưu mẫu
          </Button>
          <Button
            disabled={print.isPending || !orgUnitId}
            aria-label="In sổ lưu mẫu Excel"
            onClick={() => print.mutate({ book: 'samples', format: 'xlsx' })}
          >
            Sổ lưu mẫu Excel
          </Button>
          <Button
            disabled={print.isPending || !orgUnitId}
            onClick={() => print.mutate({ book: 'labels', format: 'pdf' })}
          >
            In nhãn mẫu
          </Button>
        </div>
        {print.error ? <Alert tone="danger">{messageOf(print.error)}</Alert> : null}
        {creating && orgUnitId ? <SampleForm key={orgUnitId} orgUnitId={orgUnitId} onSaved={setToastMessage} /> : null}
        {holding ? (
          <form
            aria-label="Giữ mẫu thức ăn"
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            onSubmit={(event) => {
              event.preventDefault();
              hold.mutate({ id: holding.id, reason: holdReason });
            }}
          >
            <p className="text-content text-text">
              Giữ mẫu {holding.dish_name} ngày {formatDay(holding.sample_date)}: mẫu giữ không hủy được đến khi bỏ giữ.
            </p>
            <TextField
              label="Lý do giữ mẫu"
              value={holdReason}
              onChange={(event) => setHoldReason(event.target.value)}
            />
            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={hold.isPending || !holdReason.trim()}>
                Xác nhận giữ mẫu
              </Button>
              <Button variant="text" onClick={() => setHolding(undefined)}>
                Thôi
              </Button>
            </div>
          </form>
        ) : null}
        {list.error ? <Alert tone="danger">{messageOf(list.error)}</Alert> : null}
        {destroy.error ? <Alert tone="danger">{messageOf(destroy.error)}</Alert> : null}
        {hold.error ? <Alert tone="danger">{messageOf(hold.error)}</Alert> : null}
        <DataGrid
          label="Mẫu thức ăn lưu"
          columns={COLUMNS}
          rows={rows}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `${row.dish_name} ${formatDay(row.sample_date)}`}
          loading={list.isPending && Boolean(orgUnitId)}
          emptyText="Chưa có mẫu thức ăn lưu trong khoảng ngày."
          search={{ label: 'Tìm theo tên món, dụng cụ', value: search, onChange: setSearch }}
          selectable={canInspect}
          toolbar={
            canInspect
              ? (selected) => (
                  <div className="flex flex-wrap items-end gap-2">
                    <Button variant="primary" onClick={() => setCreating(!creating)}>
                      Lưu mẫu
                    </Button>
                    <TextField
                      label="Chất lượng mẫu khi hủy"
                      value={qualityNote}
                      onChange={(event) => setQualityNote(event.target.value)}
                    />
                    <Button
                      variant="danger"
                      disabled={destroy.isPending || selected.length === 0}
                      onClick={() => destroy.mutate(selected.map((row) => row.id))}
                    >
                      Hủy mẫu đã chọn
                    </Button>
                  </div>
                )
              : null
          }
          rowActions={
            canInspect
              ? (row) =>
                  row.status === 'stored' ? (
                    <Button
                      variant="text"
                      aria-label={`Giữ mẫu ${row.dish_name}`}
                      onClick={() => {
                        setHolding(row);
                        setHoldReason('');
                      }}
                    >
                      Giữ mẫu
                    </Button>
                  ) : row.status === 'held' ? (
                    <Button
                      variant="text"
                      aria-label={`Bỏ giữ ${row.dish_name}`}
                      disabled={hold.isPending}
                      onClick={() => hold.mutate({ id: row.id, reason: null })}
                    >
                      Bỏ giữ
                    </Button>
                  ) : null
              : undefined
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}
