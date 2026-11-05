import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormRow,
  StatusBadge,
  type DataGridColumn,
} from '@school-management/ui';
import { EMPTY_ACCOUNT_FILTER, listAccounts } from '../accounts/accounts-api.js';
import { formatDate, messageOf, selectClass } from '../archives/archive-ui.js';
import { Page, useToast } from '../directives/directive-ui.js';
import { useGridSettings } from '../pages/grid-settings.js';
import {
  listReviewGrants,
  readEvidenceFrameworks,
  revokeReviewGrant,
  saveReviewGrant,
  type EvidenceReviewGrant,
} from './evidence-api.js';

// 3.5 Đoàn đánh giá ngoài (YCTD-396 lát L8, MH-687, Q-396-9 B): người quản lý kho giao bộ tiêu chí cho tài khoản vai trò
// VT-23 đến hết ngày giao. Tài khoản đoàn tạo ở Quản lý tài khoản (bắt buộc có ngày hết hiệu lực); đoàn chỉ xem danh sách,
// chi tiết, tệp và danh mục của bộ được giao; mỗi lần xem, tải tệp ghi nhật ký truy cập
const REVIEWER_ROLE = 'VT-23';

const COLUMNS: Array<DataGridColumn<EvidenceReviewGrant>> = [
  { id: 'user', header: 'Tài khoản đoàn', alwaysVisible: true, cell: (row) => row.user_name },
  { id: 'framework', header: 'Bộ tiêu chí', cell: (row) => `${row.framework_code} · ${row.framework_name}` },
  { id: 'valid_until', header: 'Hết hạn giao', cell: (row) => formatDate(row.valid_until) },
  {
    id: 'state',
    header: 'Trạng thái',
    cell: (row) =>
      row.expired ? <StatusBadge tone="neutral" label="Hết hạn" /> : <StatusBadge tone="success" label="Còn hạn" />,
  },
  { id: 'note', header: 'Ghi chú', hiddenByDefault: true, cell: (row) => row.note ?? '' },
  { id: 'granted_by', header: 'Người giao', hiddenByDefault: true, cell: (row) => row.granted_by_name ?? '' },
];

export function EvidenceReviewersPage() {
  const queryClient = useQueryClient();
  const grid = useGridSettings('quality-evidence-reviewers');
  const { toast, setToast, close } = useToast();
  const [userId, setUserId] = useState('');
  const [frameworkId, setFrameworkId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [note, setNote] = useState('');
  const grants = useQuery({ queryKey: ['evidence', 'reviewers'], queryFn: listReviewGrants });
  const frameworks = useQuery({ queryKey: ['evidence', 'frameworks'], queryFn: readEvidenceFrameworks });
  // Tài khoản vai trò đoàn đánh giá ngoài đang hoạt động; cần quyền quản lý tài khoản để đọc danh sách
  const accounts = useQuery({
    queryKey: ['evidence', 'reviewer-accounts'],
    queryFn: () =>
      listAccounts({ ...EMPTY_ACCOUNT_FILTER, roleCode: REVIEWER_ROLE, status: 'active', page: 1, pageSize: 200 }),
    retry: false,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['evidence', 'reviewers'] });
  const save = useMutation({
    mutationFn: () => {
      const account = accounts.data?.items.find((row) => row.id === userId);
      return saveReviewGrant({
        user_id: userId,
        user_name: account?.full_name ?? '',
        framework_id: frameworkId,
        valid_until: validUntil,
        note: note.trim() === '' ? null : note.trim(),
      });
    },
    onSuccess: async () => {
      await refresh();
      setToast('Đã giao bộ tiêu chí cho đoàn đánh giá');
      setNote('');
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => revokeReviewGrant(id),
    onSuccess: async () => {
      await refresh();
      setToast('Đã thu hồi lần giao');
    },
  });
  const error = grants.error ?? frameworks.error ?? save.error ?? revoke.error;
  return (
    <Page path="/quality/evidence-reviewers" toast={toast} onToastClose={close}>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {accounts.error ? (
        <Alert tone="warning">
          Không đọc được danh sách tài khoản đoàn đánh giá (cần quyền quản lý tài khoản): {messageOf(accounts.error)}
        </Alert>
      ) : null}
      <form
        aria-label="Giao bộ tiêu chí cho đoàn đánh giá"
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <p className="text-content text-muted">
          Tạo tài khoản vai trò "Đoàn đánh giá ngoài" có ngày hết hiệu lực ở Quản lý tài khoản, rồi giao bộ tiêu chí.
          Đoàn chỉ xem, tải minh chứng của bộ được giao đến hết ngày giao; tệp có dữ liệu cá nhân không tải được.
        </p>
        <FormRow label="Tài khoản đoàn">
          <select className={selectClass} value={userId} required onChange={(event) => setUserId(event.target.value)}>
            <option value="">Chọn tài khoản</option>
            {(accounts.data?.items ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.full_name} ({row.username ?? row.phone ?? ''}
                {row.valid_until ? `, tài khoản đến ${formatDate(row.valid_until)}` : ''})
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Bộ tiêu chí">
          <select
            className={selectClass}
            value={frameworkId}
            required
            onChange={(event) => setFrameworkId(event.target.value)}
          >
            <option value="">Chọn bộ</option>
            {(frameworks.data?.frameworks ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.code} · {row.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Hết hạn giao">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={validUntil}
            required
            onChange={(event) => setValidUntil(event.target.value)}
          />
        </FormRow>
        <FormRow label="Ghi chú">
          <input
            className={FORM_CONTROL_CLASS}
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
          />
        </FormRow>
        <span>
          <Button type="submit" variant="primary" disabled={save.isPending || !userId || !frameworkId || !validUntil}>
            Giao bộ
          </Button>
        </span>
      </form>
      <DataGrid
        label="Các lần giao cho đoàn đánh giá"
        columns={COLUMNS}
        rows={grants.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `${row.user_name} ${row.framework_code}`}
        loading={!grants.data && !grants.error}
        emptyText="Chưa giao bộ nào cho đoàn đánh giá."
        rowActions={(row) => (
          <Button variant="text" disabled={revoke.isPending} onClick={() => revoke.mutate(row.id)}>
            Thu hồi
          </Button>
        )}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </Page>
  );
}
