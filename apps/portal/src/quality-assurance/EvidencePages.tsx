import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EVIDENCE_RECORD_TYPE_LABELS,
  EVIDENCE_VALIDITY_LABELS,
  QUALITY_EVIDENCE_STATUS_LABELS,
  type EvidenceRecordTypeCode,
  type EvidenceValidityCode,
  type QualityEvidenceStatusCode,
} from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  StatusBadge,
  type DataGridColumn,
  type StatusTone,
} from '@school-management/ui';
import { fieldErrorsOf, formatDate, messageOf, selectClass } from '../archives/archive-ui.js';
import { formatDateTime, Page, useToast } from '../directives/directive-ui.js';
import { useGridSettings } from '../pages/grid-settings.js';
import {
  addRecordVersion,
  addUploadVersion,
  attachEvidence,
  createStoreEvidence,
  deleteStoreEvidence,
  downloadEvidenceVersion,
  exportStoreEvidences,
  listRecordSources,
  listStoreEvidences,
  readEvidence,
  readEvidenceFrameworks,
  updateStoreEvidence,
  type EvidenceDetail,
  type EvidenceFramework,
  type EvidenceInput,
  type EvidenceRow,
} from './evidence-api.js';

// 1.1 Danh sách minh chứng của kho dùng chung (YCTD-396 lát L1, MH-679 đến MH-681). Một minh chứng dùng cho nhiều tiêu chí,
// nhiều năm học; mã theo bộ tiêu chí đang chọn. Nguồn là tệp tải lên hoặc dữ liệu trong phần mềm được chụp lúc gắn; mỗi lần
// thay tệp là một phiên bản. Tệp có dữ liệu cá nhân chỉ người có quyền xem nguồn tải được
const STATUS_TONES: Record<QualityEvidenceStatusCode, StatusTone> = {
  missing: 'danger',
  collecting: 'info',
  sufficient: 'success',
  needs_update: 'warning',
};

const VALIDITY_TONES: Record<EvidenceValidityCode, StatusTone> = {
  none: 'neutral',
  valid: 'success',
  expiring: 'warning',
  expired: 'danger',
};

const textOrNull = (value: string) => (value.trim() === '' ? null : value.trim());
const textareaClass = `${FORM_CONTROL_CLASS} min-h-24`;
const yearsText = (years: string[]) => years.join(', ');
const yearsOf = (text: string) =>
  text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');

const EVIDENCE_COLUMNS: Array<DataGridColumn<EvidenceRow>> = [
  {
    id: 'code',
    header: 'Mã minh chứng',
    alwaysVisible: true,
    className: 'font-medium whitespace-nowrap',
    cell: (row) => row.display_code,
  },
  { id: 'title', header: 'Tên minh chứng', cell: (row) => row.title },
  {
    id: 'issued',
    header: 'Số, ngày ban hành',
    cell: (row) => [row.document_number, formatDate(row.issued_date)].filter(Boolean).join(', '),
  },
  { id: 'issuer', header: 'Nơi ban hành', hiddenByDefault: true, cell: (row) => row.issuer ?? '' },
  {
    id: 'criteria',
    header: 'Tiêu chí',
    cell: (row) => [row.primary_node.code, ...row.shared_nodes.map((node) => node.code)].join(', '),
  },
  { id: 'source', header: 'Nguồn', cell: (row) => row.source_label },
  { id: 'years', header: 'Năm học', hiddenByDefault: true, cell: (row) => yearsText(row.school_year_names) },
  {
    id: 'validity',
    header: 'Hiệu lực',
    cell: (row) => <StatusBadge tone={VALIDITY_TONES[row.validity]} label={row.validity_label} />,
  },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) => <StatusBadge tone={STATUS_TONES[row.status]} label={row.status_label} />,
  },
];

type SourceKind = 'record' | 'upload' | 'none';

const emptyInput = (year: string): EvidenceInput => ({
  title: '',
  document_number: null,
  issued_date: null,
  issuer: null,
  description: null,
  valid_until: null,
  status: 'missing',
  school_year_names: year ? [year] : [],
  shared_node_ids: [],
});

function criteriaOf(framework: EvidenceFramework | undefined) {
  return (framework?.standards ?? []).flatMap((standard) => standard.criteria);
}

// Ô chọn bản ghi trong phần mềm: loại dữ liệu, ô tìm, danh sách kết quả
function RecordPicker({
  recordType,
  recordId,
  error,
  onChange,
}: {
  recordType: EvidenceRecordTypeCode;
  recordId: string;
  error?: string;
  onChange(recordType: EvidenceRecordTypeCode, recordId: string): void;
}) {
  const [search, setSearch] = useState('');
  const sources = useQuery({
    queryKey: ['evidence', 'sources', recordType, search],
    queryFn: () => listRecordSources(recordType, search),
  });
  return (
    <>
      <FormRow label="Loại dữ liệu">
        <select
          className={FORM_CONTROL_CLASS}
          value={recordType}
          onChange={(event) => onChange(event.target.value as EvidenceRecordTypeCode, '')}
        >
          {Object.entries(EVIDENCE_RECORD_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </FormRow>
      <FormRow label="Dữ liệu nguồn" error={error ?? (sources.error ? messageOf(sources.error) : undefined)}>
        <div className="flex flex-col gap-1">
          <input
            aria-label="Tìm dữ liệu nguồn"
            placeholder="Tìm theo tên, số, trích yếu"
            className={FORM_CONTROL_CLASS}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            aria-label="Chọn dữ liệu nguồn"
            className={FORM_CONTROL_CLASS}
            value={recordId}
            onChange={(event) => onChange(recordType, event.target.value)}
          >
            <option value="">Chọn</option>
            {(sources.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </FormRow>
    </>
  );
}

function InfoFields({
  form,
  errors,
  onChange,
}: {
  form: EvidenceInput;
  errors: Record<string, string>;
  onChange(form: EvidenceInput): void;
}) {
  const set = (key: 'document_number' | 'issued_date' | 'issuer' | 'description' | 'valid_until') => (value: string) =>
    onChange({ ...form, [key]: textOrNull(value) });
  return (
    <>
      <FormRow label="Tên minh chứng" error={errors.title}>
        <input
          className={FORM_CONTROL_CLASS}
          value={form.title}
          onChange={(event) => onChange({ ...form, title: event.target.value })}
        />
      </FormRow>
      <FormRow label="Số, kí hiệu" error={errors.document_number}>
        <input
          className={FORM_CONTROL_CLASS}
          value={form.document_number ?? ''}
          onChange={(event) => set('document_number')(event.target.value)}
        />
      </FormRow>
      <FormRow label="Ngày ban hành" error={errors.issued_date}>
        <input
          type="date"
          className={FORM_CONTROL_CLASS}
          value={form.issued_date ?? ''}
          onChange={(event) => set('issued_date')(event.target.value)}
        />
      </FormRow>
      <FormRow label="Nơi ban hành" error={errors.issuer}>
        <input
          className={FORM_CONTROL_CLASS}
          value={form.issuer ?? ''}
          onChange={(event) => set('issuer')(event.target.value)}
        />
      </FormRow>
      <FormRow label="Năm học của minh chứng (cách nhau bằng dấu phẩy)" error={errors.school_year_names}>
        <input
          className={FORM_CONTROL_CLASS}
          value={yearsText(form.school_year_names)}
          onChange={(event) => onChange({ ...form, school_year_names: yearsOf(event.target.value) })}
        />
      </FormRow>
      <FormRow label="Hiệu lực đến (trống: không thời hạn)" error={errors.valid_until}>
        <input
          type="date"
          className={FORM_CONTROL_CLASS}
          value={form.valid_until ?? ''}
          onChange={(event) => set('valid_until')(event.target.value)}
        />
      </FormRow>
      <FormRow label="Trạng thái" error={errors.status}>
        <select
          className={FORM_CONTROL_CLASS}
          value={form.status}
          onChange={(event) => onChange({ ...form, status: event.target.value as QualityEvidenceStatusCode })}
        >
          {Object.entries(QUALITY_EVIDENCE_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </FormRow>
      <FormRow label="Mô tả" error={errors.description}>
        <textarea
          className={textareaClass}
          value={form.description ?? ''}
          onChange={(event) => set('description')(event.target.value)}
        />
      </FormRow>
    </>
  );
}

function SharedCriteria({
  framework,
  primaryId,
  value,
  onChange,
}: {
  framework: EvidenceFramework | undefined;
  primaryId: string;
  value: string[];
  onChange(ids: string[]): void;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-label font-medium">Dùng chung cho tiêu chí khác</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {criteriaOf(framework)
          .filter((node) => node.id !== primaryId)
          .map((node) => (
            <label key={node.id} className="flex min-h-11 items-center gap-1 text-content">
              <input
                type="checkbox"
                checked={value.includes(node.id)}
                onChange={() =>
                  onChange(value.includes(node.id) ? value.filter((id) => id !== node.id) : [...value, node.id])
                }
              />
              {node.code}
            </label>
          ))}
      </div>
    </fieldset>
  );
}

// MH-681 Thêm minh chứng
function CreateForm({
  framework,
  schoolYear,
  onSaved,
  onCancel,
}: {
  framework: EvidenceFramework;
  schoolYear: string;
  onSaved(result: { id: string; display_code: string }): void;
  onCancel(): void;
}) {
  const [form, setForm] = useState<EvidenceInput>(emptyInput(schoolYear));
  const [nodeId, setNodeId] = useState('');
  const [box, setBox] = useState('');
  const [kind, setKind] = useState<SourceKind>('none');
  const [recordType, setRecordType] = useState<EvidenceRecordTypeCode>('outgoing_document');
  const [recordId, setRecordId] = useState('');
  const [file, setFile] = useState<File>();
  const save = useMutation({
    mutationFn: async () => {
      const created = await createStoreEvidence({
        ...form,
        framework_id: framework.id,
        node_id: nodeId,
        box: box ? Number(box) : null,
        record_type: kind === 'record' ? recordType : null,
        record_id: kind === 'record' && recordId ? recordId : null,
      });
      if (kind === 'upload' && file) {
        await addUploadVersion(created.id, file);
      }
      return created;
    },
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  return (
    <form
      className="flex flex-col gap-3"
      aria-label="Thêm minh chứng"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error && Object.keys(errors).length === 0 ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="1. Nguồn">
        <fieldset className="flex flex-col gap-1">
          <legend className="sr-only">Nguồn minh chứng</legend>
          {(
            [
              ['record', 'Dữ liệu trong phần mềm (chụp bản lúc gắn)'],
              ['upload', 'Tải tệp lên'],
              ['none', 'Chưa có tệp'],
            ] as Array<[SourceKind, string]>
          ).map(([value, label]) => (
            <label key={value} className="flex min-h-11 items-center gap-2 text-content">
              <input type="radio" name="source-kind" checked={kind === value} onChange={() => setKind(value)} />
              {label}
            </label>
          ))}
        </fieldset>
        {kind === 'record' ? (
          <RecordPicker
            recordType={recordType}
            recordId={recordId}
            error={errors.record_id}
            onChange={(type, id) => {
              setRecordType(type);
              setRecordId(id);
            }}
          />
        ) : null}
        {kind === 'upload' ? (
          <FormRow label="Tệp (PDF, ảnh, Word, Excel, tối đa 20 MB)" error={errors.file}>
            <input type="file" className={FORM_CONTROL_CLASS} onChange={(event) => setFile(event.target.files?.[0])} />
          </FormRow>
        ) : null}
      </FormBlock>
      <FormBlock title="2. Thông tin">
        <InfoFields form={form} errors={errors} onChange={setForm} />
      </FormBlock>
      <FormBlock title="3. Tiêu chí">
        <FormRow label="Tiêu chí" error={errors.node_id}>
          <select className={FORM_CONTROL_CLASS} value={nodeId} onChange={(event) => setNodeId(event.target.value)}>
            <option value="">Chọn tiêu chí</option>
            {criteriaOf(framework).map((node) => (
              <option key={node.id} value={node.id}>
                {node.code} {node.title}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Số hộp (trống: theo tiêu chuẩn)" error={errors.box}>
          <input
            type="number"
            min={1}
            max={99}
            className={FORM_CONTROL_CLASS}
            value={box}
            onChange={(event) => setBox(event.target.value)}
          />
        </FormRow>
        <SharedCriteria
          framework={framework}
          primaryId={nodeId}
          value={form.shared_node_ids}
          onChange={(ids) => setForm({ ...form, shared_node_ids: ids })}
        />
      </FormBlock>
      <div className="flex gap-2">
        <Button variant="primary" type="submit" disabled={save.isPending}>
          Ghi
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </div>
    </form>
  );
}

function EditForm({
  detail,
  framework,
  onSaved,
  onCancel,
}: {
  detail: EvidenceDetail;
  framework: EvidenceFramework;
  onSaved(): void;
  onCancel(): void;
}) {
  const code = detail.codes.find((row) => row.framework_id === framework.id);
  const [form, setForm] = useState<EvidenceInput>({
    title: detail.title,
    document_number: detail.document_number,
    issued_date: detail.issued_date,
    issuer: detail.issuer,
    description: detail.description,
    valid_until: detail.valid_until,
    status: detail.status,
    school_year_names: detail.school_year_names,
    shared_node_ids: (code?.shared_nodes ?? []).map((node) => node.id),
  });
  const save = useMutation({
    mutationFn: () => updateStoreEvidence(detail.id, framework.id, form),
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  return (
    <form
      className="flex flex-col gap-3"
      aria-label={`Sửa minh chứng ${code?.display_code ?? detail.title}`}
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error && Object.keys(errors).length === 0 ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thông tin">
        <InfoFields form={form} errors={errors} onChange={setForm} />
        {code ? (
          <SharedCriteria
            framework={framework}
            primaryId={code.primary_node.id}
            value={form.shared_node_ids}
            onChange={(ids) => setForm({ ...form, shared_node_ids: ids })}
          />
        ) : null}
      </FormBlock>
      <div className="flex gap-2">
        <Button variant="primary" type="submit" disabled={save.isPending}>
          Ghi
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </div>
    </form>
  );
}

// Gắn minh chứng vào bộ tiêu chí khác: mã riêng của bộ đó theo tiêu chí chính
function AttachForm({
  id,
  frameworks,
  onAttached,
}: {
  id: string;
  frameworks: EvidenceFramework[];
  onAttached(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [frameworkId, setFrameworkId] = useState('');
  const [nodeId, setNodeId] = useState('');
  const attach = useMutation({
    mutationFn: () => attachEvidence(id, frameworkId, nodeId),
    onSuccess: async (result) => {
      setFrameworkId('');
      setNodeId('');
      await queryClient.invalidateQueries({ queryKey: ['evidence'] });
      onAttached(`Đã gắn vào bộ khác với mã ${result.display_code}`);
    },
  });
  if (frameworks.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-label font-medium text-text">
        Gắn vào bộ tiêu chí khác
        <select
          className={selectClass}
          value={frameworkId}
          onChange={(event) => {
            setFrameworkId(event.target.value);
            setNodeId('');
          }}
        >
          <option value="">Chọn bộ</option>
          {frameworks.map((row) => (
            <option key={row.id} value={row.id}>
              {row.code} · {row.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-label font-medium text-text">
        Tiêu chí chính ở bộ đó
        <select className={selectClass} value={nodeId} onChange={(event) => setNodeId(event.target.value)}>
          <option value="">Chọn tiêu chí</option>
          {criteriaOf(frameworks.find((row) => row.id === frameworkId)).map((node) => (
            <option key={node.id} value={node.id}>
              {node.code} {node.title}
            </option>
          ))}
        </select>
      </label>
      <Button disabled={!frameworkId || !nodeId || attach.isPending} onClick={() => attach.mutate()}>
        Gắn
      </Button>
      {attach.error ? <Alert tone="danger">{messageOf(attach.error)}</Alert> : null}
    </div>
  );
}

// MH-680 Chi tiết minh chứng
function DetailPanel({
  id,
  framework,
  frameworks,
  onChanged,
  onDeleted,
}: {
  id: string;
  framework: EvidenceFramework;
  frameworks: EvidenceFramework[];
  onChanged(message: string): void;
  onDeleted(message: string): void;
}) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ['evidence', 'detail', id], queryFn: () => readEvidence(id) });
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['evidence'] });
  const fetchFile = useMutation({ mutationFn: (versionNo: number | null) => downloadEvidenceVersion(id, versionNo) });
  const upload = useMutation({
    mutationFn: (file: File) => addUploadVersion(id, file),
    onSuccess: async (result) => {
      await refresh();
      onChanged(`Đã thêm phiên bản ${result.version_no}`);
    },
  });
  const recapture = useMutation({
    mutationFn: (version: { record_type: EvidenceRecordTypeCode; record_id: string }) =>
      addRecordVersion(id, version.record_type, version.record_id),
    onSuccess: async (result) => {
      await refresh();
      onChanged(`Đã chụp lại nguồn thành phiên bản ${result.version_no}`);
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteStoreEvidence(id),
    onSuccess: async () => {
      setDeleting(false);
      await refresh();
      onDeleted('Đã xóa minh chứng');
    },
    onError: () => setDeleting(false),
  });
  const data = detail.data;
  if (detail.error) {
    return <Alert tone="danger">{messageOf(detail.error)}</Alert>;
  }
  if (!data) {
    return <p className="text-content text-text-secondary">Đang tải…</p>;
  }
  if (editing) {
    return (
      <EditForm
        detail={data}
        framework={framework}
        onCancel={() => setEditing(false)}
        onSaved={async () => {
          setEditing(false);
          await refresh();
          onChanged('Đã ghi minh chứng');
        }}
      />
    );
  }
  const current = data.versions[0];
  const error = fetchFile.error ?? upload.error ?? recapture.error ?? remove.error;
  const code = data.codes.find((row) => row.framework_id === framework.id);
  return (
    <div className="flex flex-col gap-3" aria-label={`Chi tiết minh chứng ${code?.display_code ?? data.title}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-section-title font-semibold">
          {code ? `${code.display_code} ` : ''}
          {data.title}
        </h2>
        <StatusBadge tone={STATUS_TONES[data.status]} label={data.status_label} />
        <StatusBadge tone={VALIDITY_TONES[data.validity]} label={data.validity_label} />
      </div>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {data.source_changed && current?.record_type && current.record_id ? (
        <Alert tone="info">
          Nguồn đã thay đổi sau lần chụp ngày {formatDateTime(current.created_at)}.
          {data.can_edit ? (
            <Button
              disabled={recapture.isPending}
              onClick={() =>
                recapture.mutate({
                  record_type: current.record_type as EvidenceRecordTypeCode,
                  record_id: current.record_id as string,
                })
              }
            >
              Chụp lại thành phiên bản mới
            </Button>
          ) : null}
        </Alert>
      ) : null}
      {data.has_personal_data ? (
        <Alert tone="info">
          Minh chứng có dữ liệu cá nhân: chỉ người có quyền xem nguồn tải được tệp; mọi lần xem, tải được ghi nhật ký.
        </Alert>
      ) : null}
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-content md:grid-cols-[14rem_minmax(0,1fr)]">
        <dt className="font-medium">Số, ngày ban hành</dt>
        <dd>{[data.document_number, formatDate(data.issued_date)].filter(Boolean).join(', ') || 'Không có'}</dd>
        <dt className="font-medium">Nơi ban hành</dt>
        <dd>{data.issuer ?? 'Không có'}</dd>
        <dt className="font-medium">Năm học</dt>
        <dd>{yearsText(data.school_year_names)}</dd>
        <dt className="font-medium">Hiệu lực đến</dt>
        <dd>{data.valid_until ? formatDate(data.valid_until) : 'Không thời hạn'}</dd>
        <dt className="font-medium">Người phụ trách</dt>
        <dd>{data.owner_name ?? 'Chưa có'}</dd>
        {data.description ? (
          <>
            <dt className="font-medium">Mô tả</dt>
            <dd className="whitespace-pre-line">{data.description}</dd>
          </>
        ) : null}
      </dl>
      <section className="flex flex-col gap-1">
        <h3 className="text-subtitle font-semibold">Mã theo bộ tiêu chí</h3>
        <ul className="list-disc pl-5 text-content">
          {data.codes.map((row) => (
            <li key={row.framework_id}>
              {row.display_code} · {row.framework_name}: tiêu chí {row.primary_node.code}
              {row.shared_nodes.length > 0
                ? `, dùng chung ${row.shared_nodes.map((node) => node.code).join(', ')}`
                : ''}
            </li>
          ))}
        </ul>
      </section>
      {data.can_edit ? (
        <AttachForm
          id={id}
          frameworks={frameworks.filter((row) => !data.codes.some((code) => code.framework_id === row.id))}
          onAttached={onChanged}
        />
      ) : null}
      <section className="flex flex-col gap-1">
        <h3 className="text-subtitle font-semibold">Phiên bản</h3>
        {data.versions.length === 0 ? (
          <p className="text-content text-text-secondary">Chưa có tệp.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-content">
            {data.versions.map((version) => (
              <li key={version.version_no} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">Bản {version.version_no}</span>
                <span>
                  {version.source_label}
                  {version.record_label ? `: ${version.record_label}` : ''}
                  {version.file_name ? ` (${version.file_name})` : ''} · {version.created_by_name ?? ''},{' '}
                  {formatDateTime(version.created_at)}
                </span>
                {version.has_file && data.can_download ? (
                  <Button variant="text" onClick={() => fetchFile.mutate(version.version_no)}>
                    Tải bản {version.version_no}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="flex flex-wrap gap-2">
        {data.can_edit ? (
          <>
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-border px-4 text-label font-medium text-primary">
              Thêm phiên bản (tải tệp)
              <input
                type="file"
                aria-label="Tải tệp phiên bản mới"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) {
                    upload.mutate(file);
                  }
                }}
              />
            </label>
            <Button onClick={() => setEditing(true)}>Sửa</Button>
          </>
        ) : null}
        {data.can_delete ? <Button onClick={() => setDeleting(true)}>Xóa</Button> : null}
      </div>
      <section className="flex flex-col gap-1">
        <h3 className="text-subtitle font-semibold">Lịch sử</h3>
        <ul className="flex flex-col gap-1 text-content">
          {data.events.map((event, index) => (
            <li key={`${event.created_at}-${index}`}>
              {formatDateTime(event.created_at)} · {event.actor_name ?? ''}: {event.action_label}
              {event.version_no ? ` bản ${event.version_no}` : ''}
              {event.detail ? ` (${event.detail})` : ''}
            </li>
          ))}
        </ul>
      </section>
      <ConfirmDeleteDialog
        open={deleting}
        subject={`${code?.display_code ?? ''} ${data.title}`}
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setDeleting(false)}
      />
    </div>
  );
}

// MH-679 Danh sách minh chứng
export function QualityEvidencesPage() {
  const queryClient = useQueryClient();
  const grid = useGridSettings('quality-evidences');
  const { toast, setToast, close } = useToast();
  const [frameworkId, setFrameworkId] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [status, setStatus] = useState('');
  const [validity, setValidity] = useState('');
  const [search, setSearch] = useState('');
  const [panel, setPanel] = useState<'create' | string>();
  const frameworks = useQuery({ queryKey: ['evidence', 'frameworks'], queryFn: readEvidenceFrameworks });
  const first = frameworks.data?.frameworks.find((row) => row.status === 'active')?.id;
  useEffect(() => {
    if (!frameworkId && first) {
      setFrameworkId(first);
    }
  }, [frameworkId, first]);
  const framework = frameworks.data?.frameworks.find((row) => row.id === frameworkId);
  const evidences = useQuery({
    queryKey: ['evidence', 'list', frameworkId, nodeId, status, validity, search],
    queryFn: () => listStoreEvidences({ framework_id: frameworkId, node_id: nodeId, status, validity, q: search }),
    enabled: frameworkId !== '',
  });
  const list = useMutation({ mutationFn: () => exportStoreEvidences(frameworkId) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['evidence'] });
  const error = frameworks.error ?? evidences.error ?? list.error;
  return (
    <Page path="/quality/evidences" toast={toast} onToastClose={close}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-label font-medium text-text">
          Bộ tiêu chí
          <select
            className={selectClass}
            value={frameworkId}
            onChange={(event) => {
              setFrameworkId(event.target.value);
              setNodeId('');
              setPanel(undefined);
            }}
          >
            {(frameworks.data?.frameworks ?? []).length === 0 ? <option value="">Chưa có bộ tiêu chí</option> : null}
            {(frameworks.data?.frameworks ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.code} · {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Tiêu chí
          <select className={selectClass} value={nodeId} onChange={(event) => setNodeId(event.target.value)}>
            <option value="">Tất cả tiêu chí</option>
            {criteriaOf(framework).map((node) => (
              <option key={node.id} value={node.id}>
                {node.code} {node.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Trạng thái
          <select className={selectClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Tất cả</option>
            {Object.entries(QUALITY_EVIDENCE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Hiệu lực
          <select className={selectClass} value={validity} onChange={(event) => setValidity(event.target.value)}>
            <option value="">Tất cả</option>
            {Object.entries(EVIDENCE_VALIDITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {panel && framework ? (
        <section className="rounded-xl border border-border bg-card p-4">
          {panel === 'create' ? (
            <CreateForm
              framework={framework}
              schoolYear={frameworks.data?.school_year_name ?? ''}
              onCancel={() => setPanel(undefined)}
              onSaved={async (result) => {
                setPanel(result.id);
                await refresh();
                setToast(`Đã ghi minh chứng ${result.display_code}`);
              }}
            />
          ) : (
            <DetailPanel
              id={panel}
              framework={framework}
              frameworks={frameworks.data?.frameworks ?? []}
              onChanged={setToast}
              onDeleted={(message) => {
                setPanel(undefined);
                setToast(message);
              }}
            />
          )}
        </section>
      ) : null}
      <DataGrid
        label="Minh chứng"
        columns={EVIDENCE_COLUMNS}
        rows={evidences.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `${row.display_code} ${row.title}`}
        loading={frameworkId !== '' && !evidences.data && !evidences.error}
        emptyText="Bộ này chưa có minh chứng."
        search={{ label: 'Tìm theo mã, tên, số minh chứng', value: search, onChange: setSearch }}
        toolbar={
          <span className="flex flex-wrap gap-2">
            {frameworks.data?.can_contribute && framework ? (
              <Button variant="primary" onClick={() => setPanel('create')}>
                Thêm minh chứng
              </Button>
            ) : null}
            {frameworkId ? (
              <Button disabled={list.isPending} onClick={() => list.mutate()}>
                Xuất danh mục minh chứng
              </Button>
            ) : null}
          </span>
        }
        rowActions={(row) => (
          <Button variant="text" onClick={() => setPanel(row.id)}>
            Xem
          </Button>
        )}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </Page>
  );
}
