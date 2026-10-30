import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Alert, ApplicationHeader, Button, StatusBadge } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Ca trực và ghi nhận rèn luyện (YCTD-391 lát L2; màn hình 1, 2 của bản mẫu): giám thị, giáo viên chủ nhiệm, giáo viên bộ môn
// xem ghi nhận của mình hôm nay, thu hồi trong ngày; ghi vi phạm hoặc khen cho một hay nhiều học sinh trong phạm vi, chọn mục nội
// quy cùng cấp, khu vực, mô tả, tối đa 3 ảnh chụp bằng camera điện thoại. Ghi nhận không tự trừ điểm, không tự xếp mức rèn luyện
type Kind = 'violation' | 'commendation';

interface ScopeClass {
  id: string;
  name: string;
  org_unit_id: string;
  school_level: string;
}

interface Student {
  child_id: string;
  full_name: string;
  class_id: string;
  class_name: string;
  org_unit_id: string;
  school_level: string;
}

interface RuleItem {
  id: string;
  name: string;
  kind: Kind;
  school_level: string;
  status: 'active' | 'inactive';
  class_criterion_name: string | null;
}

interface Zone {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

interface ConductRecord {
  id: string;
  full_name: string;
  class_name: string;
  rule_name: string;
  kind: Kind;
  occurred_at: string;
  zone_name: string | null;
  status: 'active' | 'revoked';
  revoked_reason: string | null;
}

const KIND_LABELS: Record<Kind, string> = { violation: 'Vi phạm', commendation: 'Khen' };
const INPUT_CLASS = 'rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const MAXIMUM_PHOTOS = 3;

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ';
}

function vietnamToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

function timeOf(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  );
}

function DutyView({ onRecord }: { onRecord(): void }) {
  const [records, setRecords] = useState<ConductRecord[]>();
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const [revoking, setRevoking] = useState<string>();
  const [reason, setReason] = useState('');

  async function load() {
    try {
      setRecords(await requestJson<ConductRecord[]>(`/api/v1/supervision/records?from=${vietnamToday()}&mine=true`));
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function revoke(event: FormEvent, recordId: string) {
    event.preventDefault();
    try {
      await requestJson(`/api/v1/supervision/records/${recordId}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      setRevoking(undefined);
      setReason('');
      setMessage({ tone: 'success', text: 'Đã thu hồi ghi nhận' });
      await load();
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    }
  }

  const active = (records ?? []).filter((record) => record.status === 'active');
  const count = (kind: Kind) => active.filter((record) => record.kind === kind).length;
  return (
    <div className="flex flex-col gap-4">
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      <div className="grid grid-cols-2 gap-3">
        <section className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4" aria-label="Vi phạm hôm nay">
          <span className="text-label text-text-secondary">Vi phạm hôm nay</span>
          <span className="text-page-title font-bold text-text">{count('violation')}</span>
        </section>
        <section className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4" aria-label="Khen hôm nay">
          <span className="text-label text-text-secondary">Khen hôm nay</span>
          <span className="text-page-title font-bold text-text">{count('commendation')}</span>
        </section>
      </div>
      <Button variant="primary" onClick={onRecord}>
        Ghi nhận mới
      </Button>
      <h2 className="text-section-title font-semibold text-text">Tôi đã ghi hôm nay</h2>
      {records && records.length === 0 ? (
        <p className="text-content text-text-secondary">Chưa có ghi nhận nào hôm nay.</p>
      ) : null}
      <ul className="flex flex-col gap-2" aria-label="Ghi nhận hôm nay">
        {(records ?? []).map((record) => (
          <li key={record.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-content font-semibold text-text">
                {record.full_name} · {record.class_name}
              </span>
              {record.status === 'revoked' ? (
                <StatusBadge tone="neutral" label="Đã thu hồi" />
              ) : (
                <StatusBadge tone={record.kind === 'violation' ? 'danger' : 'success'} label={KIND_LABELS[record.kind]} />
              )}
            </div>
            <span className="text-label text-text-secondary">
              {record.rule_name}
              {record.zone_name ? ` · ${record.zone_name}` : ''} · {timeOf(record.occurred_at)}
            </span>
            {record.status === 'active' && revoking !== record.id ? (
              <div>
                <Button variant="text" onClick={() => setRevoking(record.id)}>
                  Thu hồi
                </Button>
              </div>
            ) : null}
            {revoking === record.id ? (
              <form className="flex flex-col gap-2" onSubmit={(event) => void revoke(event, record.id)}>
                <label className="flex flex-col gap-1 text-label font-medium text-text">
                  Lý do thu hồi
                  <input
                    className={INPUT_CLASS}
                    value={reason}
                    maxLength={500}
                    required
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
                <div className="flex gap-2">
                  <Button type="submit" variant="primary" disabled={reason.trim() === ''}>
                    Xác nhận thu hồi
                  </Button>
                  <Button onClick={() => setRevoking(undefined)}>Thôi</Button>
                </div>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecordView({ classes, onSaved }: { classes: ScopeClass[]; onSaved(message: string): void }) {
  const [search, setSearch] = useState('');
  const [classId, setClassId] = useState('');
  const [results, setResults] = useState<Student[]>();
  const [selected, setSelected] = useState<Student[]>([]);
  const [kind, setKind] = useState<Kind>('violation');
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [ruleId, setRuleId] = useState('');
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState('');
  const [description, setDescription] = useState('');
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  const levels = useMemo(() => [...new Set(classes.map((row) => row.school_level))], [classes]);
  useEffect(() => {
    Promise.all(levels.map((level) => requestJson<RuleItem[]>(`/api/v1/supervision/rule-items?school_level=${level}`)))
      .then((lists) => setRules(lists.flat().filter((item) => item.status === 'active')))
      .catch((error: unknown) => setMessage(messageOf(error)));
    requestJson<Zone[]>('/api/v1/supervision/zones')
      .then((loaded) => setZones(loaded.filter((zone) => zone.status === 'active')))
      .catch(() => setZones([]));
  }, [levels]);

  // Mục nội quy theo loại và cấp của học sinh đã chọn (mọi học sinh phải cùng cấp với mục)
  const selectedLevels = [...new Set(selected.map((student) => student.school_level))];
  const shownRules = rules.filter(
    (item) =>
      item.kind === kind && (selectedLevels.length === 0 || selectedLevels.every((level) => level === item.school_level)),
  );

  async function find(event?: FormEvent) {
    event?.preventDefault();
    setMessage(undefined);
    const query = classId
      ? `class_id=${classId}`
      : `search=${encodeURIComponent(search.trim())}`;
    try {
      setResults(await requestJson<Student[]>(`/api/v1/supervision/students?${query}`));
    } catch (error) {
      setMessage(messageOf(error));
    }
  }

  function toggle(student: Student) {
    setSelected((current) =>
      current.some((item) => item.child_id === student.child_id)
        ? current.filter((item) => item.child_id !== student.child_id)
        : [...current, student],
    );
  }

  // Ảnh tải lên ngay khi chụp, gắn vào ghi nhận khi lưu; chỉ người tải lên xem được cho tới khi gắn
  async function addPhoto(file: File | undefined) {
    const orgUnitId = selected[0]?.org_unit_id ?? classes[0]?.org_unit_id;
    if (!file || !orgUnitId) {
      return;
    }
    const form = new FormData();
    form.set('org_unit_id', orgUnitId);
    form.set('purpose', 'conduct_evidence');
    form.set('file', file);
    try {
      const uploaded = await requestJson<{ id: string }>('/api/v1/files', { method: 'POST', body: form });
      setPhotoIds((current) => [...current, uploaded.id]);
    } catch (error) {
      setMessage(messageOf(error));
    }
  }

  async function save() {
    setBusy(true);
    setMessage(undefined);
    try {
      const result = await requestJson<{ record_ids: string[]; class_points_added: boolean }>(
        '/api/v1/supervision/records',
        {
          method: 'POST',
          body: JSON.stringify({
            child_ids: selected.map((student) => student.child_id),
            rule_item_id: ruleId,
            zone_id: zoneId || null,
            description: description.trim() || null,
            evidence_file_ids: photoIds,
          }),
        },
      );
      onSaved(
        `Đã ghi cho ${result.record_ids.length} học sinh${result.class_points_added ? '; đã ghi thêm điểm nề nếp của lớp' : ''}`,
      );
    } catch (error) {
      setMessage(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {message ? <Alert tone="danger">{message}</Alert> : null}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Học sinh">
        <h2 className="text-section-title font-semibold text-text">1. Học sinh</h2>
        <form className="flex flex-col gap-2" onSubmit={(event) => void find(event)}>
          <label className="flex flex-col gap-1 text-label font-medium text-text">
            Tìm theo tên
            <input
              className={INPUT_CLASS}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setClassId('');
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-label font-medium text-text">
            Hoặc chọn lớp
            <select className={INPUT_CLASS} value={classId} onChange={(event) => setClassId(event.target.value)}>
              <option value="">Chọn lớp</option>
              {classes.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={!classId && search.trim().length < 2}>
            Tìm học sinh
          </Button>
        </form>
        {results && results.length === 0 ? <p className="text-content text-text-secondary">Không thấy học sinh.</p> : null}
        <ul className="flex flex-col gap-1" aria-label="Kết quả tìm học sinh">
          {(results ?? []).map((student) => (
            <li key={student.child_id}>
              <label className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-content text-text">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={selected.some((item) => item.child_id === student.child_id)}
                  onChange={() => toggle(student)}
                />
                {student.full_name} · {student.class_name}
              </label>
            </li>
          ))}
        </ul>
        {selected.length > 0 ? (
          <p className="text-label text-text">
            Đã chọn: {selected.map((student) => `${student.full_name} (${student.class_name})`).join(', ')}
          </p>
        ) : null}
      </section>
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Nội dung">
        <h2 className="text-section-title font-semibold text-text">2. Nội dung</h2>
        <div className="flex gap-2" role="group" aria-label="Loại">
          {(Object.keys(KIND_LABELS) as Kind[]).map((code) => (
            <Button
              key={code}
              aria-pressed={kind === code}
              variant={kind === code ? 'primary' : 'secondary'}
              onClick={() => {
                setKind(code);
                setRuleId('');
              }}
            >
              {KIND_LABELS[code]}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Mục nội quy">
          {shownRules.map((item) => (
            <Button
              key={item.id}
              aria-pressed={ruleId === item.id}
              variant={ruleId === item.id ? 'primary' : 'secondary'}
              onClick={() => setRuleId(item.id)}
            >
              {item.name}
            </Button>
          ))}
        </div>
        {shownRules.length === 0 ? (
          <p className="text-label text-text-secondary">Chưa có mục nội quy phù hợp; Ban Giám hiệu khai ở cổng quản trị.</p>
        ) : null}
        <label className="flex flex-col gap-1 text-label font-medium text-text">
          Khu vực
          <select className={INPUT_CLASS} value={zoneId} onChange={(event) => setZoneId(event.target.value)}>
            <option value="">Không ghi</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-label font-medium text-text">
          Mô tả (không bắt buộc)
          <textarea
            className={INPUT_CLASS}
            rows={2}
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
      </section>
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Ảnh bằng chứng">
        <h2 className="text-section-title font-semibold text-text">3. Ảnh bằng chứng (không bắt buộc)</h2>
        <p className="text-label text-text-secondary">
          Chỉ người có quyền xem ghi nhận mới xem được ảnh. Tối đa {MAXIMUM_PHOTOS} ảnh.
        </p>
        {photoIds.length < MAXIMUM_PHOTOS ? (
          <label className="flex flex-col gap-1 text-label font-medium text-text">
            Chụp ảnh
            <input
              type="file"
              accept="image/jpeg,image/png"
              capture="environment"
              onChange={(event) => {
                void addPhoto(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </label>
        ) : null}
        {photoIds.length > 0 ? <p className="text-label text-text">Đã chụp {photoIds.length} ảnh</p> : null}
      </section>
      <p className="text-label text-text-secondary">
        Ghi nhận báo cho giáo viên chủ nhiệm; không tự trừ điểm, không tự xếp mức rèn luyện của học sinh.
      </p>
      <Button variant="primary" disabled={busy || selected.length === 0 || !ruleId} onClick={() => void save()}>
        Lưu ghi nhận
      </Button>
    </div>
  );
}

export function SupervisionScreen({ onBack }: { onBack(): void }) {
  const [mode, setMode] = useState<'duty' | 'record'>('duty');
  const [classes, setClasses] = useState<ScopeClass[]>();
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  // Mỗi lần ghi xong thì vẽ lại danh sách hôm nay
  const [version, setVersion] = useState(0);

  useEffect(() => {
    requestJson<{ classes: ScopeClass[] }>('/api/v1/supervision/my-scope')
      .then((scope) => setClasses(scope.classes))
      .catch((error: unknown) => setMessage({ tone: 'danger', text: messageOf(error) }));
  }, []);

  return (
    <>
      <ApplicationHeader title="Ứng dụng giáo viên" />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl">
        <div className="flex items-center gap-2">
          <Button variant="text" onClick={mode === 'record' ? () => setMode('duty') : onBack}>
            Quay lại
          </Button>
          <h1 className="text-section-title font-semibold text-text">
            {mode === 'duty' ? 'Ca trực hôm nay' : 'Ghi nhận vi phạm, khen'}
          </h1>
        </div>
        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
        {classes && classes.length === 0 ? (
          <Alert tone="warning">
            Bạn chưa có lớp nào trong phạm vi ghi nhận. Ban Giám hiệu phân công trực ở cổng quản trị, mục Nội quy, phân
            công giám thị.
          </Alert>
        ) : null}
        {mode === 'duty' ? (
          <DutyView
            key={version}
            onRecord={() => {
              setMessage(undefined);
              setMode('record');
            }}
          />
        ) : (
          <RecordView
            classes={classes ?? []}
            onSaved={(text) => {
              setMessage({ tone: 'success', text });
              setVersion((current) => current + 1);
              setMode('duty');
            }}
          />
        )}
      </main>
    </>
  );
}
