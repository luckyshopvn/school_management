import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PERMISSION_CODES,
  SIGNING_OBJECT_TYPES,
  SIGNING_STATUS_LABELS,
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
import { TabBar } from '../facilities/facilities-ui.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import { formatDateTime, messageOf, todayText } from './SigningCertificatePage.js';
import {
  cancelDossier,
  checkDossierChanges,
  createDossiers,
  downloadDossierFile,
  exportClassLog,
  listSigningObjects,
  openDossierFile,
  readCertificate,
  signDossiers,
  type SigningObject,
} from './signing-api.js';

// 2.2 Kí hồ sơ trường, lớp, nhân sự, học sinh (mục 6 của Sở, bản chạy nội bộ; DT-16 phần 16k). Mỗi thẻ là danh sách đối
// tượng của năm học đang dùng kèm hồ sơ chưa hủy: cột đối tượng, trạng thái, xem hồ sơ, tệp hồ sơ, ngày tạo, ngày kí, ngày
// thay đổi như của Sở. Chọn dòng rồi bấm "Tạo hồ sơ", "Kí xác nhận nội bộ" (không phải chữ ký số; phần mềm chưa kết nối nhà
// cung cấp nên không có nút "Đăng nhập và kí"), "Tải thông tin thay đổi"; "Hủy hồ sơ" trên từng dòng. Thẻ Sổ đầu bài theo
// lớp và tháng, có "Xuất dữ liệu sổ đầu bài"
export const STATUS_TONES: Record<SigningDossierStatus | 'none', StatusTone> = {
  none: 'neutral',
  created: 'info',
  signed: 'success',
  completed: 'success',
  sent: 'success',
  cancelled: 'neutral',
};

const thisMonth = () => todayText().slice(0, 7);

function columns(onError: (message: string) => void): Array<DataGridColumn<SigningObject>> {
  return [
    {
      id: 'object',
      header: 'Đối tượng',
      alwaysVisible: true,
      className: 'font-medium',
      cell: (row) => row.object_label,
    },
    { id: 'detail', header: 'Thông tin', cell: (row) => row.detail ?? '' },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => {
        const status = row.dossier?.status ?? 'none';
        return <StatusBadge tone={STATUS_TONES[status]} label={SIGNING_STATUS_LABELS[status]} />;
      },
    },
    { id: 'code', header: 'Mã định danh hồ sơ', cell: (row) => row.dossier?.code ?? '' },
    {
      id: 'view',
      header: 'Xem hồ sơ',
      cell: (row) =>
        row.dossier ? (
          <Button
            variant="text"
            aria-label={`Xem hồ sơ ${row.object_label}`}
            onClick={() => {
              if (row.dossier) {
                openDossierFile(row.dossier).catch((error: unknown) => onError(messageOf(error)));
              }
            }}
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
            <Button
              variant="text"
              onClick={() =>
                row.dossier &&
                downloadDossierFile(row.dossier, 'original').catch((error: unknown) => onError(messageOf(error)))
              }
            >
              {row.dossier.file_name}
            </Button>
            {row.dossier.signed_file_name ? (
              <Button
                variant="text"
                onClick={() =>
                  row.dossier &&
                  downloadDossierFile(row.dossier, 'signed').catch((error: unknown) => onError(messageOf(error)))
                }
              >
                {row.dossier.signed_file_name}
              </Button>
            ) : null}
          </span>
        ) : (
          ''
        ),
    },
    { id: 'created_at', header: 'Ngày tạo', cell: (row) => formatDateTime(row.dossier?.created_at ?? null) },
    { id: 'signed_at', header: 'Ngày kí', cell: (row) => formatDateTime(row.dossier?.signed_at ?? null) },
    { id: 'signed_by', header: 'Người kí', hiddenByDefault: true, cell: (row) => row.dossier?.signed_by_name ?? '' },
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
  ];
}

type Pending =
  | { kind: 'create'; rows: SigningObject[] }
  | { kind: 'sign'; rows: SigningObject[] }
  | { kind: 'cancel'; row: SigningObject };

export function SigningDossiersPage() {
  const canManage = useHasPermission(PERMISSION_CODES.signingManage);
  const canSign = useHasPermission(PERMISSION_CODES.signingSign);
  const queryClient = useQueryClient();
  const grid = useGridSettings('signing-dossiers');
  const [type, setType] = useState<SigningObjectType>('school');
  const [month, setMonth] = useState(thisMonth);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<Pending>();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const objects = useQuery({
    queryKey: ['signing', 'objects', type, month],
    queryFn: () => listSigningObjects(type, month),
    enabled: type !== 'class_log' || /^\d{4}-\d{2}$/.test(month),
  });
  const certificate = useQuery({ queryKey: ['signing', 'certificate'], queryFn: readCertificate });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['signing'] });
  const act = useMutation({
    mutationFn: async (action: Pending): Promise<string> => {
      if (action.kind === 'create') {
        const result = await createDossiers(
          type,
          action.rows.map((row) => row.object_id),
          month,
        );
        return `Đã tạo ${result.created} hồ sơ: ${result.codes.join(', ')}`;
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
    onError: () => setPending(undefined),
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
  const rows = (objects.data ?? []).filter(
    (row) =>
      !keyword ||
      `${row.object_label} ${row.detail ?? ''} ${row.dossier?.code ?? ''}`.toLocaleLowerCase('vi').includes(keyword),
  );
  const signerReady = certificate.data?.status === 'registered' && !certificate.data.expired;
  const tabs = SIGNING_OBJECT_TYPES.map((item) => ({ key: item.value, label: item.tab }));

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/signing-dossiers')}</h1>
        <Alert tone="info">
          "Tạo hồ sơ" lập tệp PDF từ dữ liệu hiện tại của đối tượng. "Kí xác nhận nội bộ" lập tệp đã kí ghi người kí,
          thời điểm kí, ảnh con dấu và mã băm của tệp gốc; đây không phải chữ ký số vì phần mềm chưa kết nối nhà cung
          cấp chữ ký số. "Tải thông tin thay đổi" so dữ liệu hiện tại với hồ sơ đã tạo.
        </Alert>
        {canSign && certificate.data && !signerReady ? (
          <Alert tone="warning">
            Chứng thư số nhà trường chưa đăng ký kí nội bộ hoặc đã hết hiệu lực; đăng ký ở mục 1.1 trước khi kí hồ sơ.
          </Alert>
        ) : null}
        <TabBar<SigningObjectType> label="Loại hồ sơ" tabs={tabs} current={type} onSelect={setType} />
        {type === 'class_log' ? (
          <label className="flex max-w-xs flex-col gap-2 text-label font-medium text-text">
            Tháng của sổ đầu bài
            <input
              className={FORM_CONTROL_CLASS}
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
        ) : null}
        {objects.isError ? <Alert tone="danger">{messageOf(objects.error)}</Alert> : null}
        {act.error ? <Alert tone="danger">{messageOf(act.error)}</Alert> : null}
        {check.error ? <Alert tone="danger">{messageOf(check.error)}</Alert> : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        <DataGrid
          label="Danh sách hồ sơ kí"
          columns={columns(setError)}
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
                {canManage ? (
                  <Button
                    variant="primary"
                    disabled={withoutDossier.length === 0}
                    onClick={() => setPending({ kind: 'create', rows: withoutDossier })}
                  >
                    Tạo hồ sơ
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
                {canManage ? (
                  <Button
                    variant="secondary"
                    disabled={withDossier.length === 0 || check.isPending}
                    onClick={() => check.mutate(withDossier)}
                  >
                    Tải thông tin thay đổi
                  </Button>
                ) : null}
                {type === 'class_log' ? (
                  <Button
                    variant="secondary"
                    disabled={selected.length !== 1}
                    onClick={() => {
                      setError(undefined);
                      exportClassLog(selected[0]?.object_id ?? '', month).catch((reason: unknown) =>
                        setError(messageOf(reason)),
                      );
                    }}
                  >
                    Xuất dữ liệu sổ đầu bài
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
            `Lập tệp PDF từ dữ liệu hiện tại: ${pending.rows.map((row) => row.object_label).join(', ')}.`
          ) : pending.kind === 'sign' ? (
            'Tệp đã kí ghi tên bạn, thời điểm kí, thông tin chứng thư đã khai báo, ảnh con dấu và mã băm của tệp gốc. Đây là xác nhận trên phần mềm, không phải chữ ký số.'
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
