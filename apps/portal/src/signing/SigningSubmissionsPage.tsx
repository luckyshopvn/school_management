import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PERMISSION_CODES,
  SIGNING_IDENTITY_OBJECT_TYPES,
  SIGNING_OBJECT_LABELS,
  SIGNING_STATUS_LABELS,
  SIGNING_VISIBLE_OBJECT_TYPES,
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
import { SigningDossierViewer } from './SigningDossierViewer.js';
import { STATUS_TONES } from './SigningDossiersPage.js';
import {
  completeDossiers,
  downloadDossierFile,
  listSigningSubmissions,
  markDossiersSent,
  uncompleteDossier,
  type SigningDossier,
} from './signing-api.js';

// 2.3 Xác nhận hoàn thành và gửi hồ sơ (mục 6 của Sở, bản chạy nội bộ; DT-16 phần 16k, DT-17 phần 17b). Danh sách hồ sơ đã
// kí của năm học đang dùng, cột theo lưới của Sở: tên trường, tên hiệu trưởng, trạng thái, xem hồ sơ, tệp hồ sơ, xác nhận
// hoàn thành, trạng thái gửi, mã định danh hồ sơ, ghi chú, ngày xác nhận hoàn thành, xác nhận gửi, ngày gửi. Chọn bộ lọc rồi
// bấm "Tìm kiếm". "Xác nhận hoàn thành" khóa hồ sơ (không hủy được); "Hủy xác nhận hoàn thành" khi chưa gửi. Phần mềm không
// truyền hồ sơ lên cấp trên nên có "Tải tệp gửi" (tệp đã kí) và "Đánh dấu đã gửi" kèm ngày gửi thay cho nút "Gửi hồ sơ"
const STATUS_FILTERS: SigningDossierStatus[] = ['signed', 'completed', 'sent'];

type Filter = { objectType: SigningObjectType | ''; status: SigningDossierStatus | '' };

export function SigningSubmissionsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.signingManage);
  const canSeeIdentity = useHasPermission(PERMISSION_CODES.nationalIdView);
  const queryClient = useQueryClient();
  const grid = useGridSettings('signing-submissions');
  const [draft, setDraft] = useState<Filter>({ objectType: '', status: '' });
  const [filter, setFilter] = useState<Filter>(draft);
  const [pending, setPending] = useState<
    | { kind: 'complete'; rows: SigningDossier[] }
    | { kind: 'send'; rows: SigningDossier[] }
    | { kind: 'uncomplete'; rows: SigningDossier[] }
  >();
  const [viewing, setViewing] = useState<string>();
  const [sentOn, setSentOn] = useState(todayText);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const dossiers = useQuery({
    queryKey: ['signing', 'submissions', filter.objectType, filter.status],
    queryFn: () => listSigningSubmissions(filter),
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
      for (const row of action.rows) {
        await uncompleteDossier(row.id);
      }
      return `Đã hủy xác nhận hoàn thành ${action.rows.length} hồ sơ`;
    },
    onSuccess: async (message) => {
      setPending(undefined);
      await queryClient.invalidateQueries({ queryKey: ['signing'] });
      setToastMessage(message);
    },
    onError: () => setPending(undefined),
  });
  const school = dossiers.data?.school;
  const locked = (row: SigningDossier) => SIGNING_IDENTITY_OBJECT_TYPES.includes(row.object_type) && !canSeeIdentity;
  const download = (row: SigningDossier, version: 'original' | 'signed') => {
    setError(undefined);
    downloadDossierFile(row, version).catch((reason: unknown) => setError(messageOf(reason)));
  };
  const columns: Array<DataGridColumn<SigningDossier>> = [
    { id: 'school', header: 'Tên trường', cell: () => school?.name ?? '' },
    { id: 'principal', header: 'Tên hiệu trưởng', cell: () => school?.principal_name ?? '' },
    { id: 'type', header: 'Loại hồ sơ', cell: (row) => SIGNING_OBJECT_LABELS[row.object_type] },
    {
      id: 'object',
      header: 'Đối tượng',
      alwaysVisible: true,
      className: 'font-medium',
      cell: (row) => row.object_label,
    },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => <StatusBadge tone={STATUS_TONES[row.status]} label={SIGNING_STATUS_LABELS[row.status]} />,
    },
    {
      id: 'view',
      header: 'Xem hồ sơ',
      cell: (row) => (
        <Button
          variant="text"
          aria-label={`Xem hồ sơ ${row.code}`}
          disabled={locked(row)}
          onClick={() => setViewing(row.id)}
        >
          Xem
        </Button>
      ),
    },
    {
      id: 'file',
      header: 'Tệp hồ sơ',
      cell: (row) => (
        <Button variant="text" disabled={locked(row)} onClick={() => download(row, 'signed')}>
          {row.signed_file_name ?? row.file_name}
        </Button>
      ),
    },
    {
      id: 'completed',
      header: 'Xác nhận hoàn thành',
      cell: (row) => (row.status === 'completed' || row.status === 'sent' ? 'Đã xác nhận' : 'Chưa xác nhận'),
    },
    {
      id: 'send_status',
      header: 'Trạng thái gửi',
      cell: (row) => (row.status === 'sent' ? 'Đã đánh dấu gửi' : 'Chưa gửi'),
    },
    { id: 'code', header: 'Mã định danh hồ sơ', cell: (row) => row.code },
    { id: 'note', header: 'Ghi chú', cell: (row) => [row.note, row.sent_note].filter(Boolean).join('; ') },
    { id: 'completed_at', header: 'Ngày xác nhận hoàn thành', cell: (row) => formatDateTime(row.completed_at) },
    { id: 'sent_by', header: 'Xác nhận gửi', cell: (row) => row.sent_by_name ?? '' },
    { id: 'sent_on', header: 'Ngày gửi', cell: (row) => formatDate(row.sent_on) },
    { id: 'signed_at', header: 'Ngày ký', hiddenByDefault: true, cell: (row) => formatDateTime(row.signed_at) },
    { id: 'signed_by', header: 'Người kí', hiddenByDefault: true, cell: (row) => row.signed_by_name ?? '' },
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
          Phần mềm không gửi hồ sơ lên cấp trên. Sau khi xác nhận hoàn thành, bấm "Tải tệp gửi" để lấy tệp đã kí, nộp
          cho cấp trên rồi bấm "Đánh dấu đã gửi" kèm ngày gửi.
        </Alert>
        {dossiers.isError ? <Alert tone="danger">{messageOf(dossiers.error)}</Alert> : null}
        {act.error ? <Alert tone="danger">{messageOf(act.error)}</Alert> : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
          <SelectBox
            label="Loại hồ sơ"
            value={draft.objectType}
            emptyLabel="Tất cả"
            options={SIGNING_VISIBLE_OBJECT_TYPES.map((item) => ({ value: item.value, label: item.label }))}
            onChange={(value) => setDraft({ ...draft, objectType: value as SigningObjectType | '' })}
          />
          <SelectBox
            label="Trạng thái"
            value={draft.status}
            emptyLabel="Đã kí, đã xác nhận, đã gửi"
            options={STATUS_FILTERS.map((value) => ({ value, label: SIGNING_STATUS_LABELS[value] }))}
            onChange={(value) => setDraft({ ...draft, status: value as SigningDossierStatus | '' })}
          />
          <div>
            <Button variant="secondary" onClick={() => setFilter(draft)}>
              Tìm kiếm
            </Button>
          </div>
        </div>
        <DataGrid
          label="Danh sách hồ sơ đã kí"
          columns={columns}
          rows={dossiers.data?.items ?? []}
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
                  onClick={() => setPending({ kind: 'uncomplete', rows: selected })}
                >
                  Hủy xác nhận hoàn thành
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
            <Button variant="text" disabled={locked(row)} onClick={() => download(row, 'signed')}>
              Tải tệp gửi
            </Button>
          )}
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
      {viewing ? <SigningDossierViewer dossierId={viewing} onClose={() => setViewing(undefined)} /> : null}
      {pending ? (
        <ConfirmDialog
          open
          title={
            pending.kind === 'complete'
              ? `Xác nhận hoàn thành ${pending.rows.length} hồ sơ?`
              : pending.kind === 'send'
                ? `Đánh dấu đã gửi ${pending.rows.length} hồ sơ?`
                : `Hủy xác nhận hoàn thành ${pending.rows.length} hồ sơ?`
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
