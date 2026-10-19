import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  TextField,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { listCatalogItems } from '../catalogs/catalogs-api.js';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { uploadFile } from '../children/children-api.js';
import { listClasses } from '../classes/classes-api.js';
import { AppShell } from '../pages/AppShell.js';
import { FormButtons, FormPanel } from '../pages/FormPanel.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { matchesSearch } from '../pages/grid-search.js';
import { menuPageTitle } from '../pages/page-title.js';
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
  type ApplicationRow,
  type Campaign,
  type ConvertResult,
  type Post,
} from './admissions-api.js';

// MH-26 Hồ sơ tuyển sinh và xét duyệt, MH-63 Đợt và tin tuyển sinh (P16-01 đến P16-05; YCTD-86): lập, mở, đóng đợt;
// tiếp nhận hồ sơ trực tuyến, xét đạt hoặc không đạt kèm lý do, chuyển hồ sơ đạt thành hồ sơ học sinh; soạn và công bố
// tin. Giao diện chung theo Sở (DT-15 phần 15f3, YCTD-115): hồ sơ, đợt và tin tuyển sinh là lưới dữ liệu chung (khóa
// `admission-applications`, `admission-campaigns`, `admission-posts`); lập đợt, soạn tin, chuyển hồ sơ bằng biểu mẫu theo
// khối; chi tiết hồ sơ mở ngay dưới dòng của hồ sơ
type Tab = 'applications' | 'campaigns' | 'posts';
const filterClass = `mt-1 ${FORM_CONTROL_CLASS}`;
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
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/admissions')}</h1>
        {campaigns.error ? <Alert tone="danger">{messageOf(campaigns.error)}</Alert> : null}
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-label font-medium text-text">
            Đợt đang xem
            <select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} className={filterClass}>
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
        {tab === 'applications' && selected ? (
          <ApplicationsTab key={selected.id} campaign={selected} onDone={setToastMessage} />
        ) : null}
        {tab === 'campaigns' ? (
          <CampaignsTab
            campaigns={campaigns.data ?? []}
            loading={campaigns.isPending}
            onSelect={setCampaignId}
            onDone={setToastMessage}
          />
        ) : null}
        {tab === 'posts' && selected ? <PostsTab campaign={selected} onDone={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}

const CAMPAIGN_COLUMNS: Array<DataGridColumn<Campaign>> = [
  { id: 'name', header: 'Đợt', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
  { id: 'org_unit_name', header: 'Đơn vị', cell: (row) => row.org_unit_name },
  { id: 'open', header: 'Thời gian nhận hồ sơ', cell: (row) => `${row.open_from} đến ${row.open_to}` },
  { id: 'application_count', header: 'Hồ sơ', cell: (row) => row.application_count },
  { id: 'passed', header: 'Đạt / chỉ tiêu', cell: (row) => `${row.passed_count} / ${row.quota}` },
  { id: 'converted_count', header: 'Đã nhập học', hiddenByDefault: true, cell: (row) => row.converted_count },
  { id: 'status', header: 'Trạng thái', cell: (row) => CAMPAIGN_STATUS_LABELS[row.status] },
];

function CampaignForm({ onSaved, onCancel }: { onSaved(campaign: Campaign): void; onCancel(): void }) {
  const unitChoice = useUnitChoice();
  const [name, setName] = useState('');
  const [quota, setQuota] = useState('20');
  const [openFrom, setOpenFrom] = useState(vietnamToday);
  const [openTo, setOpenTo] = useState(vietnamToday);
  const create = useMutation({
    mutationFn: () =>
      postJson<Campaign>('/api/v1/admission-campaigns', {
        org_unit_id: unitChoice.selectedId,
        name,
        quota: Number(quota),
        open_from: openFrom,
        open_to: openTo,
      }),
    onSuccess: onSaved,
  });
  return (
    <form
      aria-label="Lập đợt tuyển sinh"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <FormBlock title="Lập đợt tuyển sinh">
        <FormRow label="Đơn vị">
          <select
            className={FORM_CONTROL_CLASS}
            value={unitChoice.selectedId ?? ''}
            onChange={(event) => unitChoice.select(event.target.value)}
          >
            {unitChoice.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Tên đợt">
          <input className={FORM_CONTROL_CLASS} value={name} onChange={(event) => setName(event.target.value)} />
        </FormRow>
        <FormRow label="Chỉ tiêu">
          <input
            type="number"
            min={1}
            className={FORM_CONTROL_CLASS}
            value={quota}
            onChange={(event) => setQuota(event.target.value)}
          />
        </FormRow>
        <FormRow label="Nhận hồ sơ từ ngày">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={openFrom}
            onChange={(event) => setOpenFrom(event.target.value)}
          />
        </FormRow>
        <FormRow label="Hạn nhận hồ sơ">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={openTo}
            onChange={(event) => setOpenTo(event.target.value)}
          />
        </FormRow>
      </FormBlock>
      <FormButtons busy={create.isPending} disabled={name === ''} onCancel={onCancel} />
    </form>
  );
}

function CampaignsTab({
  campaigns,
  loading,
  onSelect,
  onDone,
}: {
  campaigns: Campaign[];
  loading: boolean;
  onSelect(id: string): void;
  onDone(message: string): void;
}) {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.admissionCampaignManage);
  const grid = useGridSettings('admission-campaigns');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Campaign['status'] | ''>('');
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['admission-campaigns'] });
    onDone(message);
  };
  const change = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'open' | 'close' }) =>
      postJson(`/api/v1/admission-campaigns/${id}/${action}`, {}),
    onSuccess: (_result, variables) =>
      refresh(variables.action === 'open' ? 'Đã mở đợt tuyển sinh' : 'Đã đóng đợt tuyển sinh'),
  });
  const error = change.error ?? grid.error;
  const rows = campaigns.filter(
    (campaign) =>
      (status === '' || campaign.status === status) && matchesSearch(search, campaign.name, campaign.org_unit_name),
  );
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {canManage && creating ? (
        <FormPanel>
          <CampaignForm
            onCancel={() => setCreating(false)}
            onSaved={async (campaign) => {
              setCreating(false);
              onSelect(campaign.id);
              await refresh('Đã lập đợt tuyển sinh');
            }}
          />
        </FormPanel>
      ) : null}
      <DataGrid
        label="Đợt tuyển sinh"
        columns={CAMPAIGN_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `đợt ${row.name}`}
        loading={loading}
        emptyText="Chưa có đợt tuyển sinh."
        search={{ label: 'Tìm theo tên đợt, đơn vị', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Trạng thái đợt
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
                className={filterClass}
              >
                <option value="">Tất cả</option>
                {Object.entries(CAMPAIGN_STATUS_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        toolbar={
          canManage ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Thêm mới
            </Button>
          ) : null
        }
        rowActions={(campaign) => (
          <>
            {canManage && campaign.status === 'draft' ? (
              <Button onClick={() => change.mutate({ id: campaign.id, action: 'open' })}>Mở đợt</Button>
            ) : null}
            {canManage && campaign.status === 'open' ? (
              <Button variant="text" onClick={() => change.mutate({ id: campaign.id, action: 'close' })}>
                Đóng đợt
              </Button>
            ) : null}
          </>
        )}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}

const APPLICATION_COLUMNS: Array<DataGridColumn<ApplicationRow>> = [
  { id: 'code', header: 'Mã hồ sơ', alwaysVisible: true, className: 'font-medium', cell: (row) => row.code },
  { id: 'child_full_name', header: 'Học sinh', cell: (row) => row.child_full_name },
  { id: 'child_dob', header: 'Ngày sinh', cell: (row) => row.child_dob },
  { id: 'guardian', header: 'Phụ huynh', cell: (row) => `${row.guardian_full_name} (${row.guardian_phone})` },
  {
    id: 'source',
    header: 'Nguồn',
    cell: (row) =>
      row.source === 'online'
        ? 'Trực tuyến'
        : row.source === 'routing'
          ? 'Phân tuyến (Tuyển sinh đầu cấp)'
          : 'Tại trường',
  },
  { id: 'status', header: 'Trạng thái', cell: (row) => APPLICATION_STATUS_LABELS[row.status] },
  { id: 'reject_reason', header: 'Lý do không đạt', hiddenByDefault: true, cell: (row) => row.reject_reason ?? '' },
];

function ApplicationsTab({ campaign, onDone }: { campaign: Campaign; onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('admission-applications');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const applications = useQuery({
    queryKey: ['admission-applications', campaign.id, status],
    queryFn: () => listApplications(campaign.id, status),
  });
  const error = applications.error ?? grid.error;
  const rows = (applications.data ?? []).filter((row) =>
    matchesSearch(search, row.code, row.child_full_name, row.guardian_full_name, row.guardian_phone),
  );
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <DataGrid
        label="Hồ sơ tuyển sinh"
        columns={APPLICATION_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `hồ sơ ${row.code}`}
        loading={applications.isPending}
        emptyText="Đợt chưa có hồ sơ."
        search={{
          label: 'Tìm theo mã hồ sơ, tên học sinh, phụ huynh, điện thoại',
          value: search,
          onChange: setSearch,
        }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Lọc trạng thái
              <select value={status} onChange={(event) => setStatus(event.target.value)} className={filterClass}>
                <option value="">Tất cả</option>
                {Object.entries(APPLICATION_STATUS_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        rowActions={(row) => (
          <Button
            variant="text"
            aria-label={`Xem hồ sơ ${row.code}`}
            onClick={() => setSelectedId(selectedId === row.id ? '' : row.id)}
          >
            Xem
          </Button>
        )}
        activeRowId={selectedId}
        renderRowDetail={(row) =>
          selectedId === row.id ? (
            <ApplicationPanel
              key={row.id}
              applicationId={row.id}
              campaign={campaign}
              onDone={async (message) => {
                await queryClient.invalidateQueries({ queryKey: ['admission-applications'] });
                await queryClient.invalidateQueries({ queryKey: ['admission-campaigns'] });
                await queryClient.invalidateQueries({ queryKey: ['admission-application', row.id] });
                onDone(message);
              }}
            />
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
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
          ? `Đã chuyển thành hồ sơ học sinh, ${result.child.full_name} đang học lớp ${result.child.current_class?.class_name ?? ''}`
          : `Đã chuyển thành hồ sơ học sinh chờ quản lý đơn vị duyệt${result.approval_error ? `: ${result.approval_error}` : ''}`,
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
          aria-label="Chuyển thành hồ sơ học sinh"
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            convert.mutate();
          }}
        >
          <FormBlock title="Chuyển thành hồ sơ học sinh">
            <FormRow label="Lớp">
              <select
                className={FORM_CONTROL_CLASS}
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
              >
                <option value="">Chọn lớp</option>
                {(classes.data ?? [])
                  .filter((item) => item.status === 'active')
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.enrolled_count}/{item.max_size})
                    </option>
                  ))}
              </select>
            </FormRow>
            {data.child_national_id_masked ? null : (
              <FormRow label="Số định danh cá nhân của học sinh">
                <input
                  inputMode="numeric"
                  maxLength={12}
                  className={FORM_CONTROL_CLASS}
                  value={nationalId}
                  onChange={(event) => setNationalId(event.target.value)}
                />
              </FormRow>
            )}
            {data.guardian_relationship_item_id ? null : (
              <FormRow label="Quan hệ của phụ huynh">
                <select
                  className={FORM_CONTROL_CLASS}
                  value={relationshipId}
                  onChange={(event) => setRelationshipId(event.target.value)}
                >
                  <option value="">Chọn quan hệ</option>
                  {(relationships.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </FormRow>
            )}
            <FormRow label="Bản chụp giấy khai sinh">
              <input
                type="file"
                accept="image/*,application/pdf"
                className="block text-content"
                onChange={(event) => setBirthCertificate(event.target.files?.[0])}
              />
            </FormRow>
            <FormRow label="Xác nhận">
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-content text-text">
                  <input
                    type="checkbox"
                    checked={confirmOverCapacity}
                    onChange={(event) => setConfirmOverCapacity(event.target.checked)}
                  />
                  Xác nhận khi lớp đã đủ sĩ số
                </label>
                <label className="flex items-center gap-2 text-content text-text">
                  <input
                    type="checkbox"
                    checked={confirmDuplicate}
                    onChange={(event) => setConfirmDuplicate(event.target.checked)}
                  />
                  Xác nhận khi nghi trùng học sinh đã có
                </label>
              </div>
            </FormRow>
          </FormBlock>
          <div>
            <Button type="submit" variant="primary" disabled={convert.isPending || !classId || !birthCertificate}>
              Chuyển thành hồ sơ học sinh
            </Button>
          </div>
        </form>
      ) : null}
      {data.status === 'converted' ? (
        <p className="text-content text-text">Đã chuyển thành hồ sơ học sinh; xem ở trang Quản lý hồ sơ học sinh.</p>
      ) : null}
    </section>
  );
}

function PostForm({ campaign, onSaved, onCancel }: { campaign: Campaign; onSaved(): void; onCancel(): void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [publishFrom, setPublishFrom] = useState(vietnamToday);
  const [publishTo, setPublishTo] = useState('');
  const create = useMutation({
    mutationFn: () =>
      postJson('/api/v1/admission-posts', {
        campaign_id: campaign.id,
        title,
        content,
        publish_from: publishFrom,
        publish_to: publishTo || undefined,
      }),
    onSuccess: onSaved,
  });
  return (
    <form
      aria-label="Soạn tin tuyển sinh"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <FormBlock title={`Soạn tin tuyển sinh cho ${campaign.name}`}>
        <FormRow label="Tiêu đề">
          <input className={FORM_CONTROL_CLASS} value={title} onChange={(event) => setTitle(event.target.value)} />
        </FormRow>
        <FormRow label="Nội dung">
          <textarea
            rows={4}
            className={FORM_CONTROL_CLASS}
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </FormRow>
        <FormRow label="Đăng từ ngày">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={publishFrom}
            onChange={(event) => setPublishFrom(event.target.value)}
          />
        </FormRow>
        <FormRow label="Thời hạn đăng (trống là hạn nhận hồ sơ)">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={publishTo}
            onChange={(event) => setPublishTo(event.target.value)}
          />
        </FormRow>
      </FormBlock>
      <FormButtons busy={create.isPending} disabled={!title || !content} onCancel={onCancel} />
    </form>
  );
}

function PostsTab({ campaign, onDone }: { campaign: Campaign; onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.admissionPostManage);
  const grid = useGridSettings('admission-posts');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const posts = useQuery({ queryKey: ['admission-posts', campaign.id], queryFn: () => listPosts(campaign.id) });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['admission-posts'] });
    onDone(message);
  };
  const change = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'publish' | 'hide' }) =>
      postJson(`/api/v1/admission-posts/${id}/${action}`, action === 'hide' ? { reason: 'Gỡ tin' } : {}),
    onSuccess: (_result, variables) => refresh(variables.action === 'publish' ? 'Đã công bố tin' : 'Đã ẩn tin'),
  });
  const error = posts.error ?? change.error ?? grid.error;
  const columns: Array<DataGridColumn<Post>> = [
    { id: 'title', header: 'Tiêu đề', alwaysVisible: true, className: 'font-medium', cell: (post) => post.title },
    { id: 'content', header: 'Nội dung', hiddenByDefault: true, cell: (post) => post.content },
    { id: 'publish_from', header: 'Đăng từ', cell: (post) => post.publish_from },
    { id: 'publish_to', header: 'Thời hạn', cell: (post) => post.publish_to ?? campaign.open_to },
    { id: 'status', header: 'Trạng thái', cell: (post) => POST_STATUS_LABELS[post.status] },
  ];
  const rows = (posts.data ?? []).filter((post) => matchesSearch(search, post.title, post.content));
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {canManage && creating ? (
        <FormPanel>
          <PostForm
            campaign={campaign}
            onCancel={() => setCreating(false)}
            onSaved={() => {
              setCreating(false);
              void refresh('Đã lưu tin tuyển sinh');
            }}
          />
        </FormPanel>
      ) : null}
      <DataGrid
        label="Tin tuyển sinh"
        columns={columns}
        rows={rows}
        getRowId={(post) => post.id}
        getRowLabel={(post) => `tin ${post.title}`}
        loading={posts.isPending}
        emptyText="Đợt chưa có tin tuyển sinh."
        search={{ label: 'Tìm theo tiêu đề, nội dung', value: search, onChange: setSearch }}
        toolbar={
          canManage ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Thêm mới
            </Button>
          ) : null
        }
        rowActions={(post) => (
          <>
            {canManage && post.status !== 'published' && campaign.status !== 'closed' ? (
              <Button onClick={() => change.mutate({ id: post.id, action: 'publish' })}>Công bố</Button>
            ) : null}
            {canManage && post.status === 'published' ? (
              <Button variant="text" onClick={() => change.mutate({ id: post.id, action: 'hide' })}>
                Ẩn tin
              </Button>
            ) : null}
          </>
        )}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}
