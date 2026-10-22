import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FOOD_CHECK_RESULTS,
  FOOD_INSPECTION_STEPS,
  FOOD_REJECTION_ACTIONS,
  PERMISSION_CODES,
} from '@school-management/shared';
import { Alert, Button, DataGrid, StatusBadge, TextField, Toast, type DataGridColumn } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { SelectBox, TabBar } from '../facilities/facilities-ui.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { fetchCurrentUser } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  addDays,
  clockTime,
  confirmInspection,
  createInspection,
  downloadBook,
  formatDay,
  labelOf,
  listInspections,
  listLots,
  readInspectionDay,
  updateInspection,
  type CheckResult,
  type InspectionLine,
  type InspectionLineInput,
  type InspectionListItem,
  type InspectionSheet,
} from './food-safety-api.js';
import { MEAL_LABELS, MEAL_TYPES, messageOf, vietnamToday, type MealType } from './kitchen-api.js';

// 3.1 Kiểm thực ba bước (DT-18 phần 22b, YCTD-146; BR-144) theo Quyết định 1246/QĐ-BYT: mỗi ngày mỗi bước một phiếu. Lập
// phiếu thì máy chủ gợi ý sẵn dòng (bước 1 các lô chờ kiểm tra, bước 2, 3 các món của thực đơn đã công bố và số suất);
// người kiểm thực ghi kết quả, ghi phiếu, xác nhận phiếu (khóa). Xác nhận bước 1 thì lô đạt được nhận, lô không đạt ghi cách
// xử lý. In sổ kiểm thực ba bước theo khoảng ngày
type StepKey = '1' | '2' | '3';
type EditLine = InspectionLineInput & { key: string; lot: InspectionLine['lot']; lots: InspectionLine['lots'] };

const cellClass = 'rounded-lg border border-border bg-card px-2 py-1 text-content disabled:bg-surface';
const RESULT_OPTIONS = FOOD_CHECK_RESULTS.map((item) => ({ value: item.value, label: item.label }));

const LIST_COLUMNS: Array<DataGridColumn<InspectionListItem>> = [
  { id: 'date', header: 'Ngày', alwaysVisible: true, cell: (row) => formatDay(row.inspection_date) },
  { id: 'step', header: 'Bước', alwaysVisible: true, cell: (row) => labelOf(FOOD_INSPECTION_STEPS, String(row.step)) },
  { id: 'inspector', header: 'Người kiểm tra', cell: (row) => row.inspector_name },
  { id: 'lines', header: 'Số dòng', cell: (row) => row.line_count },
  { id: 'fails', header: 'Không đạt', cell: (row) => row.fail_count },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) =>
      row.status === 'confirmed' ? (
        <StatusBadge tone="success" label="Đã xác nhận" />
      ) : (
        <StatusBadge tone="warning" label="Nháp" />
      ),
  },
];

let lineSequence = 0;
const nextKey = () => `line-${(lineSequence += 1)}`;

function toEditLine(line: InspectionLine): EditLine {
  return {
    ...line,
    key: line.id,
    first_time: clockTime(line.first_time) || null,
    second_time: clockTime(line.second_time) || null,
    lot_ids: line.lots.map((lot) => lot.id),
  };
}

function emptyLine(): EditLine {
  return {
    key: nextKey(),
    lot_id: null,
    meal_type: 'lunch',
    dish_id: null,
    dish_name: '',
    main_ingredients: null,
    servings: null,
    first_time: null,
    second_time: null,
    hygiene_people: null,
    hygiene_equipment: null,
    hygiene_area: null,
    utensils: null,
    sensory_result: null,
    rapid_test_result: null,
    rejection_action: null,
    action: null,
    note: null,
    lot_ids: [],
    lot: null,
    lots: [],
  };
}

// Dòng gửi lên: bỏ thông tin hiển thị, lô của món lấy theo các thẻ lô đang chọn
const lineBody = (line: EditLine): InspectionLineInput => ({
  lot_id: line.lot_id,
  meal_type: line.meal_type,
  dish_id: line.dish_id,
  dish_name: line.dish_name,
  main_ingredients: line.main_ingredients,
  servings: line.servings,
  first_time: line.first_time,
  second_time: line.second_time,
  hygiene_people: line.hygiene_people,
  hygiene_equipment: line.hygiene_equipment,
  hygiene_area: line.hygiene_area,
  utensils: line.utensils,
  sensory_result: line.sensory_result,
  rapid_test_result: line.rapid_test_result,
  rejection_action: line.rejection_action,
  action: line.action,
  note: line.note,
  lot_ids: line.lots.map((lot) => lot.id),
});

function ResultSelect({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: CheckResult | null;
  disabled: boolean;
  onChange(value: CheckResult | null): void;
}) {
  return (
    <select
      aria-label={label}
      className={cellClass}
      value={value ?? ''}
      disabled={disabled}
      onChange={(event) => onChange((event.target.value || null) as CheckResult | null)}
    >
      <option value="">—</option>
      {RESULT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function TextCell({
  label,
  value,
  disabled,
  type = 'text',
  onChange,
}: {
  label: string;
  value: string | number | null;
  disabled: boolean;
  type?: 'text' | 'time' | 'number';
  onChange(value: string): void;
}) {
  return (
    <input
      aria-label={label}
      type={type}
      className={`${cellClass} ${type === 'text' ? 'min-w-32' : ''}`}
      value={value ?? ''}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function CreateSheetForm({
  orgUnitId,
  date,
  step,
  onCreated,
}: {
  orgUnitId: string;
  date: string;
  step: 1 | 2 | 3;
  onCreated(message: string): void;
}) {
  const queryClient = useQueryClient();
  const currentUser = useQuery({ queryKey: ['current-user'], queryFn: fetchCurrentUser });
  const [inspectorName, setInspectorName] = useState<string>();
  const [title, setTitle] = useState('');
  const [time, setTime] = useState(new Date(Date.now() + 7 * 3_600_000).toISOString().slice(11, 16));
  const [location, setLocation] = useState(step === 1 ? 'Khu tiếp nhận thực phẩm' : step === 2 ? 'Khu chế biến' : '');
  const name = inspectorName ?? currentUser.data?.full_name ?? '';
  const create = useMutation({
    mutationFn: () =>
      createInspection({
        org_unit_id: orgUnitId,
        inspection_date: date,
        step,
        inspector_name: name,
        inspector_title: title || null,
        inspected_time: time || null,
        location: location || null,
        note: null,
      }),
    onSuccess: async (sheet) => {
      await queryClient.invalidateQueries({ queryKey: ['food-inspection-day'] });
      await queryClient.invalidateQueries({ queryKey: ['food-inspections'] });
      onCreated(`Đã lập phiếu bước ${step} với ${sheet.lines.length} dòng gợi ý`);
    },
  });
  return (
    <form
      aria-label={`Lập phiếu bước ${step}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <p className="text-content text-text-secondary">
        Ngày {formatDay(date)} chưa có phiếu bước {step}. Lập phiếu thì hệ thống gợi ý sẵn{' '}
        {step === 1 ? 'các lô hàng chờ kiểm tra' : 'các món của thực đơn đã công bố và số suất'}.
      </p>
      <div className="grid gap-3 md:grid-cols-4">
        <TextField label="Người kiểm tra" value={name} onChange={(event) => setInspectorName(event.target.value)} />
        <TextField label="Chức vụ" value={title} onChange={(event) => setTitle(event.target.value)} />
        <TextField label="Giờ kiểm tra" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        <TextField label="Địa điểm" value={location} onChange={(event) => setLocation(event.target.value)} />
      </div>
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <div>
        <Button type="submit" variant="primary" disabled={create.isPending || !name.trim()}>
          Lập phiếu bước {step}
        </Button>
      </div>
    </form>
  );
}

function SheetEditor({
  sheet,
  canInspect,
  onMessage,
}: {
  sheet: InspectionSheet;
  canInspect: boolean;
  onMessage(message: string): void;
}) {
  const queryClient = useQueryClient();
  const readOnly = sheet.status === 'confirmed' || !canInspect;
  const [header, setHeader] = useState({
    inspector_name: sheet.inspector_name,
    inspector_title: sheet.inspector_title ?? '',
    inspected_time: clockTime(sheet.inspected_time),
    location: sheet.location ?? '',
    note: sheet.note ?? '',
  });
  const [lines, setLines] = useState<EditLine[]>(() => sheet.lines.map(toEditLine));
  // Lô đã đạt để gắn vào món ở bước 2
  const acceptedLots = useQuery({
    queryKey: ['food-lots', { org_unit_id: sheet.org_unit_id, status: 'accepted' }],
    queryFn: () => listLots({ org_unit_id: sheet.org_unit_id, status: 'accepted' }),
    enabled: sheet.step === 2 && !readOnly,
  });
  // Lô chờ kiểm tra nhập sau khi lập phiếu bước 1 thì thêm dòng tay
  const pendingLots = useQuery({
    queryKey: ['food-lots', { org_unit_id: sheet.org_unit_id, status: 'pending' }],
    queryFn: () => listLots({ org_unit_id: sheet.org_unit_id, status: 'pending' }),
    enabled: sheet.step === 1 && !readOnly,
  });
  const addableLots = (pendingLots.data ?? []).filter(
    (lot) => lot.received_date <= sheet.inspection_date && !lines.some((line) => line.lot_id === lot.id),
  );
  const body = () => ({
    inspector_name: header.inspector_name,
    inspector_title: header.inspector_title || null,
    inspected_time: header.inspected_time || null,
    location: header.location || null,
    note: header.note || null,
    lines: lines.map(lineBody),
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['food-inspection-day'] });
    await queryClient.invalidateQueries({ queryKey: ['food-inspections'] });
    await queryClient.invalidateQueries({ queryKey: ['food-lots'] });
  };
  const save = useMutation({
    mutationFn: () => updateInspection(sheet.id, body()),
    onSuccess: async () => {
      await refresh();
      onMessage(`Đã ghi phiếu bước ${sheet.step}`);
    },
  });
  // Xác nhận ghi phần đang sửa trước để máy chủ kiểm tra đúng nội dung trên màn hình
  const confirm = useMutation({
    mutationFn: async () => {
      await updateInspection(sheet.id, body());
      return confirmInspection(sheet.id);
    },
    onSuccess: async () => {
      await refresh();
      onMessage(`Đã xác nhận phiếu bước ${sheet.step}`);
    },
  });
  const change = (index: number, patch: Partial<EditLine>) =>
    setLines((current) => current.map((line, position) => (position === index ? { ...line, ...patch } : line)));
  const remove = (index: number) => setLines((current) => current.filter((_line, position) => position !== index));
  const textOf = (value: string) => value || null;
  const timeOf = (value: string) => value || null;
  const mealSelect = (line: EditLine, index: number) => (
    <select
      aria-label={`Bữa dòng ${index + 1}`}
      className={cellClass}
      value={line.meal_type ?? ''}
      disabled={readOnly}
      onChange={(event) => change(index, { meal_type: (event.target.value || null) as MealType | null })}
    >
      <option value="">—</option>
      {MEAL_TYPES.map((meal) => (
        <option key={meal} value={meal}>
          {MEAL_LABELS[meal]}
        </option>
      ))}
    </select>
  );
  const commonTail = (line: EditLine, index: number) => (
    <>
      <td>
        <ResultSelect
          label={`Cảm quan dòng ${index + 1}`}
          value={line.sensory_result}
          disabled={readOnly}
          onChange={(value) => change(index, { sensory_result: value })}
        />
      </td>
      <td>
        <TextCell
          label={`Biện pháp xử lý dòng ${index + 1}`}
          value={line.action}
          disabled={readOnly}
          onChange={(value) => change(index, { action: textOf(value) })}
        />
      </td>
      <td>
        <TextCell
          label={`Ghi chú dòng ${index + 1}`}
          value={line.note}
          disabled={readOnly}
          onChange={(value) => change(index, { note: textOf(value) })}
        />
      </td>
    </>
  );
  const removeCell = (index: number) =>
    readOnly ? null : (
      <td>
        <Button variant="text" aria-label={`Bỏ dòng ${index + 1}`} onClick={() => remove(index)}>
          Bỏ dòng
        </Button>
      </td>
    );
  const headers =
    sheet.step === 1
      ? [
          'Mã lô',
          'Nguyên liệu',
          'Nhà cung cấp',
          'Nhập lúc',
          'Khối lượng',
          'Hạn dùng',
          'Chứng từ',
          'Cảm quan',
          'Xét nghiệm nhanh',
          'Xử lý khi không đạt',
          'Biện pháp xử lý',
          'Ghi chú',
        ]
      : sheet.step === 2
        ? [
            'Bữa',
            'Tên món',
            'Nguyên liệu chính',
            'Số suất',
            'Sơ chế xong',
            'Chế biến xong',
            'Vệ sinh người',
            'Vệ sinh dụng cụ',
            'Vệ sinh khu vực',
            'Lô đã dùng',
            'Cảm quan',
            'Biện pháp xử lý',
            'Ghi chú',
          ]
        : [
            'Bữa',
            'Tên món',
            'Số suất',
            'Chia món xong',
            'Bắt đầu ăn',
            'Dụng cụ chia, chứa',
            'Cảm quan',
            'Biện pháp xử lý',
            'Ghi chú',
          ];
  const lotOptions = acceptedLots.data ?? [];
  return (
    <form
      aria-label={`Phiếu kiểm thực bước ${sheet.step}`}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-section-title font-semibold text-text">
          {labelOf(FOOD_INSPECTION_STEPS, String(sheet.step))} – ngày {formatDay(sheet.inspection_date)}
        </h2>
        {sheet.status === 'confirmed' ? (
          <StatusBadge tone="success" label="Đã xác nhận" />
        ) : (
          <StatusBadge tone="warning" label="Nháp" />
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        <TextField
          label="Người kiểm tra"
          value={header.inspector_name}
          disabled={readOnly}
          onChange={(event) => setHeader({ ...header, inspector_name: event.target.value })}
        />
        <TextField
          label="Chức vụ"
          value={header.inspector_title}
          disabled={readOnly}
          onChange={(event) => setHeader({ ...header, inspector_title: event.target.value })}
        />
        <TextField
          label="Giờ kiểm tra"
          type="time"
          value={header.inspected_time}
          disabled={readOnly}
          onChange={(event) => setHeader({ ...header, inspected_time: event.target.value })}
        />
        <TextField
          label="Địa điểm"
          value={header.location}
          disabled={readOnly}
          onChange={(event) => setHeader({ ...header, location: event.target.value })}
        />
        <TextField
          label="Ghi chú phiếu"
          value={header.note}
          disabled={readOnly}
          onChange={(event) => setHeader({ ...header, note: event.target.value })}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-content" aria-label={`Dòng kiểm tra bước ${sheet.step}`}>
          <thead>
            <tr className="text-left text-text-secondary">
              <th className="py-2 pr-2">STT</th>
              {headers.map((title) => (
                <th key={title} className="pr-2">
                  {title}
                </th>
              ))}
              {readOnly || sheet.step === 1 ? null : <th />}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={headers.length + 2} className="py-2 text-text-secondary">
                  {sheet.step === 1 ? 'Không có lô hàng chờ kiểm tra.' : 'Phiếu chưa có dòng nào.'}
                </td>
              </tr>
            ) : null}
            {lines.map((line, index) => (
              <tr key={line.key} className="border-t border-border align-top">
                <td className="py-2 pr-2">{index + 1}</td>
                {sheet.step === 1 ? (
                  <>
                    <td className="py-2 pr-2 font-medium">{line.lot?.code ?? ''}</td>
                    <td className="pr-2">{line.lot?.ingredient_name ?? ''}</td>
                    <td className="pr-2">{line.lot?.supplier_name ?? ''}</td>
                    <td className="pr-2">
                      {formatDay(line.lot?.received_date)} {clockTime(line.lot?.received_time)}
                    </td>
                    <td className="pr-2">
                      {line.lot ? `${line.lot.quantity.toLocaleString('vi-VN')} ${line.lot.unit}` : ''}
                    </td>
                    <td className="pr-2">{formatDay(line.lot?.expiry_date)}</td>
                    <td className="pr-2">{line.lot?.document_number ?? ''}</td>
                    <td>
                      <ResultSelect
                        label={`Cảm quan dòng ${index + 1}`}
                        value={line.sensory_result}
                        disabled={readOnly}
                        onChange={(value) => change(index, { sensory_result: value })}
                      />
                    </td>
                    <td>
                      <ResultSelect
                        label={`Xét nghiệm nhanh dòng ${index + 1}`}
                        value={line.rapid_test_result}
                        disabled={readOnly}
                        onChange={(value) => change(index, { rapid_test_result: value })}
                      />
                    </td>
                    <td>
                      {line.sensory_result === 'fail' || line.rapid_test_result === 'fail' ? (
                        <select
                          aria-label={`Xử lý khi không đạt dòng ${index + 1}`}
                          className={cellClass}
                          value={line.rejection_action ?? ''}
                          disabled={readOnly}
                          onChange={(event) =>
                            change(index, {
                              rejection_action: (event.target.value || null) as EditLine['rejection_action'],
                            })
                          }
                        >
                          <option value="">Chọn cách xử lý</option>
                          {FOOD_REJECTION_ACTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </td>
                    <td>
                      <TextCell
                        label={`Biện pháp xử lý dòng ${index + 1}`}
                        value={line.action}
                        disabled={readOnly}
                        onChange={(value) => change(index, { action: textOf(value) })}
                      />
                    </td>
                    <td>
                      <TextCell
                        label={`Ghi chú dòng ${index + 1}`}
                        value={line.note}
                        disabled={readOnly}
                        onChange={(value) => change(index, { note: textOf(value) })}
                      />
                    </td>
                  </>
                ) : sheet.step === 2 ? (
                  <>
                    <td>{mealSelect(line, index)}</td>
                    <td>
                      <TextCell
                        label={`Tên món dòng ${index + 1}`}
                        value={line.dish_name}
                        disabled={readOnly}
                        onChange={(value) => change(index, { dish_name: textOf(value) })}
                      />
                    </td>
                    <td>
                      <TextCell
                        label={`Nguyên liệu chính dòng ${index + 1}`}
                        value={line.main_ingredients}
                        disabled={readOnly}
                        onChange={(value) => change(index, { main_ingredients: textOf(value) })}
                      />
                    </td>
                    <td>
                      <TextCell
                        label={`Số suất dòng ${index + 1}`}
                        type="number"
                        value={line.servings}
                        disabled={readOnly}
                        onChange={(value) => change(index, { servings: value === '' ? null : Number(value) })}
                      />
                    </td>
                    <td>
                      <TextCell
                        label={`Sơ chế xong dòng ${index + 1}`}
                        type="time"
                        value={line.first_time}
                        disabled={readOnly}
                        onChange={(value) => change(index, { first_time: timeOf(value) })}
                      />
                    </td>
                    <td>
                      <TextCell
                        label={`Chế biến xong dòng ${index + 1}`}
                        type="time"
                        value={line.second_time}
                        disabled={readOnly}
                        onChange={(value) => change(index, { second_time: timeOf(value) })}
                      />
                    </td>
                    <td>
                      <ResultSelect
                        label={`Vệ sinh người dòng ${index + 1}`}
                        value={line.hygiene_people}
                        disabled={readOnly}
                        onChange={(value) => change(index, { hygiene_people: value })}
                      />
                    </td>
                    <td>
                      <ResultSelect
                        label={`Vệ sinh dụng cụ dòng ${index + 1}`}
                        value={line.hygiene_equipment}
                        disabled={readOnly}
                        onChange={(value) => change(index, { hygiene_equipment: value })}
                      />
                    </td>
                    <td>
                      <ResultSelect
                        label={`Vệ sinh khu vực dòng ${index + 1}`}
                        value={line.hygiene_area}
                        disabled={readOnly}
                        onChange={(value) => change(index, { hygiene_area: value })}
                      />
                    </td>
                    <td className="pr-2">
                      <ul className="flex flex-wrap gap-1" aria-label={`Lô đã dùng dòng ${index + 1}`}>
                        {line.lots.map((lot) => (
                          <li
                            key={lot.id}
                            className="inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-label text-info"
                          >
                            {lot.code} – {lot.ingredient_name}
                            {readOnly ? null : (
                              <button
                                type="button"
                                aria-label={`Bỏ lô ${lot.code} dòng ${index + 1}`}
                                className="font-bold"
                                onClick={() =>
                                  change(index, { lots: line.lots.filter((other) => other.id !== lot.id) })
                                }
                              >
                                ×
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                      {readOnly ? null : (
                        <select
                          aria-label={`Thêm lô dòng ${index + 1}`}
                          className={`${cellClass} mt-1`}
                          value=""
                          onChange={(event) => {
                            const lot = lotOptions.find((option) => option.id === event.target.value);
                            if (lot) {
                              change(index, {
                                lots: [
                                  ...line.lots,
                                  {
                                    id: lot.id,
                                    code: lot.code,
                                    ingredient_name: lot.ingredient_name,
                                    supplier_name: lot.supplier_name,
                                    received_date: lot.received_date,
                                    expiry_date: lot.expiry_date,
                                  },
                                ],
                              });
                            }
                          }}
                        >
                          <option value="">Thêm lô…</option>
                          {lotOptions
                            .filter((lot) => !line.lots.some((chosen) => chosen.id === lot.id))
                            .map((lot) => (
                              <option key={lot.id} value={lot.id}>
                                {lot.code} – {lot.ingredient_name} ({formatDay(lot.received_date)})
                              </option>
                            ))}
                        </select>
                      )}
                    </td>
                    {commonTail(line, index)}
                    {removeCell(index)}
                  </>
                ) : (
                  <>
                    <td>{mealSelect(line, index)}</td>
                    <td>
                      <TextCell
                        label={`Tên món dòng ${index + 1}`}
                        value={line.dish_name}
                        disabled={readOnly}
                        onChange={(value) => change(index, { dish_name: textOf(value) })}
                      />
                    </td>
                    <td>
                      <TextCell
                        label={`Số suất dòng ${index + 1}`}
                        type="number"
                        value={line.servings}
                        disabled={readOnly}
                        onChange={(value) => change(index, { servings: value === '' ? null : Number(value) })}
                      />
                    </td>
                    <td>
                      <TextCell
                        label={`Chia món xong dòng ${index + 1}`}
                        type="time"
                        value={line.first_time}
                        disabled={readOnly}
                        onChange={(value) => change(index, { first_time: timeOf(value) })}
                      />
                    </td>
                    <td>
                      <TextCell
                        label={`Bắt đầu ăn dòng ${index + 1}`}
                        type="time"
                        value={line.second_time}
                        disabled={readOnly}
                        onChange={(value) => change(index, { second_time: timeOf(value) })}
                      />
                    </td>
                    <td>
                      <TextCell
                        label={`Dụng cụ dòng ${index + 1}`}
                        value={line.utensils}
                        disabled={readOnly}
                        onChange={(value) => change(index, { utensils: textOf(value) })}
                      />
                    </td>
                    {commonTail(line, index)}
                    {removeCell(index)}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      {confirm.error ? <Alert tone="danger">{messageOf(confirm.error)}</Alert> : null}
      {readOnly ? null : (
        <div className="flex flex-wrap gap-2">
          {sheet.step === 1 ? (
            addableLots.length > 0 ? (
              <select
                aria-label="Thêm lô chờ kiểm tra"
                className={cellClass}
                value=""
                onChange={(event) => {
                  const lot = addableLots.find((item) => item.id === event.target.value);
                  if (lot) {
                    setLines([...lines, { ...emptyLine(), meal_type: null, dish_name: null, lot_id: lot.id, lot }]);
                  }
                }}
              >
                <option value="">Thêm lô chờ kiểm tra</option>
                {addableLots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.code} – {lot.ingredient_name}
                  </option>
                ))}
              </select>
            ) : null
          ) : (
            <Button onClick={() => setLines([...lines, emptyLine()])}>Thêm dòng</Button>
          )}
          <Button type="submit" variant="primary" disabled={save.isPending || confirm.isPending}>
            Ghi phiếu
          </Button>
          <Button disabled={save.isPending || confirm.isPending} onClick={() => confirm.mutate()}>
            Xác nhận phiếu
          </Button>
        </div>
      )}
    </form>
  );
}

function BookPanel({ orgUnitId, date }: { orgUnitId: string; date: string }) {
  const [from, setFrom] = useState(addDays(date, -6));
  const [to, setTo] = useState(date);
  const [format, setFormat] = useState<'pdf' | 'xlsx'>('pdf');
  const print = useMutation({
    mutationFn: () => downloadBook({ org_unit_id: orgUnitId, from, to, book: 'inspections', format }),
  });
  return (
    <section aria-label="In sổ kiểm thực" className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <TextField label="Sổ từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <TextField label="Sổ đến ngày" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <SelectBox
          label="Định dạng sổ"
          value={format}
          options={[
            { value: 'pdf', label: 'PDF' },
            { value: 'xlsx', label: 'Excel' },
          ]}
          onChange={(value) => setFormat(value as 'pdf' | 'xlsx')}
        />
        <Button disabled={print.isPending || !from || !to} onClick={() => print.mutate()}>
          In sổ kiểm thực
        </Button>
      </div>
      {print.error ? <Alert tone="danger">{messageOf(print.error)}</Alert> : null}
    </section>
  );
}

export function FoodInspectionsPage() {
  const canInspect = useHasPermission(PERMISSION_CODES.foodSafetyInspect);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const grid = useGridSettings('food-inspections');
  const [date, setDate] = useState(vietnamToday());
  const [step, setStep] = useState<StepKey>('1');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const day = useQuery({
    queryKey: ['food-inspection-day', orgUnitId, date],
    queryFn: () => readInspectionDay(orgUnitId ?? '', date),
    enabled: Boolean(orgUnitId && date),
  });
  const today = vietnamToday();
  const recentFilters = { org_unit_id: orgUnitId, from: addDays(today, -30), to: today };
  const recent = useQuery({
    queryKey: ['food-inspections', recentFilters],
    queryFn: () => listInspections(recentFilters),
    enabled: Boolean(orgUnitId),
  });
  const stepNumber = Number(step) as 1 | 2 | 3;
  const sheet = day.data?.steps[stepNumber - 1] ?? null;
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/food-safety/inspections')}</h1>
        <div className="grid gap-3 md:grid-cols-3">
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
          <TextField
            label="Ngày kiểm thực"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <TabBar<StepKey>
          label="Bước kiểm thực"
          tabs={FOOD_INSPECTION_STEPS.map((item): { key: StepKey; label: string } => {
            const own = day.data?.steps[Number(item.value) - 1];
            const state = own ? (own.status === 'confirmed' ? ' (đã xác nhận)' : ' (nháp)') : '';
            return { key: item.value, label: `${item.label}${state}` };
          })}
          current={step}
          onSelect={setStep}
        />
        {day.error ? <Alert tone="danger">{messageOf(day.error)}</Alert> : null}
        {orgUnitId && day.data ? (
          sheet ? (
            <SheetEditor
              key={`${sheet.id}-${sheet.status}-${JSON.stringify(sheet.lines.map((line) => line.id))}`}
              sheet={sheet}
              canInspect={canInspect}
              onMessage={setToastMessage}
            />
          ) : canInspect ? (
            <CreateSheetForm
              key={`${orgUnitId}-${date}-${step}`}
              orgUnitId={orgUnitId}
              date={date}
              step={stepNumber}
              onCreated={setToastMessage}
            />
          ) : (
            <p className="text-content text-text-secondary">
              Ngày {formatDay(date)} chưa có phiếu bước {step}.
            </p>
          )
        ) : null}
        {orgUnitId ? <BookPanel key={`${orgUnitId}-${date}`} orgUnitId={orgUnitId} date={date} /> : null}
        {recent.error ? <Alert tone="danger">{messageOf(recent.error)}</Alert> : null}
        <DataGrid
          label="Phiếu kiểm thực 30 ngày gần đây"
          columns={LIST_COLUMNS}
          rows={recent.data ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `Bước ${row.step} ngày ${formatDay(row.inspection_date)}`}
          loading={recent.isPending && Boolean(orgUnitId)}
          emptyText="Chưa có phiếu kiểm thực trong 30 ngày gần đây."
          onRowClick={(row) => {
            setDate(row.inspection_date);
            setStep(String(row.step) as StepKey);
          }}
          rowActions={(row) => (
            <Button
              variant="text"
              aria-label={`Mở phiếu bước ${row.step} ngày ${formatDay(row.inspection_date)}`}
              onClick={() => {
                setDate(row.inspection_date);
                setStep(String(row.step) as StepKey);
              }}
            >
              Mở
            </Button>
          )}
          activeRowId={sheet?.id}
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}
