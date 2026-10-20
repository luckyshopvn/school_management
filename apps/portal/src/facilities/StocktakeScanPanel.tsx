import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { EQUIPMENT_CONDITIONS, equipmentQrCodeOf } from '@school-management/shared';
import { Alert, Button, QrScanner, TextField } from '@school-management/ui';
import {
  listLocations,
  lookupQr,
  scanStocktake,
  type Condition,
  type EquipmentTarget,
  type StocktakeDetail,
  type StocktakeLine,
} from './equipment-18g-api.js';
import { formatNumber, messageOf } from './facilities-api.js';
import { SelectBox } from './facilities-ui.js';

// Quét kiểm kê trên web di động (DT-18 phần 18g): quét mã tem bằng máy ảnh hoặc nhập mã, xem thiết bị và số theo sổ, ghi
// tình trạng (từng thiết bị) hoặc số đếm được, số dùng được (lô), nơi thấy, ghi chú. Thiết bị ngoài sổ của đợt vẫn ghi được
export interface ScanTarget {
  line: StocktakeLine | null;
  qrCode: string | null;
  target: Pick<EquipmentTarget, 'target_type' | 'code' | 'name' | 'unit' | 'location_name' | 'quantity'>;
}

export function RecordForm({
  stocktake,
  scanned,
  onSaved,
  onCancel,
}: {
  stocktake: StocktakeDetail;
  scanned: ScanTarget;
  onSaved(line: StocktakeLine): void;
  onCancel(): void;
}) {
  const line = scanned.line;
  const isAsset = scanned.target.target_type === 'asset';
  const [condition, setCondition] = useState<Condition | ''>(line?.condition ?? (isAsset ? '' : ''));
  const [counted, setCounted] = useState(line?.counted_quantity?.toString() ?? '');
  const [usable, setUsable] = useState(line?.usable_quantity?.toString() ?? '');
  const [foundLocationId, setFoundLocationId] = useState(line?.found_location_id ?? '');
  const [note, setNote] = useState(line?.note ?? '');
  const locations = useQuery({
    queryKey: ['equipment-locations', stocktake.org_unit_id],
    queryFn: () => listLocations(stocktake.org_unit_id),
  });
  const save = useMutation({
    mutationFn: () =>
      scanStocktake(stocktake.id, {
        ...(line ? { line_id: line.id } : { qr_code: scanned.qrCode ?? '' }),
        condition: condition || null,
        counted_quantity: isAsset || counted === '' ? null : Number(counted),
        usable_quantity: isAsset || usable === '' ? null : Number(usable),
        found_location_id: foundLocationId || null,
        note: note || null,
      }),
    onSuccess: onSaved,
  });
  const expected = line ? line.expected_quantity : 0;
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Ghi kết quả kiểm kê"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex flex-col gap-1">
        <span className="text-content font-semibold text-text">
          {scanned.target.code} – {scanned.target.name}
        </span>
        <span className="text-label text-text-secondary">
          {isAsset ? 'Từng thiết bị' : 'Lô'}; nơi để theo sổ: {scanned.target.location_name ?? 'chưa gán'}; số theo sổ:{' '}
          {formatNumber(expected)} {scanned.target.unit}
          {line && !line.in_scope ? ' (ngoài sổ của đợt)' : ''}
          {!line ? ' (ngoài sổ của đợt, ghi thì thêm dòng mới)' : ''}
        </span>
      </div>
      {isAsset ? (
        <fieldset className="flex flex-wrap gap-3" aria-label="Tình trạng">
          {EQUIPMENT_CONDITIONS.map((item) => (
            <label key={item.value} className="flex items-center gap-2 text-content text-text">
              <input
                type="radio"
                name="condition"
                value={item.value}
                checked={condition === item.value}
                onChange={() => setCondition(item.value)}
              />
              {item.label}
            </label>
          ))}
        </fieldset>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <TextField
            label="Số đếm được"
            type="number"
            inputMode="decimal"
            min={0}
            value={counted}
            onChange={(event) => setCounted(event.target.value)}
          />
          <TextField
            label="Số dùng được"
            type="number"
            inputMode="decimal"
            min={0}
            value={usable}
            placeholder="Bằng số đếm được"
            onChange={(event) => setUsable(event.target.value)}
          />
          <SelectBox
            label="Tình trạng phần hỏng"
            value={condition === 'unusable' ? 'unusable' : 'damaged'}
            options={EQUIPMENT_CONDITIONS.filter((item) => item.value === 'damaged' || item.value === 'unusable')}
            onChange={(value) => setCondition(value as Condition)}
          />
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <SelectBox
          label="Nơi thấy"
          value={foundLocationId}
          options={(locations.data ?? [])
            .filter((location) => location.status === 'active')
            .map((location) => ({ value: location.id, label: location.name }))}
          emptyLabel="Đúng nơi để theo sổ"
          onChange={setFoundLocationId}
        />
        <TextField label="Ghi chú" value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          disabled={save.isPending || (isAsset && !condition) || (!isAsset && counted === '')}
        >
          Ghi kết quả
        </Button>
        <Button variant="text" onClick={onCancel}>
          Bỏ qua
        </Button>
      </div>
    </form>
  );
}

export function StocktakeScanPanel({
  stocktake,
  onRecorded,
}: {
  stocktake: StocktakeDetail;
  onRecorded(message: string): void;
}) {
  const [scanned, setScanned] = useState<ScanTarget>();
  const [error, setError] = useState<string>();
  async function handle(text: string) {
    setError(undefined);
    const code = equipmentQrCodeOf(text);
    if (!code) {
      setError('Mã đã quét không phải tem thiết bị');
      return;
    }
    const line = stocktake.lines.find((item) => item.qr_code === code) ?? null;
    if (line) {
      setScanned({
        line,
        qrCode: code,
        target: {
          target_type: line.target_type,
          code: line.code,
          name: line.name,
          unit: line.unit,
          location_name: line.location_name,
          quantity: line.expected_quantity,
        },
      });
      return;
    }
    try {
      const target = await lookupQr(code);
      if (target.org_unit_id !== stocktake.org_unit_id) {
        setError(`Thiết bị thuộc ${target.org_unit_name}, không thuộc đơn vị của đợt kiểm kê`);
        return;
      }
      setScanned({ line: null, qrCode: code, target });
    } catch (lookupError) {
      setError(messageOf(lookupError));
    }
  }
  return (
    <section className="flex flex-col gap-3" aria-label="Quét kiểm kê">
      <h2 className="text-section-title font-semibold text-text">Quét kiểm kê</h2>
      <QrScanner onScan={(text) => void handle(text)} disabled={stocktake.status !== 'counting'} />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {scanned ? (
        <RecordForm
          key={`${scanned.qrCode}:${scanned.line?.id ?? ''}`}
          stocktake={stocktake}
          scanned={scanned}
          onCancel={() => setScanned(undefined)}
          onSaved={(line) => {
            setScanned(undefined);
            onRecorded(`Đã ghi ${line.code} – ${line.name}`);
          }}
        />
      ) : null}
    </section>
  );
}
