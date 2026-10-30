import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, ConfirmDialog, DataGrid, StatusBadge, type DataGridColumn } from '@school-management/ui';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { listChildren } from '../children/children-api.js';
import { RowMessageTable } from '../imports/ExcelImportPanel.js';
import { messageOf } from '../imports/import-api.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { useHasPermission } from '../session/permissions.js';
import {
  decideTransfer,
  downloadDossier,
  listTransfers,
  receiveTransfer,
  requestTransferOut,
  TRANSFER_STATUS_LABELS,
  type StudentTransfer,
  type TransferPlace,
} from './students-api.js';
import { BuildPackageDialog, ImportPackageDialog, ReceivedLearningRecordsDialog } from './TransferPackageDialogs.js';
import { SendPackageDialog, TransferMailboxPanel, useMailboxSettings } from './TransferMailboxPanel.js';
import { listOutbox, MAILBOX_STATE_LABELS, revokeTransferPackage } from './transfer-mailbox-api.js';

// Chuyển trường chạy nội bộ ở 4.2 Biến động học sinh (DT-16 phần 16g, mục 4.2 của Sở "tiếp nhận học sinh chuyển đến (từ
// tỉnh, xã, trường); duyệt chuyển đi"). Các trường chưa liên thông nên theo quyết định của Eric ngày 2026-10-16 không có nút
// "Gửi": chuyển đi lập đề nghị, người duyệt "Duyệt" (học sinh thôi học) hoặc "Từ chối", rồi xuất hồ sơ chuyển dạng PDF hoặc
// tệp theo mẫu Bộ để trao trường nhận; tiếp nhận chuyển đến tải tệp hồ sơ chuyển, mỗi học sinh thành một hồ sơ nháp
const inputClass = 'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const formatDate = (value: string | null) => (value ? value.split('-').reverse().join('/') : '');
const EMPTY_PLACE: TransferPlace = { school_name: '', province_name: '', ward_name: '', transfer_date: '', reason: '' };

function PlaceFields({
  place,
  direction,
  onChange,
}: {
  place: TransferPlace;
  direction: 'out' | 'in';
  onChange(next: TransferPlace): void;
}) {
  const field = (key: keyof TransferPlace, label: string, type = 'text') => (
    <label className="text-label font-medium text-text">
      {label}
      <input
        type={type}
        value={place[key] ?? ''}
        onChange={(event) => onChange({ ...place, [key]: event.target.value })}
        className={inputClass}
      />
    </label>
  );
  const to = direction === 'out' ? 'chuyển đến' : 'chuyển đi';
  return (
    <>
      {field('school_name', `Trường ${to}`)}
      {field('province_name', `Tỉnh/Thành phố ${to}`)}
      {field('ward_name', `Xã/Phường ${to}`)}
      {field('transfer_date', 'Ngày chuyển (để trống là hôm nay)', 'date')}
      {field('reason', 'Lý do')}
    </>
  );
}

function RequestOutDialog({ onDone, onCancel }: { onDone(message: string): void; onCancel(): void }) {
  const [search, setSearch] = useState('');
  const [childId, setChildId] = useState('');
  const [place, setPlace] = useState<TransferPlace>(EMPTY_PLACE);
  const students = useQuery({
    queryKey: ['children', 'transfer-out', search],
    queryFn: () => listChildren({ q: search, status: 'active', page: 1, pageSize: 20 }),
    enabled: search.trim().length >= 2,
  });
  const save = useMutation({
    mutationFn: () => requestTransferOut(childId, place),
    onSuccess: () => onDone('Đã lập đề nghị chuyển đi, chờ duyệt'),
  });
  return (
    <ConfirmDialog
      open
      title="Đề nghị chuyển đi"
      confirmLabel="Ghi"
      busy={save.isPending || !childId || !place.school_name.trim()}
      onCancel={onCancel}
      onConfirm={() => save.mutate()}
    >
      <div className="flex flex-col gap-3">
        <label className="text-label font-medium text-text">
          Tìm học sinh theo họ tên
          <input value={search} onChange={(event) => setSearch(event.target.value)} className={inputClass} />
        </label>
        <label className="text-label font-medium text-text">
          Học sinh
          <select
            aria-label="Học sinh"
            value={childId}
            onChange={(event) => setChildId(event.target.value)}
            className={inputClass}
          >
            <option value="">Chọn học sinh</option>
            {(students.data?.items ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.full_name} – {formatDate(row.dob)} – {row.class_name ?? ''}
              </option>
            ))}
          </select>
        </label>
        <PlaceFields place={place} direction="out" onChange={setPlace} />
        {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      </div>
    </ConfirmDialog>
  );
}

function ReceiveDialog({ onDone, onCancel }: { onDone(message: string): void; onCancel(): void }) {
  const unitChoice = useUnitChoice();
  const [orgUnitId, setOrgUnitId] = useState('');
  const [place, setPlace] = useState<TransferPlace>(EMPTY_PLACE);
  const [file, setFile] = useState<File>();
  const unitId = orgUnitId || unitChoice.selectedId || '';
  const save = useMutation({
    mutationFn: () => receiveTransfer(unitId, place, file ?? new File([], 'trong.xlsx')),
    onSuccess: (result) => {
      if (result.created > 0) {
        onDone(`Đã tiếp nhận ${result.created} học sinh chuyển đến thành hồ sơ nháp`);
      }
    },
  });
  return (
    <ConfirmDialog
      open
      title="Tiếp nhận học sinh chuyển đến"
      confirmLabel="Tiếp nhận"
      busy={save.isPending || !file || !unitId || !place.school_name.trim()}
      onCancel={onCancel}
      onConfirm={() => save.mutate()}
    >
      <div className="flex flex-col gap-3">
        <p className="text-label text-text-secondary">
          Tải tệp hồ sơ chuyển theo mẫu của Bộ (82 cột) do trường cũ cấp. Mỗi học sinh trong tệp thành một hồ sơ nháp;
          bổ sung giấy khai sinh rồi gửi duyệt, xếp lớp ở 4.1.1.
        </p>
        <label className="text-label font-medium text-text">
          Đơn vị tiếp nhận
          <select
            aria-label="Đơn vị tiếp nhận"
            value={unitId}
            onChange={(event) => setOrgUnitId(event.target.value)}
            className={inputClass}
          >
            {unitChoice.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </label>
        <PlaceFields place={place} direction="in" onChange={setPlace} />
        <input
          type="file"
          aria-label="Tệp hồ sơ chuyển"
          accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => setFile(event.target.files?.[0])}
        />
        {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
        {save.data && save.data.errors.length > 0 ? (
          <RowMessageTable label="Báo cáo dòng lỗi" rows={save.data.errors} />
        ) : null}
      </div>
    </ConfirmDialog>
  );
}

export function StudentTransfersSection({ onChanged }: { onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.childManage);
  const canApprove = useHasPermission(PERMISSION_CODES.childApprove);
  const canExport = useHasPermission(PERMISSION_CODES.dataExport);
  const canViewNationalId = useHasPermission(PERMISSION_CODES.nationalIdView);
  const canDossier = canExport && canViewNationalId;
  const grid = useGridSettings('student-transfers');
  const [direction, setDirection] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<'out' | 'in' | 'package'>();
  const [packaging, setPackaging] = useState<StudentTransfer>();
  const [sending, setSending] = useState<StudentTransfer>();
  const mailboxSettings = useMailboxSettings();
  const mailboxEnabled = mailboxSettings.data?.available === true && mailboxSettings.data.enabled;
  const outbox = useQuery({
    queryKey: ['student-transfers', 'mailbox', 'outbox'],
    queryFn: listOutbox,
    enabled: mailboxSettings.data?.available === true,
  });
  const outboxByCode = new Map((outbox.data ?? []).map((item) => [item.package_code, item]));
  const [receivedRecords, setReceivedRecords] = useState<StudentTransfer>();
  const [deciding, setDeciding] = useState<{ row: StudentTransfer; approve: boolean }>();
  const [note, setNote] = useState('');
  const [fileError, setFileError] = useState<string>();
  const transfers = useQuery({
    queryKey: ['student-transfers', direction, status, search, page, grid.settings.pageSize],
    queryFn: () => listTransfers({ direction, status, q: search }, page, grid.settings.pageSize),
    enabled: grid.ready,
  });
  const refresh = async (message: string) => {
    setDialog(undefined);
    setPackaging(undefined);
    setSending(undefined);
    onChanged(message);
    await queryClient.invalidateQueries({ queryKey: ['student-transfers'] });
    await queryClient.invalidateQueries({ queryKey: ['student-movements'] });
  };
  const decide = useMutation({
    mutationFn: () => decideTransfer(deciding?.row.id ?? '', deciding?.approve ?? false, note.trim()),
    onSuccess: async (result) => {
      setDeciding(undefined);
      await refresh(result.status === 'approved' ? 'Đã duyệt chuyển đi; học sinh thôi học' : 'Đã từ chối đề nghị');
    },
  });
  const dossier = (row: StudentTransfer, format: 'xlsx' | 'pdf') => {
    setFileError(undefined);
    downloadDossier(row.id, format).catch((error: unknown) => setFileError(messageOf(error)));
  };
  const columns: Array<DataGridColumn<StudentTransfer>> = [
    { id: 'direction', header: 'Loại', cell: (row) => (row.direction === 'out' ? 'Chuyển đi' : 'Chuyển đến') },
    { id: 'transfer_date', header: 'Ngày chuyển', cell: (row) => formatDate(row.transfer_date) },
    { id: 'moet_student_code', header: 'Mã định danh Bộ GD&ĐT', cell: (row) => row.moet_student_code ?? '' },
    { id: 'full_name', header: 'Họ tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
    { id: 'dob', header: 'Ngày sinh', cell: (row) => formatDate(row.dob) },
    { id: 'school', header: 'Trường đến/đi', cell: (row) => row.school_name },
    {
      id: 'place',
      header: 'Tỉnh, xã',
      cell: (row) => [row.ward_name, row.province_name].filter(Boolean).join(', '),
    },
    { id: 'reason', header: 'Lý do', cell: (row) => row.reason ?? '' },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => (
        <StatusBadge
          tone={row.status === 'pending' ? 'warning' : row.status === 'rejected' ? 'danger' : 'success'}
          label={TRANSFER_STATUS_LABELS[row.status]}
        />
      ),
    },
    { id: 'package_code', header: 'Mã gói', cell: (row) => row.package_code ?? '' },
    {
      id: 'mailbox_state',
      header: 'Gửi qua hệ thống',
      cell: (row) => {
        const item = row.direction === 'out' && row.package_code ? outboxByCode.get(row.package_code) : undefined;
        return item ? `${MAILBOX_STATE_LABELS[item.state]}${item.decision_note ? `: ${item.decision_note}` : ''}` : '';
      },
    },
    { id: 'decided_by', header: 'Người duyệt', hiddenByDefault: true, cell: (row) => row.decided_by_name ?? '' },
    { id: 'decision_note', header: 'Ghi chú duyệt', hiddenByDefault: true, cell: (row) => row.decision_note ?? '' },
  ];
  const selectFilter = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: [string, string][],
  ) => (
    <label className="text-label font-medium text-text">
      {label}
      <select
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setPage(1);
        }}
        className={inputClass}
      >
        <option value="">Tất cả</option>
        {options.map(([key, name]) => (
          <option key={key} value={key}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section className="flex flex-col gap-4" aria-label="Chuyển trường">
      <h2 className="text-section-title font-semibold text-text">Chuyển đi, tiếp nhận chuyển đến</h2>
      <p className="text-label text-text-secondary">
        Hiệu trưởng lập gói chuyển trường (mã hóa, có học bạ đã ký) để trao trường nhận; trường nhận dùng "Nhập gói
        chuyển trường". Trường nhận dùng phần mềm khác thì xuất hồ sơ PDF hoặc tệp theo mẫu của Bộ.
      </p>
      <TransferMailboxPanel canApprove={canApprove} onChanged={(message) => void refresh(message)} />
      {transfers.isError ? <Alert tone="danger">{messageOf(transfers.error)}</Alert> : null}
      {fileError ? <Alert tone="danger">{fileError}</Alert> : null}
      <DataGrid
        label="Danh sách chuyển trường"
        columns={columns}
        rows={transfers.data?.items ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.full_name}
        loading={!transfers.data && !transfers.isError}
        emptyText="Chưa có học sinh chuyển đi, chuyển đến."
        search={{
          label: 'Tìm theo họ tên',
          value: search,
          onChange: (value) => {
            setSearch(value);
            setPage(1);
          },
        }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {selectFilter('Loại', direction, setDirection, [
              ['out', 'Chuyển đi'],
              ['in', 'Chuyển đến'],
            ])}
            {selectFilter(
              'Trạng thái',
              status,
              setStatus,
              Object.entries(TRANSFER_STATUS_LABELS) as Array<[string, string]>,
            )}
          </div>
        }
        toolbar={
          <>
            {canManage || canApprove ? <Button onClick={() => setDialog('out')}>Đề nghị chuyển đi</Button> : null}
            {canManage ? <Button onClick={() => setDialog('in')}>Tiếp nhận chuyển đến</Button> : null}
            {canApprove ? <Button onClick={() => setDialog('package')}>Nhập gói chuyển trường</Button> : null}
          </>
        }
        rowActions={(row) => (
          <span className="flex flex-wrap gap-1">
            {row.direction === 'out' && row.status === 'pending' && canApprove ? (
              <>
                <Button
                  variant="text"
                  onClick={() => {
                    setNote('');
                    setDeciding({ row, approve: true });
                  }}
                >
                  Duyệt
                </Button>
                <Button
                  variant="text"
                  onClick={() => {
                    setNote('');
                    setDeciding({ row, approve: false });
                  }}
                >
                  Từ chối
                </Button>
              </>
            ) : null}
            {row.direction === 'out' && canDossier && canApprove && row.status !== 'rejected' ? (
              <Button variant="text" onClick={() => setPackaging(row)}>
                Lập gói
              </Button>
            ) : null}
            {row.direction === 'out' &&
            canDossier &&
            canApprove &&
            mailboxEnabled &&
            (row.status === 'pending' || row.status === 'approved') &&
            !['sent', 'opened', 'accepted'].includes(outboxByCode.get(row.package_code ?? '')?.state ?? '') ? (
              <Button variant="text" onClick={() => setSending(row)}>
                Gửi qua hệ thống
              </Button>
            ) : null}
            {row.direction === 'out' &&
            canApprove &&
            ['sent', 'opened'].includes(outboxByCode.get(row.package_code ?? '')?.state ?? '') ? (
              <Button
                variant="text"
                onClick={() => {
                  setFileError(undefined);
                  revokeTransferPackage(row.id)
                    .then(() => refresh('Đã thu hồi gói gửi qua hệ thống'))
                    .catch((error: unknown) => setFileError(messageOf(error)));
                }}
              >
                Thu hồi gói
              </Button>
            ) : null}
            {row.direction === 'in' && row.package_code && row.child_id ? (
              <Button variant="text" onClick={() => setReceivedRecords(row)}>
                Học bạ nhận được
              </Button>
            ) : null}
            {row.direction === 'out' && canDossier ? (
              <>
                <Button variant="text" onClick={() => dossier(row, 'pdf')}>
                  Hồ sơ PDF
                </Button>
                <Button variant="text" onClick={() => dossier(row, 'xlsx')}>
                  Tệp mẫu Bộ
                </Button>
              </>
            ) : null}
          </span>
        )}
        settings={grid.settings}
        onSettingsChange={grid.update}
        serverPagination={{ page, total: transfers.data?.total ?? 0, onPageChange: setPage }}
      />
      {dialog === 'out' ? (
        <RequestOutDialog onDone={(message) => void refresh(message)} onCancel={() => setDialog(undefined)} />
      ) : null}
      {dialog === 'in' ? (
        <ReceiveDialog onDone={(message) => void refresh(message)} onCancel={() => setDialog(undefined)} />
      ) : null}
      {dialog === 'package' ? (
        <ImportPackageDialog onDone={(message) => void refresh(message)} onCancel={() => setDialog(undefined)} />
      ) : null}
      {sending ? (
        <SendPackageDialog
          transfer={sending}
          onDone={(message) => void refresh(message)}
          onCancel={() => setSending(undefined)}
        />
      ) : null}
      {packaging ? (
        <BuildPackageDialog
          transfer={packaging}
          onDone={(message) => void refresh(message)}
          onCancel={() => setPackaging(undefined)}
        />
      ) : null}
      {receivedRecords ? (
        <ReceivedLearningRecordsDialog transfer={receivedRecords} onClose={() => setReceivedRecords(undefined)} />
      ) : null}
      {deciding ? (
        <ConfirmDialog
          open
          title={`${deciding.approve ? 'Duyệt' : 'Từ chối'} chuyển đi – ${deciding.row.full_name}`}
          confirmLabel={deciding.approve ? 'Duyệt' : 'Từ chối'}
          busy={decide.isPending || (!deciding.approve && !note.trim())}
          onCancel={() => setDeciding(undefined)}
          onConfirm={() => decide.mutate()}
        >
          <div className="flex flex-col gap-3">
            {deciding.approve ? (
              <p>Học sinh sẽ thôi học từ ngày {formatDate(deciding.row.transfer_date)} với lý do chuyển trường.</p>
            ) : null}
            <label className="text-label font-medium text-text">
              {deciding.approve ? 'Ghi chú' : 'Lý do từ chối'}
              <input value={note} onChange={(event) => setNote(event.target.value)} className={inputClass} />
            </label>
            {decide.error ? <Alert tone="danger">{messageOf(decide.error)}</Alert> : null}
          </div>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
