import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError, type FieldError } from '../session/api-client.js';

// MP-21 Tuyển sinh trực tuyến không cần đăng nhập (G3-01, G3-07; P16-02, P16-05; YCTD-86): tin tuyển sinh của đợt đang
// nhận hồ sơ kèm thời hạn, nộp hồ sơ, nhận mã hồ sơ, tra cứu trạng thái bằng mã và số điện thoại
interface PublicCampaign {
  id: string;
  name: string;
  description: string | null;
  org_unit_name: string;
  open_from: string;
  application_deadline: string;
  posts: Array<{ id: string; title: string; content: string; deadline: string }>;
}

interface PublicAdmissions {
  campaigns: PublicCampaign[];
  relationships: Array<{ id: string; name: string }>;
}

interface LookupResult {
  code: string;
  child_full_name: string;
  campaign_name: string;
  status_label: string;
  reject_reason: string | null;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init.body ? { 'content-type': 'application/json' } : {},
    credentials: 'omit',
  });
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: { code?: string; message?: string; details?: FieldError[] };
  };
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body.error?.code ?? 'ERR_INTERNAL',
      body.error?.message ?? 'Hệ thống gặp lỗi, vui lòng thử lại sau',
      body.error?.details ?? [],
    );
  }
  return body;
}

function describe(error: unknown): { message: string; fields: Record<string, string> } {
  if (error instanceof ApiError) {
    return {
      message: error.message,
      fields: Object.fromEntries(error.details.map((detail) => [detail.field, detail.message])),
    };
  }
  return { message: 'Không kết nối được tới máy chủ, vui lòng thử lại', fields: {} };
}

const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';

export function AdmissionsScreen({ onBack }: { onBack(): void }) {
  const [data, setData] = useState<PublicAdmissions>();
  const [loadError, setLoadError] = useState<string>();
  const [campaignId, setCampaignId] = useState('');

  useEffect(() => {
    let active = true;
    call<PublicAdmissions>('/api/v1/public/admissions')
      .then((result) => {
        if (active) {
          setData(result);
          setCampaignId(result.campaigns[0]?.id ?? '');
        }
      })
      .catch((error: unknown) => active && setLoadError(describe(error).message));
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 px-4 py-8">
      <div className="flex w-full max-w-lg items-center justify-between">
        <h1 className="text-page-title font-bold text-text">Tuyển sinh trực tuyến</h1>
        <Button variant="text" onClick={onBack}>
          Về đăng nhập
        </Button>
      </div>
      {loadError ? <Alert tone="danger">{loadError}</Alert> : null}
      {data && data.campaigns.length === 0 ? (
        <Alert tone="info">Nhà trường hiện chưa có đợt tuyển sinh đang nhận hồ sơ.</Alert>
      ) : null}
      {(data?.campaigns ?? []).map((campaign) => (
        <section
          key={campaign.id}
          aria-label={`Đợt ${campaign.name}`}
          className="flex w-full max-w-lg flex-col gap-2 rounded-xl border border-border bg-card p-4"
        >
          <h2 className="text-section-title font-semibold text-text">{campaign.name}</h2>
          <p className="text-label text-text-secondary">
            {campaign.org_unit_name}; hạn nhận hồ sơ {campaign.application_deadline}
          </p>
          {campaign.description ? <p className="text-content text-text">{campaign.description}</p> : null}
          <ul className="flex flex-col gap-2">
            {campaign.posts.map((post) => (
              <li key={post.id} aria-label={post.title} className="rounded-lg bg-page p-3">
                <h3 className="text-content font-semibold text-text">{post.title}</h3>
                <p className="whitespace-pre-line text-content text-text">{post.content}</p>
                <p className="text-label text-text-secondary">Thời hạn: {post.deadline}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {data && data.campaigns.length > 0 ? (
        <ApplicationForm
          campaigns={data.campaigns}
          relationships={data.relationships}
          campaignId={campaignId}
          onCampaign={setCampaignId}
        />
      ) : null}
      <LookupForm />
    </main>
  );
}

function ApplicationForm({
  campaigns,
  relationships,
  campaignId,
  onCampaign,
}: {
  campaigns: PublicCampaign[];
  relationships: PublicAdmissions['relationships'];
  campaignId: string;
  onCampaign(id: string): void;
}) {
  const [childName, setChildName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('female');
  const [hasAllergies, setHasAllergies] = useState('');
  const [allergies, setAllergies] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [note, setNote] = useState('');
  const [result, setResult] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(undefined);
    setFields({});
    try {
      const created = await call<{ message: string }>('/api/v1/public/admission-applications', {
        method: 'POST',
        body: JSON.stringify({
          campaign_id: campaignId,
          child_full_name: childName,
          child_dob: dob,
          child_gender: gender,
          child_has_allergies: hasAllergies === '' ? undefined : hasAllergies === 'yes',
          child_allergies: hasAllergies === 'yes' ? allergies : undefined,
          guardian_full_name: guardianName,
          guardian_phone: phone.trim(),
          guardian_relationship_item_id: relationship || undefined,
          note: note || undefined,
        }),
      });
      setResult(created.message);
    } catch (error) {
      const described = describe(error);
      setErrorMessage(described.message);
      setFields(described.fields);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="w-full max-w-lg">
        <Alert tone="success">{result}</Alert>
      </div>
    );
  }
  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label="Nộp hồ sơ tuyển sinh"
      className="flex w-full max-w-lg flex-col gap-3 rounded-xl border border-border bg-card p-4"
    >
      <h2 className="text-section-title font-semibold text-text">Nộp hồ sơ</h2>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      <label className="text-label font-medium text-text">
        Đợt tuyển sinh
        <select value={campaignId} onChange={(event) => onCampaign(event.target.value)} className={selectClass}>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </select>
      </label>
      <TextField
        label="Họ tên trẻ"
        value={childName}
        onChange={(event) => setChildName(event.target.value)}
        error={fields.child_full_name}
      />
      <TextField
        label="Ngày sinh của trẻ"
        type="date"
        value={dob}
        onChange={(event) => setDob(event.target.value)}
        error={fields.child_dob}
      />
      <label className="text-label font-medium text-text">
        Giới tính
        <select value={gender} onChange={(event) => setGender(event.target.value)} className={selectClass}>
          <option value="female">Nữ</option>
          <option value="male">Nam</option>
        </select>
      </label>
      <label className="text-label font-medium text-text">
        Trẻ có dị ứng không
        <select value={hasAllergies} onChange={(event) => setHasAllergies(event.target.value)} className={selectClass}>
          <option value="">Chọn</option>
          <option value="no">Không có dị ứng</option>
          <option value="yes">Có dị ứng</option>
        </select>
        {fields.child_has_allergies ? (
          <span className="mt-1 block text-label text-danger">{fields.child_has_allergies}</span>
        ) : null}
      </label>
      {hasAllergies === 'yes' ? (
        <TextField
          label="Dị ứng gì"
          value={allergies}
          onChange={(event) => setAllergies(event.target.value)}
          error={fields.child_allergies}
        />
      ) : null}
      <TextField
        label="Họ tên phụ huynh"
        value={guardianName}
        onChange={(event) => setGuardianName(event.target.value)}
        error={fields.guardian_full_name}
      />
      <TextField
        label="Số điện thoại phụ huynh"
        type="tel"
        inputMode="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        error={fields.guardian_phone}
      />
      <label className="text-label font-medium text-text">
        Quan hệ với trẻ
        <select value={relationship} onChange={(event) => setRelationship(event.target.value)} className={selectClass}>
          <option value="">Chọn</option>
          {relationships.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <TextField label="Ghi chú" value={note} onChange={(event) => setNote(event.target.value)} />
      <Button type="submit" variant="primary" disabled={submitting}>
        {submitting ? 'Đang gửi…' : 'Nộp hồ sơ'}
      </Button>
    </form>
  );
}

function LookupForm() {
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<LookupResult>();
  const [errorMessage, setErrorMessage] = useState<string>();

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);
    setResult(undefined);
    try {
      const query = new URLSearchParams({ code: code.trim(), phone: phone.trim() });
      setResult(await call<LookupResult>(`/api/v1/public/admission-applications/lookup?${query.toString()}`));
    } catch (error) {
      setErrorMessage(describe(error).message);
    }
  }

  return (
    <form
      onSubmit={lookup}
      noValidate
      aria-label="Tra cứu hồ sơ tuyển sinh"
      className="flex w-full max-w-lg flex-col gap-3 rounded-xl border border-border bg-card p-4"
    >
      <h2 className="text-section-title font-semibold text-text">Tra cứu hồ sơ</h2>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      <TextField label="Mã hồ sơ" value={code} onChange={(event) => setCode(event.target.value)} />
      <TextField
        label="Số điện thoại đã khai"
        type="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
      />
      <Button type="submit">Tra cứu</Button>
      {result ? (
        <div role="status" className="text-content text-text">
          Hồ sơ {result.code} của {result.child_full_name} ({result.campaign_name}): {result.status_label}
          {result.reject_reason ? `. Lý do: ${result.reject_reason}` : ''}
        </div>
      ) : null}
    </form>
  );
}
