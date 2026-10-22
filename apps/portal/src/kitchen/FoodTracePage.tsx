import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FOOD_CERTIFICATE_TYPES,
  FOOD_CERTIFICATE_VALIDITY,
  FOOD_CHECK_RESULTS,
  FOOD_LOT_STATUSES,
  PERMISSION_CODES,
} from '@school-management/shared';
import { Alert, Button, StatusBadge, TextField, Toast, type StatusTone } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { SelectBox } from '../facilities/facilities-ui.js';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import {
  clockTime,
  formatDay,
  formatMoment,
  holdSample,
  labelOf,
  readTrace,
  type CertificateValidity,
  type TraceDish,
  type TraceLot,
} from './food-safety-api.js';
import { MEAL_LABELS, messageOf, vietnamToday } from './kitchen-api.js';

// 3.5 Truy xuất nguồn gốc (DT-18 phần 22b, YCTD-146): từ món ăn của một ngày ra lô hàng, nhà cung cấp, giấy tờ an toàn thực
// phẩm còn hiệu lực vào ngày đó, kết quả ba bước kiểm tra và mẫu lưu. Lô ghi ở bước 2 là "đã ghi"; ngày chưa ghi lô thì hệ
// thống suy ra theo nguyên liệu của món, cần đối chiếu. Khi có phản ánh thì giữ mẫu ngay tại đây
const VALIDITY_TONES: Record<CertificateValidity, StatusTone> = {
  valid: 'success',
  expiring: 'warning',
  expired: 'danger',
  revoked: 'neutral',
};

const result = (value: string | null | undefined) => labelOf(FOOD_CHECK_RESULTS, value) || 'Chưa ghi';

function LotCard({ lot }: { lot: TraceLot }) {
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-border p-3">
      <p className="font-medium text-text">
        Lô {lot.code} – {lot.ingredient_name} ({lot.quantity.toLocaleString('vi-VN')} {lot.unit}){' '}
        <span className="text-label text-text-secondary">{labelOf(FOOD_LOT_STATUSES, lot.status)}</span>
      </p>
      <p>
        Nhà cung cấp: {lot.supplier_name}
        {lot.supplier_address ? `, ${lot.supplier_address}` : ''}
        {lot.supplier_phone ? `, điện thoại ${lot.supplier_phone}` : ''}
      </p>
      <p>
        Nhập ngày {formatDay(lot.received_date)} {clockTime(lot.received_time)}
        {lot.lot_number ? `; số lô ${lot.lot_number}` : ''}
        {lot.expiry_date ? `; hạn dùng ${formatDay(lot.expiry_date)}` : ''}
        {lot.document_number ? `; chứng từ ${lot.document_number}` : ''}
        {lot.purchase_code ? `; phiếu đi chợ ${lot.purchase_code}` : ''}
      </p>
      <p>
        Kiểm tra bước 1:{' '}
        {lot.first_step
          ? `ngày ${formatDay(lot.first_step.inspection_date)}, ${lot.first_step.inspector_name}; cảm quan ${result(
              lot.first_step.sensory_result,
            )}; xét nghiệm nhanh ${labelOf(FOOD_CHECK_RESULTS, lot.first_step.rapid_test_result) || 'không làm'}`
          : 'chưa kiểm tra'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span>Giấy tờ nhà cung cấp:</span>
        {lot.certificates.length === 0 ? <StatusBadge tone="danger" label="Chưa có giấy tờ" /> : null}
        {lot.certificates.map((certificate) => (
          <span key={certificate.id} className="inline-flex items-center gap-1">
            {labelOf(FOOD_CERTIFICATE_TYPES, certificate.certificate_type)} số {certificate.number}
            <StatusBadge
              tone={VALIDITY_TONES[certificate.validity_on_date]}
              label={labelOf(FOOD_CERTIFICATE_VALIDITY, certificate.validity_on_date)}
            />
          </span>
        ))}
      </div>
    </li>
  );
}

function DishCard({
  dish,
  canInspect,
  onHold,
  holding,
}: {
  dish: TraceDish;
  canInspect: boolean;
  onHold(sampleId: string, dishName: string): void;
  holding: boolean;
}) {
  return (
    <article
      aria-label={`${MEAL_LABELS[dish.meal_type]} – ${dish.dish_name}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-content break-inside-avoid"
    >
      <h2 className="text-section-title font-semibold text-text">
        {MEAL_LABELS[dish.meal_type]} – {dish.dish_name}
        {dish.servings !== null ? ` (${dish.servings} suất)` : ''}
      </h2>
      <div className="grid gap-2 md:grid-cols-2">
        <p>
          Bước 2 (khi chế biến):{' '}
          {dish.step2
            ? `cảm quan ${result(dish.step2.sensory_result)}; vệ sinh người ${result(
                dish.step2.hygiene_people,
              )}, dụng cụ ${result(dish.step2.hygiene_equipment)}, khu vực ${result(dish.step2.hygiene_area)}${
                dish.step2.inspection_status === 'draft' ? ' (phiếu chưa xác nhận)' : ''
              }`
            : 'chưa ghi'}
        </p>
        <p>
          Bước 3 (trước khi ăn):{' '}
          {dish.step3
            ? `cảm quan ${result(dish.step3.sensory_result)}${
                dish.step3.inspection_status === 'draft' ? ' (phiếu chưa xác nhận)' : ''
              }`
            : 'chưa ghi'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Lô hàng đã dùng</span>
        {dish.lots_source === 'recorded' ? <StatusBadge tone="success" label="Đã ghi ở bước 2" /> : null}
        {dish.lots_source === 'inferred' ? (
          <StatusBadge tone="warning" label="Suy ra theo nguyên liệu – cần đối chiếu" />
        ) : null}
        {dish.lots_source === 'none' ? <StatusBadge tone="neutral" label="Không tìm thấy lô" /> : null}
      </div>
      {dish.lots.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {dish.lots.map((lot) => (
            <LotCard key={lot.id} lot={lot} />
          ))}
        </ul>
      ) : null}
      <div className="flex flex-col gap-1">
        <span className="font-medium">Mẫu lưu</span>
        {dish.samples.length === 0 ? <StatusBadge tone="danger" label="Chưa lưu mẫu" /> : null}
        {dish.samples.map((sample) => (
          <div key={sample.id} className="flex flex-wrap items-center gap-2">
            <span>
              Lấy lúc {formatMoment(sample.sampled_at)}, {sample.quantity.toLocaleString('vi-VN')}{' '}
              {sample.food_form === 'liquid' ? 'ml' : 'g'}, người lưu {sample.sampled_by_name}
            </span>
            {sample.status === 'held' ? (
              <StatusBadge tone="danger" label={`Đang giữ mẫu${sample.hold_reason ? `: ${sample.hold_reason}` : ''}`} />
            ) : sample.status === 'destroyed' ? (
              <StatusBadge tone="neutral" label={`Đã hủy ${formatMoment(sample.destroyed_at)}`} />
            ) : (
              <StatusBadge tone="info" label="Đang lưu" />
            )}
            {canInspect && sample.status === 'stored' ? (
              <Button
                variant="text"
                className="print:hidden"
                aria-label={`Giữ mẫu ${dish.dish_name}`}
                disabled={holding}
                onClick={() => onHold(sample.id, dish.dish_name)}
              >
                Giữ mẫu
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </article>
  );
}

export function FoodTracePage() {
  const canInspect = useHasPermission(PERMISSION_CODES.foodSafetyInspect);
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [date, setDate] = useState(vietnamToday());
  const [dishId, setDishId] = useState('');
  const [applied, setApplied] = useState({ date: vietnamToday(), dishId: '' });
  const [holdReason, setHoldReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  // Món của ngày để chọn truy xuất một món
  const dayDishes = useQuery({
    queryKey: ['food-trace', orgUnitId, date, ''],
    queryFn: () => readTrace({ org_unit_id: orgUnitId, date }),
    enabled: Boolean(orgUnitId && date),
  });
  const trace = useQuery({
    queryKey: ['food-trace', orgUnitId, applied.date, applied.dishId],
    queryFn: () => readTrace({ org_unit_id: orgUnitId, date: applied.date, dish_id: applied.dishId }),
    enabled: Boolean(orgUnitId && applied.date),
  });
  const hold = useMutation({
    mutationFn: ({ id }: { id: string; dishName: string }) => holdSample(id, holdReason.trim()),
    onSuccess: async (_sample, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['food-trace'] });
      await queryClient.invalidateQueries({ queryKey: ['food-samples'] });
      setToastMessage(`Đã giữ mẫu ${variables.dishName}`);
    },
  });
  const dishOptions = (dayDishes.data?.dishes ?? [])
    .filter((dish) => dish.dish_id !== null)
    .map((dish) => ({ value: dish.dish_id ?? '', label: `${MEAL_LABELS[dish.meal_type]} – ${dish.dish_name}` }));
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/food-safety/trace')}</h1>
        <form
          aria-label="Truy xuất nguồn gốc"
          className="grid items-end gap-3 md:grid-cols-4 print:hidden"
          onSubmit={(event) => {
            event.preventDefault();
            setApplied({ date, dishId });
          }}
        >
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
          <TextField
            label="Ngày ăn"
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setDishId('');
            }}
          />
          <SelectBox
            label="Món"
            value={dishId}
            options={dishOptions}
            emptyLabel="Mọi món của ngày"
            onChange={setDishId}
          />
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={!date}>
              Truy xuất
            </Button>
            <Button onClick={() => window.print()}>In trang</Button>
          </div>
        </form>
        {canInspect ? (
          <div className="grid gap-3 md:grid-cols-3 print:hidden">
            <TextField
              label="Lý do giữ mẫu"
              value={holdReason}
              onChange={(event) => setHoldReason(event.target.value)}
            />
          </div>
        ) : null}
        {hold.error ? <Alert tone="danger">{messageOf(hold.error)}</Alert> : null}
        {trace.error ? <Alert tone="danger">{messageOf(trace.error)}</Alert> : null}
        {trace.data ? (
          <>
            <p className="text-content text-text-secondary">
              Ngày {formatDay(trace.data.date)}: {trace.data.dishes.length} món
            </p>
            {trace.data.dishes.length === 0 ? (
              <p className="text-content text-text-secondary">
                Ngày này chưa có món trong phiếu kiểm thực và thực đơn đã công bố.
              </p>
            ) : null}
            {trace.data.dishes.map((dish) => (
              <DishCard
                key={`${dish.meal_type}-${dish.dish_id ?? dish.dish_name}`}
                dish={dish}
                canInspect={canInspect}
                holding={hold.isPending}
                onHold={(id, dishName) => {
                  if (!holdReason.trim()) {
                    setToastMessage('Ghi lý do giữ mẫu trước khi giữ');
                    return;
                  }
                  hold.mutate({ id, dishName });
                }}
              />
            ))}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
