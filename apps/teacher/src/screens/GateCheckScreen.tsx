import { useEffect, useState, type FormEvent } from 'react';
import { Alert, ApplicationHeader, Button, StatusBadge } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// MG-16 Xác nhận người đón tại cổng (P04-03, QT-02 bước 6): bảo vệ tra trẻ trong đơn vị được gán, đối chiếu người đón
// với danh sách ủy quyền và ghi nhận xác nhận; người ngoài danh sách thì báo giáo viên chủ nhiệm xử lý (YCTD-48)
interface DirectoryEntry {
  child_id: string;
  full_name: string;
  class_name: string;
  guardians: Array<{ guardian_id: string; full_name: string; relationship: string; phone: string | null }>;
  authorized_pickups: Array<{ id: string; full_name: string; relationship: string; phone: string }>;
  gate_checks: Array<{ person_name: string; recorded_at: string }>;
}

interface OrgUnit {
  id: string;
  name: string;
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ';
}

function timeOf(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  );
}

export function GateCheckScreen({ orgUnitIds, onBack }: { orgUnitIds: string[]; onBack(): void }) {
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [orgUnitId, setOrgUnitId] = useState(orgUnitIds[0] ?? '');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<DirectoryEntry[]>();
  const [message, setMessage] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string }>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    requestJson<OrgUnit[]>('/api/v1/org-units')
      .then((loaded) => setUnits(loaded.filter((unit) => orgUnitIds.includes(unit.id))))
      .catch(() => setUnits([]));
  }, [orgUnitIds]);

  async function find(event?: FormEvent) {
    event?.preventDefault();
    try {
      setResults(
        await requestJson<DirectoryEntry[]>(
          `/api/v1/pickup-directory?org_unit_id=${orgUnitId}&search=${encodeURIComponent(search.trim())}`,
        ),
      );
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    }
  }

  async function confirm(
    child: DirectoryEntry,
    person: { guardian_id?: string; authorized_pickup_id?: string; name: string },
  ) {
    setBusy(true);
    try {
      await requestJson(`/api/v1/children/${child.child_id}/pickups`, {
        method: 'POST',
        body: JSON.stringify({
          pickup_type: 'gate_check',
          ...(person.guardian_id ? { guardian_id: person.guardian_id } : {}),
          ...(person.authorized_pickup_id ? { authorized_pickup_id: person.authorized_pickup_id } : {}),
        }),
      });
      await find();
      setMessage({ tone: 'success', text: `Đã xác nhận ${person.name} đón ${child.full_name}` });
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    } finally {
      setBusy(false);
    }
  }

  const inputClass = 'rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
  return (
    <div className="min-h-screen">
      <ApplicationHeader title="Ứng dụng giáo viên" />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        <div className="flex items-center gap-3">
          <Button variant="text" onClick={onBack}>
            Quay lại
          </Button>
          <h1 className="text-section-title font-bold text-text">Xác nhận người đón tại cổng</h1>
        </div>
        <form className="flex flex-col gap-2" onSubmit={(event) => void find(event)}>
          {orgUnitIds.length > 1 ? (
            <label className="flex flex-col gap-1 text-label font-medium text-text">
              Đơn vị
              <select className={inputClass} value={orgUnitId} onChange={(event) => setOrgUnitId(event.target.value)}>
                {orgUnitIds.map((id) => (
                  <option key={id} value={id}>
                    {units.find((unit) => unit.id === id)?.name ?? id}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-label font-medium text-text">
            Tên trẻ
            <input className={inputClass} value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <Button variant="primary" type="submit" disabled={search.trim().length < 2}>
            Tìm trẻ
          </Button>
        </form>
        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
        {results && results.length === 0 ? (
          <p className="text-content text-text-secondary">Không tìm thấy trẻ nào.</p>
        ) : null}
        <ul className="flex flex-col gap-2" aria-label="Kết quả tìm trẻ">
          {(results ?? []).map((child) => (
            <li
              key={child.child_id}
              aria-label={child.full_name}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-content font-semibold">{child.full_name}</span>
                <span className="text-label text-text-secondary">{child.class_name}</span>
              </div>
              <p className="text-label text-text-secondary">Người được đón trẻ hôm nay:</p>
              {[
                ...child.guardians.map((guardian) => ({
                  key: guardian.guardian_id,
                  name: guardian.full_name,
                  relationship: guardian.relationship,
                  phone: guardian.phone,
                  guardian_id: guardian.guardian_id,
                })),
                ...child.authorized_pickups.map((authorized) => ({
                  key: authorized.id,
                  name: authorized.full_name,
                  relationship: authorized.relationship,
                  phone: authorized.phone,
                  authorized_pickup_id: authorized.id,
                })),
              ].map((person) => (
                <div key={person.key} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-content">
                    {person.name} ({person.relationship}){person.phone ? ` - ${person.phone}` : ''}
                  </span>
                  <Button disabled={busy} onClick={() => void confirm(child, person)}>
                    Xác nhận {person.name}
                  </Button>
                </div>
              ))}
              {child.gate_checks.map((check) => (
                <StatusBadge
                  key={check.recorded_at}
                  tone="success"
                  label={`Đã xác nhận ${check.person_name} lúc ${timeOf(check.recorded_at)}`}
                />
              ))}
              <p className="text-label text-text-secondary">
                Người đón không có trong danh sách: báo giáo viên chủ nhiệm để xin phụ huynh xác nhận.
              </p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
