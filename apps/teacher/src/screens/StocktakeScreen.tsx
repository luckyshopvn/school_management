import { useEffect, useState, type FormEvent } from 'react';
import { Alert, ApplicationHeader, Button, QrScanner } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Kiểm kê thiết bị bằng điện thoại (DT-18 phần 18g, YCTD-143): chọn đợt kiểm kê đang mở của đơn vị mình, quét mã tem QR
// trên thiết bị, xem số theo sổ, ghi tình trạng (từng thiết bị) hoặc số đếm được, số dùng được (lô). Lập đợt, duyệt, chốt
// chênh lệch làm trên cổng quản trị
interface Stocktake {
  id: string;
  code: string;
  name: string;
  org_unit_name: string;
  location_name: string | null;
  line_count: number;
  counted_count: number;
}

interface Line {
  id: string;
  target_type: 'asset' | 'holding';
  code: string;
  name: string;
  unit: string;
  location_name: string | null;
  expected_quantity: number;
  counted_quantity: number | null;
  condition: string | null;
  qr_code: string | null;
}

interface Target {
  target_type: 'asset' | 'holding';
  code: string;
  name: string;
  unit: string;
  location_name: string | null;
  qr_code: string | null;
}

const CONDITIONS = [
  { value: 'good', label: 'Dùng được' },
  { value: 'damaged', label: 'Hỏng, cần sửa' },
  { value: 'unusable', label: 'Hỏng, không dùng được' },
  { value: 'missing', label: 'Không tìm thấy' },
];

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ';
}

export function StocktakeScreen({ onBack }: { onBack(): void }) {
  const [stocktakes, setStocktakes] = useState<Stocktake[]>();
  const [selected, setSelected] = useState<Stocktake>();
  const [lines, setLines] = useState<Line[]>([]);
  const [target, setTarget] = useState<Target>();
  const [condition, setCondition] = useState('');
  const [counted, setCounted] = useState('');
  const [usable, setUsable] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    requestJson<Stocktake[]>('/api/v1/equipment-stocktakes?status=counting')
      .then((loaded) => {
        setStocktakes(loaded);
        if (loaded.length === 1) {
          setSelected(loaded[0]);
        }
      })
      .catch((error: unknown) => setMessage({ tone: 'danger', text: messageOf(error) }));
  }, []);

  async function reload(stocktake: Stocktake) {
    const detail = await requestJson<{ lines: Line[] }>(`/api/v1/equipment-stocktakes/${stocktake.id}`);
    setLines(detail.lines);
  }

  useEffect(() => {
    if (selected) {
      reload(selected).catch((error: unknown) => setMessage({ tone: 'danger', text: messageOf(error) }));
    }
  }, [selected]);

  async function scanned(text: string) {
    setMessage(undefined);
    try {
      const found = await requestJson<Target>(`/api/v1/equipment-qr/${encodeURIComponent(text)}`);
      const line = lines.find((item) => item.qr_code === found.qr_code);
      setTarget(found);
      setCondition(line?.condition ?? '');
      setCounted(line?.counted_quantity?.toString() ?? '');
      setUsable('');
      setNote('');
    } catch (error) {
      setTarget(undefined);
      setMessage({ tone: 'danger', text: messageOf(error) });
    }
  }

  async function record(event: FormEvent) {
    event.preventDefault();
    if (!selected || !target) {
      return;
    }
    setBusy(true);
    try {
      const isAsset = target.target_type === 'asset';
      await requestJson(`/api/v1/equipment-stocktakes/${selected.id}/scan`, {
        method: 'POST',
        body: JSON.stringify({
          qr_code: target.qr_code,
          condition: condition || null,
          counted_quantity: isAsset || counted === '' ? null : Number(counted),
          usable_quantity: isAsset || usable === '' ? null : Number(usable),
          note: note || null,
        }),
      });
      setMessage({ tone: 'success', text: `Đã ghi ${target.code} – ${target.name}` });
      setTarget(undefined);
      await reload(selected);
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    } finally {
      setBusy(false);
    }
  }

  const line = target ? lines.find((item) => item.qr_code === target.qr_code) : undefined;
  const done = lines.filter((item) => item.counted_quantity !== null).length;
  const inputClass = 'rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
  return (
    <div className="min-h-screen">
      <ApplicationHeader title="Ứng dụng giáo viên" />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        <div className="flex items-center gap-3">
          <Button variant="text" onClick={onBack}>
            Quay lại
          </Button>
          <h1 className="text-section-title font-bold text-text">Kiểm kê thiết bị</h1>
        </div>
        {stocktakes && stocktakes.length === 0 ? (
          <p className="text-content text-text-secondary">Không có đợt kiểm kê nào đang mở.</p>
        ) : null}
        {stocktakes && stocktakes.length > 1 ? (
          <label className="flex flex-col gap-1 text-label font-medium text-text">
            Đợt kiểm kê
            <select
              className={inputClass}
              value={selected?.id ?? ''}
              onChange={(event) => setSelected(stocktakes.find((item) => item.id === event.target.value))}
            >
              <option value="">Chọn đợt</option>
              {stocktakes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} – {item.name} ({item.org_unit_name})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {selected ? (
          <p className="text-content text-text" aria-label="Tiến độ kiểm kê">
            {selected.code} – {selected.name}: đã kiểm {done}/{lines.length}
          </p>
        ) : null}
        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
        {selected ? <QrScanner onScan={(text) => void scanned(text)} disabled={busy} /> : null}
        {target ? (
          <form className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3" onSubmit={(event) => void record(event)}>
            <div className="flex flex-col">
              <span className="text-content font-semibold">
                {target.code} – {target.name}
              </span>
              <span className="text-label text-text-secondary">
                Nơi để: {target.location_name ?? 'chưa gán'}; theo sổ: {line ? line.expected_quantity : 0} {target.unit}
                {line ? '' : ' (ngoài sổ của đợt)'}
              </span>
            </div>
            {target.target_type === 'asset' ? (
              <fieldset className="flex flex-col gap-2" aria-label="Tình trạng">
                {CONDITIONS.map((item) => (
                  <label key={item.value} className="flex items-center gap-2 text-content">
                    <input
                      type="radio"
                      name="condition"
                      checked={condition === item.value}
                      onChange={() => setCondition(item.value)}
                    />
                    {item.label}
                  </label>
                ))}
              </fieldset>
            ) : (
              <>
                <label className="flex flex-col gap-1 text-label font-medium text-text">
                  Số đếm được
                  <input
                    className={inputClass}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={counted}
                    onChange={(event) => setCounted(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-label font-medium text-text">
                  Số dùng được
                  <input
                    className={inputClass}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    placeholder="Bằng số đếm được"
                    value={usable}
                    onChange={(event) => setUsable(event.target.value)}
                  />
                </label>
              </>
            )}
            <label className="flex flex-col gap-1 text-label font-medium text-text">
              Ghi chú
              <input className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            <Button
              variant="primary"
              type="submit"
              disabled={busy || (target.target_type === 'asset' ? !condition : counted === '')}
            >
              Ghi kết quả
            </Button>
          </form>
        ) : null}
      </main>
    </div>
  );
}
