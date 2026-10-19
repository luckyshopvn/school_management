import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CLASS_STAGE_LABELS,
  PERMISSION_CODES,
  SIGNING_IDENTITY_OBJECT_TYPES,
  SIGNING_STATUS_LABELS,
  SIGNING_VISIBLE_OBJECT_TYPES,
  type ClassStage,
  type SigningDossierStatus,
  type SigningObjectType,
} from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDialog,
  DataGrid,
  FORM_CONTROL_CLASS,
  StatusBadge,
  Toast,
  type DataGridColumn,
  type StatusTone,
} from '@school-management/ui';
import { SelectBox, TabBar } from '../facilities/facilities-ui.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import { formatDate, formatDateTime, messageOf } from './SigningCertificatePage.js';
import { SigningDossierViewer } from './SigningDossierViewer.js';
import {
  cancelDossier,
  checkDossierChanges,
  createDossiers,
  downloadCreateErrors,
  downloadDossierFile,
  listSigningObjects,
  readCertificate,
  signDossiers,
  type SigningObject,
} from './signing-api.js';

// 2.2 Kí hồ sơ trường, lớp, nhân sự, học sinh (mục 6 của Sở, bản chạy nội bộ; DT-16 phần 16k, DT-17 phần 17b). Mỗi thẻ là
// danh sách đối tượng của năm học đang dùng kèm hồ sơ chưa hủy, cột theo lưới của Sở: cột riêng từng loại (mã và tên trường,
// tên hiệu trưởng; lớp, khối; mã nhân sự, họ tên, ngày sinh, trạng thái nhân sự, vị trí việc làm; mã học sinh, tên, ngày
// sinh, lớp, trạng thái học sinh) rồi trạng thái, xem hồ sơ, tệp hồ sơ, ngày tạo, ngày ký, ghi chú, ngày thay đổi; lọc khối
// ở lớp, khối và lớp ở học sinh. Chọn dòng rồi bấm "Tạo hồ sơ", "Kí xác nhận nội bộ" (không phải chữ ký số; "Đăng nhập và
// kí" chỉ hiện khi có nhà cung cấp kí số thật), "Tải thông tin thay đổi"; "Tải file lỗi" lấy đối tượng tạo hồ sơ không
// được; "Hủy hồ sơ" trên từng dòng. Cấp Mầm non không có thẻ Sổ đầu bài và nút "Xuất dữ liệu sổ đầu bài" như Sở
export const STATUS_TONES: Record<SigningDossierStatus | 'none', StatusTone> = {
  none: 'neutral',
  created: 'info',
  signed: 'success',
  completed: 'success',
  sent: 'success',
  cancelled: 'neutral',
};

interface ColumnActions {
  onView(row: SigningObject): void;
  onError(message: string): void;
  canOpen: boolean;
}

function headColumns(type: SigningObjectType): Array<DataGridColumn<SigningObject>> {
  const object = (header: string): DataGridColumn<SigningObject> => ({
    id: 'object',
    header,
    alwaysVisible: true,
    className: 'font-medium',
    cell: (row) => row.object_label,
  });
  const code = (header: string): DataGridColumn<SigningObject> => ({
    id: 'code',
    header,
    cell: (row) => row.code ?? '',
  });
  const dob: DataGridColumn<SigningObject> = { id: 'dob', header: 'Ngày sinh', cell: (row) => formatDate(row.dob) };
  if (type === 'school') {
    return [
      code('Mã trường'),
      object('Tên trường'),
      { id: 'principal', header: 'Tên hiệu trưởng', cell: (row) => row.principal_name ?? '' },
    ];
  }
  if (type === 'class') {
    return [
      object('Lớp'),
      { id: 'stage', header: 'Khối', cell: (row) => (row.stage ? CLASS_STAGE_LABELS[row.stage] : '') },
    ];
  }
  if (type === 'staff') {
    return [
      code('Mã nhân sự'),
      object('Họ tên'),
      dob,
      { id: 'person_status', header: 'Trạng thái nhân sự', cell: (row) => row.person_status ?? '' },
      { id: 'job_position', header: 'Vị trí việc làm', cell: (row) => row.job_position ?? '' },
    ];
  }
  return [
    code('Mã học sinh'),
    object('Tên học sinh'),
    dob,
    { id: 'class_name', header: 'Lớp', cell: (row) => row.class_name ?? '' },
    { id: 'person_status', header: 'Trạng thái học sinh', cell: (row) => row.person_status ?? '' },
  ];
}

function columns(type: SigningObjectType, actions: ColumnActions): Array<DataGridColumn<SigningObject>> {
  const download = (row: SigningObject, version: 'original' | 'signed') =>
    row.dossier &&
    downloadDossierFile(row.dossier, version).catch((error: unknown) => actions.onError(messageOf(error)));
  return [
    ...headColumns(type),
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => {
        const status = row.dossier?.status ?? 'none';
        return <StatusBadge tone={STATUS_TONES[status]} label={SIGNING_STATUS_LABELS[status]} />;
      },
    },
    {
      id: 'view',
      header: 'Xem hồ sơ',
      cell: (row) =>
        row.dossier ? (
          <Button
            variant="text"
            aria-label={`Xem hồ sơ ${row.object_label}`}
            disabled={!actions.canOpen}
            onClick={() => actions.onView(row)}
          >
            Xem
          </Button>
        ) : (
          ''
        ),
    },
    {
      id: 'file',
      header: 'Tệp hồ sơ',
      cell: (row) =>
        row.dossier ? (
          <span className="flex flex-col items-start">
            <Button variant="text" disabled={!actions.canOpen} onClick={() => download(row, 'original')}>
              {row.dossier.file_name}
            </Button>
            {row.dossier.signed_file_name ? (
              <Button variant="text" disabled={!actions.canOpen} onClick={() => download(row, 'signed')}>
                {row.dossier.signed_file_name}
              </Button>
            ) : null}
          </span>
        ) : (
          ''
        ),
    },
    { id: 'created_at', header: 'Ngày tạo', cell: (row) => formatDateTime(row.dossier?.created_at ?? null) },
    { id: 'signed_at', header: 'Ngày ký', cell: (row) => formatDateTime(row.dossier?.signed_at ?? null) },
    {
      id: 'note',
      header: 'Ghi chú',
      cell: (row) =>
        row.create_error ? (
          <span className="text-label text-danger">{row.create_error}</span>
        ) : (
          (row.dossier?.note ?? '')
        ),
    },
    {
      id: 'changed_at',
      header: 'Ngày thay đổi',
      cell: (row) =>
        row.dossier?.changed_at ? (
          <span className="flex flex-col">
            <span>{formatDateTime(row.dossier.changed_at)}</span>
            <span className="text-label text-text-secondary">{row.dossier.change_summary}</span>
          </span>
        ) : row.dossier?.checked_at ? (
          <span className="text-label text-text-secondary">Không thay đổi</span>
        ) : (
          ''
        ),
    },
    {
      id: 'dossier_code',
      header: 'Mã định danh hồ sơ',
      hiddenByDefault: true,
      cell: (row) => row.dossier?.code ?? '',
    },
    { id: 'signed_by', header: 'Người kí', hiddenByDefault: true, cell: (row) => row.dossier?.signed_by_name ?? '' },
  ];
}

type Pending =
  | { kind: 'create'; rows: SigningObject[] }
  | { kind: 'sign'; rows: SigningObject[] }
  | { kind: 'cancel'; row: SigningObject };

const STAGES = Object.entries(CLASS_STAGE_LABELS).map(([value, label]) => ({ value, label }));

export function SigningDossiersPage() {
  const canManage = useHasPermission(PERMISSION_CODES.signingManage);
  const canSign = useHasPermission(PERMISSION_CODES.signingSign);
  const canSeeIdentity = useHasPermission(PERMISSION_CODES.nationalIdView);
  const queryClient = useQueryClient();
  const grid = useGridSettings('signing-dossiers');
  const [type, setType] = useState<SigningObjectType>('school');
  const [stage, setStage] = useState<ClassStage | ''>('');
  const [className, setClassName] = useState('');
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<Pending>();
  const [viewing, setViewing] = useState<string>();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const objects = useQuery({
    queryKey: ['signing', 'objects', type],
    queryFn: () => listSigningObjects(type, ''),
  });
  const certificate = useQuery({ queryKey: ['signing', 'certificate'], queryFn: readCertificate });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['signing'] });
  // Hồ sơ nhân sự, học sinh in đủ số định danh, số CCCD: cần quyền xem số định danh (quyết định của Eric ngày 2026-10-19)
  const identityLocked = SIGNING_IDENTITY_OBJECT_TYPES.includes(type) && !canSeeIdentity;
  const act = useMutation({
    mutationFn: async (action: Pending): Promise<string> => {
      if (action.kind === 'create') {
        const result = await createDossiers(
          type,
          action.rows.map((row) => row.object_id),
          '',
          note.trim() || null,
        );
        return [
          `Đã tạo ${result.created} hồ sơ: ${result.codes.join(', ')}`,
          result.errors.length > 0
            ? `${result.errors.length} đối tượng không tạo được, xem cột Ghi chú hoặc bấm "Tải file lỗi"`
            : null,
        ]
          .filter(Boolean)
          .join('. ');
      }
      if (action.kind === 'sign') {
        const result = await signDossiers(action.rows.map((row) => row.dossier?.id ?? ''));
        return `Đã kí xác nhận nội bộ ${result.signed} hồ sơ`;
      }
      await cancelDossier(action.row.dossier?.id ?? '', reason);
      return `Đã hủy hồ sơ ${action.row.dossier?.code ?? ''}`;
    },
    onSuccess: async (message) => {
      setPending(undefined);
      await refresh();
      setToastMessage(message);
    },
    onError: async () => {
      setPending(undefined);
      await refresh();
    },
  });
  const check = useMutation({
    mutationFn: (rows: SigningObject[]) => checkDossierChanges(rows.map((row) => row.dossier?.id ?? '')),
    onSuccess: async (result) => {
      await refresh();
      const changed = result.items.filter((item) => item.changed).length;
      setToastMessage(
        changed > 0
          ? `${changed}/${result.items.length} hồ sơ có dữ liệu thay đổi sau khi tạo`
          : `${result.items.length} hồ sơ không có thay đổi`,
      );
    },
  });
  const keyword = search.trim().toLocaleLowerCase('vi');
  const all = objects.data ?? [];
  const classNames = [...new Set(all.map((row) => row.class_name).filter((name): name is string => Boolean(name)))];
  const rows = all.filter(
    (row) =>
      (!stage || row.stage === stage) &&
      (!className || row.class_name === className) &&
      (!keyword ||
        `${row.object_label} ${row.code ?? ''} ${row.detail ?? ''} ${row.dossier?.code ?? ''}`
          .toLocaleLowerCase('vi')
          .includes(keyword)),
  );
  const cert = certificate.data;
  const signerReady = cert?.status === 'registered' && !cert.expired && cert.provider_in_list;
  const tabs = SIGNING_VISIBLE_OBJECT_TYPES.map((item) => ({ key: item.value, label: item.tab }));
  const selectType = (next: SigningObjectType) => {
    setType(next);
    setStage('');
    setClassName('');
  };

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/signing-dossiers')}</h1>
        <Alert tone="info">
          "Tạo hồ sơ" lập tệp PDF và tệp dữ liệu XML theo mẫu hồ sơ của Sở từ dữ liệu hiện tại của đối tượng. "Kí xác
          nhận nội bộ" lập tệp đã kí ghi người kí, thời điểm kí, ảnh con dấu và mã băm của tệp gốc; đây không phải chữ
          ký số vì phần mềm chưa kết nối nhà cung cấp chữ ký số. "Tải thông tin thay đổi" so dữ liệu hiện tại với hồ sơ
          đã tạo.
        </Alert>
        {canSign && cert && !signerReady ? (
          <Alert tone="warning">
            Chứng thư số nhà trường chưa đăng ký kí nội bộ, đã hết hiệu lực hoặc có nhà phát hành ngoài danh sách; đăng
            ký ở mục 1.1 trước khi kí hồ sơ.
          </Alert>
        ) : null}
        <TabBar<SigningObjectType> label="Loại hồ sơ" tabs={tabs} current={type} onSelect={selectType} />
        {identityLocked ? (
          <Alert tone="warning">
            Hồ sơ nhân sự, học sinh in đủ số định danh cá nhân và số CCCD theo mẫu của Sở. Bạn chưa có quyền xem số định
            danh nên không tạo, xem, tải được hồ sơ loại này.
          </Alert>
        ) : null}
        {type === 'class' || type === 'child' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SelectBox
              label="Khối"
              value={stage}
              emptyLabel="Tất cả"
              options={STAGES}
              onChange={(value) => setStage(value as ClassStage | '')}
            />
            {type === 'child' ? (
              <SelectBox
                label="Lớp"
                value={className}
                emptyLabel="Tất cả"
                options={classNames.map((name) => ({ value: name, label: name }))}
                onChange={setClassName}
              />
            ) : null}
          </div>
        ) : null}
        {objects.isError ? <Alert tone="danger">{messageOf(objects.error)}</Alert> : null}
        {act.error ? <Alert tone="danger">{messageOf(act.error)}</Alert> : null}
        {check.error ? <Alert tone="danger">{messageOf(check.error)}</Alert> : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        <DataGrid
          label="Danh sách hồ sơ kí"
          columns={columns(type, {
            canOpen: !identityLocked,
            onError: setError,
            onView: (row) => row.dossier && setViewing(row.dossier.id),
          })}
          rows={rows}
          getRowId={(row) => row.object_id}
          getRowLabel={(row) => row.object_label}
          loading={objects.isPending}
          emptyText="Không có đối tượng nào."
          search={{ label: 'Tìm theo tên, thông tin, mã hồ sơ', value: search, onChange: setSearch }}
          selectable
          toolbar={(selected) => {
            const withoutDossier = selected.filter((row) => !row.dossier);
            const unsigned = selected.filter((row) => row.dossier?.status === 'created');
            const withDossier = selected.filter((row) => row.dossier);
            return (
              <>
                <Button
                  variant="secondary"
                  disabled={!all.some((row) => row.create_error)}
                  onClick={() => {
                    setError(undefined);
                    downloadCreateErrors(type).catch((reason: unknown) => setError(messageOf(reason)));
                  }}
                >
                  Tải file lỗi
                </Button>
                {canManage ? (
                  <Button
                    variant="secondary"
                    disabled={withDossier.length === 0 || check.isPending || identityLocked}
                    onClick={() => check.mutate(withDossier)}
                  >
                    Tải thông tin thay đổi
                  </Button>
                ) : null}
                {canSign ? (
                  <Button
                    variant="secondary"
                    disabled={unsigned.length === 0 || !signerReady}
                    onClick={() => setPending({ kind: 'sign', rows: unsigned })}
                  >
                    Kí xác nhận nội bộ
                  </Button>
                ) : null}
                {canSign && cert?.digital_signer ? (
                  <Button
                    variant="secondary"
                    disabled={unsigned.length === 0 || !signerReady}
                    onClick={() => setPending({ kind: 'sign', rows: unsigned })}
                  >
                    Đăng nhập và kí
                  </Button>
                ) : null}
                {canManage ? (
                  <Button
                    variant="primary"
                    disabled={withoutDossier.length === 0 || identityLocked}
                    onClick={() => {
                      setNote('');
                      setPending({ kind: 'create', rows: withoutDossier });
                    }}
                  >
                    Tạo hồ sơ
                  </Button>
                ) : null}
              </>
            );
          }}
          rowActions={(row) =>
            canManage && (row.dossier?.status === 'created' || row.dossier?.status === 'signed') ? (
              <Button
                variant="text"
                onClick={() => {
                  setReason('');
                  setPending({ kind: 'cancel', row });
                }}
              >
                Hủy hồ sơ
              </Button>
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
      {viewing ? <SigningDossierViewer dossierId={viewing} onClose={() => setViewing(undefined)} /> : null}
      {pending ? (
        <ConfirmDialog
          open
          title={
            pending.kind === 'create'
              ? `Tạo hồ sơ cho ${pending.rows.length} đối tượng?`
              : pending.kind === 'sign'
                ? `Kí xác nhận nội bộ ${pending.rows.length} hồ sơ?`
                : `Hủy hồ sơ ${pending.row.dossier?.code ?? ''}?`
          }
          confirmLabel={
            pending.kind === 'create' ? 'Tạo hồ sơ' : pending.kind === 'sign' ? 'Kí xác nhận nội bộ' : 'Hủy hồ sơ'
          }
          busy={act.isPending}
          onCancel={() => setPending(undefined)}
          onConfirm={() => {
            if (pending.kind !== 'cancel' || reason.trim() !== '') {
              act.mutate(pending);
            }
          }}
        >
          {pending.kind === 'create' ? (
            <span className="flex flex-col gap-3">
              <span>
                Lập tệp PDF và tệp XML từ dữ liệu hiện tại: {pending.rows.map((row) => row.object_label).join(', ')}.
                Đối tượng thiếu mục bắt buộc sẽ không tạo được, lý do ghi ở cột Ghi chú.
              </span>
              <label className="flex flex-col gap-2 text-label font-medium text-text">
                Ghi chú
                <input className={FORM_CONTROL_CLASS} value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
            </span>
          ) : pending.kind === 'sign' ? (
            <span className="flex flex-col gap-3">
              <span className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <span>Nhà phát hành</span>
                <span className="text-text">{cert?.provider ?? ''}</span>
                <span>Tên đăng nhập</span>
                <span className="text-text">{cert?.login_name ?? ''}</span>
              </span>
              <span>
                Tệp đã kí ghi tên bạn, thời điểm kí, thông tin chứng thư đã khai báo, ảnh con dấu và mã băm của tệp gốc.
                Đây là xác nhận trên phần mềm, không phải chữ ký số; phần mềm không hỏi mật khẩu chứng thư.
              </span>
            </span>
          ) : (
            <label className="flex flex-col gap-2 text-label font-medium text-text">
              Lý do hủy (bắt buộc)
              <input
                className={FORM_CONTROL_CLASS}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          )}
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}
