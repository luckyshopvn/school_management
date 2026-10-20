import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { INCOMING_KIND_LABELS, type DocumentCatalogKind } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, FormBlock, FormRow } from '@school-management/ui';
import { fieldErrorsOf, messageOf } from '../archives/archive-ui.js';
import {
  listCatalog,
  listDocumentStaff,
  listExternalUnits,
  listIncoming,
  listLeaders,
} from '../incoming-documents/incoming-api.js';
import { listOrgUnits } from '../org-units/org-units-api.js';
import {
  createOutgoing,
  listOutgoing,
  updateOutgoing,
  type OutgoingDocument,
  type OutgoingDocumentInput,
} from './outgoing-api.js';

// Biểu mẫu văn bản đi theo VNPT iOffice (DT-18 phần 18b, YCTD-140): số eOffice (phần mềm cấp), số trình ký, trích yếu, hình
// thức, độ khẩn, độ mật, lĩnh vực, loại văn bản, người soạn thảo, đơn vị soạn thảo, người ký, phân loại văn bản ưu tiên,
// thời gian họp và địa điểm (giấy mời), chèn mã QR; văn bản liên quan, văn bản gốc, văn bản đến được trả lời; đơn vị dự kiến
// nhận (đơn vị bên ngoài, đơn vị trong trường). Tệp đính kèm thêm ở chi tiết sau khi ghi
type Recipient = { external_unit_id?: string; org_unit_id?: string; name: string };
type Link = { link_type: 'related' | 'original'; outgoing_id?: string; incoming_id?: string; label: string };

function initialValues(document?: OutgoingDocument) {
  return {
    submission_number: document?.submission_number ?? '',
    summary: document?.summary ?? '',
    form_id: document?.form_id ?? '',
    urgency_id: document?.urgency_id ?? '',
    secrecy_id: document?.secrecy_id ?? '',
    field_id: document?.field_id ?? '',
    document_kind: document?.document_kind ?? 'new',
    priority: document?.priority ?? false,
    meeting_at: document?.meeting_at ? toLocalInput(document.meeting_at) : '',
    meeting_place: document?.meeting_place ?? '',
    insert_qr: document?.insert_qr ?? true,
    drafter_id: document?.drafter_id ?? '',
    drafting_unit_id: document?.drafting_unit_id ?? '',
    signer_id: document?.signer_id ?? '',
    content_note: document?.content_note ?? '',
    reply_to_id: document?.reply_to_id ?? '',
  };
}

// Giờ họp lưu theo múi giờ chuẩn; ô nhập datetime-local hiện giờ Việt Nam
function toLocalInput(value: string): string {
  const date = new Date(value);
  const shifted = new Date(date.getTime() + 7 * 3_600_000);
  return shifted.toISOString().slice(0, 16);
}

export function OutgoingDocumentForm({
  document,
  onSaved,
  onCancel,
}: {
  document?: OutgoingDocument;
  onSaved(saved: OutgoingDocument): void;
  onCancel(): void;
}) {
  const [values, setValues] = useState(() => initialValues(document));
  const [recipients, setRecipients] = useState<Recipient[]>(
    () =>
      document?.recipients.map((item) => ({
        ...(item.external_unit_id ? { external_unit_id: item.external_unit_id } : {}),
        ...(item.org_unit_id ? { org_unit_id: item.org_unit_id } : {}),
        name: item.name,
      })) ?? [],
  );
  const [links, setLinks] = useState<Link[]>(
    () =>
      document?.links.map((link) => ({
        link_type: link.link_type,
        ...(link.outgoing_id ? { outgoing_id: link.outgoing_id } : {}),
        ...(link.incoming_id ? { incoming_id: link.incoming_id } : {}),
        label: `${link.symbol ?? ''} – ${link.summary ?? ''}`,
      })) ?? [],
  );
  const [linkSearch, setLinkSearch] = useState('');
  const catalog = useQuery({ queryKey: ['document-catalogs'], queryFn: () => listCatalog() });
  const leaders = useQuery({ queryKey: ['document-leaders'], queryFn: listLeaders });
  const staff = useQuery({ queryKey: ['document-staff'], queryFn: listDocumentStaff });
  const externals = useQuery({ queryKey: ['external-units', ''], queryFn: () => listExternalUnits() });
  const units = useQuery({ queryKey: ['org-units', 'flat', ''], queryFn: () => listOrgUnits() });
  const outgoingMatches = useQuery({
    queryKey: ['outgoing-link-search', linkSearch],
    queryFn: () => listOutgoing({ view: 'search', q: linkSearch, page: 1, pageSize: 10 }),
    enabled: linkSearch.trim().length >= 2,
    retry: false,
  });
  const incomingMatches = useQuery({
    queryKey: ['incoming-link-search', linkSearch],
    queryFn: () => listIncoming({ view: 'search', q: linkSearch, page: 1, pageSize: 10 }),
    enabled: linkSearch.trim().length >= 2,
    retry: false,
  });
  const save = useMutation({
    mutationFn: () => {
      const input: OutgoingDocumentInput = {
        submission_number: values.submission_number.trim() || null,
        summary: values.summary,
        form_id: values.form_id || null,
        urgency_id: values.urgency_id || null,
        secrecy_id: values.secrecy_id || null,
        field_id: values.field_id || null,
        document_kind: values.document_kind,
        priority: values.priority,
        meeting_at: values.meeting_at ? `${values.meeting_at}:00+07:00` : null,
        meeting_place: values.meeting_place.trim() || null,
        insert_qr: values.insert_qr,
        drafter_id: values.drafter_id || null,
        drafting_unit_id: values.drafting_unit_id || null,
        signer_id: values.signer_id || null,
        content_note: values.content_note.trim() || null,
        reply_to_id: values.reply_to_id || null,
        recipients: recipients.map((item) => ({
          external_unit_id: item.external_unit_id,
          org_unit_id: item.org_unit_id,
        })),
        links: links.map((link) => ({
          link_type: link.link_type,
          outgoing_id: link.outgoing_id,
          incoming_id: link.incoming_id,
        })),
      };
      return document ? updateOutgoing(document.id, input) : createOutgoing(input);
    },
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  const set = <Key extends keyof typeof values>(key: Key, value: (typeof values)[Key]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const catalogSelect = (
    key: 'form_id' | 'urgency_id' | 'secrecy_id' | 'field_id',
    kind: DocumentCatalogKind,
    label: string,
  ) => (
    <FormRow label={label} error={errors[key]}>
      <select className={FORM_CONTROL_CLASS} value={values[key]} onChange={(event) => set(key, event.target.value)}>
        <option value="">Chọn</option>
        {(catalog.data ?? [])
          .filter((item) => item.kind === kind && (item.active || item.id === values[key]))
          .map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
      </select>
    </FormRow>
  );
  const text = (key: 'submission_number' | 'meeting_place', label: string) => (
    <FormRow label={label} error={errors[key]}>
      <input className={FORM_CONTROL_CLASS} value={values[key]} onChange={(event) => set(key, event.target.value)} />
    </FormRow>
  );
  const unitOptions = (units.data ?? []).filter((unit) => unit.status === 'active');
  const addRecipient = (value: string) => {
    if (!value) {
      return;
    }
    const [type, id] = value.split(':') as ['external' | 'internal', string];
    if (recipients.some((item) => item.external_unit_id === id || item.org_unit_id === id)) {
      return;
    }
    const name =
      type === 'external'
        ? ((externals.data ?? []).find((unit) => unit.id === id)?.name ?? '')
        : (unitOptions.find((unit) => unit.id === id)?.name ?? '');
    setRecipients((current) => [
      ...current,
      type === 'external' ? { external_unit_id: id, name } : { org_unit_id: id, name },
    ]);
  };
  const addLink = (link: Link) => {
    if (links.some((item) => item.outgoing_id === link.outgoing_id && item.incoming_id === link.incoming_id)) {
      return;
    }
    setLinks((current) => [...current, link]);
  };
  return (
    <form
      noValidate
      aria-label={document ? `Sửa văn bản đi số eOffice ${document.eoffice_number}` : 'Thêm mới văn bản đi'}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thông tin văn bản">
        <FormRow label="Số eOffice">
          <span className="text-content text-text-secondary">
            {document ? document.eoffice_number : 'Phần mềm cấp khi ghi'}
          </span>
        </FormRow>
        {text('submission_number', 'Số trình ký')}
        <FormRow label="Trích yếu" error={errors.summary}>
          <textarea
            className={FORM_CONTROL_CLASS}
            rows={3}
            value={values.summary}
            onChange={(event) => set('summary', event.target.value)}
          />
        </FormRow>
        {catalogSelect('form_id', 'form', 'Hình thức')}
        {catalogSelect('urgency_id', 'urgency', 'Độ khẩn')}
        {catalogSelect('secrecy_id', 'secrecy', 'Độ mật')}
        {catalogSelect('field_id', 'field', 'Lĩnh vực')}
        <FormRow label="Loại văn bản" error={errors.document_kind}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.document_kind}
            onChange={(event) => set('document_kind', event.target.value as typeof values.document_kind)}
          >
            {Object.entries(INCOMING_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Phân loại VB ưu tiên">
          <input
            type="checkbox"
            className="h-4 w-4"
            aria-label="Văn bản ưu tiên"
            checked={values.priority}
            onChange={(event) => set('priority', event.target.checked)}
          />
        </FormRow>
        <FormRow label="Chèn QR code">
          <input
            type="checkbox"
            className="h-4 w-4"
            aria-label="Chèn QR code"
            checked={values.insert_qr}
            onChange={(event) => set('insert_qr', event.target.checked)}
          />
        </FormRow>
        <FormRow label="Nội dung trình" error={errors.content_note}>
          <textarea
            className={FORM_CONTROL_CLASS}
            rows={2}
            value={values.content_note}
            onChange={(event) => set('content_note', event.target.value)}
          />
        </FormRow>
      </FormBlock>
      <FormBlock title="Người xử lý">
        <FormRow label="Người soạn thảo" error={errors.drafter_id}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.drafter_id}
            onChange={(event) => set('drafter_id', event.target.value)}
          >
            <option value="">Người tạo dự thảo</option>
            {(staff.data ?? []).map((person) => (
              <option key={person.user_id} value={person.user_id}>
                {person.full_name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Đơn vị soạn thảo" error={errors.drafting_unit_id}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.drafting_unit_id}
            onChange={(event) => set('drafting_unit_id', event.target.value)}
          >
            <option value="">Chọn</option>
            {unitOptions.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Người ký" error={errors.signer_id}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.signer_id}
            onChange={(event) => set('signer_id', event.target.value)}
          >
            <option value="">Chọn</option>
            {(leaders.data ?? []).map((leader) => (
              <option key={leader.user_id} value={leader.user_id}>
                {[leader.user_name, leader.title].filter(Boolean).join(' – ')}
              </option>
            ))}
          </select>
        </FormRow>
      </FormBlock>
      <FormBlock title="Thư mời, giấy mời">
        <FormRow label="Thời gian họp" error={errors.meeting_at}>
          <input
            type="datetime-local"
            className={FORM_CONTROL_CLASS}
            value={values.meeting_at}
            onChange={(event) => set('meeting_at', event.target.value)}
          />
        </FormRow>
        {text('meeting_place', 'Địa điểm')}
      </FormBlock>
      <FormBlock title="Đơn vị dự kiến nhận VB">
        <FormRow label="Thêm đơn vị nhận" error={errors.recipients}>
          <select
            aria-label="Thêm đơn vị nhận"
            className={FORM_CONTROL_CLASS}
            value=""
            onChange={(event) => addRecipient(event.target.value)}
          >
            <option value="">Chọn đơn vị</option>
            <optgroup label="Đơn vị trong trường (liên thông nội bộ)">
              {unitOptions.map((unit) => (
                <option key={unit.id} value={`internal:${unit.id}`}>
                  {unit.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Đơn vị bên ngoài">
              {(externals.data ?? [])
                .filter((unit) => unit.active)
                .map((unit) => (
                  <option key={unit.id} value={`external:${unit.id}`}>
                    {unit.name}
                  </option>
                ))}
            </optgroup>
          </select>
        </FormRow>
        <ul aria-label="Đơn vị dự kiến nhận" className="flex flex-col gap-1">
          {recipients.map((item) => (
            <li key={item.external_unit_id ?? item.org_unit_id} className="flex items-center gap-2 text-content">
              {item.name}
              <span className="text-label text-text-muted">{item.org_unit_id ? '(trong trường)' : '(bên ngoài)'}</span>
              <Button
                variant="text"
                onClick={() => setRecipients((current) => current.filter((other) => other !== item))}
              >
                Bỏ
              </Button>
            </li>
          ))}
        </ul>
      </FormBlock>
      <FormBlock title="Văn bản liên quan">
        <FormRow label="Trả lời văn bản đến" error={errors.reply_to_id}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.reply_to_id}
            onChange={(event) => set('reply_to_id', event.target.value)}
          >
            <option value="">Không</option>
            {document?.reply_to_id ? (
              <option value={document.reply_to_id}>
                {document.reply_to_symbol} – {document.reply_to_summary}
              </option>
            ) : null}
            {(incomingMatches.data?.items ?? [])
              .filter((item) => item.id !== document?.reply_to_id)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.symbol} – {item.summary}
                </option>
              ))}
          </select>
        </FormRow>
        <FormRow label="Tìm văn bản" error={errors.links}>
          <input
            aria-label="Tìm văn bản liên quan theo trích yếu"
            placeholder="Nhập ít nhất 2 ký tự của trích yếu"
            className={FORM_CONTROL_CLASS}
            value={linkSearch}
            onChange={(event) => setLinkSearch(event.target.value)}
          />
        </FormRow>
        <ul className="flex flex-col gap-1">
          {(outgoingMatches.data?.items ?? [])
            .filter((item) => item.id !== document?.id)
            .map((item) => {
              const label = `${item.symbol ?? `eOffice ${item.eoffice_number}`} – ${item.summary}`;
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-2 text-content">
                  Văn bản đi: {label}
                  <Button variant="text" onClick={() => addLink({ link_type: 'related', outgoing_id: item.id, label })}>
                    Thêm liên quan
                  </Button>
                  <Button
                    variant="text"
                    onClick={() => addLink({ link_type: 'original', outgoing_id: item.id, label })}
                  >
                    Là văn bản gốc
                  </Button>
                </li>
              );
            })}
          {(incomingMatches.data?.items ?? []).map((item) => {
            const label = `${item.symbol} – ${item.summary}`;
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-2 text-content">
                Văn bản đến: {label}
                <Button variant="text" onClick={() => addLink({ link_type: 'related', incoming_id: item.id, label })}>
                  Thêm liên quan
                </Button>
              </li>
            );
          })}
        </ul>
        <ul aria-label="Văn bản liên quan đã chọn" className="flex flex-col gap-1">
          {links.map((link) => (
            <li key={`${link.link_type}:${link.outgoing_id ?? link.incoming_id}`} className="flex items-center gap-2">
              <span className="text-label font-semibold">
                {link.link_type === 'original' ? 'Văn bản gốc' : 'Liên quan'}
              </span>
              {link.label}
              <Button variant="text" onClick={() => setLinks((current) => current.filter((other) => other !== link))}>
                Bỏ
              </Button>
            </li>
          ))}
        </ul>
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Đóng
        </Button>
      </div>
    </form>
  );
}
