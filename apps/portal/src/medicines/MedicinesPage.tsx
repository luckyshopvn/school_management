import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { requestJson } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  describeDose,
  MEDICATION_STATUS_LABELS,
  messageOf,
  openFile,
  postJson,
  PURCHASE_STATUS_LABELS,
  vietnamToday,
  type MedicationRequest,
  type MedicationStatus,
  type Medicine,
  type MedicineIssue,
  type Pharmacy,
  type PurchaseOrder,
  type PurchaseRequest,
  type ScheduleRow,
} from './medicines-api.js';

// MH-17 Thuốc và dặn thuốc (P10-02 đến P10-05, P10-09; BR-48 đến BR-50, BR-63, BR-86, BR-88; YCTD-75): y tế nhận hoặc từ
// chối yêu cầu dặn thuốc, ghi liều và bỏ liều theo khung giờ, thấy trạng thái phụ huynh đã biết bỏ liều; quản lý danh mục
// thuốc, nhà thuốc; đề nghị mua thuốc duyệt theo hạn mức, phiếu mua thuốc tăng tồn, phiếu cấp thuốc trừ tồn
type Tab = 'requests' | 'schedule' | 'catalog' | 'purchases' | 'issues';
const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const money = (amount: number) => amount.toLocaleString('vi-VN');

export function MedicinesPage() {
  const canManage = useHasPermission(PERMISSION_CODES.medicineManage);
  const canApprove = useHasPermission(PERMISSION_CODES.medicinePurchaseApprove);
  const canAdminister = useHasPermission(PERMISSION_CODES.medicationAdminister);
  const [tab, setTab] = useState<Tab>(canAdminister ? 'requests' : 'purchases');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const tabs: Array<[Tab, string, boolean]> = [
    ['requests', 'Dặn thuốc', canAdminister],
    ['schedule', 'Cho uống hôm nay', canAdminister],
    ['catalog', 'Danh mục thuốc', true],
    ['purchases', 'Mua thuốc', canManage || canApprove],
    ['issues', 'Cấp thuốc', canManage],
  ];
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">Thuốc và dặn thuốc</h1>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Thuốc">
          {tabs
            .filter(([, , visible]) => visible)
            .map(([code, label]) => (
              <Button
                key={code}
                role="tab"
                aria-selected={tab === code}
                variant={tab === code ? 'secondary' : 'text'}
                onClick={() => setTab(code)}
              >
                {label}
              </Button>
            ))}
        </div>
        {tab === 'requests' ? <RequestsTab onDone={setToastMessage} /> : null}
        {tab === 'schedule' ? <ScheduleTab onDone={setToastMessage} /> : null}
        {tab === 'catalog' ? <CatalogTab canManage={canManage} onDone={setToastMessage} /> : null}
        {tab === 'purchases' ? (
          <PurchasesTab canManage={canManage} canApprove={canApprove} onDone={setToastMessage} />
        ) : null}
        {tab === 'issues' ? <IssuesTab onDone={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}

function RequestsTab({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [status, setStatus] = useState<MedicationStatus | ''>('pending');
  const [rejecting, setRejecting] = useState<string>();
  const [reason, setReason] = useState('');
  const [failure, setFailure] = useState<string>();
  const requests = useQuery({
    queryKey: ['medication-requests', orgUnitId, status],
    queryFn: () =>
      requestJson<MedicationRequest[]>(
        `/api/v1/medication-requests?org_unit_id=${orgUnitId}${status ? `&status=${status}` : ''}`,
      ),
    enabled: Boolean(orgUnitId),
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['medication-requests'] });
    await queryClient.invalidateQueries({ queryKey: ['medication-schedule'] });
    onDone(message);
  };
  const receive = useMutation({
    mutationFn: (requestId: string) => postJson(`/api/v1/medication-requests/${requestId}/receive`, {}),
    onSuccess: () => refresh('Đã nhận thuốc, thuốc vào danh sách cần cho uống'),
  });
  const reject = useMutation({
    mutationFn: (requestId: string) => postJson(`/api/v1/medication-requests/${requestId}/reject`, { reason }),
    onSuccess: () => {
      setRejecting(undefined);
      setReason('');
      return refresh('Đã từ chối nhận thuốc và báo phụ huynh');
    },
  });
  const complete = useMutation({
    mutationFn: (requestId: string) => postJson(`/api/v1/medication-requests/${requestId}/complete`, {}),
    onSuccess: () => refresh('Đã kết thúc yêu cầu dặn thuốc'),
  });
  const error = [requests.error, receive.error, reject.error, complete.error].find(Boolean);
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {failure ? <Alert tone="danger">{failure}</Alert> : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
        <label className="text-label font-medium text-text">
          Trạng thái
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as MedicationStatus | '')}
            className={selectClass}
          >
            <option value="">Tất cả</option>
            {Object.entries(MEDICATION_STATUS_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <table className="w-full text-content">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Trẻ</th>
            <th>Thuốc</th>
            <th>Giờ uống</th>
            <th>Thời gian</th>
            <th>Dị ứng</th>
            <th>Trạng thái</th>
            <th>Liều đã ghi</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {(requests.data ?? []).map((request) => (
            <tr key={request.id} className="border-t border-border align-top">
              <td className="py-2">
                {request.full_name}
                <br />
                <span className="text-text-secondary">{request.class_name ?? ''}</span>
              </td>
              <td>
                {request.medicine_name}, {request.dosage}
                {request.note ? <div className="text-text-secondary">{request.note}</div> : null}
                <div className="flex flex-wrap gap-1">
                  {[
                    ...request.medicine_photo_ids,
                    ...(request.prescription_photo_id ? [request.prescription_photo_id] : []),
                  ].map((fileId, index) => (
                    <Button
                      key={fileId}
                      variant="text"
                      onClick={() => void openFile(fileId).catch((cause: unknown) => setFailure(messageOf(cause)))}
                    >
                      {index < request.medicine_photo_ids.length ? `Ảnh thuốc ${index + 1}` : 'Đơn thuốc'}
                    </Button>
                  ))}
                </div>
              </td>
              <td>{request.times.join(', ')}</td>
              <td>
                {request.from_date} đến {request.to_date}
              </td>
              <td>{request.allergy_note}</td>
              <td>
                {MEDICATION_STATUS_LABELS[request.status]}
                {request.assigned_role === 'homeroom' ? ' (giáo viên chủ nhiệm nhận)' : ''}
                {request.reject_reason ? `: ${request.reject_reason}` : ''}
              </td>
              <td>
                {request.administrations.map((dose) => (
                  <div key={dose.id}>
                    {dose.scheduled_date} {dose.scheduled_time}: {describeDose(dose)}
                  </div>
                ))}
              </td>
              <td>
                {request.status === 'pending' ? (
                  <div className="flex flex-col gap-2">
                    <Button variant="primary" onClick={() => receive.mutate(request.id)} disabled={receive.isPending}>
                      Nhận thuốc
                    </Button>
                    {rejecting === request.id ? (
                      <>
                        <TextField
                          label="Lý do từ chối"
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                        />
                        <Button onClick={() => reject.mutate(request.id)} disabled={reason === '' || reject.isPending}>
                          Xác nhận từ chối
                        </Button>
                      </>
                    ) : (
                      <Button onClick={() => setRejecting(request.id)}>Từ chối</Button>
                    )}
                  </div>
                ) : null}
                {request.status === 'administering' ? (
                  <Button onClick={() => complete.mutate(request.id)} disabled={complete.isPending}>
                    Kết thúc
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScheduleTab({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [date, setDate] = useState(vietnamToday);
  const [skipReasons, setSkipReasons] = useState<Record<string, string>>({});
  const schedule = useQuery({
    queryKey: ['medication-schedule', orgUnitId, date],
    queryFn: () => requestJson<ScheduleRow[]>(`/api/v1/medication-schedules?org_unit_id=${orgUnitId}&date=${date}`),
    enabled: Boolean(orgUnitId),
  });
  const record = useMutation({
    mutationFn: ({ row, skipped }: { row: ScheduleRow; skipped: boolean }) =>
      postJson('/api/v1/medication-administrations', {
        request_id: row.request_id,
        scheduled_date: row.scheduled_date,
        scheduled_time: row.scheduled_time,
        is_skipped: skipped,
        skip_reason: skipped ? (skipReasons[`${row.request_id}:${row.scheduled_time}`] ?? '') : null,
      }),
    onSuccess: async (_result, { skipped }) => {
      await queryClient.invalidateQueries({ queryKey: ['medication-schedule'] });
      await queryClient.invalidateQueries({ queryKey: ['medication-requests'] });
      onDone(skipped ? 'Đã ghi bỏ liều và báo phụ huynh' : 'Đã ghi liều đã cho uống');
    },
  });
  const error = [schedule.error, record.error].find(Boolean);
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
        <TextField label="Ngày cho uống" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>
      {schedule.data && schedule.data.length === 0 ? (
        <p className="text-content text-text-secondary">Không có liều cần cho uống trong ngày.</p>
      ) : null}
      <table className="w-full text-content">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Giờ</th>
            <th>Trẻ</th>
            <th>Thuốc</th>
            <th>Liều</th>
            <th>Ghi nhận</th>
          </tr>
        </thead>
        <tbody>
          {(schedule.data ?? []).map((row) => {
            const key = `${row.request_id}:${row.scheduled_time}`;
            return (
              <tr key={key} className="border-t border-border align-top">
                <td className="py-2">{row.scheduled_time}</td>
                <td>
                  {row.full_name}
                  <br />
                  <span className="text-text-secondary">{row.class_name ?? ''}</span>
                </td>
                <td>{row.medicine_name}</td>
                <td>{row.dosage}</td>
                <td>
                  {row.administration ? (
                    describeDose(row.administration)
                  ) : row.can_administer ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <Button
                        variant="primary"
                        onClick={() => record.mutate({ row, skipped: false })}
                        disabled={record.isPending}
                      >
                        Đã cho uống
                      </Button>
                      <TextField
                        label="Lý do bỏ liều"
                        value={skipReasons[key] ?? ''}
                        onChange={(event) => setSkipReasons({ ...skipReasons, [key]: event.target.value })}
                      />
                      <Button onClick={() => record.mutate({ row, skipped: true })} disabled={record.isPending}>
                        Bỏ liều
                      </Button>
                    </div>
                  ) : (
                    'Chưa ghi'
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CatalogTab({ canManage, onDone }: { canManage: boolean; onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [ingredient, setIngredient] = useState('');
  const [unit, setUnit] = useState('');
  const [pharmacyId, setPharmacyId] = useState('');
  const [stock, setStock] = useState('0');
  const [pharmacyName, setPharmacyName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const medicines = useQuery({
    queryKey: ['medicines', orgUnitId],
    queryFn: () => requestJson<Medicine[]>(`/api/v1/medicines?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const pharmacies = useQuery({
    queryKey: ['pharmacies', orgUnitId],
    queryFn: () => requestJson<Pharmacy[]>(`/api/v1/pharmacies?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['medicines'] });
    await queryClient.invalidateQueries({ queryKey: ['pharmacies'] });
    onDone(message);
  };
  const createMedicine = useMutation({
    mutationFn: () =>
      postJson('/api/v1/medicines', {
        org_unit_id: orgUnitId,
        code,
        name,
        active_ingredient: ingredient || null,
        unit,
        pharmacy_id: pharmacyId || null,
        stock_qty: Number(stock) || 0,
      }),
    onSuccess: () => {
      setCode('');
      setName('');
      setIngredient('');
      setStock('0');
      return refresh('Đã thêm thuốc vào danh mục');
    },
  });
  const createPharmacy = useMutation({
    mutationFn: () =>
      postJson('/api/v1/pharmacies', {
        org_unit_id: orgUnitId,
        name: pharmacyName,
        phone: phone || null,
        address: address || null,
      }),
    onSuccess: () => {
      setPharmacyName('');
      setPhone('');
      setAddress('');
      return refresh('Đã thêm nhà thuốc');
    },
  });
  const toggle = useMutation({
    mutationFn: (medicine: Medicine) =>
      postJson(
        `/api/v1/medicines/${medicine.id}`,
        { status: medicine.status === 'active' ? 'inactive' : 'active' },
        'PATCH',
      ),
    onSuccess: () => refresh('Đã cập nhật trạng thái thuốc'),
  });
  const error = [medicines.error, pharmacies.error, createMedicine.error, createPharmacy.error, toggle.error].find(
    Boolean,
  );
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
      {canManage ? (
        <form
          aria-label="Thêm thuốc"
          className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            createMedicine.mutate();
          }}
        >
          <TextField label="Mã thuốc" value={code} onChange={(event) => setCode(event.target.value)} />
          <TextField label="Tên thuốc" value={name} onChange={(event) => setName(event.target.value)} />
          <TextField label="Hoạt chất" value={ingredient} onChange={(event) => setIngredient(event.target.value)} />
          <TextField label="Đơn vị tính" value={unit} onChange={(event) => setUnit(event.target.value)} />
          <label className="text-label font-medium text-text">
            Nhà thuốc
            <select value={pharmacyId} onChange={(event) => setPharmacyId(event.target.value)} className={selectClass}>
              <option value="">Không chọn</option>
              {(pharmacies.data ?? [])
                .filter((pharmacy) => pharmacy.status === 'active')
                .map((pharmacy) => (
                  <option key={pharmacy.id} value={pharmacy.id}>
                    {pharmacy.name}
                  </option>
                ))}
            </select>
          </label>
          <TextField label="Tồn đầu" type="number" value={stock} onChange={(event) => setStock(event.target.value)} />
          <div className="flex items-end">
            <Button type="submit" variant="primary" disabled={createMedicine.isPending || !code || !name || !unit}>
              Thêm thuốc
            </Button>
          </div>
        </form>
      ) : null}
      <table className="w-full text-content">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Mã</th>
            <th>Tên thuốc</th>
            <th>Hoạt chất</th>
            <th>Đơn vị</th>
            <th>Nhà thuốc</th>
            <th>Tồn</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {(medicines.data ?? []).map((medicine) => (
            <tr key={medicine.id} className="border-t border-border">
              <td className="py-2">{medicine.code}</td>
              <td>{medicine.name}</td>
              <td>{medicine.active_ingredient ?? ''}</td>
              <td>{medicine.unit}</td>
              <td>{medicine.pharmacy_name ?? ''}</td>
              <td>{medicine.stock_qty}</td>
              <td>
                {medicine.status === 'active' ? 'Đang dùng' : 'Ngừng dùng'}
                {canManage ? (
                  <Button variant="text" onClick={() => toggle.mutate(medicine)} disabled={toggle.isPending}>
                    {medicine.status === 'active' ? 'Ngừng' : 'Dùng lại'}
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="text-section-title font-semibold text-text">Nhà thuốc</h2>
      {canManage ? (
        <form
          aria-label="Thêm nhà thuốc"
          className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            createPharmacy.mutate();
          }}
        >
          <TextField
            label="Tên nhà thuốc"
            value={pharmacyName}
            onChange={(event) => setPharmacyName(event.target.value)}
          />
          <TextField label="Điện thoại" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <TextField label="Địa chỉ" value={address} onChange={(event) => setAddress(event.target.value)} />
          <div className="flex items-end">
            <Button type="submit" variant="primary" disabled={createPharmacy.isPending || !pharmacyName}>
              Thêm nhà thuốc
            </Button>
          </div>
        </form>
      ) : null}
      <ul className="flex flex-col gap-1 text-content">
        {(pharmacies.data ?? []).map((pharmacy) => (
          <li key={pharmacy.id}>
            {pharmacy.name} {pharmacy.phone ? `, ${pharmacy.phone}` : ''}{' '}
            {pharmacy.address ? `, ${pharmacy.address}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PurchasesTab({
  canManage,
  canApprove,
  onDone,
}: {
  canManage: boolean;
  canApprove: boolean;
  onDone(message: string): void;
}) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [medicineId, setMedicineId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [reason, setReason] = useState('');
  const [ordering, setOrdering] = useState<PurchaseRequest>();
  const [pharmacyId, setPharmacyId] = useState('');
  const [orderQuantity, setOrderQuantity] = useState('');
  const [orderPrice, setOrderPrice] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const medicines = useQuery({
    queryKey: ['medicines', orgUnitId],
    queryFn: () => requestJson<Medicine[]>(`/api/v1/medicines?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const pharmacies = useQuery({
    queryKey: ['pharmacies', orgUnitId],
    queryFn: () => requestJson<Pharmacy[]>(`/api/v1/pharmacies?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const requests = useQuery({
    queryKey: ['medicine-purchase-requests', orgUnitId],
    queryFn: () => requestJson<PurchaseRequest[]>(`/api/v1/medicine-purchase-requests?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const orders = useQuery({
    queryKey: ['medicine-purchase-orders', orgUnitId],
    queryFn: () => requestJson<PurchaseOrder[]>(`/api/v1/medicine-purchase-orders?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const refresh = async (message: string) => {
    for (const key of ['medicine-purchase-requests', 'medicine-purchase-orders', 'medicines']) {
      await queryClient.invalidateQueries({ queryKey: [key] });
    }
    onDone(message);
  };
  const createRequest = useMutation({
    mutationFn: () =>
      postJson('/api/v1/medicine-purchase-requests', {
        medicine_id: medicineId,
        quantity: Number(quantity),
        estimated_unit_price: Number(price),
        reason,
      }),
    onSuccess: () => {
      setQuantity('');
      setPrice('');
      setReason('');
      return refresh('Đã gửi đề nghị mua thuốc chờ duyệt');
    },
  });
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      postJson(
        `/api/v1/medicine-purchase-requests/${id}/${approve ? 'approve' : 'reject'}`,
        approve ? {} : { reason: rejectReason },
      ),
    onSuccess: (_result, { approve }) => {
      setRejectReason('');
      return refresh(approve ? 'Đã duyệt đề nghị mua thuốc' : 'Đã từ chối đề nghị mua thuốc');
    },
  });
  const createOrder = useMutation({
    mutationFn: (request: PurchaseRequest) =>
      postJson<PurchaseOrder>('/api/v1/medicine-purchase-orders', {
        request_id: request.id,
        pharmacy_id: pharmacyId,
        items: [{ medicine_id: request.medicine_id, quantity: Number(orderQuantity), unit_price: Number(orderPrice) }],
      }),
    onSuccess: (order) => {
      setOrdering(undefined);
      return refresh(`Đã lập phiếu mua thuốc ${order.code}, số lượng thuốc đã tăng`);
    },
  });
  const error = [requests.error, orders.error, createRequest.error, decide.error, createOrder.error].find(Boolean);
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
      {canManage ? (
        <form
          aria-label="Đề nghị mua thuốc"
          className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault();
            createRequest.mutate();
          }}
        >
          <label className="text-label font-medium text-text">
            Thuốc cần mua
            <select value={medicineId} onChange={(event) => setMedicineId(event.target.value)} className={selectClass}>
              <option value="">Chọn thuốc</option>
              {(medicines.data ?? []).map((medicine) => (
                <option key={medicine.id} value={medicine.id}>
                  {medicine.name} (còn {medicine.stock_qty} {medicine.unit})
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Số lượng"
            type="number"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <TextField
            label="Đơn giá dự kiến"
            type="number"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
          <TextField label="Lý do" value={reason} onChange={(event) => setReason(event.target.value)} />
          <div className="flex items-end">
            <Button
              type="submit"
              variant="primary"
              disabled={createRequest.isPending || !medicineId || !quantity || price === '' || !reason}
            >
              Gửi đề nghị
            </Button>
          </div>
        </form>
      ) : null}
      {canApprove ? (
        <TextField
          label="Lý do từ chối đề nghị"
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
        />
      ) : null}
      <table className="w-full text-content">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Thuốc</th>
            <th>Số lượng</th>
            <th>Dự kiến</th>
            <th>Lý do</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {(requests.data ?? []).map((request) => (
            <tr key={request.id} className="border-t border-border align-top">
              <td className="py-2">{request.medicine_name}</td>
              <td>
                {request.quantity} {request.unit}
              </td>
              <td>{money(request.estimated_amount)} đ</td>
              <td>{request.reason}</td>
              <td>
                {PURCHASE_STATUS_LABELS[request.status]}
                {request.status === 'pending' && request.requires_principal ? ' (Hiệu trưởng duyệt)' : ''}
                {request.reject_reason ? `: ${request.reject_reason}` : ''}
              </td>
              <td>
                {canApprove && request.status === 'pending' ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      onClick={() => decide.mutate({ id: request.id, approve: true })}
                      disabled={decide.isPending}
                    >
                      Duyệt
                    </Button>
                    <Button
                      onClick={() => decide.mutate({ id: request.id, approve: false })}
                      disabled={decide.isPending || !rejectReason}
                    >
                      Từ chối
                    </Button>
                  </div>
                ) : null}
                {canManage && request.status === 'approved' ? (
                  ordering?.id === request.id ? (
                    <div className="flex flex-col gap-2">
                      <label className="text-label font-medium text-text">
                        Nhà thuốc mua
                        <select
                          value={pharmacyId}
                          onChange={(event) => setPharmacyId(event.target.value)}
                          className={selectClass}
                        >
                          <option value="">Chọn nhà thuốc</option>
                          {(pharmacies.data ?? [])
                            .filter((pharmacy) => pharmacy.status === 'active')
                            .map((pharmacy) => (
                              <option key={pharmacy.id} value={pharmacy.id}>
                                {pharmacy.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <TextField
                        label="Số lượng đã mua"
                        type="number"
                        value={orderQuantity}
                        onChange={(event) => setOrderQuantity(event.target.value)}
                      />
                      <TextField
                        label="Đơn giá"
                        type="number"
                        value={orderPrice}
                        onChange={(event) => setOrderPrice(event.target.value)}
                      />
                      <Button
                        variant="primary"
                        onClick={() => createOrder.mutate(request)}
                        disabled={createOrder.isPending || !pharmacyId || !orderQuantity || orderPrice === ''}
                      >
                        Ghi thuốc đã mua
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => {
                        setOrdering(request);
                        setOrderQuantity(String(request.quantity));
                        setOrderPrice(String(request.estimated_unit_price));
                      }}
                    >
                      Lập phiếu mua
                    </Button>
                  )
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="text-section-title font-semibold text-text">Phiếu mua thuốc</h2>
      <table className="w-full text-content">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Mã phiếu</th>
            <th>Ngày mua</th>
            <th>Nhà thuốc</th>
            <th>Thuốc đã mua</th>
            <th>Tổng tiền</th>
          </tr>
        </thead>
        <tbody>
          {(orders.data ?? []).map((order) => (
            <tr key={order.id} className="border-t border-border">
              <td className="py-2">{order.code}</td>
              <td>{order.order_date}</td>
              <td>{order.pharmacy_name}</td>
              <td>
                {order.items
                  .map((item) => `${item.medicine_name}: ${item.quantity} ${item.unit} x ${money(item.unit_price)} đ`)
                  .join('; ')}
              </td>
              <td>{money(order.total_amount)} đ</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IssuesTab({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [medicineId, setMedicineId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [recipient, setRecipient] = useState('');
  const [reason, setReason] = useState('');
  const medicines = useQuery({
    queryKey: ['medicines', orgUnitId],
    queryFn: () => requestJson<Medicine[]>(`/api/v1/medicines?org_unit_id=${orgUnitId}&status=active`),
    enabled: Boolean(orgUnitId),
  });
  const issues = useQuery({
    queryKey: ['medicine-issues', orgUnitId],
    queryFn: () => requestJson<MedicineIssue[]>(`/api/v1/medicine-issues?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const issue = useMutation({
    mutationFn: () =>
      postJson<MedicineIssue>('/api/v1/medicine-issues', {
        medicine_id: medicineId,
        quantity: Number(quantity),
        recipient,
        reason,
      }),
    onSuccess: async (created) => {
      setQuantity('');
      setRecipient('');
      setReason('');
      await queryClient.invalidateQueries({ queryKey: ['medicine-issues'] });
      await queryClient.invalidateQueries({ queryKey: ['medicines'] });
      onDone(`Đã lập phiếu cấp thuốc ${created.code}`);
    },
  });
  const error = [medicines.error, issues.error, issue.error].find(Boolean);
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
      <form
        aria-label="Cấp thuốc"
        className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          issue.mutate();
        }}
      >
        <label className="text-label font-medium text-text">
          Thuốc cấp
          <select value={medicineId} onChange={(event) => setMedicineId(event.target.value)} className={selectClass}>
            <option value="">Chọn thuốc</option>
            {(medicines.data ?? []).map((medicine) => (
              <option key={medicine.id} value={medicine.id}>
                {medicine.name} (còn {medicine.stock_qty} {medicine.unit})
              </option>
            ))}
          </select>
        </label>
        <TextField
          label="Số lượng cấp"
          type="number"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
        <TextField label="Người nhận" value={recipient} onChange={(event) => setRecipient(event.target.value)} />
        <TextField label="Lý do cấp" value={reason} onChange={(event) => setReason(event.target.value)} />
        <div className="flex items-end">
          <Button
            type="submit"
            variant="primary"
            disabled={issue.isPending || !medicineId || !quantity || !recipient || !reason}
          >
            Cấp thuốc
          </Button>
        </div>
      </form>
      <table className="w-full text-content">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Mã phiếu</th>
            <th>Thời điểm</th>
            <th>Thuốc</th>
            <th>Số lượng</th>
            <th>Người nhận</th>
            <th>Lý do</th>
          </tr>
        </thead>
        <tbody>
          {(issues.data ?? []).map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="py-2">{row.code}</td>
              <td>{new Date(row.issued_at).toLocaleString('vi-VN')}</td>
              <td>{row.medicine_name}</td>
              <td>
                {row.quantity} {row.unit}
              </td>
              <td>{row.recipient}</td>
              <td>{row.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
