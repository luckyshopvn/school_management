import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES, type EvidenceRecordTypeCode } from '@school-management/shared';
import { Alert, Button, ConfirmDialog, FORM_CONTROL_CLASS, FormRow } from '@school-management/ui';
import { fieldErrorsOf, messageOf } from '../archives/archive-ui.js';
import { useHasPermission } from '../session/permissions.js';
import { createStoreEvidence, listEvidenceByRecord, readEvidenceFrameworks } from './evidence-api.js';

// Nút "Dùng làm minh chứng" ở trang của bản ghi nguồn (YCTD-396 lát L2, MH-686): chọn bộ, tiêu chí chính, tên rồi gắn; bản ghi
// đã là minh chứng thì hiện mã. Chỉ người có quyền đóng góp hoặc quản lý kho thấy nút; máy chủ kiểm cả quyền xem nguồn
export function UseAsEvidence({
  recordType,
  recordId,
  defaultTitle,
}: {
  recordType: EvidenceRecordTypeCode;
  recordId: string;
  defaultTitle: string;
}) {
  const queryClient = useQueryClient();
  const canContribute = useHasPermission(PERMISSION_CODES.evidenceContribute);
  const canManage = useHasPermission(PERMISSION_CODES.evidenceManage);
  const allowed = canContribute || canManage;
  const [open, setOpen] = useState(false);
  const [frameworkId, setFrameworkId] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [title, setTitle] = useState(defaultTitle);
  const [message, setMessage] = useState<string>();
  const used = useQuery({
    queryKey: ['evidence', 'by-record', recordType, recordId],
    queryFn: () => listEvidenceByRecord(recordType, recordId),
    enabled: allowed,
  });
  const frameworks = useQuery({
    queryKey: ['evidence', 'frameworks'],
    queryFn: readEvidenceFrameworks,
    enabled: allowed && open,
  });
  const framework = frameworks.data?.frameworks.find((row) => row.id === frameworkId);
  const save = useMutation({
    mutationFn: () =>
      createStoreEvidence({
        title,
        document_number: null,
        issued_date: null,
        issuer: null,
        description: null,
        valid_until: null,
        status: 'missing',
        school_year_names: [],
        shared_node_ids: [],
        framework_id: frameworkId,
        node_id: nodeId,
        box: null,
        record_type: recordType,
        record_id: recordId,
      }),
    onSuccess: async (result) => {
      setOpen(false);
      setMessage(`Đã gắn làm minh chứng ${result.display_code}`);
      await queryClient.invalidateQueries({ queryKey: ['evidence'] });
    },
  });
  if (!allowed) {
    return null;
  }
  const errors = fieldErrorsOf(save.error);
  const codes = (used.data ?? []).filter((row) => row.display_code);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {codes.length > 0 ? (
        <span className="text-label text-text-secondary">
          Minh chứng {codes.map((row) => row.display_code).join(', ')}
        </span>
      ) : null}
      <Button
        onClick={() => {
          setMessage(undefined);
          save.reset();
          setOpen(true);
        }}
      >
        Dùng làm minh chứng
      </Button>
      {message ? (
        <span role="status" className="text-label text-success">
          {message}
        </span>
      ) : null}
      <ConfirmDialog
        open={open}
        title="Dùng làm minh chứng"
        confirmLabel="Gắn minh chứng"
        busy={save.isPending}
        onCancel={() => setOpen(false)}
        onConfirm={() => save.mutate()}
      >
        <div className="flex flex-col gap-3 text-text">
          <p>Hệ thống chụp bản hiện tại của dữ liệu này làm phiên bản 1 của minh chứng.</p>
          {save.error && Object.keys(errors).length === 0 ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
          <FormRow label="Bộ tiêu chí" error={errors.framework_id}>
            <select
              className={FORM_CONTROL_CLASS}
              value={frameworkId}
              onChange={(event) => {
                setFrameworkId(event.target.value);
                setNodeId('');
              }}
            >
              <option value="">Chọn bộ tiêu chí</option>
              {(frameworks.data?.frameworks ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.code} · {row.name}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Tiêu chí chính" error={errors.node_id}>
            <select className={FORM_CONTROL_CLASS} value={nodeId} onChange={(event) => setNodeId(event.target.value)}>
              <option value="">Chọn tiêu chí</option>
              {(framework?.standards ?? [])
                .flatMap((standard) => standard.criteria)
                .map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.code} {node.title}
                  </option>
                ))}
            </select>
          </FormRow>
          <FormRow label="Tên minh chứng" error={errors.title}>
            <input className={FORM_CONTROL_CLASS} value={title} onChange={(event) => setTitle(event.target.value)} />
          </FormRow>
          {errors.record_id ? <Alert tone="danger">{errors.record_id}</Alert> : null}
        </div>
      </ConfirmDialog>
    </span>
  );
}
