import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PERMISSION_CODES,
  SIGNING_OBJECT_LABELS,
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
} from '@school-management/ui';
import { SelectBox } from '../facilities/facilities-ui.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import { formatDate, formatDateTime, messageOf, todayText } from './SigningCertificatePage.js';
import { STATUS_TONES } from './SigningDossiersPage.js';
import {
  completeDossiers,
  downloadDossierFile,
  listSigningSubmissions,
  markDossiersSent,
  uncompleteDossier,
  type SigningDossier,
} from './signing-api.js';

// 2.3 Xác nhận hoàn thành và gửi hồ sơ (mục 6 của Sở, bản chạy nội bộ; DT-16 phần 16k). Danh sách hồ sơ đã kí của năm học
// đang dùng kèm mã định danh hồ sơ. "Xác nhận hoàn thành" khóa hồ sơ (không hủy được); "Hủy xác nhận" khi chưa gửi. Phần
// mềm không truyền hồ sơ lên cấp trên nên có "Tải tệp gửi" (tệp đã kí) và "Đánh dấu đã gửi" kèm ngày gửi
const STATUS_FILTERS: SigningDossierStatus[] = ['signed', 'completed', 'sent'];

export function SigningSubmissionsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.signingManage);
  const queryClient = useQueryClient();
  const grid = useGridSettings('signing-submissions');
  const [objectType, setObjectType] = useState<SigningObjectType | ''>('');
  const [status, setStatus] = useState<SigningDossierStatus | ''>('');
  const [pending, setPending] = useState<
    | { kind: 'complete'; rows: SigningDossier[] }
    | { kind: 'send'; rows: SigningDossier[] }
    | { kind: 'uncomplete'; row: SigningDossier }
  >();
  const [sentOn, setSentOn] = useState(todayText);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const dossiers = useQuery({
    queryKey: ['signing', 'submissions', objectType, status],
    queryFn: () => listSigningSubmissions({ objectType, status }),
  });
  const act = useMutation({
    mutationFn: async (action: NonNullable<typeof pending>): Promise<string> => {
      if (action.kind === 'complete') {
        const result = await completeDossiers(action.rows.map((row) => row.id));
        return `Đã xác nhận hoàn thành ${result.completed} hồ sơ`;
      }
      if (action.kind === 'send') {
        const result = await markDossiersSent(
          action.rows.map((row) => row.id),
          sentOn,
          note.trim() || null,
        );
        return `Đã đánh dấu đã gửi ${result.sent} hồ sơ`;
      }
      await uncompleteDossier(action.row.id);
      return `Đã hủy xác nhận hồ sơ ${action.row.code}`;
    },
    onSuccess: async (message) => {
      setPending(undefined);
      await queryClient.invalidateQueries({ queryKey: ['signing'] });
      setToastMessage(message);
    },
    onError: () => setPending(undefined),
  });
  const columns: Array<DataGridColumn<SigningDossier>> = [
    { id: 'code', header: 'Mã định danh hồ sơ', alwaysVisible: true, className: 'font-medium', cell: (row) => row.code },
    { id: 'object', header: 'Đối tượng', cell: (row) => row.object_label },
    { id: 'type', header: 'Loại hồ sơ', cell: (row) => SIGNING_OBJECT_LABELS[row.object_type] },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => <StatusBadge tone={STATUS_TONES[row.status]} label={SIGNING_STATUS_LABELS[row.status]} />,
    },
    { id: 'signed_at', header: 'Ngày kí', cell: (row) => formatDateTime(row.signed_at) },
    { id: 'signed_by', header: 'Người kí', cell: (row) => row.signed_by_name ?? '' },
    { id: 'completed_at', header: 'Ngày xác nhận', cell: (row) => formatDateTime(row.completed_at) },
    { id: 'sent_on', header: 'Ngày gửi', cell: (row) => formatDate(row.sent_on) },
    { id: 'sent_by', header: 'Người đánh dấu gửi', hiddenByDefault: true, cell: (row) => row.sent_by_name ?? '' },
    { id: 'sent_note', header: 'Ghi chú gửi', hiddenByDefault: true, cell: (row) => row.sent_note ?? '' },
    {
      id: 'changed_at',
      header: 'Ngày thay đổi',
      hiddenByDefault: true,
      cell: (row) => formatDateTime(row.changed_at),
    },
  ];

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/signing-submissions')}</h1>
        <Alert tone="info">
          Phần mềm không gửi hồ sơ lên cấp trên. Sau khi xác nhận hoàn thành, bấm "Tải tệp gửi" để lấy tệp đã kí, nộp cho
          cấp trên rồi bấm "Đánh dấu đã gửi" kèm ngày gửi.
        </Alert>
        {dossiers.isError ? <Alert tone="danger">{messageOf(dossiers.error)}</Alert> : null}
        {act.error ? <Alert tone="danger">{messageOf(act.error)}</Alert> : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SelectBox
            label="Loại hồ sơ"
            value={objectType}
            emptyLabel="Tất cả"
            options={SIGNING_OBJECT_TYPES.map((item) => ({ value: item.value, label: item.label }))}
            onChange={(value) => setObjectType(value as SigningObjectType | '')}
          />
          <SelectBox
            label="Trạng thái"
            value={status}
            emptyLabel="Đã kí, đã xác nhận, đã gửi"
            options={STATUS_FILTERS.map((value) => ({ value, label: SIGNING_STATUS_LABELS[value] }))}
            onChange={(value) => setStatus(value as SigningDossierStatus | '')}
          />
        </div>
        <DataGrid
          label="Danh sách hồ sơ đã kí"
          columns={columns}
          rows={dossiers.data ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `${row.code} ${row.object_label}`}
          loading={dossiers.isPending}
          emptyText="Chưa có hồ sơ đã kí nào."
          selectable
          toolbar={(selected) =>
            canManage ? (
              <>
                <Button
                  variant="primary"
                  disabled={selected.length === 0 || selected.some((row) => row.status !== 'signed')}
                  onClick={() => setPending({ kind: 'complete', rows: selected })}
                >
                  Xác nhận hoàn thành
                </Button>
                <Button
                  variant="secondary"
                  disabled={selected.length === 0 || selected.some((row) => row.status !== 'completed')}
                  onClick={() => {
                    setSentOn(todayText());
                    setNote('');
                    setPending({ kind: 'send', rows: selected });
                  }}
                >
                  Đánh dấu đã gửi
                </Button>
              </>
            ) : null
          }
          rowActions={(row) => (
            <span className="flex flex-wrap justify-end gap-1">
              <Button
                variant="text"
                onClick={() => {
                  setError(undefined);
                  downloadDossierFile(row, 'signed').catch((reason: unknown) => setError(messageOf(reason)));
                }}
              >
                Tải tệp gửi
              </Button>
              {canManage && row.status === 'completed' ? (
                <Button variant="text" onClick={() => setPending({ kind: 'uncomplete', row })}>
                  Hủy xác nhận
                </Button>
              ) : null}
            </span>
          )}
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
      {pending ? (
        <ConfirmDialog
          open
          title={
            pending.kind === 'complete'
              ? `Xác nhận hoàn thành ${pending.rows.length} hồ sơ?`
              : pending.kind === 'send'
                ? `Đánh dấu đã gửi ${pending.rows.length} hồ sơ?`
                : `Hủy xác nhận hồ sơ ${pending.row.code}?`
          }
          confirmLabel={
            pending.kind === 'complete' ? 'Xác nhận hoàn thành' : pending.kind === 'send' ? 'Đánh dấu' : 'Hủy xác nhận'
          }
          busy={act.isPending}
          onCancel={() => setPending(undefined)}
          onConfirm={() => act.mutate(pending)}
        >
          {pending.kind === 'complete' ? (
            'Hồ sơ đã xác nhận hoàn thành không hủy được; muốn sửa thì hủy xác nhận trước khi đánh dấu đã gửi.'
          ) : pending.kind === 'send' ? (
            <span className="flex flex-col gap-3">
              <span>Phần mềm chỉ ghi trạng thái, không gửi tệp đi.</span>
              <label className="flex flex-col gap-2 text-label font-medium text-text">
                Ngày gửi
                <input
                  className={FORM_CONTROL_CLASS}
                  type="date"
                  max={todayText()}
                  value={sentOn}
                  onChange={(event) => setSentOn(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2 text-label font-medium text-text">
                Ghi chú (nơi nhận, số văn bản)
                <input className={FORM_CONTROL_CLASS} value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
            </span>
          ) : (
            'Hồ sơ trở lại trạng thái đã kí; có thể hủy để tạo lại.'
          )}
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}
