import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { listCatalogItems } from '../catalogs/catalogs-api.js';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { uploadFile } from '../children/children-api.js';
import { listClasses } from '../classes/classes-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useHasPermission } from '../session/permissions.js';
import {
  APPLICATION_STATUS_LABELS,
  CAMPAIGN_STATUS_LABELS,
  getApplication,
  listApplications,
  listCampaigns,
  listPosts,
  messageOf,
  POST_STATUS_LABELS,
  postJson,
  type Campaign,
  type ConvertResult,
} from './admissions-api.js';

// MH-26 Hồ sơ tuyển sinh và xét duyệt, MH-63 Đợt và tin tuyển sinh (P16-01 đến P16-05; YCTD-86): lập, mở, đóng đợt;
// tiếp nhận hồ sơ trực tuyến, xét đạt hoặc không đạt kèm lý do, chuyển hồ sơ đạt thành hồ sơ trẻ; soạn và công bố tin
type Tab = 'applications' | 'campaigns' | 'posts';
const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

export function AdmissionsPage() {
  const [tab, setTab] = useState<Tab>('applications');
  const [campaignId, setCampaignId] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const campaigns = useQuery({ queryKey: ['admission-campaigns'], queryFn: listCampaigns });
  useEffect(() => {
    if (!campaignId && campaigns.data?.[0]) {
      setCampaignId(campaigns.data[0].id);
    }
  }, [campaignId, campaigns.data]);
  const selected = campaigns.data?.find((campaign) => campaign.id === campaignId);
  const tabs: Array<[Tab, string]> = [
    ['applications', 'Hồ sơ tuyển sinh'],
    ['campaigns', 'Đợt tuyển sinh'],
    ['posts', 'Tin tuyển sinh'],
  ];
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">Tuyển sinh</h1>
        {campaigns.error ? <Alert tone="danger">{messageOf(campaigns.error)}</Alert> : null}
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-label font-medium text-text">
            Đợt đang xem
            <select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} className={selectClass}>
              <option value="">Chọn đợt tuyển sinh</option>
              {(campaigns.data ?? []).map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name} ({CAMPAIGN_STATUS_LABELS[campaign.status]})
                </option>
              ))}
            </select>
          </label>
          {selected ? (
            <p className="text-label text-text-secondary">
              {selected.org_unit_name}; nhận hồ sơ {selected.open_from} đến {selected.open_to}; đạt{' '}
              {selected.passed_count}/{selected.quota} chỉ tiêu
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tuyển sinh">
          {tabs.map(([code, label]) => (
            <Button
              key={code}
              role="tab"
              aria-selected={tab === code}
              variant={tab === code ? 'secondary' : 'text'}
              onClick={() => setTab(code)}
            >
              {label}
            </Button>
          ))}
        </div>
        {tab === 'applications' && selected ? <ApplicationsTab campaign={selected} onDone={setToastMessage} /> : null}
        {tab === 'campaigns' ? (
          <CampaignsTab campaigns={campaigns.data ?? []} onSelect={setCampaignId} onDone={setToastMessage} />
        ) : null}
        {tab === 'posts' && selected ? <PostsTab campaign={selected} onDone={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}

function CampaignsTab({
  campaigns,
  onSelect,
  onDone,
}: {
  campaigns: Campaign[];
  onSelect(id: string): void;
  onDone(message: string): void;
}) {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.admissionCampaignManage);
  const unitChoice = useUnitChoice();
  const [name, setName] = useState('');
  const [quota, setQuota] = useState('20');
  const [openFrom, setOpenFrom] = useState(vietnamToday);
  const [openTo, setOpenTo] = useState(vietnamToday);
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['admission-campaigns'] });
    onDone(message);
  };
  const create = useMutation({
    mutationFn: () =>
      postJson<Campaign>('/api/v1/admission-campaigns', {
        org_unit_id: unitChoice.selectedId,
        name,
        quota: Number(quota),
        open_from: openFrom,
        open_to: openTo,
      }),
    onSuccess: async (campaign) => {
      setName('');
      onSelect(campaign.id);
      await refresh('Đã lập đợt tuyển sinh');
    },
  });
  const change = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'open' | 'close' }) =>
      postJson(`/api/v1/admission-campaigns/${id}/${action}`, {}),
    onSuccess: (_result, variables) =>
      refresh(variables.action === 'open' ? 'Đã mở đợt tuyển sinh' : 'Đã đóng đợt tuyển sinh'),
  });
  const error = create.error ?? change.error;
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {canManage ? (
        <form
          aria-label="Lập đợt tuyển sinh"
          className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <UnitSelect units={unitChoice.units} selectedId={unitChoice.selectedId} onSelect={unitChoice.select} />
          <TextField label="Tên đợt" value={name} onChange={(event) => setName(event.target.value)} />
          <TextField
            label="Chỉ tiêu"
            type="number"
            min={1}
            value={quota}
            onChange={(event) => setQuota(event.target.value)}
          />
          <TextField
            label="Nhận hồ sơ từ ngày"
            type="date"
            value={openFrom}
            onChange={(event) => setOpenFrom(event.target.value)}
          />
          <TextField
            label="Hạn nhận hồ sơ"
            type="date"
            value={openTo}
            onChange={(event) => setOpenTo(event.target.value)}
          />
          <div className="flex items-end">
            <Button type="submit" variant="primary" disabled={create.isPending || name === ''}>
              Lập đợt tuyển sinh
            </Button>
          </div>
        </form>
      ) : null}
      <table className="w-full text-left text-content">
        <thead>
          <tr className="text-label text-text-secondary">
            <th className="py-2">Đợt</th>
            <th>Đơn vị</th>
            <th>Thời gian nhận hồ sơ</th>
            <th>Hồ sơ</th>
            <th>Đạt / chỉ tiêu</th>
            <th>Trạng thái</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr key={campaign.id} className="border-t border-border">
              <td className="py-2">{campaign.name}</td>
              <td>{campaign.org_unit_name}</td>
              <td>
                {campaign.open_from} đến {campaign.open_to}
              </td>
              <td>{campaign.application_count}</td>
              <td>
                {campaign.passed_count} / {campaign.quota}
              </td>
              <td>{CAMPAIGN_STATUS_LABELS[campaign.status]}</td>
              <td>
                {canManage && campaign.status === 'draft' ? (
                  <Button onClick={() => change.mutate({ id: campaign.id, action: 'open' })}>Mở đợt</Button>
                ) : null}
                {canManage && campaign.status === 'open' ? (
                  <Button variant="text" onClick={() => change.mutate({ id: campaign.id, action: 'close' })}>
                    Đóng đợt
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApplicationsTab({ campaign, onDone }: { campaign: Campaign; onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const applications = useQuery({
    queryKey: ['admission-applications', campaign.id, status],
    queryFn: () => listApplications(campaign.id, status),
  });
  return (
    <div className="flex flex-col gap-4">
      {applications.error ? <Alert tone="danger">{messageOf(applications.error)}</Alert> : null}
      <label className="text-label font-medium text-text">
        Lọc trạng thái
        <select value={status} onChange={(event) => setStatus(event.target.value)} className={selectClass}>
          <option value="">Tất cả</option>
          {Object.entries(APPLICATION_STATUS_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <table className="w-full text-left text-content">
        <thead>
          <tr className="text-label text-text-secondary">
            <th className="py-2">Mã hồ sơ</th>
            <th>Trẻ</th>
            <th>Ngày sinh</th>
            <th>Phụ huynh</th>
            <th>Nguồn</th>
            <th>Trạng thái</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(applications.data ?? []).map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="py-2">{row.code}</td>
              <td>{row.child_full_name}</td>
              <td>{row.child_dob}</td>
              <td>
                {row.guardian_full_name} ({row.guardian_phone})
              </td>
              <td>{row.source === 'online' ? 'Trực tuyến' : 'Tại trường'}</td>
              <td>{APPLICATION_STATUS_LABELS[row.status]}</td>
              <td>
                <Button variant="text" aria-label={`Xem hồ sơ ${row.code}`} onClick={() => setSelectedId(row.id)}>
                  Xem
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {selectedId ? (
        <ApplicationPanel
          key={selectedId}
          applicationId={selectedId}
          campaign={campaign}
          onDone={async (message) => {
            await queryClient.invalidateQueries({ queryKey: ['admission-applications'] });
            await queryClient.invalidateQueries({ queryKey: ['admission-campaigns'] });
            await queryClient.invalidateQueries({ queryKey: ['admission-application', selectedId] });
            onDone(message);
          }}
        />
      ) : null}
    </div>
  );
}

function ApplicationPanel({
  applicationId,
  campaign,
  onDone,
}: {
  applicationId: string;
  campaign: Campaign;
  onDone(message: string): Promise<void>;
}) {
  const canManage = useHasPermission(PERMISSION_CODES.admissionApplicationManage);
  const canReview = useHasPermission(PERMISSION_CODES.admissionApplicationReview);
  const application = useQuery({
    queryKey: ['admission-application', applicationId],
    queryFn: () => getApplication(applicationId),
  });
  const classes = useQuery({
    queryKey: ['classes', campaign.org_unit_id],
    queryFn: () => listClasses(campaign.org_unit_id),
  });
  const relationships = useQuery({
    queryKey: ['catalog-items', 'parent_relationship'],
    queryFn: () => listCatalogItems('parent_relationship'),
  });
  const [reason, setReason] = useState('');
  const [classId, setClassId] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [relationshipId, setRelationshipId] = useState('');
  const [birthCertificate, setBirthCertificate] = useState<File>();
  const [confirmOverCapacity, setConfirmOverCapacity] = useState(false);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const act = useMutation({
    mutationFn: ({ action, body }: { action: 'receive' | 'approve' | 'reject'; body: unknown }) =>
      postJson(`/api/v1/admission-applications/${applicationId}/${action}`, body),
    onSuccess: (_result, variables) =>
      onDone(
        variables.action === 'receive'
          ? 'Đã tiếp nhận hồ sơ'
          : variables.action === 'approve'
            ? 'Đã xét hồ sơ đạt'
            : 'Đã ghi hồ sơ không đạt',
      ),
  });
  const convert = useMutation({
    mutationFn: async () => {
      const selectedClass = classes.data?.find((item) => item.id === classId);
      if (!birthCertificate || !selectedClass) {
        throw new Error('missing');
      }
      const file = await uploadFile(selectedClass.org_unit_id, 'birth_certificate', birthCertificate);
      return postJson<ConvertResult>(`/api/v1/admission-applications/${applicationId}/convert`, {
        class_id: classId,
        national_id: nationalId || undefined,
        relationship_item_id: relationshipId || undefined,
        birth_certificate_file_id: file.id,
        confirm_over_capacity: confirmOverCapacity,
        confirm_possible_duplicate: confirmDuplicate,
      });
    },
    onSuccess: (result) =>
      onDone(
        result.child.status === 'active'
          ? `Đã chuyển thành hồ sơ trẻ, ${result.child.full_name} đang học lớp ${result.child.current_class?.class_name ?? ''}`
          : `Đã chuyển thành hồ sơ trẻ chờ quản lý đơn vị duyệt${result.approval_error ? `: ${result.approval_error}` : ''}`,
      ),
  });
  const data = application.data;
  if (!data) {
    return application.error ? <Alert tone="danger">{messageOf(application.error)}</Alert> : null;
  }
  const error = act.error ?? convert.error;
  return (
    <section
      aria-label={`Hồ sơ tuyển sinh ${data.code}`}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <h2 className="text-section-title font-semibold text-text">
        Hồ sơ {data.code}: {data.child_full_name}
      </h2>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <dl className="grid grid-cols-1 gap-2 text-content md:grid-cols-2">
        <div>
          <dt className="text-label text-text-secondary">Trạng thái</dt>
          <dd>{APPLICATION_STATUS_LABELS[data.status]}</dd>
        </div>
        <div>
          <dt className="text-label text-text-secondary">Ngày sinh, giới tính</dt>
          <dd>
            {data.child_dob}, {data.child_gender === 'male' ? 'Nam' : 'Nữ'}
          </dd>
        </div>
        <div>
          <dt className="text-label text-text-secondary">Số định danh cá nhân</dt>
          <dd>{data.child_national_id_masked ?? 'Chưa có'}</dd>
        </div>
        <div>
          <dt className="text-label text-text-secondary">Dị ứng</dt>
          <dd>
            {data.child_has_allergies === null
              ? 'Chưa khai báo'
              : data.child_has_allergies
                ? (data.child_allergies ?? 'Có')
                : 'Không có'}
          </dd>
        </div>
        <div>
          <dt className="text-label text-text-secondary">Phụ huynh</dt>
          <dd>
            {data.guardian_full_name} ({data.guardian_relationship ?? 'chưa chọn quan hệ'}), {data.guardian_phone}
          </dd>
        </div>
        <div>
          <dt className="text-label text-text-secondary">Ghi chú</dt>
          <dd>{data.note ?? ''}</dd>
        </div>
        {data.reject_reason ? (
          <div>
            <dt className="text-label text-text-secondary">Lý do không đạt</dt>
            <dd>{data.reject_reason}</dd>
          </div>
        ) : null}
      </dl>
      <div className="flex flex-wrap gap-2">
        {canManage && data.status === 'submitted' ? (
          <Button variant="primary" onClick={() => act.mutate({ action: 'receive', body: {} })}>
            Tiếp nhận hồ sơ
          </Button>
        ) : null}
        {canReview && data.status === 'received' ? (
          <Button variant="primary" onClick={() => act.mutate({ action: 'approve', body: {} })}>
            Xét đạt
          </Button>
        ) : null}
      </div>
      {canReview && (data.status === 'submitted' || data.status === 'received') ? (
        <div className="flex flex-wrap items-end gap-2">
          <TextField label="Lý do không đạt" value={reason} onChange={(event) => setReason(event.target.value)} />
          <Button disabled={reason.trim() === ''} onClick={() => act.mutate({ action: 'reject', body: { reason } })}>
            Ghi không đạt
          </Button>
        </div>
      ) : null}
      {canManage && data.status === 'passed' ? (
        <form
          aria-label="Chuyển thành hồ sơ trẻ"
          className="grid grid-cols-1 gap-3 md:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            convert.mutate();
          }}
        >
          <label className="text-label font-medium text-text">
            Lớp
            <select value={classId} onChange={(event) => setClassId(event.target.value)} className={selectClass}>
              <option value="">Chọn lớp</option>
              {(classes.data ?? [])
                .filter((item) => item.status === 'active')
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.enrolled_count}/{item.max_size})
                  </option>
                ))}
            </select>
          </label>
          {data.child_national_id_masked ? null : (
            <TextField
              label="Số định danh cá nhân của trẻ"
              inputMode="numeric"
              maxLength={12}
              value={nationalId}
              onChange={(event) => setNationalId(event.target.value)}
            />
          )}
          {data.guardian_relationship_item_id ? null : (
            <label className="text-label font-medium text-text">
              Quan hệ của phụ huynh
              <select
                value={relationshipId}
                onChange={(event) => setRelationshipId(event.target.value)}
                className={selectClass}
              >
                <option value="">Chọn quan hệ</option>
                {(relationships.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-label font-medium text-text">
            Bản chụp giấy khai sinh
            <input
              type="file"
              accept="image/*,application/pdf"
              className="mt-2 block"
              onChange={(event) => setBirthCertificate(event.target.files?.[0])}
            />
          </label>
          <label className="flex items-center gap-2 text-label text-text">
            <input
              type="checkbox"
              checked={confirmOverCapacity}
              onChange={(event) => setConfirmOverCapacity(event.target.checked)}
            />
            Xác nhận khi lớp đã đủ sĩ số
          </label>
          <label className="flex items-center gap-2 text-label text-text">
            <input
              type="checkbox"
              checked={confirmDuplicate}
              onChange={(event) => setConfirmDuplicate(event.target.checked)}
            />
            Xác nhận khi nghi trùng trẻ đã có
          </label>
          <div className="flex items-end">
            <Button type="submit" variant="primary" disabled={convert.isPending || !classId || !birthCertificate}>
              Chuyển thành hồ sơ trẻ
            </Button>
          </div>
        </form>
      ) : null}
      {data.status === 'converted' ? (
        <p className="text-content text-text">Đã chuyển thành hồ sơ trẻ; xem ở trang Hồ sơ trẻ.</p>
      ) : null}
    </section>
  );
}

function PostsTab({ campaign, onDone }: { campaign: Campaign; onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.admissionPostManage);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [publishFrom, setPublishFrom] = useState(vietnamToday);
  const [publishTo, setPublishTo] = useState('');
  const posts = useQuery({ queryKey: ['admission-posts', campaign.id], queryFn: () => listPosts(campaign.id) });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['admission-posts'] });
    onDone(message);
  };
  const create = useMutation({
    mutationFn: () =>
      postJson('/api/v1/admission-posts', {
        campaign_id: campaign.id,
        title,
        content,
        publish_from: publishFrom,
        publish_to: publishTo || undefined,
      }),
    onSuccess: () => {
      setTitle('');
      setContent('');
      return refresh('Đã lưu tin tuyển sinh');
    },
  });
  const change = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'publish' | 'hide' }) =>
      postJson(`/api/v1/admission-posts/${id}/${action}`, action === 'hide' ? { reason: 'Gỡ tin' } : {}),
    onSuccess: (_result, variables) => refresh(variables.action === 'publish' ? 'Đã công bố tin' : 'Đã ẩn tin'),
  });
  const error = posts.error ?? create.error ?? change.error;
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {canManage ? (
        <form
          aria-label="Soạn tin tuyển sinh"
          className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <TextField label="Tiêu đề" value={title} onChange={(event) => setTitle(event.target.value)} />
          <TextField label="Nội dung" value={content} onChange={(event) => setContent(event.target.value)} />
          <TextField
            label="Đăng từ ngày"
            type="date"
            value={publishFrom}
            onChange={(event) => setPublishFrom(event.target.value)}
          />
          <TextField
            label="Thời hạn đăng (trống là hạn nhận hồ sơ)"
            type="date"
            value={publishTo}
            onChange={(event) => setPublishTo(event.target.value)}
          />
          <div className="flex items-end">
            <Button type="submit" variant="primary" disabled={create.isPending || !title || !content}>
              Lưu tin
            </Button>
          </div>
        </form>
      ) : null}
      <table className="w-full text-left text-content">
        <thead>
          <tr className="text-label text-text-secondary">
            <th className="py-2">Tiêu đề</th>
            <th>Đăng từ</th>
            <th>Thời hạn</th>
            <th>Trạng thái</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(posts.data ?? []).map((post) => (
            <tr key={post.id} className="border-t border-border">
              <td className="py-2">{post.title}</td>
              <td>{post.publish_from}</td>
              <td>{post.publish_to ?? campaign.open_to}</td>
              <td>{POST_STATUS_LABELS[post.status]}</td>
              <td>
                {canManage && post.status !== 'published' && campaign.status !== 'closed' ? (
                  <Button onClick={() => change.mutate({ id: post.id, action: 'publish' })}>Công bố</Button>
                ) : null}
                {canManage && post.status === 'published' ? (
                  <Button variant="text" onClick={() => change.mutate({ id: post.id, action: 'hide' })}>
                    Ẩn tin
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
