import { useState } from 'react';
import { Alert, TextField } from '@school-management/ui';
import { convertUnit, PHYSICAL_CONSTANTS, UNIT_GROUPS } from './units.ts';

// Bảng hằng số, đổi đơn vị (DT-29 phần 29d, YCTD-328; THCS, THPT): hằng số vật lí thường dùng theo CODATA 2018 và bộ đổi đơn vị
// độ dài, khối lượng, thời gian, tốc độ, diện tích, thể tích, nhiệt độ. Chạy trên máy
export function ConstantsTool() {
  const [groupKey, setGroupKey] = useState('length');
  const group = UNIT_GROUPS.find((item) => item.key === groupKey) ?? UNIT_GROUPS[0];
  const [from, setFrom] = useState('km');
  const [to, setTo] = useState('m');
  const [valueText, setValueText] = useState('1');
  const value = Number(valueText.replace(',', '.'));
  const result = Number.isFinite(value) && valueText.trim() ? convertUnit(groupKey, value, from, to) : null;
  if (!group) {
    return null;
  }
  const select = (label: string, current: string, change: (value: string) => void) => (
    <label className="flex flex-col gap-1 text-label font-medium text-text">
      {label}
      <select
        value={current}
        onChange={(event) => change(event.target.value)}
        className="rounded-lg border border-border bg-card px-3 py-2 text-content text-text"
      >
        {group.units.map((unit) => (
          <option key={unit.key} value={unit.key}>
            {unit.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Đổi đơn vị" className="flex flex-col gap-3">
        <h3 className="text-content font-semibold text-text">Đổi đơn vị</h3>
        <label className="flex flex-col gap-1 text-label font-medium text-text">
          Đại lượng
          <select
            value={groupKey}
            onChange={(event) => {
              const next = UNIT_GROUPS.find((item) => item.key === event.target.value);
              setGroupKey(event.target.value);
              setFrom(next?.units[0]?.key ?? '');
              setTo(next?.units[1]?.key ?? '');
            }}
            className="rounded-lg border border-border bg-card px-3 py-2 text-content text-text"
          >
            {UNIT_GROUPS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <TextField
            label="Giá trị"
            inputMode="decimal"
            value={valueText}
            onChange={(event) => setValueText(event.target.value)}
          />
          {select('Từ', from, setFrom)}
          {select('Sang', to, setTo)}
        </div>
        {valueText.trim() && !Number.isFinite(value) ? <Alert tone="warning">Nhập một số</Alert> : null}
        <p aria-live="polite" aria-label="Kết quả đổi" className="text-section-title font-bold text-text">
          {result !== null
            ? `${valueText} ${group.units.find((unit) => unit.key === from)?.label ?? ''} = ${result.toLocaleString('vi-VN', { maximumFractionDigits: 10 })} ${group.units.find((unit) => unit.key === to)?.label ?? ''}`
            : ''}
        </p>
      </section>
      <section aria-label="Hằng số vật lí" className="flex flex-col gap-2">
        <h3 className="text-content font-semibold text-text">Hằng số vật lí (CODATA 2018)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-content">
            <thead className="text-left text-label text-text-secondary">
              <tr>
                <th className="px-2 py-1">Hằng số</th>
                <th className="px-2 py-1">Kí hiệu</th>
                <th className="px-2 py-1">Giá trị</th>
                <th className="px-2 py-1">Đơn vị</th>
              </tr>
            </thead>
            <tbody>
              {PHYSICAL_CONSTANTS.map((constant) => (
                <tr key={constant.name} className="border-t border-border align-top">
                  <td className="px-2 py-1">
                    {constant.name}
                    {constant.note ? (
                      <span className="block text-label text-text-secondary">{constant.note}</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-1 italic">{constant.symbol}</td>
                  <td className="px-2 py-1 tabular-nums">{constant.value}</td>
                  <td className="px-2 py-1">{constant.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
