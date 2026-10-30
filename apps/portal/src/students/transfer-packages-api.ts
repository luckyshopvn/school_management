import { saveResponseFile } from '../exports/export-api.js';
import { fetchWithSession, readError, requestJson } from '../session/api-client.js';

// Gói chuyển trường (YCTD-390 lát L1): lập gói ở trường đi, xem trước và tiếp nhận ở trường đến, học bạ nhận được
export type OptionalTransferPart = 'suc-khoe' | 'khen-thuong';
export const OPTIONAL_TRANSFER_PART_LABELS: Record<OptionalTransferPart, string> = {
  'suc-khoe': 'Sức khỏe (dị ứng, bệnh mạn tính, nhóm máu, lần cân đo gần nhất)',
  'khen-thuong': 'Khen thưởng đã duyệt',
};

export interface PackagePart {
  path: string;
  label: string;
  bytes: number;
}

export interface BuiltTransferPackage {
  package_code: string;
  package_sha256: string;
  password: string;
  parts: PackagePart[];
  package_file: { file_name: string; content_base64: string };
  print_file: { file_name: string; content_base64: string };
}

export interface TransferPackagePreview {
  package_code: string;
  created_at: string;
  source_school: { name: string; code: string | null };
  transfer_date: string;
  reason: string | null;
  approved_by_name: string;
  student: {
    full_name: string;
    dob: string | null;
    gender: string;
    moet_student_code: string | null;
    national_id_last4: string | null;
    class_name: string | null;
    grade_level: string | null;
    school_level: string | null;
    guardians: Array<{ full_name: string; relationship: string; phone: string | null }>;
  };
  parts: PackagePart[];
  learning_records: Array<{ academic_year_name: string; class_name: string; signed: boolean }>;
  consent: { optional_parts: OptionalTransferPart[]; recorded_by_name: string; recorded_at: string } | null;
  already_received: boolean;
  existing_child: { id: string; full_name: string } | null;
}

export interface ReceivedLearningRecord {
  id: string;
  kind: 'learning_record' | 'term_results';
  academic_year_name: string;
  class_name: string | null;
  source_school_name: string;
  package_code: string;
  signer_name: string | null;
  signed_at: string | null;
  has_file: boolean;
}

export const buildTransferPackage = (
  transferId: string,
  optionalParts: OptionalTransferPart[],
  consentRecorded: boolean,
  applicationReceived: boolean,
) =>
  requestJson<BuiltTransferPackage>(`/api/v1/student-transfers/${transferId}/package`, {
    method: 'POST',
    body: JSON.stringify({
      optional_parts: optionalParts,
      consent_recorded: consentRecorded,
      application_received: applicationReceived,
    }),
  });

export function saveBase64File(file: { file_name: string; content_base64: string }, contentType: string) {
  const bytes = Uint8Array.from(atob(file.content_base64), (character) => character.charCodeAt(0));
  saveResponseFile(new Blob([bytes], { type: contentType }), '', file.file_name);
}

const packageForm = (file: File, password: string, extra: Record<string, string> = {}) => {
  const form = new FormData();
  form.set('file', file);
  form.set('password', password);
  for (const [key, value] of Object.entries(extra)) {
    form.set(key, value);
  }
  return form;
};

export const previewTransferPackage = (file: File, password: string) =>
  requestJson<TransferPackagePreview>('/api/v1/student-transfers/package/preview', {
    method: 'POST',
    body: packageForm(file, password),
  });

export const acceptTransferPackage = (
  file: File,
  password: string,
  input: { classId: string; fromDate: string; confirmOverCapacity: boolean },
) =>
  requestJson<{
    errors: Array<{ row: number; column: string | null; message: string }>;
    transfer_id: string | null;
    child_id: string | null;
  }>('/api/v1/student-transfers/package/accept', {
    method: 'POST',
    body: packageForm(file, password, {
      class_id: input.classId,
      ...(input.fromDate ? { from_date: input.fromDate } : {}),
      confirm_over_capacity: String(input.confirmOverCapacity),
    }),
  });

export const listReceivedLearningRecords = (childId: string) =>
  requestJson<ReceivedLearningRecord[]>(`/api/v1/student-transfers/received-learning-records?child_id=${childId}`);

export async function downloadReceivedLearningRecord(recordId: string): Promise<void> {
  const response = await fetchWithSession(`/api/v1/student-transfers/received-learning-records/${recordId}/file`);
  if (!response.ok) {
    throw await readError(response);
  }
  saveResponseFile(await response.blob(), response.headers.get('content-disposition') ?? '', 'hoc-ba.pdf');
}
