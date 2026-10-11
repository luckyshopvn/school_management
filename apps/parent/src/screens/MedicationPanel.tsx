import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError, fetchWithSession, requestJson } from '../session/api-client.js';

// MP-07 Dặn thuốc (P10-03, P10-04; BR-48, BR-88; YCTD-75): phụ huynh gửi yêu cầu dặn thuốc kèm ít nhất một ảnh thuốc, ảnh đơn
// thuốc nếu có; xem trạng thái, các liều đã cho uống hoặc bỏ liều; xác nhận đã biết thông báo bỏ liều một lần
type RequestStatus = 'pending' | 'administering' | 'completed' | 'rejected';

interface Dose {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  administered_at: string | null;
  dose_note: string | null;
  is_skipped: boolean;
  skip_reason: string | null;
  parent_acknowledged_at: string | null;
}

interface MedicationRequest {
  id: string;
  medicine_name: string;
  dosage: string;
  times: string[];
  from_date: string;
  to_date: string;
  medicine_photo_ids: string[];
  status: RequestStatus;
  reject_reason: string | null;
  administrations: Dose[];
}

const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Chờ nhận thuốc',
  administering: 'Đang cho uống',
  completed: 'Hoàn thành',
  rejected: 'Từ chối',
};

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const timeOf = (value: string) =>
  new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

async function uploadFile(orgUnitId: string, purpose: 'medicine_photo' | 'prescription', file: File) {
  const form = new FormData();
  form.set('org_unit_id', orgUnitId);
  form.set('purpose', purpose);
  form.set('file', file);
  return (await requestJson<{ id: string }>('/api/v1/files', { method: 'POST', body: form })).id;
}

async function openFile(fileId: string) {
  const response = await fetchWithSession(`/api/v1/files/${fileId}`);
  if (!response.ok) {
    throw new ApiError(response.status, 'ERR_FORBIDDEN', 'Không mở được ảnh');
  }
  window.open(URL.createObjectURL(await response.blob()), '_blank', 'noopener');
}

export function MedicationPanel({ child }: { child: { id: string; full_name: string; org_unit_id: string } }) {
  const [requests, setRequests] = useState<MedicationRequest[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [medicineName, setMedicineName] = useState('');
  const [dosage, setDosage] = useState('');
  const [times, setTimes] = useState('');
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [allergy, setAllergy] = useState('');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [prescription, setPrescription] = useState<File>();
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setRequests(await requestJson<MedicationRequest[]>(`/api/v1/medication-requests?child_id=${child.id}`));
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  }, [child.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);
    setNotice(undefined);
    setSubmitting(true);
    try {
      const photoIds: string[] = [];
      for (const photo of photos) {
        photoIds.push(await uploadFile(child.org_unit_id, 'medicine_photo', photo));
      }
      const prescriptionId = prescription ? await uploadFile(child.org_unit_id, 'prescription', prescription) : null;
      await requestJson('/api/v1/medication-requests', {
        method: 'POST',
        body: JSON.stringify({
          child_id: child.id,
          medicine_name: medicineName,
          dosage,
          times: times
            .split(/[,;\s]+/)
            .map((time) => time.trim())
            .filter(Boolean),
          from_date: fromDate,
          to_date: toDate,
          allergy_note: allergy,
          note: note || null,
          medicine_photo_ids: photoIds,
          prescription_photo_id: prescriptionId,
        }),
      });
      setNotice('Đã gửi yêu cầu dặn thuốc, chờ nhà trường nhận thuốc');
      setMedicineName('');
      setDosage('');
      setTimes('');
      setNote('');
      setPhotos([]);
      setPrescription(undefined);
      await load();
    } catch (error) {
      setErrorMessage(messageOf(error));
    } finally {
      setSubmitting(false);
    }
  }

  const acknowledge = async (doseId: string) => {
    try {
      await requestJson(`/api/v1/medication-administrations/${doseId}/acknowledge`, { method: 'POST' });
      await load();
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };

  return (
    <section className="flex flex-col gap-3" aria-label={`Dặn thuốc cho ${child.full_name}`}>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {requests.map((request) => (
        <article
          key={request.id}
          className="flex flex-col gap-1 rounded-lg border border-border p-3 text-content"
          aria-label={`Thuốc ${request.medicine_name}`}
        >
          <p className="font-semibold">
            {request.medicine_name}, {request.dosage}
          </p>
          <p>
            Giờ uống {request.times.join(', ')} từ {request.from_date} đến {request.to_date}
          </p>
          <p>
            {STATUS_LABELS[request.status]}
            {request.status === 'rejected' && request.reject_reason ? `: ${request.reject_reason}` : ''}
          </p>
          {request.medicine_photo_ids[0] ? (
            <div>
              <Button
                onClick={() =>
                  void openFile(request.medicine_photo_ids[0] ?? '').catch((error: unknown) =>
                    setErrorMessage(messageOf(error)),
                  )
                }
              >
                Xem ảnh thuốc
              </Button>
            </div>
          ) : null}
          {request.administrations.map((dose) => (
            <div key={dose.id} className="flex flex-wrap items-center gap-2">
              <span>
                {dose.scheduled_date} {dose.scheduled_time}:{' '}
                {dose.is_skipped
                  ? `Bỏ liều. Lý do: ${dose.skip_reason ?? ''}`
                  : `Đã cho uống lúc ${dose.administered_at ? timeOf(dose.administered_at) : ''}`}
                {dose.dose_note ? ` (${dose.dose_note})` : ''}
              </span>
              {dose.is_skipped ? (
                dose.parent_acknowledged_at ? (
                  <span className="text-text-secondary">Đã xác nhận đã biết</span>
                ) : (
                  <Button onClick={() => void acknowledge(dose.id)}>Đã biết</Button>
                )
              ) : null}
            </div>
          ))}
        </article>
      ))}

      <form onSubmit={submit} noValidate className="flex flex-col gap-3" aria-label="Gửi yêu cầu dặn thuốc">
        <TextField label="Tên thuốc" value={medicineName} onChange={(event) => setMedicineName(event.target.value)} />
        <TextField label="Liều lượng" value={dosage} onChange={(event) => setDosage(event.target.value)} />
        <TextField
          label="Giờ cho uống"
          placeholder="08:00, 11:00"
          value={times}
          onChange={(event) => setTimes(event.target.value)}
        />
        <TextField
          label="Dùng từ ngày"
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
        />
        <TextField
          label="Dùng đến ngày"
          type="date"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
        />
        <TextField
          label="Tình trạng dị ứng"
          placeholder="Ghi Không nếu không dị ứng"
          value={allergy}
          onChange={(event) => setAllergy(event.target.value)}
        />
        <TextField label="Ghi chú" value={note} onChange={(event) => setNote(event.target.value)} />
        <label className="text-label font-medium text-text">
          Ảnh thuốc
          <input
            className="mt-2 block"
            type="file"
            accept="image/jpeg,image/png"
            multiple
            onChange={(event) => setPhotos([...(event.target.files ?? [])])}
          />
        </label>
        <label className="text-label font-medium text-text">
          Ảnh đơn thuốc (nếu có)
          <input
            className="mt-2 block"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(event) => setPrescription(event.target.files?.[0])}
          />
        </label>
        <Button type="submit" variant="primary" disabled={submitting}>
          Gửi dặn thuốc
        </Button>
      </form>
    </section>
  );
}
