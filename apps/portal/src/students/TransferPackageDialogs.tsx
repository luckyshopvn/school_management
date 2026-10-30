import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, ConfirmDialog, StatusBadge } from '@school-management/ui';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import { RowMessageTable } from '../imports/ExcelImportPanel.js';
import { messageOf } from '../imports/import-api.js';
import type { StudentTransfer } from './students-api.js';
import {
  acceptTransferPackage,
  buildTransferPackage,
  downloadReceivedLearningRecord,
  listReceivedLearningRecords,
  OPTIONAL_TRANSFER_PART_LABELS,
  previewTransferPackage,
  saveBase64File,
  type BuiltTransferPackage,
  type OptionalTransferPart,
} from './transfer-packages-api.js';
import { acceptMailboxPackage, previewMailboxPackage } from './transfer-mailbox-api.js';

// Gói chuyển trường (YCTD-390 lát L1): MH-651 trường đi chọn thành phần và lập gói; MH-652, MH-653 trường đến nhập gói, xem trước,
// xếp lớp, tiếp nhận; học bạ nhận từ trường khác xem và tải ở hồ sơ chuyển đến
const inputClass = 'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const formatDate = (value: string | null) => (value ? value.slice(0, 10).split('-').reverse().join('/') : '');
const OPTIONAL_PARTS = Object.keys(OPTIONAL_TRANSFER_PART_LABELS) as OptionalTransferPart[];

const MANDATORY_PARTS = [
  'Hồ sơ học sinh, cha mẹ hoặc người giám hộ',
  'Tệp hồ sơ theo mẫu 82 cột của Bộ, có mã định danh và số định danh',
  'Học bạ các năm đã ký (PDF nguyên bản)',
  'Kết quả năm học đang học khi chuyển giữa năm',
  'Nhu cầu đặc biệt, kế hoạch giáo dục cá nhân (nếu có)',
  'Môn học lựa chọn (nếu có)',
];

export function BuildPackageDialog({
  transfer,
  onDone,
  onCancel,
}: {
  transfer: StudentTransfer;
  onDone(message: string): void;
  onCancel(): void;
}) {
  const [optional, setOptional] = useState<OptionalTransferPart[]>([]);
  const [consent, setConsent] = useState(false);
  const [application, setApplication] = useState(false);
  const [built, setBuilt] = useState<BuiltTransferPackage>();
  const build = useMutation({
    mutationFn: () => buildTransferPackage(transfer.id, optional, consent, application),
    onSuccess: (result) => {
      setBuilt(result);
      saveBase64File(result.package_file, 'application/octet-stream');
    },
  });
  if (built) {
    return (
      <ConfirmDialog
        open
        title={`Gói chuyển trường ${built.package_code}`}
        confirmLabel="Đã ghi mật khẩu, đóng"
        onCancel={() => onDone(`Đã lập gói ${built.package_code}`)}
        onConfirm={() => onDone(`Đã lập gói ${built.package_code}`)}
      >
        <div className="flex flex-col gap-3">
          <Alert tone="warning">
            Mật khẩu chỉ hiện lần này và in trên bản in. Giao bản in cho phụ huynh hoặc trường đến, không gửi kèm tệp
            gói.
          </Alert>
          <p className="text-content">
            Mật khẩu mở gói: <strong className="font-mono text-section-title">{built.password}</strong>
          </p>
          <p className="break-all text-label text-text-secondary">Mã băm SHA-256: {built.package_sha256}</p>
          <ul className="list-disc pl-5 text-label">
            {built.parts.map((part) => (
              <li key={part.path}>{part.label}</li>
            ))}
          </ul>
          <span className="flex flex-wrap gap-2">
            <Button onClick={() => saveBase64File(built.package_file, 'application/octet-stream')}>Tải tệp gói</Button>
            <Button onClick={() => saveBase64File(built.print_file, 'application/pdf')}>Tải bản in (PDF)</Button>
          </span>
        </div>
      </ConfirmDialog>
    );
  }
  return (
    <ConfirmDialog
      open
      title={`Lập gói chuyển trường – ${transfer.full_name}`}
      confirmLabel="Lập gói"
      busy={build.isPending || !application || (optional.length > 0 && !consent)}
      onCancel={onCancel}
      onConfirm={() => build.mutate()}
    >
      <div className="flex flex-col gap-3">
        <p className="text-label text-text-secondary">
          Trường đến: {transfer.school_name}. Gói mã hóa bằng mật khẩu, dùng khi trường đến nhận bằng tệp; hồ sơ giấy
          (đơn, học bạ bản chính, giấy giới thiệu) vẫn theo quy định.
        </p>
        <label className="flex items-start gap-2 text-content">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5"
            checked={application}
            onChange={(event) => setApplication(event.target.checked)}
          />
          Đã nhận đơn xin chuyển trường do cha mẹ hoặc người giám hộ ký
        </label>
        <h3 className="text-label font-semibold text-text">Luôn có trong gói</h3>
        <ul className="list-disc pl-5 text-label">
          {MANDATORY_PARTS.map((part) => (
            <li key={part}>{part}</li>
          ))}
        </ul>
        <h3 className="text-label font-semibold text-text">Chỉ gửi khi phụ huynh đồng ý</h3>
        {OPTIONAL_PARTS.map((part) => (
          <label key={part} className="flex items-start gap-2 text-content">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5"
              checked={optional.includes(part)}
              onChange={(event) =>
                setOptional(event.target.checked ? [...optional, part] : optional.filter((item) => item !== part))
              }
            />
            {OPTIONAL_TRANSFER_PART_LABELS[part]}
          </label>
        ))}
        {optional.length > 0 ? (
          <label className="flex items-start gap-2 text-content">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            Phụ huynh đã đồng ý bằng đơn giấy cho các mục chọn thêm (học sinh từ đủ 7 tuổi cũng đồng ý)
          </label>
        ) : null}
        {build.error ? <Alert tone="danger">{messageOf(build.error)}</Alert> : null}
      </div>
    </ConfirmDialog>
  );
}

// Gói bằng tệp (MH-653) hoặc gói nhận qua hộp thư nền tảng (lát L2): `mailboxId` có thì bỏ bước chọn tệp, mật khẩu
export function ImportPackageDialog({
  mailboxId,
  onDone,
  onCancel,
}: {
  mailboxId?: string;
  onDone(message: string): void;
  onCancel(): void;
}) {
  const unitChoice = useUnitChoice();
  const [file, setFile] = useState<File>();
  const [password, setPassword] = useState('');
  const [orgUnitId, setOrgUnitId] = useState('');
  const [classId, setClassId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [overCapacity, setOverCapacity] = useState(false);
  const unitId = orgUnitId || unitChoice.selectedId || '';
  const classes = useQuery({
    queryKey: ['classes', 'transfer-package', unitId],
    queryFn: () => listClasses(unitId),
    enabled: unitId !== '',
  });
  const preview = useMutation({
    mutationFn: () => (mailboxId ? previewMailboxPackage(mailboxId) : previewTransferPackage(file as File, password)),
  });
  const openPreview = preview.mutate;
  useEffect(() => {
    if (mailboxId) {
      openPreview();
    }
  }, [mailboxId, openPreview]);
  const accept = useMutation({
    mutationFn: () =>
      mailboxId
        ? acceptMailboxPackage(mailboxId, { classId, fromDate, confirmOverCapacity: overCapacity })
        : acceptTransferPackage(file as File, password, { classId, fromDate, confirmOverCapacity: overCapacity }),
    onSuccess: (result) => {
      if (result.child_id) {
        onDone(`Đã tiếp nhận ${preview.data?.student.full_name ?? 'học sinh'} vào lớp, trạng thái Đang học`);
      }
    },
  });
  const data = preview.data;
  const blocked = data ? data.already_received || data.existing_child !== null : true;
  return (
    <ConfirmDialog
      open
      title={mailboxId ? 'Gói chuyển trường nhận qua hệ thống' : 'Nhập gói chuyển trường'}
      confirmLabel={data ? 'Tiếp nhận' : 'Xem gói'}
      busy={
        data
          ? accept.isPending || blocked || !classId
          : preview.isPending || mailboxId !== undefined || !file || password.replace(/[^A-Za-z0-9]/g, '').length !== 16
      }
      onCancel={onCancel}
      onConfirm={() => (data ? accept.mutate() : preview.mutate())}
    >
      <div className="flex flex-col gap-3">
        {!data && mailboxId ? (
          preview.error ? (
            <Alert tone="danger">{messageOf(preview.error)}</Alert>
          ) : (
            <p className="text-label text-text-secondary">Đang mở gói, kiểm chữ ký của trường đi…</p>
          )
        ) : !data ? (
          <>
            <p className="text-label text-text-secondary">
              Chọn tệp gói (đuôi .goichuyen) và nhập mật khẩu 16 ký tự in trên bản in do trường cũ cấp.
            </p>
            <input
              type="file"
              aria-label="Tệp gói chuyển trường"
              accept=".goichuyen"
              onChange={(event) => setFile(event.target.files?.[0])}
            />
            <label className="text-label font-medium text-text">
              Mật khẩu mở gói
              <input
                value={password}
                autoComplete="off"
                onChange={(event) => setPassword(event.target.value)}
                className={`${inputClass} font-mono`}
              />
            </label>
            {preview.error ? <Alert tone="danger">{messageOf(preview.error)}</Alert> : null}
          </>
        ) : (
          <>
            <Alert tone="success">
              Gói {data.package_code} của {data.source_school.name}, người duyệt {data.approved_by_name}, lập ngày{' '}
              {formatDate(data.created_at)}; {mailboxId ? 'chữ ký của trường đi và ' : ''}mã băm từng phần hợp lệ.
            </Alert>
            {data.already_received ? <Alert tone="danger">Gói này đã được tiếp nhận.</Alert> : null}
            {data.existing_child ? (
              <Alert tone="danger">
                Học sinh đã có hồ sơ ở trường ({data.existing_child.full_name}, trùng mã định danh Bộ); không tiếp nhận
                lại.
              </Alert>
            ) : null}
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-label sm:grid-cols-[12rem_1fr]">
              <dt className="text-text-secondary">Học sinh</dt>
              <dd>
                {data.student.full_name} – {formatDate(data.student.dob)}
              </dd>
              <dt className="text-text-secondary">Mã định danh Bộ</dt>
              <dd>{data.student.moet_student_code ?? 'Chưa có'}</dd>
              <dt className="text-text-secondary">Số định danh</dt>
              <dd>{data.student.national_id_last4 ? `•••• •••• ${data.student.national_id_last4}` : ''}</dd>
              <dt className="text-text-secondary">Lớp ở trường cũ</dt>
              <dd>{data.student.class_name ?? ''}</dd>
              <dt className="text-text-secondary">Cha mẹ, người giám hộ</dt>
              <dd>
                {data.student.guardians
                  .map((guardian) => `${guardian.full_name} (${guardian.relationship})`)
                  .join(', ')}
              </dd>
              <dt className="text-text-secondary">Học bạ</dt>
              <dd>
                {data.learning_records.length
                  ? data.learning_records
                      .map((record) => `${record.class_name} ${record.academic_year_name}`)
                      .join(', ')
                  : 'Không có'}
              </dd>
            </dl>
            <ul className="list-disc pl-5 text-label">
              {data.parts.map((part) => (
                <li key={part.path}>{part.label}</li>
              ))}
            </ul>
            <label className="text-label font-medium text-text">
              Đơn vị tiếp nhận
              <select
                aria-label="Đơn vị tiếp nhận"
                value={unitId}
                onChange={(event) => {
                  setOrgUnitId(event.target.value);
                  setClassId('');
                }}
                className={inputClass}
              >
                {unitChoice.units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-label font-medium text-text">
              Xếp vào lớp
              <select
                aria-label="Xếp vào lớp"
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
                className={inputClass}
              >
                <option value="">Chọn lớp</option>
                {(classes.data ?? [])
                  .filter((row) => row.status === 'active')
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-label font-medium text-text">
              Ngày bắt đầu học (để trống là hôm nay)
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex items-start gap-2 text-content">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={overCapacity}
                onChange={(event) => setOverCapacity(event.target.checked)}
              />
              Vẫn xếp khi lớp đã đủ sĩ số
            </label>
            {accept.error ? <Alert tone="danger">{messageOf(accept.error)}</Alert> : null}
            {accept.data && accept.data.errors.length > 0 ? (
              <RowMessageTable label="Lỗi hồ sơ trong gói" rows={accept.data.errors} />
            ) : null}
          </>
        )}
      </div>
    </ConfirmDialog>
  );
}

export function ReceivedLearningRecordsDialog({ transfer, onClose }: { transfer: StudentTransfer; onClose(): void }) {
  const [error, setError] = useState<string>();
  const records = useQuery({
    queryKey: ['received-learning-records', transfer.child_id],
    queryFn: () => listReceivedLearningRecords(transfer.child_id ?? ''),
    enabled: transfer.child_id !== null,
  });
  return (
    <ConfirmDialog
      open
      title={`Học bạ nhận được – ${transfer.full_name}`}
      confirmLabel="Đóng"
      onCancel={onClose}
      onConfirm={onClose}
    >
      <div className="flex flex-col gap-3">
        {records.isError ? <Alert tone="danger">{messageOf(records.error)}</Alert> : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {(records.data ?? []).length === 0 && records.data ? <p>Gói không có học bạ.</p> : null}
        <ul className="flex flex-col gap-2">
          {(records.data ?? []).map((record) => (
            <li key={record.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
              <span className="font-medium">
                {record.class_name ?? ''} {record.academic_year_name}
              </span>
              <StatusBadge
                tone={record.kind === 'learning_record' ? 'success' : 'warning'}
                label={record.kind === 'learning_record' ? 'Học bạ đã ký' : 'Kết quả năm học đang học'}
              />
              <span className="text-label text-text-secondary">Do {record.source_school_name} cấp, chỉ đọc</span>
              {record.has_file ? (
                <Button
                  variant="text"
                  onClick={() => {
                    setError(undefined);
                    downloadReceivedLearningRecord(record.id).catch((reason: unknown) => setError(messageOf(reason)));
                  }}
                >
                  Tải PDF
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </ConfirmDialog>
  );
}
