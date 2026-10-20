import { useEffect, useId, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  INCOMING_AUTHORITY_LABELS,
  INCOMING_COPY_LABELS,
  INCOMING_KIND_LABELS,
  INCOMING_MAXIMUM_FILE_BYTES,
  INCOMING_TRANSFER_LABELS,
  type DocumentCatalogKind,
} from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, FormBlock, FormRow } from '@school-management/ui';
import { fieldErrorsOf, messageOf } from '../archives/archive-ui.js';
import {
  createIncoming,
  listBooks,
  listCatalog,
  listExternalUnits,
  nextArrivalNumber,
  receiveInterconnect,
  updateIncoming,
  uploadIncomingFile,
  type IncomingDocument,
  type IncomingDocumentInput,
} from './incoming-api.js';

// Biểu mẫu "THÔNG TIN VĂN BẢN ĐẾN" theo VNPT iOffice (DT-18 phần 18a, YCTD-138): trích yếu, số ký hiệu, đơn vị ban hành, ngày
// văn bản (bắt buộc); hình thức, độ khẩn, hạn xử lý; sổ văn bản, số đến, ngày đến (bắt buộc khi vào sổ); độ mật, thẩm quyền,
// loại văn bản, hình thức chuyển, hình thức sao, có văn bản giấy; tệp đính kèm (quét tài liệu hoặc tải tệp, tối đa 50 MB mỗi
// tệp, bắt buộc khi thêm mới); nội dung xử lý có "Mẫu nhập". Ba chế độ: vào sổ (Thêm mới), sửa thông tin, nhập văn bản
// nhận qua liên thông (chưa có sổ, số đến)
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';
// Mẫu nhập nội dung xử lý; Claude tự đặt vì khảo sát chỉ ghi tên nút
const NOTE_TEMPLATES = [
  'Kính trình Hiệu trưởng xem xét, cho ý kiến chỉ đạo.',
  'Đề nghị giao bộ phận chuyên môn tham mưu thực hiện.',
  'Văn bản để biết, lưu hồ sơ.',
];

type Mode = 'register' | 'edit' | 'interconnect';

function emptyValues(document?: IncomingDocument) {
  return {
    summary: document?.summary ?? '',
    symbol: document?.symbol ?? '',
    issuer_unit_id: document?.issuer_unit_id ?? '',
    issuer_name: document?.issuer_unit_id ? '' : (document?.issuer_name ?? ''),
    document_date: document?.document_date ?? '',
    form_id: document?.form_id ?? '',
    urgency_id: document?.urgency_id ?? '',
    secrecy_id: document?.secrecy_id ?? '',
    field_id: document?.field_id ?? '',
    deadline: document?.deadline ?? '',
    authority: document?.authority ?? 'normal',
    document_kind: document?.document_kind ?? 'new',
    transfer_method: document?.transfer_method ?? 'hand',
    copy_type: document?.copy_type ?? 'original',
    has_paper: document?.has_paper ?? false,
    processing_note: document?.processing_note ?? '',
    book_id: '',
    arrival_number: '',
    arrival_date: VIETNAM_DATE.format(new Date()),
  };
}

export function IncomingDocumentForm({
  mode,
  document,
  onSaved,
  onCancel,
}: {
  mode: Mode;
  document?: IncomingDocument;
  onSaved(saved: IncomingDocument): void;
  onCancel(): void;
}) {
  const [values, setValues] = useState(() => emptyValues(document));
  const [files, setFiles] = useState<File[]>([]);
  const [scanned, setScanned] = useState(false);
  const [localError, setLocalError] = useState<string>();
  const fileInputId = useId();
  const set = <Key extends keyof typeof values>(key: Key, value: (typeof values)[Key]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const catalog = useQuery({ queryKey: ['document-catalogs'], queryFn: () => listCatalog() });
  const units = useQuery({ queryKey: ['external-units'], queryFn: () => listExternalUnits() });
  const books = useQuery({ queryKey: ['document-books'], queryFn: () => listBooks(), enabled: mode === 'register' });
  const year = Number(values.arrival_date.slice(0, 4));
  const bookChoices = (books.data ?? []).filter((book) => !year || book.year === year);
  // Sổ mặc định là sổ đầu tiên của năm theo ngày đến; số đến điền sẵn số kế tiếp, văn thư sửa được
  useEffect(() => {
    if (mode === 'register' && !values.book_id && bookChoices[0]) {
      set('book_id', bookChoices[0].id);
    }
  }, [mode, values.book_id, bookChoices]);
  const next = useQuery({
    queryKey: ['incoming-next-number', values.book_id],
    queryFn: () => nextArrivalNumber(values.book_id),
    enabled: mode === 'register' && Boolean(values.book_id),
  });
  const choices = (kind: DocumentCatalogKind) =>
    (catalog.data ?? []).filter((item) => item.kind === kind && (item.active || item.id === values[`${kind}_id`]));
  const save = useMutation({
    mutationFn: async () => {
      const input: IncomingDocumentInput = {
        summary: values.summary,
        symbol: values.symbol,
        issuer_unit_id: values.issuer_unit_id || null,
        issuer_name: values.issuer_unit_id ? null : values.issuer_name || null,
        document_date: values.document_date,
        form_id: values.form_id || null,
        urgency_id: values.urgency_id || null,
        secrecy_id: values.secrecy_id || null,
        field_id: values.field_id || null,
        deadline: values.deadline || null,
        authority: values.authority,
        document_kind: values.document_kind,
        transfer_method: values.transfer_method,
        copy_type: values.copy_type,
        has_paper: values.has_paper,
        processing_note: values.processing_note || null,
      };
      let saved: IncomingDocument;
      if (mode === 'edit' && document) {
        saved = await updateIncoming(document.id, input);
      } else if (mode === 'interconnect') {
        saved = await receiveInterconnect(input);
      } else {
        const typed = values.arrival_number.trim();
        saved = await createIncoming({
          ...input,
          book_id: values.book_id,
          arrival_number: typed ? Number(typed) : null,
          arrival_date: values.arrival_date,
        });
      }
      for (const file of files) {
        saved = await uploadIncomingFile(saved.id, file, { kind: 'main', scanned });
      }
      return saved;
    },
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  const title = mode === 'edit' ? `Cập nhật thông tin văn bản ${document?.symbol ?? ''}` : 'THÔNG TIN VĂN BẢN ĐẾN';
  const text = (key: 'summary' | 'symbol' | 'issuer_name', label: string, required = false) => (
    <FormRow label={`${label}${required ? ' (*)' : ''}`} error={errors[key]}>
      <input className={FORM_CONTROL_CLASS} value={values[key]} onChange={(event) => set(key, event.target.value)} />
    </FormRow>
  );
  const date = (key: 'document_date' | 'deadline' | 'arrival_date', label: string, required = false) => (
    <FormRow label={`${label}${required ? ' (*)' : ''}`} error={errors[key]}>
      <input
        type="date"
        className={FORM_CONTROL_CLASS}
        value={values[key]}
        onChange={(event) => set(key, event.target.value)}
      />
    </FormRow>
  );
  const catalogSelect = (kind: DocumentCatalogKind, label: string) => {
    const key = `${kind}_id` as 'form_id' | 'urgency_id' | 'secrecy_id' | 'field_id';
    return (
      <FormRow label={label} error={errors[key]}>
        <select className={FORM_CONTROL_CLASS} value={values[key]} onChange={(event) => set(key, event.target.value)}>
          <option value="">-- Chọn --</option>
          {choices(kind).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </FormRow>
    );
  };
  const choice = <Value extends string>(
    key: 'authority' | 'document_kind' | 'transfer_method' | 'copy_type',
    label: string,
    labels: Record<Value, string>,
  ) => (
    <FormRow label={label} error={errors[key]}>
      <select
        className={FORM_CONTROL_CLASS}
        value={values[key]}
        onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
      >
        {Object.entries<string>(labels).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </FormRow>
  );

  return (
    <form
      noValidate
      aria-label={title}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setLocalError(undefined);
        if (mode !== 'edit' && files.length === 0) {
          setLocalError('Đính kèm ít nhất một tệp (quét tài liệu hoặc tải tệp tin)');
          return;
        }
        save.mutate();
      }}
    >
      <h2 className="text-section-title font-semibold text-text">{title}</h2>
      {localError ? <Alert tone="danger">{localError}</Alert> : null}
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thông tin văn bản">
        <FormRow label="Trích yếu (*)" error={errors.summary}>
          <textarea
            className={FORM_CONTROL_CLASS}
            rows={2}
            value={values.summary}
            onChange={(event) => set('summary', event.target.value)}
          />
        </FormRow>
        {text('symbol', 'Số ký hiệu', true)}
        <FormRow label="Đơn vị ban hành (*)" error={errors.issuer_unit_id ?? errors.issuer_name}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.issuer_unit_id}
            onChange={(event) => set('issuer_unit_id', event.target.value)}
          >
            <option value="">-- Nhập tên đơn vị khác --</option>
            {(units.data ?? [])
              .filter((unit) => unit.active || unit.id === values.issuer_unit_id)
              .map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
          </select>
        </FormRow>
        {values.issuer_unit_id ? null : text('issuer_name', 'Tên đơn vị ban hành')}
        {date('document_date', 'Ngày văn bản', true)}
        {catalogSelect('form', 'Hình thức')}
        {catalogSelect('urgency', 'Độ khẩn')}
        {date('deadline', 'Hạn xử lý')}
        {catalogSelect('field', 'Lĩnh vực')}
      </FormBlock>
      {mode === 'register' ? (
        <FormBlock title="Vào sổ">
          <FormRow label="Sổ văn bản (*)" error={errors.book_id}>
            <select
              className={FORM_CONTROL_CLASS}
              value={values.book_id}
              onChange={(event) => set('book_id', event.target.value)}
            >
              <option value="">-- Chọn sổ --</option>
              {bookChoices.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.name} ({book.year})
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Số đến (*)" error={errors.arrival_number}>
            <input
              className={FORM_CONTROL_CLASS}
              inputMode="numeric"
              placeholder={next.data ? String(next.data.next_number) : ''}
              value={values.arrival_number}
              onChange={(event) => set('arrival_number', event.target.value)}
            />
          </FormRow>
          {date('arrival_date', 'Ngày đến', true)}
        </FormBlock>
      ) : null}
      <FormBlock title="Thông tin nhận">
        {catalogSelect('secrecy', 'Độ mật')}
        {choice('authority', 'Thẩm quyền', INCOMING_AUTHORITY_LABELS)}
        {choice('document_kind', 'Loại văn bản', INCOMING_KIND_LABELS)}
        {choice('transfer_method', 'Hình thức chuyển', INCOMING_TRANSFER_LABELS)}
        {choice('copy_type', 'Hình thức sao', INCOMING_COPY_LABELS)}
        <FormRow label="Có văn bản giấy">
          <input
            type="checkbox"
            className="h-4 w-4"
            aria-label="Có văn bản giấy"
            checked={values.has_paper}
            onChange={(event) => set('has_paper', event.target.checked)}
          />
        </FormRow>
        {mode !== 'edit' ? (
          <FormRow label="File đính kèm (*)" error={errors.file}>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-content">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={scanned}
                  onChange={(event) => setScanned(event.target.checked)}
                />
                Tệp quét từ máy quét (Quét tài liệu)
              </label>
              <label htmlFor={fileInputId} className="text-label text-text-secondary">
                Tải tệp tin (PDF, ảnh, Word, Excel; tối đa 50 MB mỗi tệp)
              </label>
              <input
                id={fileInputId}
                type="file"
                multiple
                accept={FILE_ACCEPT}
                onChange={(event) => {
                  const picked = [...(event.target.files ?? [])];
                  const tooLarge = picked.find((file) => file.size > INCOMING_MAXIMUM_FILE_BYTES);
                  setLocalError(tooLarge ? `Tệp ${tooLarge.name} vượt 50 MB` : undefined);
                  setFiles(tooLarge ? [] : picked);
                }}
              />
            </div>
          </FormRow>
        ) : null}
        <FormRow label="Nội dung xử lý" error={errors.processing_note}>
          <div className="flex flex-col gap-2">
            <textarea
              className={FORM_CONTROL_CLASS}
              rows={3}
              value={values.processing_note}
              onChange={(event) => set('processing_note', event.target.value)}
            />
            <select
              aria-label="Mẫu nhập"
              className={FORM_CONTROL_CLASS}
              value=""
              onChange={(event) =>
                event.target.value &&
                set('processing_note', [values.processing_note, event.target.value].filter(Boolean).join('\n'))
              }
            >
              <option value="">Mẫu nhập…</option>
              {NOTE_TEMPLATES.map((template) => (
                <option key={template} value={template}>
                  {template}
                </option>
              ))}
            </select>
          </div>
        </FormRow>
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Lưu
        </Button>
        <Button variant="text" onClick={onCancel}>
          Đóng
        </Button>
      </div>
    </form>
  );
}
