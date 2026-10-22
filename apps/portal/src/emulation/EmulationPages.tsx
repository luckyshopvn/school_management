import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EMULATION_APPEAL_KIND_LABELS,
  EMULATION_APPEAL_STATUS_LABELS,
  EMULATION_CAMPAIGN_KIND_LABELS,
  EMULATION_CAMPAIGN_STATUS_LABELS,
  EMULATION_CHECK_STATE_LABELS,
  EMULATION_DECISION_KIND_LABELS,
  EMULATION_KIND_LABELS,
  EMULATION_LEVEL_LABELS,
  EMULATION_NOMINATION_STATUS_LABELS,
  EMULATION_POSITION_LABELS,
  EMULATION_REGISTRATION_STATUS_LABELS,
  EMULATION_TARGET_LABELS,
  EMULATION_VOTE_LABELS,
  emulationScore,
  type EmulationAppealKindCode,
  type EmulationCampaignStatusCode,
  type EmulationCheck,
  type EmulationCriterion,
  type EmulationNominationStatusCode,
  type EmulationPositionCode,
  type EmulationTargetCode,
  type EmulationVoteCode,
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
import { formatDateTime, Page, Tabs, todayText, useToast } from '../directives/directive-ui.js';
import { useGridSettings } from '../pages/grid-settings.js';
import {
  addEvidence,
  addManualAward,
  campaignAction,
  castVotes,
  closeMeeting,
  createNomination,
  createOutgoingDraft,
  deleteCampaign,
  deleteDecision,
  deleteManualAward,
  deleteNomination,
  deleteRegistration,
  deleteTitle,
  downloadCertificate,
  downloadDecision,
  downloadEvidence,
  downloadLaunchDocument,
  downloadMinutes,
  downloadNominationReport,
  exportCampaignReport,
  exportHistory,
  issueDecision,
  listAppeals,
  listCampaigns,
  listDecisions,
  listEvidenceOptions,
  listHistory,
  listNominations,
  listRegistrations,
  listTitles,
  listVoting,
  loadDefaultTitles,
  nominationAction,
  openMeeting,
  readCampaignReport,
  readCouncil,
  readDecision,
  readEmulationOverview,
  readMeeting,
  readNomination,
  recordUpperResult,
  removeEvidence,
  register,
  resolveAppeal,
  reviewRegistrations,
  saveCampaign,
  saveCouncil,
  saveDecision,
  saveTitle,
  submitAppeal,
  updateNomination,
  verifyAward,
  type AwardRow,
  type CampaignInput,
  type EmulationAppeal,
  type EmulationCampaign,
  type EmulationDecision,
  type EmulationNomination,
  type EmulationNominationDetail,
  type EmulationRegistration,
  type EmulationTitle,
  type MeetingDetail,
  type TitleInput,
} from './emulation-api.js';

// Thi đua, khen thưởng cán bộ, giáo viên (DT-18 phần 22d, YCTD-148): đợt thi đua, đăng ký, hồ sơ đề nghị (KPI làm đầu vào,
// minh chứng từ kho hồ sơ chuyên môn), hội đồng và bỏ phiếu kín, phúc khảo, khiếu nại, quyết định khen thưởng (dự thảo văn
// bản đi), sổ theo dõi nhiều năm, báo cáo, danh mục danh hiệu; trang tra cứu giấy khen công khai
const CAMPAIGN_TONES: Record<EmulationCampaignStatusCode, StatusTone> = {
  draft: 'neutral',
  launched: 'info',
  published: 'warning',
  closed: 'success',
};
const NOMINATION_TONES: Record<EmulationNominationStatusCode, StatusTone> = {
  draft: 'neutral',
  submitted: 'info',
  returned: 'warning',
  accepted: 'info',
  passed: 'success',
  failed: 'danger',
  proposed: 'info',
  awarded: 'success',
  not_awarded: 'danger',
};
const CHECK_TONES: Record<EmulationCheck['state'], StatusTone> = {
  ok: 'success',
  failed: 'danger',
  unknown: 'warning',
};
const textareaClass = `${FORM_CONTROL_CLASS} min-h-24`;

const useOverview = () => useQuery({ queryKey: ['emulation', 'overview'], queryFn: readEmulationOverview });
const useCampaigns = () => useQuery({ queryKey: ['emulation', 'campaigns'], queryFn: listCampaigns });
const useTitles = () => useQuery({ queryKey: ['emulation', 'titles'], queryFn: () => listTitles() });
const nullable = (value: string) => (value.trim() === '' ? null : value.trim());

function CampaignSelect({
  value,
  onChange,
  statuses,
}: {
  value: string;
  onChange(value: string): void;
  statuses?: EmulationCampaignStatusCode[];
}) {
  const campaigns = useCampaigns();
  const rows = (campaigns.data ?? []).filter((row) => !statuses || statuses.includes(row.status));
  return (
    <label className="text-label font-medium text-text">
      Đợt thi đua
      <select className={selectClass} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Chọn đợt thi đua</option>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name} ({EMULATION_CAMPAIGN_STATUS_LABELS[row.status]})
          </option>
        ))}
      </select>
    </label>
  );
}

// Đợt đang chọn: mặc định là đợt mới nhất
function useCampaignChoice(statuses?: EmulationCampaignStatusCode[]) {
  const campaigns = useCampaigns();
  const [chosen, setChosen] = useState('');
  const first = (campaigns.data ?? []).find((row) => !statuses || statuses.includes(row.status))?.id ?? '';
  const id = chosen || first;
  const campaign = (campaigns.data ?? []).find((row) => row.id === id);
  return { id, campaign, setChosen };
}

function Checks({ checks }: { checks: EmulationCheck[] }) {
  if (checks.length === 0) {
    return <p className="text-content text-text-secondary">Danh hiệu không có điều kiện cần đối chiếu.</p>;
  }
  return (
    <table className="w-full border-collapse text-content" aria-label="Điều kiện của danh hiệu">
      <thead>
        <tr>
          <th className="border border-border px-2 py-1 text-left">Điều kiện</th>
          <th className="border border-border px-2 py-1 text-left">Kết quả</th>
          <th className="border border-border px-2 py-1 text-left">Chi tiết</th>
        </tr>
      </thead>
      <tbody>
        {checks.map((check) => (
          <tr key={check.code}>
            <td className="border border-border px-2 py-1">{check.label}</td>
            <td className="border border-border px-2 py-1">
              <StatusBadge tone={CHECK_TONES[check.state]} label={EMULATION_CHECK_STATE_LABELS[check.state]} />
            </td>
            <td className="border border-border px-2 py-1">{check.detail}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

// ---- 1.1. Đợt thi đua ----

function CampaignForm({
  campaign,
  onDone,
  onCancel,
}: {
  campaign: EmulationCampaign | null;
  onDone(message: string): void;
  onCancel(): void;
}) {
  const overview = useOverview();
  const titles = useTitles();
  const [value, setValue] = useState<CampaignInput>({
    code: campaign?.code ?? '',
    name: campaign?.name ?? '',
    kind: campaign?.kind ?? 'regular',
    description: campaign?.description ?? '',
    title_ids: campaign?.title_ids ?? [],
    kpi_period_id: campaign?.kpi_period_id ?? null,
    registration_deadline: campaign?.registration_deadline ?? null,
    nomination_deadline: campaign?.nomination_deadline ?? null,
    appeal_days: campaign?.appeal_days ?? 7,
  });
  const save = useMutation({
    mutationFn: () =>
      saveCampaign(campaign?.id ?? null, {
        ...value,
        description: nullable(value.description ?? ''),
        registration_deadline: value.registration_deadline || null,
        nomination_deadline: value.nomination_deadline || null,
      }),
    onSuccess: (saved) => onDone(`Đã ghi đợt thi đua ${saved.name}`),
  });
  const errors = fieldErrorsOf(save.error);
  const set = (patch: Partial<CampaignInput>) => setValue((current) => ({ ...current, ...patch }));
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Đợt thi đua"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thông tin đợt">
        <FormRow label="Mã đợt" error={errors.code}>
          <input
            className={FORM_CONTROL_CLASS}
            value={value.code}
            onChange={(event) => set({ code: event.target.value })}
          />
        </FormRow>
        <FormRow label="Tên đợt thi đua" error={errors.name}>
          <input
            className={FORM_CONTROL_CLASS}
            value={value.name}
            onChange={(event) => set({ name: event.target.value })}
          />
        </FormRow>
        <FormRow label="Loại">
          <select
            className={FORM_CONTROL_CLASS}
            value={value.kind}
            onChange={(event) => set({ kind: event.target.value as CampaignInput['kind'] })}
          >
            {Object.entries(EMULATION_CAMPAIGN_KIND_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Nội dung phát động" error={errors.description}>
          <textarea
            className={textareaClass}
            value={value.description ?? ''}
            onChange={(event) => set({ description: event.target.value })}
          />
        </FormRow>
        <FormRow label="Kỳ đánh giá KPI làm đầu vào" error={errors.kpi_period_id}>
          <select
            className={FORM_CONTROL_CLASS}
            value={value.kpi_period_id ?? ''}
            onChange={(event) => set({ kpi_period_id: event.target.value || null })}
          >
            <option value="">Không dùng KPI</option>
            {(overview.data?.kpi_periods ?? []).map((period) => (
              <option key={period.id} value={period.id}>
                {period.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Hạn đăng ký thi đua" error={errors.registration_deadline}>
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={value.registration_deadline ?? ''}
            onChange={(event) => set({ registration_deadline: event.target.value })}
          />
        </FormRow>
        <FormRow label="Hạn nộp hồ sơ đề nghị" error={errors.nomination_deadline}>
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={value.nomination_deadline ?? ''}
            onChange={(event) => set({ nomination_deadline: event.target.value })}
          />
        </FormRow>
        <FormRow label="Số ngày nhận phúc khảo, khiếu nại sau khi công bố" error={errors.appeal_days}>
          <input
            type="number"
            min={1}
            max={60}
            className={FORM_CONTROL_CLASS}
            value={value.appeal_days}
            onChange={(event) => set({ appeal_days: Number(event.target.value) })}
          />
        </FormRow>
      </FormBlock>
      <FormBlock title="Danh hiệu, hình thức khen thưởng của đợt">
        {errors.title_ids ? <Alert tone="danger">{errors.title_ids}</Alert> : null}
        {(titles.data ?? []).map((title) => (
          <label key={title.id} className="flex items-center gap-2 text-content">
            <input
              type="checkbox"
              checked={value.title_ids.includes(title.id)}
              onChange={(event) =>
                set({
                  title_ids: event.target.checked
                    ? [...value.title_ids, title.id]
                    : value.title_ids.filter((id) => id !== title.id),
                })
              }
            />
            {title.name} ({EMULATION_TARGET_LABELS[title.target]}, {EMULATION_LEVEL_LABELS[title.decision_level]})
          </label>
        ))}
        {titles.data?.length === 0 ? (
          <p className="text-content text-text-secondary">Chưa có danh mục; nạp danh mục ở mục 6.1.</p>
        ) : null}
      </FormBlock>
      <Actions>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Hủy
        </Button>
      </Actions>
    </form>
  );
}

function CampaignPanel({ campaign, onChanged }: { campaign: EmulationCampaign; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const overview = useOverview();
  const [editing, setEditing] = useState(false);
  const action = useMutation({
    mutationFn: (name: 'launch' | 'publish' | 'close') => campaignAction(campaign.id, name),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['emulation'] });
      onChanged(`${saved.name}: ${EMULATION_CAMPAIGN_STATUS_LABELS[saved.status]}`);
    },
  });
  const file = useMutation({ mutationFn: (format: 'pdf' | 'docx') => downloadLaunchDocument(campaign.id, format) });
  const manage = overview.data?.can_manage ?? false;
  if (editing) {
    return (
      <CampaignForm
        campaign={campaign}
        onCancel={() => setEditing(false)}
        onDone={async (message) => {
          setEditing(false);
          await queryClient.invalidateQueries({ queryKey: ['emulation'] });
          onChanged(message);
        }}
      />
    );
  }
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label={campaign.name}>
      {action.error ? <Alert tone="danger">{messageOf(action.error)}</Alert> : null}
      {file.error ? <Alert tone="danger">{messageOf(file.error)}</Alert> : null}
      <p className="whitespace-pre-wrap text-content">{campaign.description}</p>
      <p className="text-content">
        Danh hiệu: {campaign.titles.map((title) => title.name).join(', ')}. Kỳ KPI:{' '}
        {campaign.kpi_period_name ?? 'không dùng'}.
        {campaign.appeal_deadline ? ` Hạn phúc khảo, khiếu nại: ${formatDate(campaign.appeal_deadline)}.` : ''}
      </p>
      <Actions>
        <Button variant="secondary" onClick={() => file.mutate('pdf')}>
          Tải thông báo phát động (PDF)
        </Button>
        <Button variant="secondary" onClick={() => file.mutate('docx')}>
          Tải thông báo phát động (Word)
        </Button>
        {manage && campaign.status !== 'closed' ? (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Sửa
          </Button>
        ) : null}
        {manage && campaign.status === 'draft' ? (
          <Button variant="primary" disabled={action.isPending} onClick={() => action.mutate('launch')}>
            Phát động
          </Button>
        ) : null}
        {manage && campaign.status === 'published' ? (
          <Button variant="secondary" disabled={action.isPending} onClick={() => action.mutate('close')}>
            Kết thúc đợt
          </Button>
        ) : null}
      </Actions>
    </section>
  );
}

export function CampaignsPage() {
  const queryClient = useQueryClient();
  const overview = useOverview();
  const campaigns = useCampaigns();
  const grid = useGridSettings('emulation-campaigns');
  const { toast, setToast, close } = useToast();
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<string>();
  const [deleting, setDeleting] = useState<EmulationCampaign>();
  const remove = useMutation({
    mutationFn: (row: EmulationCampaign) => deleteCampaign(row.id),
    onSuccess: async (_result, row) => {
      setDeleting(undefined);
      await queryClient.invalidateQueries({ queryKey: ['emulation'] });
      setToast(`Đã xóa ${row.name}`);
    },
    onError: () => setDeleting(undefined),
  });
  const columns: Array<DataGridColumn<EmulationCampaign>> = [
    { id: 'code', header: 'Mã', cell: (row) => row.code },
    { id: 'name', header: 'Đợt thi đua', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
    { id: 'kind', header: 'Loại', cell: (row) => EMULATION_CAMPAIGN_KIND_LABELS[row.kind] },
    { id: 'registration', header: 'Hạn đăng ký', cell: (row) => formatDate(row.registration_deadline) },
    { id: 'nomination', header: 'Hạn nộp hồ sơ', cell: (row) => formatDate(row.nomination_deadline) },
    { id: 'registrations', header: 'Số đăng ký', cell: (row) => row.registration_count },
    { id: 'nominations', header: 'Số hồ sơ', cell: (row) => row.nomination_count },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => (
        <StatusBadge tone={CAMPAIGN_TONES[row.status]} label={EMULATION_CAMPAIGN_STATUS_LABELS[row.status]} />
      ),
    },
  ];
  return (
    <Page path="/emulation/campaigns" toast={toast} onToastClose={close}>
      {campaigns.error ? <Alert tone="danger">{messageOf(campaigns.error)}</Alert> : null}
      {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      {creating ? (
        <CampaignForm
          campaign={null}
          onCancel={() => setCreating(false)}
          onDone={async (message) => {
            setCreating(false);
            await queryClient.invalidateQueries({ queryKey: ['emulation'] });
            setToast(message);
          }}
        />
      ) : null}
      <DataGrid
        label="Đợt thi đua"
        columns={columns}
        rows={campaigns.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        loading={!campaigns.data && !campaigns.error}
        emptyText="Chưa có đợt thi đua."
        toolbar={
          overview.data?.can_manage ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Thêm đợt thi đua
            </Button>
          ) : null
        }
        rowActions={(row) =>
          overview.data?.can_manage && row.status === 'draft' ? (
            <Button variant="text" onClick={() => setDeleting(row)}>
              Xóa
            </Button>
          ) : null
        }
        onRowClick={(row) => setActiveId(activeId === row.id ? undefined : row.id)}
        activeRowId={activeId}
        renderRowDetail={(row) =>
          activeId === row.id ? <CampaignPanel campaign={row} onChanged={(message) => setToast(message)} /> : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      <ConfirmDeleteDialog
        open={deleting !== undefined}
        subject={deleting?.name ?? ''}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onCancel={() => setDeleting(undefined)}
      />
    </Page>
  );
}

// ---- Chọn đối tượng: cá nhân hoặc tổ ----

function SubjectFields({
  campaign,
  titleId,
  setTitleId,
  subjectId,
  setSubjectId,
  errors,
}: {
  campaign: EmulationCampaign | undefined;
  titleId: string;
  setTitleId(value: string): void;
  subjectId: string;
  setSubjectId(value: string): void;
  errors: Record<string, string>;
}) {
  const overview = useOverview();
  const data = overview.data;
  const title = campaign?.titles.find((row) => row.id === titleId);
  const target: EmulationTargetCode = title?.target ?? 'individual';
  return (
    <>
      <FormRow label="Danh hiệu, hình thức khen thưởng" error={errors.title_id}>
        <select
          className={FORM_CONTROL_CLASS}
          value={titleId}
          onChange={(event) => {
            setTitleId(event.target.value);
            setSubjectId('');
          }}
        >
          <option value="">Chọn danh hiệu</option>
          {(campaign?.titles ?? []).map((row) => (
            <option key={row.id} value={row.id}>
              {row.name} ({EMULATION_TARGET_LABELS[row.target]})
            </option>
          ))}
        </select>
      </FormRow>
      {target === 'individual' ? (
        <FormRow label="Cá nhân" error={errors.staff_id}>
          {data?.can_manage ? (
            <select
              className={FORM_CONTROL_CLASS}
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
            >
              <option value="">Tôi ({data.my_staff?.full_name ?? 'chưa có hồ sơ nhân sự'})</option>
              {data.staff.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.full_name} ({row.code})
                </option>
              ))}
            </select>
          ) : (
            <span className="text-content">{data?.my_staff?.full_name ?? 'Tài khoản chưa gắn hồ sơ nhân sự'}</span>
          )}
        </FormRow>
      ) : (
        <FormRow label="Tập thể (tổ)" error={errors.department_id}>
          <select
            className={FORM_CONTROL_CLASS}
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
          >
            <option value="">Chọn tổ</option>
            {(data?.can_manage ? data.departments : data?.my_department ? [data.my_department] : []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </FormRow>
      )}
    </>
  );
}

function subjectInput(campaign: EmulationCampaign | undefined, titleId: string, subjectId: string) {
  const target = campaign?.titles.find((row) => row.id === titleId)?.target ?? 'individual';
  return {
    campaign_id: campaign?.id ?? '',
    title_id: titleId,
    target,
    staff_id: target === 'individual' ? subjectId || null : null,
    department_id: target === 'collective' ? subjectId || null : null,
  };
}

// ---- 1.2. Đăng ký thi đua ----

export function RegistrationsPage() {
  const queryClient = useQueryClient();
  const overview = useOverview();
  const choice = useCampaignChoice();
  const grid = useGridSettings('emulation-registrations');
  const { toast, setToast, close } = useToast();
  const [view, setView] = useState<'mine' | 'all'>('mine');
  const [titleId, setTitleId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [commitment, setCommitment] = useState('');
  const [note, setNote] = useState('');
  const manage = overview.data?.can_manage ?? false;
  const registrations = useQuery({
    queryKey: ['emulation', 'registrations', choice.id, view],
    queryFn: () => listRegistrations(choice.id, view),
    enabled: choice.id !== '',
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['emulation'] });
  const create = useMutation({
    mutationFn: () =>
      register({ ...subjectInput(choice.campaign, titleId, subjectId), commitment: nullable(commitment) }),
    onSuccess: async (row) => {
      setTitleId('');
      setCommitment('');
      await refresh();
      setToast(`Đã đăng ký ${row.title_name} cho ${row.subject_name}`);
    },
  });
  const review = useMutation({
    mutationFn: (input: { ids: string[]; accept: boolean }) =>
      reviewRegistrations(input.ids, input.accept, nullable(note)),
    onSuccess: async (result, input) => {
      setNote('');
      await refresh();
      setToast(`${input.accept ? 'Đã duyệt' : 'Đã trả lại'} ${result.updated} đăng ký`);
    },
  });
  const remove = useMutation({
    mutationFn: (row: EmulationRegistration) => deleteRegistration(row.id),
    onSuccess: async () => {
      await refresh();
      setToast('Đã xóa đăng ký');
    },
  });
  const columns: Array<DataGridColumn<EmulationRegistration>> = [
    {
      id: 'subject',
      header: 'Cá nhân, tập thể',
      alwaysVisible: true,
      className: 'font-medium',
      cell: (row) => row.subject_name,
    },
    { id: 'target', header: 'Đối tượng', cell: (row) => EMULATION_TARGET_LABELS[row.target] },
    { id: 'title', header: 'Danh hiệu đăng ký', cell: (row) => row.title_name },
    { id: 'commitment', header: 'Cam kết', cell: (row) => row.commitment ?? '' },
    { id: 'by', header: 'Người đăng ký', cell: (row) => row.registered_by_name },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => (
        <span title={row.review_note ?? undefined}>
          <StatusBadge
            tone={row.status === 'accepted' ? 'success' : row.status === 'returned' ? 'warning' : 'info'}
            label={EMULATION_REGISTRATION_STATUS_LABELS[row.status]}
          />
        </span>
      ),
    },
  ];
  const errors = fieldErrorsOf(create.error);
  const open = choice.campaign?.status === 'launched';
  return (
    <Page path="/emulation/registrations" toast={toast} onToastClose={close}>
      <div className="flex flex-wrap items-end gap-3">
        <CampaignSelect value={choice.id} onChange={choice.setChosen} />
      </div>
      {manage ? (
        <Tabs<'mine' | 'all'>
          label="Đăng ký thi đua"
          value={view}
          options={[
            { value: 'mine', label: 'Đăng ký của tôi' },
            { value: 'all', label: 'Mọi đăng ký' },
          ]}
          onChange={setView}
        />
      ) : null}
      {open ? (
        <form
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          aria-label="Đăng ký thi đua mới"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
          <SubjectFields
            campaign={choice.campaign}
            titleId={titleId}
            setTitleId={setTitleId}
            subjectId={subjectId}
            setSubjectId={setSubjectId}
            errors={errors}
          />
          <FormRow label="Nội dung cam kết, chỉ tiêu phấn đấu" error={errors.commitment}>
            <textarea
              className={textareaClass}
              value={commitment}
              onChange={(event) => setCommitment(event.target.value)}
            />
          </FormRow>
          <Actions>
            <Button type="submit" variant="primary" disabled={create.isPending}>
              Đăng ký
            </Button>
          </Actions>
        </form>
      ) : choice.campaign ? (
        <Alert tone="info">Đợt thi đua không ở giai đoạn nhận đăng ký.</Alert>
      ) : null}
      {registrations.error ? <Alert tone="danger">{messageOf(registrations.error)}</Alert> : null}
      {review.error ? <Alert tone="danger">{messageOf(review.error)}</Alert> : null}
      {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      {manage && view === 'all' ? (
        <label className="text-label font-medium text-text">
          Lý do trả lại
          <input className={FORM_CONTROL_CLASS} value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
      ) : null}
      <DataGrid
        label="Danh sách đăng ký thi đua"
        columns={columns}
        rows={registrations.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `${row.subject_name} – ${row.title_name}`}
        loading={choice.id !== '' && !registrations.data && !registrations.error}
        emptyText="Chưa có đăng ký."
        selectable={manage && view === 'all'}
        toolbar={(selected) =>
          manage && view === 'all' ? (
            <span className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={selected.length === 0 || review.isPending}
                onClick={() => review.mutate({ ids: selected.map((row) => row.id), accept: true })}
              >
                Duyệt đăng ký
              </Button>
              <Button
                variant="secondary"
                disabled={selected.length === 0 || review.isPending}
                onClick={() => review.mutate({ ids: selected.map((row) => row.id), accept: false })}
              >
                Trả lại
              </Button>
            </span>
          ) : null
        }
        rowActions={(row) =>
          row.status !== 'accepted' && view === 'mine' ? (
            <Button variant="text" onClick={() => remove.mutate(row)}>
              Xóa
            </Button>
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </Page>
  );
}

// ---- 2. Hồ sơ đề nghị ----

function NominationEditor({ detail, onSaved }: { detail: EmulationNominationDetail; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const [achievements, setAchievements] = useState(detail.achievements ?? '');
  const [initiative, setInitiative] = useState(detail.initiative ?? '');
  const [scores, setScores] = useState<Record<string, string>>(
    Object.fromEntries(
      detail.criteria.map((criterion) => [criterion.code, String(detail.scores[criterion.code] ?? '')]),
    ),
  );
  const numeric = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(scores).flatMap(([key, value]) => (value === '' ? [] : [[key, Number(value)]])),
      ),
    [scores],
  );
  const save = useMutation({
    mutationFn: () =>
      updateNomination(detail.id, {
        achievements: nullable(achievements),
        initiative: nullable(initiative),
        scores: numeric,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['emulation'] });
      onSaved('Đã ghi hồ sơ đề nghị');
    },
  });
  const errors = fieldErrorsOf(save.error);
  return (
    <form
      className="flex flex-col gap-3"
      aria-label="Nội dung hồ sơ đề nghị"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormRow label="Tóm tắt thành tích" error={errors.achievements}>
        <textarea
          className={`${FORM_CONTROL_CLASS} min-h-32`}
          value={achievements}
          onChange={(event) => setAchievements(event.target.value)}
        />
      </FormRow>
      <FormRow label="Sáng kiến, giải pháp" error={errors.initiative}>
        <textarea
          className={textareaClass}
          value={initiative}
          onChange={(event) => setInitiative(event.target.value)}
        />
      </FormRow>
      <FormBlock title="Tự chấm theo tiêu chí">
        {detail.criteria.map((criterion: EmulationCriterion) => (
          <FormRow
            key={criterion.code}
            label={`${criterion.title} (trọng số ${criterion.weight}, tối đa ${criterion.max_score})`}
            error={errors[`scores.${criterion.code}`]}
          >
            <input
              type="number"
              min={0}
              max={criterion.max_score}
              step="0.5"
              className={FORM_CONTROL_CLASS}
              value={scores[criterion.code] ?? ''}
              onChange={(event) => setScores((current) => ({ ...current, [criterion.code]: event.target.value }))}
            />
          </FormRow>
        ))}
        <p className="text-content">
          Điểm quy về thang 100: <strong>{emulationScore(detail.criteria, numeric)}</strong>
        </p>
      </FormBlock>
      <Actions>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi hồ sơ
        </Button>
      </Actions>
    </form>
  );
}

function EvidenceSection({
  detail,
  onChanged,
}: {
  detail: EmulationNominationDetail;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [documentId, setDocumentId] = useState('');
  const options = useQuery({
    queryKey: ['emulation', 'evidence-options', detail.id],
    queryFn: () => listEvidenceOptions(detail.id),
    enabled: detail.can_edit,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['emulation'] });
  const add = useMutation({
    mutationFn: () => addEvidence(detail.id, documentId, null),
    onSuccess: async () => {
      setDocumentId('');
      await refresh();
      onChanged('Đã thêm minh chứng');
    },
  });
  const remove = useMutation({
    mutationFn: (evidenceId: string) => removeEvidence(detail.id, evidenceId),
    onSuccess: async () => {
      await refresh();
      onChanged('Đã bỏ minh chứng');
    },
  });
  const file = useMutation({ mutationFn: (evidenceId: string) => downloadEvidence(detail.id, evidenceId) });
  const error = add.error ?? remove.error ?? file.error;
  return (
    <FormBlock title="Minh chứng (kho hồ sơ chuyên môn)">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {detail.evidence.length === 0 ? <p className="text-content text-text-secondary">Chưa có minh chứng.</p> : null}
      <ul className="flex flex-col gap-1">
        {detail.evidence.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-2 text-content">
            <span>{item.title}</span>
            <Button variant="text" onClick={() => file.mutate(item.id)}>
              Tải tệp
            </Button>
            {detail.can_edit ? (
              <Button variant="text" onClick={() => remove.mutate(item.id)}>
                Bỏ
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {detail.can_edit ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-label font-medium text-text">
            Hồ sơ trong kho
            <select className={selectClass} value={documentId} onChange={(event) => setDocumentId(event.target.value)}>
              <option value="">Chọn hồ sơ minh chứng</option>
              {(options.data ?? []).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title} ({option.folder_name})
                </option>
              ))}
            </select>
          </label>
          <Button variant="secondary" disabled={!documentId || add.isPending} onClick={() => add.mutate()}>
            Thêm minh chứng
          </Button>
        </div>
      ) : null}
    </FormBlock>
  );
}

function AppealForm({ detail, onDone }: { detail: EmulationNominationDetail; onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const send = useMutation({
    mutationFn: () =>
      submitAppeal({ campaign_id: detail.campaign_id, nomination_id: detail.id, kind: 'review', content }),
    onSuccess: async () => {
      setContent('');
      await queryClient.invalidateQueries({ queryKey: ['emulation'] });
      onDone('Đã gửi phúc khảo');
    },
  });
  return (
    <FormBlock title={`Phúc khảo kết quả bình xét (đến hết ngày ${formatDate(detail.appeal_deadline)})`}>
      {send.error ? <Alert tone="danger">{messageOf(send.error)}</Alert> : null}
      <FormRow label="Nội dung phúc khảo">
        <textarea className={textareaClass} value={content} onChange={(event) => setContent(event.target.value)} />
      </FormRow>
      <Actions>
        <Button variant="secondary" disabled={!content.trim() || send.isPending} onClick={() => send.mutate()}>
          Gửi phúc khảo
        </Button>
      </Actions>
    </FormBlock>
  );
}

export function NominationPanel({ id, onChanged }: { id: string; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ['emulation', 'nomination', id], queryFn: () => readNomination(id) });
  const [note, setNote] = useState('');
  const action = useMutation({
    mutationFn: (name: 'submit' | 'withdraw' | 'accept' | 'return') =>
      nominationAction(id, name, name === 'return' ? note : undefined),
    onSuccess: async (saved) => {
      setNote('');
      await queryClient.invalidateQueries({ queryKey: ['emulation'] });
      onChanged(`${saved.subject_name}: ${saved.status_label}`);
    },
  });
  const report = useMutation({ mutationFn: (format: 'pdf' | 'docx') => downloadNominationReport(id, format) });
  const data = detail.data;
  if (detail.error) {
    return <Alert tone="danger">{messageOf(detail.error)}</Alert>;
  }
  if (!data) {
    return <p className="text-content">Đang tải…</p>;
  }
  const kpi = data.kpi_live
    ? `${data.kpi_live.rank_label ?? 'chưa xếp loại'} (${data.kpi_live.period_name})`
    : data.kpi_rank_label
      ? `${data.kpi_rank_label} (${data.kpi_period_name ?? ''})`
      : 'Chưa có kết quả KPI';
  const published = data.campaign_status === 'published';
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label={`Hồ sơ ${data.subject_name}`}
    >
      {action.error ? <Alert tone="danger">{messageOf(action.error)}</Alert> : null}
      {report.error ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
      {data.status === 'returned' && data.return_note ? (
        <Alert tone="warning">Trả lại: {data.return_note}</Alert>
      ) : null}
      <p className="text-content">
        <strong>{data.title_name}</strong> – {data.subject_name}
        {data.department_name ? ` (${data.department_name})` : ''}. Kết quả KPI: {kpi}. Điểm tiêu chí:{' '}
        {data.total_score}.
      </p>
      {data.agree_count !== null ? (
        <p className="text-content">
          Kết quả bỏ phiếu: {data.agree_count} đồng ý, {data.disagree_count} không đồng ý, {data.abstain_count} không
          biểu quyết; tỉ lệ đồng ý {data.agree_percent}% (tối thiểu {data.vote_threshold_percent}%).
        </p>
      ) : null}
      <Checks checks={data.eligibility} />
      {data.can_edit ? (
        <NominationEditor key={data.status} detail={data} onSaved={onChanged} />
      ) : (
        <>
          <p className="whitespace-pre-wrap text-content">{data.achievements}</p>
          {data.initiative ? <p className="whitespace-pre-wrap text-content">Sáng kiến: {data.initiative}</p> : null}
        </>
      )}
      <EvidenceSection detail={data} onChanged={onChanged} />
      {data.appeals.map((appeal) => (
        <Alert key={appeal.id} tone="info">
          {EMULATION_APPEAL_KIND_LABELS[appeal.kind]}: {appeal.content} –{' '}
          {EMULATION_APPEAL_STATUS_LABELS[appeal.status as 'pending']}
          {appeal.response ? `: ${appeal.response}` : ''}
        </Alert>
      ))}
      {published && ['passed', 'failed'].includes(data.status) && !data.can_manage ? (
        <AppealForm detail={data} onDone={onChanged} />
      ) : null}
      <Actions>
        <Button variant="secondary" onClick={() => report.mutate('docx')}>
          Tải báo cáo thành tích (Word)
        </Button>
        <Button variant="secondary" onClick={() => report.mutate('pdf')}>
          Tải báo cáo thành tích (PDF)
        </Button>
        {data.can_edit ? (
          <Button variant="primary" disabled={action.isPending} onClick={() => action.mutate('submit')}>
            Nộp hồ sơ
          </Button>
        ) : null}
        {data.status === 'submitted' && !data.can_manage ? (
          <Button variant="secondary" disabled={action.isPending} onClick={() => action.mutate('withdraw')}>
            Rút hồ sơ
          </Button>
        ) : null}
        {data.can_manage && data.status === 'submitted' ? (
          <Button variant="primary" disabled={action.isPending} onClick={() => action.mutate('accept')}>
            Tiếp nhận
          </Button>
        ) : null}
      </Actions>
      {data.can_manage && ['submitted', 'accepted'].includes(data.status) ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-label font-medium text-text">
            Lý do trả lại
            <input className={FORM_CONTROL_CLASS} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <Button
            variant="secondary"
            disabled={!note.trim() || action.isPending}
            onClick={() => action.mutate('return')}
          >
            Trả lại hồ sơ
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function NominationList({ view }: { view: 'mine' | 'review' }) {
  const queryClient = useQueryClient();
  const choice = useCampaignChoice();
  const grid = useGridSettings(view === 'review' ? 'emulation-nomination-review' : 'emulation-nominations');
  const { toast, setToast, close } = useToast();
  const [status, setStatus] = useState('');
  const [titleId, setTitleId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<string>();
  const [deleting, setDeleting] = useState<EmulationNomination>();
  const nominations = useQuery({
    queryKey: ['emulation', 'nominations', view, choice.id, status],
    queryFn: () => listNominations({ view, campaign_id: choice.id || undefined, status: status || undefined }),
  });
  const create = useMutation({
    mutationFn: () => createNomination(subjectInput(choice.campaign, titleId, subjectId)),
    onSuccess: async (row) => {
      setCreating(false);
      setTitleId('');
      await queryClient.invalidateQueries({ queryKey: ['emulation'] });
      setActiveId(row.id);
      setToast(`Đã lập hồ sơ ${row.title_name} cho ${row.subject_name}; nhập thành tích rồi nộp`);
    },
  });
  const remove = useMutation({
    mutationFn: (row: EmulationNomination) => deleteNomination(row.id),
    onSuccess: async () => {
      setDeleting(undefined);
      await queryClient.invalidateQueries({ queryKey: ['emulation'] });
      setToast('Đã xóa hồ sơ');
    },
    onError: () => setDeleting(undefined),
  });
  const columns: Array<DataGridColumn<EmulationNomination>> = [
    {
      id: 'subject',
      header: 'Cá nhân, tập thể',
      alwaysVisible: true,
      className: 'font-medium',
      cell: (row) => row.subject_name,
    },
    { id: 'title', header: 'Danh hiệu đề nghị', cell: (row) => row.title_name },
    { id: 'campaign', header: 'Đợt', hiddenByDefault: true, cell: (row) => row.campaign_name },
    { id: 'kpi', header: 'Xếp loại KPI', cell: (row) => row.kpi_rank_label ?? '' },
    { id: 'score', header: 'Điểm tiêu chí', cell: (row) => row.total_score },
    { id: 'checks', header: 'Điều kiện không đạt', cell: (row) => (row.failed_checks > 0 ? row.failed_checks : '') },
    { id: 'owner', header: 'Người lập', cell: (row) => row.owner_name },
    { id: 'percent', header: 'Tỉ lệ đồng ý', cell: (row) => (row.agree_percent ? `${row.agree_percent}%` : '') },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => <StatusBadge tone={NOMINATION_TONES[row.status]} label={row.status_label} />,
    },
  ];
  const path = view === 'review' ? '/emulation/nominations/review' : '/emulation/nominations';
  return (
    <Page path={path} toast={toast} onToastClose={close}>
      <div className="flex flex-wrap items-end gap-3">
        <CampaignSelect value={choice.id} onChange={choice.setChosen} />
        <label className="text-label font-medium text-text">
          Trạng thái
          <select className={selectClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Tất cả</option>
            {Object.entries(EMULATION_NOMINATION_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {nominations.error ? <Alert tone="danger">{messageOf(nominations.error)}</Alert> : null}
      {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      {creating ? (
        <form
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          aria-label="Lập hồ sơ đề nghị"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
          <SubjectFields
            campaign={choice.campaign}
            titleId={titleId}
            setTitleId={setTitleId}
            subjectId={subjectId}
            setSubjectId={setSubjectId}
            errors={fieldErrorsOf(create.error)}
          />
          <Actions>
            <Button type="submit" variant="primary" disabled={create.isPending}>
              Lập hồ sơ
            </Button>
            <Button variant="secondary" onClick={() => setCreating(false)}>
              Hủy
            </Button>
          </Actions>
        </form>
      ) : null}
      <DataGrid
        label={view === 'review' ? 'Hồ sơ đề nghị đã nộp' : 'Hồ sơ đề nghị của tôi'}
        columns={columns}
        rows={nominations.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `${row.subject_name} – ${row.title_name}`}
        loading={!nominations.data && !nominations.error}
        emptyText="Không có hồ sơ đề nghị."
        toolbar={
          view === 'mine' && choice.campaign?.status === 'launched' ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Lập hồ sơ đề nghị
            </Button>
          ) : null
        }
        rowActions={(row) =>
          view === 'mine' && row.status === 'draft' && !row.submitted_at ? (
            <Button variant="text" onClick={() => setDeleting(row)}>
              Xóa
            </Button>
          ) : null
        }
        onRowClick={(row) => setActiveId(activeId === row.id ? undefined : row.id)}
        activeRowId={activeId}
        renderRowDetail={(row) =>
          activeId === row.id ? <NominationPanel id={row.id} onChanged={(message) => setToast(message)} /> : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      <ConfirmDeleteDialog
        open={deleting !== undefined}
        subject={deleting ? `${deleting.subject_name} – ${deleting.title_name}` : ''}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onCancel={() => setDeleting(undefined)}
      />
    </Page>
  );
}

export const MyNominationsPage = () => <NominationList view="mine" />;
export const ReviewNominationsPage = () => <NominationList view="review" />;

// ---- 3.1. Hội đồng và phiên họp ----

function MembersEditor({
  campaignId,
  members,
  onSaved,
}: {
  campaignId: string;
  members: Array<{ user_id: string; position: EmulationPositionCode }>;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const overview = useOverview();
  const [rows, setRows] = useState(members);
  const save = useMutation({
    mutationFn: () =>
      saveCouncil(
        campaignId,
        rows.filter((row) => row.user_id !== ''),
      ),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['emulation'] });
      onSaved(`Đã ghi hội đồng ${saved.members.length} thành viên`);
    },
  });
  const candidates = (overview.data?.staff ?? []).filter((row) => row.user_id);
  return (
    <FormBlock title="Thành viên hội đồng thi đua, khen thưởng">
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-end gap-2">
          <label className="text-label font-medium text-text">
            Thành viên {index + 1}
            <select
              className={selectClass}
              value={row.user_id}
              onChange={(event) =>
                setRows(
                  rows.map((item, position) => (position === index ? { ...item, user_id: event.target.value } : item)),
                )
              }
            >
              <option value="">Chọn cán bộ</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.user_id ?? ''}>
                  {candidate.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-label font-medium text-text">
            Chức danh
            <select
              className={selectClass}
              value={row.position}
              onChange={(event) =>
                setRows(
                  rows.map((item, position) =>
                    position === index ? { ...item, position: event.target.value as EmulationPositionCode } : item,
                  ),
                )
              }
            >
              {Object.entries(EMULATION_POSITION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Button variant="text" onClick={() => setRows(rows.filter((_item, position) => position !== index))}>
            Bỏ
          </Button>
        </div>
      ))}
      <Actions>
        <Button
          variant="secondary"
          onClick={() => setRows([...rows, { user_id: '', position: rows.length === 0 ? 'chair' : 'member' }])}
        >
          Thêm thành viên
        </Button>
        <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
          Ghi hội đồng
        </Button>
      </Actions>
    </FormBlock>
  );
}

function MeetingResults({ meeting }: { meeting: MeetingDetail }) {
  return (
    <table className="w-full border-collapse text-content" aria-label="Kết quả bỏ phiếu">
      <thead>
        <tr>
          {['Cá nhân, tập thể', 'Danh hiệu', 'Đồng ý', 'Không đồng ý', 'Không biểu quyết', 'Tỉ lệ', 'Kết quả'].map(
            (text) => (
              <th key={text} className="border border-border px-2 py-1 text-left">
                {text}
              </th>
            ),
          )}
        </tr>
      </thead>
      <tbody>
        {meeting.nominations.map((row) => (
          <tr key={row.id}>
            <td className="border border-border px-2 py-1">{row.subject_name}</td>
            <td className="border border-border px-2 py-1">{row.title_name}</td>
            <td className="border border-border px-2 py-1">{row.agree_count ?? ''}</td>
            <td className="border border-border px-2 py-1">{row.disagree_count ?? ''}</td>
            <td className="border border-border px-2 py-1">{row.abstain_count ?? ''}</td>
            <td className="border border-border px-2 py-1">{row.agree_percent ? `${row.agree_percent}%` : ''}</td>
            <td className="border border-border px-2 py-1">
              <StatusBadge tone={NOMINATION_TONES[row.status]} label={EMULATION_NOMINATION_STATUS_LABELS[row.status]} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CouncilPage() {
  const queryClient = useQueryClient();
  const choice = useCampaignChoice(['launched', 'published', 'closed']);
  const { toast, setToast, close } = useToast();
  const [heldAt, setHeldAt] = useState(`${todayText()}T14:00`);
  const [location, setLocation] = useState('');
  const [attendees, setAttendees] = useState('');
  const [conclusion, setConclusion] = useState('');
  const council = useQuery({
    queryKey: ['emulation', 'council', choice.id],
    queryFn: () => readCouncil(choice.id),
    enabled: choice.id !== '',
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['emulation'] });
  const open = useMutation({
    mutationFn: () => openMeeting(choice.id, { held_at: heldAt, location: nullable(location), content: null }),
    onSuccess: async (meeting) => {
      await refresh();
      setToast(`Đã mở phiên bỏ phiếu ${meeting.nominations.length} hồ sơ`);
    },
  });
  const voting = council.data?.meetings.find((meeting) => meeting.status === 'voting');
  const finish = useMutation({
    mutationFn: () =>
      closeMeeting(voting?.id ?? '', {
        attendee_count: attendees === '' ? null : Number(attendees),
        conclusion: nullable(conclusion),
      }),
    onSuccess: async () => {
      await refresh();
      setToast('Đã đóng phiên, tính kết quả và lập biên bản');
    },
  });
  const publish = useMutation({
    mutationFn: () => campaignAction(choice.id, 'publish'),
    onSuccess: async (saved) => {
      await refresh();
      setToast(`Đã công bố kết quả; phúc khảo, khiếu nại đến hết ngày ${formatDate(saved.appeal_deadline)}`);
    },
  });
  const minutes = useMutation({ mutationFn: (id: string) => downloadMinutes(id) });
  const [detailId, setDetailId] = useState('');
  const detail = useQuery({
    queryKey: ['emulation', 'meeting', detailId],
    queryFn: () => readMeeting(detailId),
    enabled: detailId !== '',
  });
  const data = council.data;
  const error = council.error ?? open.error ?? finish.error ?? publish.error ?? minutes.error;
  return (
    <Page path="/emulation/council" toast={toast} onToastClose={close}>
      <div className="flex flex-wrap items-end gap-3">
        <CampaignSelect value={choice.id} onChange={choice.setChosen} statuses={['launched', 'published', 'closed']} />
      </div>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {data ? (
        <>
          <MembersEditor
            key={`${choice.id}-${data.members.length}`}
            campaignId={choice.id}
            members={data.members.map((member) => ({ user_id: member.user_id, position: member.position }))}
            onSaved={(message) => setToast(message)}
          />
          <FormBlock title="Phiên họp bình xét">
            <p className="text-content">Hồ sơ đã tiếp nhận chờ bình xét: {data.waiting_count}.</p>
            {voting ? (
              <>
                <Alert tone="info">
                  Phiên ngày {formatDateTime(voting.held_at)} đang bỏ phiếu: {voting.voted_members}/
                  {voting.member_count} thành viên đã bỏ phiếu.
                </Alert>
                <FormRow label="Số thành viên có mặt">
                  <input
                    type="number"
                    min={0}
                    className={FORM_CONTROL_CLASS}
                    value={attendees}
                    onChange={(event) => setAttendees(event.target.value)}
                  />
                </FormRow>
                <FormRow label="Kết luận của hội đồng">
                  <textarea
                    className={textareaClass}
                    value={conclusion}
                    onChange={(event) => setConclusion(event.target.value)}
                  />
                </FormRow>
                <Actions>
                  <Button variant="primary" disabled={finish.isPending} onClick={() => finish.mutate()}>
                    Đóng phiên, tính kết quả
                  </Button>
                </Actions>
              </>
            ) : data.campaign.status !== 'closed' ? (
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-label font-medium text-text">
                  Thời gian họp
                  <input
                    type="datetime-local"
                    className={FORM_CONTROL_CLASS}
                    value={heldAt}
                    onChange={(event) => setHeldAt(event.target.value)}
                  />
                </label>
                <label className="text-label font-medium text-text">
                  Địa điểm
                  <input
                    className={FORM_CONTROL_CLASS}
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                  />
                </label>
                <Button
                  variant="primary"
                  disabled={open.isPending || data.waiting_count === 0}
                  onClick={() => open.mutate()}
                >
                  Mở phiên bỏ phiếu
                </Button>
                <Button variant="secondary" disabled={publish.isPending} onClick={() => publish.mutate()}>
                  Công bố kết quả bình xét
                </Button>
              </div>
            ) : null}
          </FormBlock>
          <FormBlock title="Các phiên đã họp">
            <ul className="flex flex-col gap-2">
              {data.meetings.map((meeting) => (
                <li key={meeting.id} className="flex flex-wrap items-center gap-2 text-content">
                  <span>
                    {formatDateTime(meeting.held_at)} – {meeting.nomination_count} hồ sơ –{' '}
                    {meeting.status === 'voting' ? 'đang bỏ phiếu' : 'đã đóng'}
                  </span>
                  <Button variant="text" onClick={() => setDetailId(detailId === meeting.id ? '' : meeting.id)}>
                    Xem kết quả
                  </Button>
                  {meeting.minutes_file_id ? (
                    <Button variant="text" onClick={() => minutes.mutate(meeting.id)}>
                      Tải biên bản
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            {detail.data ? <MeetingResults meeting={detail.data} /> : null}
          </FormBlock>
        </>
      ) : null}
    </Page>
  );
}

// ---- 3.2. Bỏ phiếu bình xét ----

function Ballot({ meeting, onSaved }: { meeting: MeetingDetail; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const [choices, setChoices] = useState<Record<string, EmulationVoteCode>>(
    Object.fromEntries(meeting.nominations.flatMap((row) => (row.my_choice ? [[row.id, row.my_choice]] : []))),
  );
  const save = useMutation({
    mutationFn: () =>
      castVotes(
        meeting.id,
        Object.entries(choices).map(([nomination_id, choice]) => ({ nomination_id, choice })),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['emulation'] });
      onSaved('Đã ghi phiếu bình xét');
    },
  });
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Phiếu bình xét">
      <p className="text-content">
        Phiên họp {formatDateTime(meeting.held_at)}
        {meeting.location ? `, ${meeting.location}` : ''}. Phiếu kín: chỉ bạn thấy lựa chọn của mình.
      </p>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <table className="w-full border-collapse text-content">
        <thead>
          <tr>
            {['Cá nhân, tập thể', 'Danh hiệu', 'Xếp loại KPI', 'Điểm', 'Điều kiện không đạt', 'Phiếu'].map((text) => (
              <th key={text} className="border border-border px-2 py-1 text-left">
                {text}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {meeting.nominations.map((row) => (
            <tr key={row.id}>
              <td className="border border-border px-2 py-1">{row.subject_name}</td>
              <td className="border border-border px-2 py-1">{row.title_name}</td>
              <td className="border border-border px-2 py-1">{row.kpi_rank_label ?? ''}</td>
              <td className="border border-border px-2 py-1">{row.total_score}</td>
              <td className="border border-border px-2 py-1">{row.failed_checks || ''}</td>
              <td className="border border-border px-2 py-1">
                <div role="radiogroup" aria-label={`Phiếu cho ${row.subject_name}`} className="flex flex-wrap gap-3">
                  {(Object.keys(EMULATION_VOTE_LABELS) as EmulationVoteCode[]).map((code) => (
                    <label key={code} className="flex items-center gap-1">
                      <input
                        type="radio"
                        name={`vote-${row.id}`}
                        checked={choices[row.id] === code}
                        onChange={() => setChoices((current) => ({ ...current, [row.id]: code }))}
                      />
                      {EMULATION_VOTE_LABELS[code]}
                    </label>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Actions>
        <Button
          variant="primary"
          disabled={save.isPending || Object.keys(choices).length === 0}
          onClick={() => save.mutate()}
        >
          Ghi phiếu
        </Button>
      </Actions>
    </section>
  );
}

export function VotingPage() {
  const voting = useQuery({ queryKey: ['emulation', 'voting'], queryFn: listVoting });
  const { toast, setToast, close } = useToast();
  return (
    <Page path="/emulation/voting" toast={toast} onToastClose={close}>
      {voting.error ? <Alert tone="danger">{messageOf(voting.error)}</Alert> : null}
      {voting.data?.length === 0 ? (
        <Alert tone="info">Không có phiên bỏ phiếu nào đang mở mà bạn là thành viên.</Alert>
      ) : null}
      {(voting.data ?? []).map((meeting) => (
        <Ballot key={meeting.id} meeting={meeting} onSaved={(message) => setToast(message)} />
      ))}
    </Page>
  );
}

// ---- 3.3. Phúc khảo, khiếu nại ----

export function AppealsPage() {
  const queryClient = useQueryClient();
  const overview = useOverview();
  const manage = overview.data?.can_manage ?? false;
  const grid = useGridSettings('emulation-appeals');
  const { toast, setToast, close } = useToast();
  const [view, setView] = useState<'mine' | 'all'>('mine');
  const choice = useCampaignChoice(['published']);
  const [content, setContent] = useState('');
  const [responses, setResponses] = useState<Record<string, string>>({});
  const appeals = useQuery({ queryKey: ['emulation', 'appeals', view], queryFn: () => listAppeals(view) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['emulation'] });
  const send = useMutation({
    mutationFn: (kind: EmulationAppealKindCode) =>
      submitAppeal({ campaign_id: choice.id, nomination_id: null, kind, content }),
    onSuccess: async () => {
      setContent('');
      await refresh();
      setToast('Đã gửi khiếu nại');
    },
  });
  const resolve = useMutation({
    mutationFn: (input: { id: string; accept: boolean }) =>
      resolveAppeal(input.id, input.accept, responses[input.id] ?? ''),
    onSuccess: async (row) => {
      await refresh();
      setToast(`Đã giải quyết: ${EMULATION_APPEAL_STATUS_LABELS[row.status]}`);
    },
  });
  const columns: Array<DataGridColumn<EmulationAppeal>> = [
    { id: 'kind', header: 'Loại', cell: (row) => EMULATION_APPEAL_KIND_LABELS[row.kind] },
    {
      id: 'subject',
      header: 'Hồ sơ',
      cell: (row) => (row.subject_name ? `${row.subject_name} – ${row.title_name}` : ''),
    },
    { id: 'content', header: 'Nội dung', alwaysVisible: true, cell: (row) => row.content },
    { id: 'by', header: 'Người gửi', cell: (row) => row.submitted_by_name },
    { id: 'deadline', header: 'Hạn', cell: (row) => formatDate(row.deadline) },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => (
        <StatusBadge
          tone={row.status === 'pending' ? 'info' : row.status === 'accepted' ? 'success' : 'warning'}
          label={EMULATION_APPEAL_STATUS_LABELS[row.status]}
        />
      ),
    },
    { id: 'response', header: 'Trả lời', cell: (row) => row.response ?? '' },
  ];
  return (
    <Page path="/emulation/appeals" toast={toast} onToastClose={close}>
      {manage ? (
        <Tabs<'mine' | 'all'>
          label="Phúc khảo, khiếu nại"
          value={view}
          options={[
            { value: 'mine', label: 'Tôi đã gửi' },
            { value: 'all', label: 'Cần giải quyết' },
          ]}
          onChange={setView}
        />
      ) : null}
      {choice.campaign ? (
        <FormBlock
          title={`Khiếu nại về đợt ${choice.campaign.name} (đến hết ngày ${formatDate(choice.campaign.appeal_deadline)})`}
        >
          {send.error ? <Alert tone="danger">{messageOf(send.error)}</Alert> : null}
          <p className="text-content text-text-secondary">
            Phúc khảo kết quả của hồ sơ gửi ở chi tiết hồ sơ (mục 2.1).
          </p>
          <FormRow label="Nội dung khiếu nại">
            <textarea className={textareaClass} value={content} onChange={(event) => setContent(event.target.value)} />
          </FormRow>
          <Actions>
            <Button
              variant="secondary"
              disabled={!content.trim() || send.isPending}
              onClick={() => send.mutate('complaint')}
            >
              Gửi khiếu nại
            </Button>
          </Actions>
        </FormBlock>
      ) : null}
      {appeals.error ? <Alert tone="danger">{messageOf(appeals.error)}</Alert> : null}
      {resolve.error ? <Alert tone="danger">{messageOf(resolve.error)}</Alert> : null}
      <DataGrid
        label="Phúc khảo, khiếu nại"
        columns={columns}
        rows={appeals.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.content}
        loading={!appeals.data && !appeals.error}
        emptyText="Không có phúc khảo, khiếu nại."
        rowActions={(row) =>
          manage && view === 'all' && row.status === 'pending' ? (
            <span className="flex flex-wrap items-center gap-2">
              <input
                aria-label={`Trả lời ${row.submitted_by_name}`}
                className={FORM_CONTROL_CLASS}
                value={responses[row.id] ?? ''}
                onChange={(event) => setResponses((current) => ({ ...current, [row.id]: event.target.value }))}
              />
              <Button variant="text" onClick={() => resolve.mutate({ id: row.id, accept: true })}>
                Chấp nhận
              </Button>
              <Button variant="text" onClick={() => resolve.mutate({ id: row.id, accept: false })}>
                Không chấp nhận
              </Button>
            </span>
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </Page>
  );
}

// ---- 4.1. Quyết định khen thưởng ----

function DecisionForm({ onDone, onCancel }: { onDone(id: string, message: string): void; onCancel(): void }) {
  const choice = useCampaignChoice(['published']);
  const titles = useTitles();
  const [kind, setKind] = useState<'decision' | 'proposal'>('decision');
  const [title, setTitle] = useState('Quyết định công nhận danh hiệu thi đua, khen thưởng');
  const [basis, setBasis] = useState(
    'Căn cứ Luật Thi đua, khen thưởng;\nCăn cứ biên bản họp Hội đồng thi đua, khen thưởng của trường;',
  );
  const [signer, setSigner] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const passed = useQuery({
    queryKey: ['emulation', 'nominations', 'review', choice.id, 'passed'],
    queryFn: () => listNominations({ view: 'review', campaign_id: choice.id, status: 'passed' }),
    enabled: choice.id !== '',
  });
  const level = kind === 'decision' ? 'school' : 'upper';
  const rows = (passed.data ?? []).filter(
    (row) => titles.data?.find((item) => item.id === row.title_id)?.decision_level === level,
  );
  const save = useMutation({
    mutationFn: () =>
      saveDecision(null, {
        campaign_id: choice.id,
        kind,
        title,
        basis: nullable(basis),
        signer_name: nullable(signer),
        signer_title: null,
        nomination_ids: selected,
      }),
    onSuccess: (saved) => onDone(saved.id, `Đã lập ${EMULATION_DECISION_KIND_LABELS[saved.kind].toLowerCase()}`),
  });
  const errors = fieldErrorsOf(save.error);
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Lập quyết định khen thưởng"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <CampaignSelect value={choice.id} onChange={choice.setChosen} statuses={['published']} />
      <FormRow label="Loại">
        <select
          className={FORM_CONTROL_CLASS}
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as 'decision' | 'proposal');
            setSelected([]);
          }}
        >
          {Object.entries(EMULATION_DECISION_KIND_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </FormRow>
      <FormRow label="Trích yếu" error={errors.title}>
        <input className={FORM_CONTROL_CLASS} value={title} onChange={(event) => setTitle(event.target.value)} />
      </FormRow>
      <FormRow label="Căn cứ">
        <textarea className={textareaClass} value={basis} onChange={(event) => setBasis(event.target.value)} />
      </FormRow>
      <FormRow label="Người ký">
        <input className={FORM_CONTROL_CLASS} value={signer} onChange={(event) => setSigner(event.target.value)} />
      </FormRow>
      <FormBlock title="Hồ sơ được hội đồng thông qua">
        {errors.nomination_ids ? <Alert tone="danger">{errors.nomination_ids}</Alert> : null}
        {rows.length === 0 ? <p className="text-content text-text-secondary">Không có hồ sơ phù hợp.</p> : null}
        {rows.map((row) => (
          <label key={row.id} className="flex items-center gap-2 text-content">
            <input
              type="checkbox"
              checked={selected.includes(row.id)}
              onChange={(event) =>
                setSelected(event.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))
              }
            />
            {row.subject_name} – {row.title_name}
          </label>
        ))}
      </FormBlock>
      <Actions>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Lập
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Hủy
        </Button>
      </Actions>
    </form>
  );
}

function DecisionPanel({ id, onChanged }: { id: string; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const overview = useOverview();
  const detail = useQuery({ queryKey: ['emulation', 'decision', id], queryFn: () => readDecision(id) });
  const [number, setNumber] = useState('');
  const [issueDate, setIssueDate] = useState(todayText());
  const [upper, setUpper] = useState({ number: '', date: todayText(), issuer: '' });
  const [awarded, setAwarded] = useState<string[]>([]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['emulation'] });
  const outgoing = useMutation({
    mutationFn: () => createOutgoingDraft(id),
    onSuccess: async () => {
      await refresh();
      onChanged('Đã tạo dự thảo văn bản đi; trình ký, cấp số, phát hành ở phân hệ Văn bản đi');
    },
  });
  const issue = useMutation({
    mutationFn: () => issueDecision(id, { number: nullable(number), issue_date: issueDate || null }),
    onSuccess: async (saved) => {
      await refresh();
      onChanged(`Đã ban hành số ${saved.number}`);
    },
  });
  const result = useMutation({
    mutationFn: () => recordUpperResult(id, { ...upper, awarded_ids: awarded }),
    onSuccess: async () => {
      await refresh();
      onChanged('Đã ghi kết quả của cấp trên');
    },
  });
  const file = useMutation({ mutationFn: (format: 'pdf' | 'docx') => downloadDecision(id, format) });
  const certificate = useMutation({ mutationFn: (awardId: string) => downloadCertificate(awardId) });
  const data = detail.data;
  if (detail.error) {
    return <Alert tone="danger">{messageOf(detail.error)}</Alert>;
  }
  if (!data) {
    return <p className="text-content">Đang tải…</p>;
  }
  const error = outgoing.error ?? issue.error ?? result.error ?? file.error ?? certificate.error;
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label={data.title}>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <table className="w-full border-collapse text-content" aria-label="Danh sách khen thưởng">
        <thead>
          <tr>
            {['Cá nhân, tập thể', 'Tổ', 'Danh hiệu', 'Trạng thái', 'Mã tra cứu', ''].map((text) => (
              <th key={text} className="border border-border px-2 py-1 text-left">
                {text}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line) => (
            <tr key={line.id}>
              <td className="border border-border px-2 py-1">{line.subject_name}</td>
              <td className="border border-border px-2 py-1">{line.department ?? ''}</td>
              <td className="border border-border px-2 py-1">{line.title_name}</td>
              <td className="border border-border px-2 py-1">{line.status_label}</td>
              <td className="border border-border px-2 py-1">{line.award?.lookup_code ?? ''}</td>
              <td className="border border-border px-2 py-1">
                {line.award ? (
                  <Button variant="text" onClick={() => line.award && certificate.mutate(line.award.id)}>
                    Tải giấy khen
                  </Button>
                ) : data.kind === 'proposal' && data.status === 'issued' && !data.upper_number ? (
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={awarded.includes(line.id)}
                      onChange={(event) =>
                        setAwarded(
                          event.target.checked ? [...awarded, line.id] : awarded.filter((item) => item !== line.id),
                        )
                      }
                    />
                    Được cấp trên khen
                  </label>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.outgoing ? (
        <p className="text-content">
          Văn bản đi: {data.outgoing.summary} (
          {data.outgoing.status === 'issued' ? `đã phát hành, số ${data.outgoing.symbol}` : 'chưa phát hành'}).
        </p>
      ) : null}
      <Actions>
        <Button variant="secondary" onClick={() => file.mutate('docx')}>
          Tải dự thảo (Word)
        </Button>
        <Button variant="secondary" onClick={() => file.mutate('pdf')}>
          Tải dự thảo (PDF)
        </Button>
        {data.status === 'draft' && !data.outgoing && overview.data?.can_draft_outgoing ? (
          <Button variant="secondary" disabled={outgoing.isPending} onClick={() => outgoing.mutate()}>
            Tạo dự thảo văn bản đi
          </Button>
        ) : null}
      </Actions>
      {data.status === 'draft' && data.can_decide ? (
        <FormBlock title="Ban hành">
          <p className="text-content text-text-secondary">
            Văn bản đi đã phát hành thì số, ngày lấy theo văn bản đi; không thì nhập tay.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-label font-medium text-text">
              Số, ký hiệu
              <input
                className={FORM_CONTROL_CLASS}
                value={number}
                onChange={(event) => setNumber(event.target.value)}
              />
            </label>
            <label className="text-label font-medium text-text">
              Ngày ban hành
              <input
                type="date"
                className={FORM_CONTROL_CLASS}
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
              />
            </label>
            <Button variant="primary" disabled={issue.isPending} onClick={() => issue.mutate()}>
              Ban hành
            </Button>
          </div>
        </FormBlock>
      ) : null}
      {data.kind === 'proposal' && data.status === 'issued' && !data.upper_number ? (
        <FormBlock title="Kết quả của cấp trên">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-label font-medium text-text">
              Số quyết định
              <input
                className={FORM_CONTROL_CLASS}
                value={upper.number}
                onChange={(event) => setUpper({ ...upper, number: event.target.value })}
              />
            </label>
            <label className="text-label font-medium text-text">
              Ngày
              <input
                type="date"
                className={FORM_CONTROL_CLASS}
                value={upper.date}
                onChange={(event) => setUpper({ ...upper, date: event.target.value })}
              />
            </label>
            <label className="text-label font-medium text-text">
              Cấp khen
              <input
                className={FORM_CONTROL_CLASS}
                value={upper.issuer}
                onChange={(event) => setUpper({ ...upper, issuer: event.target.value })}
              />
            </label>
            <Button variant="primary" disabled={result.isPending} onClick={() => result.mutate()}>
              Ghi kết quả
            </Button>
          </div>
        </FormBlock>
      ) : null}
    </section>
  );
}

export function DecisionsPage() {
  const queryClient = useQueryClient();
  const overview = useOverview();
  const grid = useGridSettings('emulation-decisions');
  const { toast, setToast, close } = useToast();
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<string>();
  const [deleting, setDeleting] = useState<EmulationDecision>();
  const decisions = useQuery({ queryKey: ['emulation', 'decisions'], queryFn: listDecisions });
  const remove = useMutation({
    mutationFn: (row: EmulationDecision) => deleteDecision(row.id),
    onSuccess: async () => {
      setDeleting(undefined);
      await queryClient.invalidateQueries({ queryKey: ['emulation'] });
      setToast('Đã xóa dự thảo');
    },
    onError: () => setDeleting(undefined),
  });
  const columns: Array<DataGridColumn<EmulationDecision>> = [
    { id: 'kind', header: 'Loại', cell: (row) => EMULATION_DECISION_KIND_LABELS[row.kind] },
    { id: 'title', header: 'Trích yếu', alwaysVisible: true, className: 'font-medium', cell: (row) => row.title },
    { id: 'campaign', header: 'Đợt', cell: (row) => row.campaign_name },
    { id: 'count', header: 'Số hồ sơ', cell: (row) => row.nomination_count },
    { id: 'number', header: 'Số, ký hiệu', cell: (row) => row.number ?? '' },
    { id: 'date', header: 'Ngày ban hành', cell: (row) => formatDate(row.issue_date) },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => (
        <StatusBadge
          tone={row.status === 'issued' ? 'success' : 'neutral'}
          label={row.status === 'issued' ? 'Đã ban hành' : 'Dự thảo'}
        />
      ),
    },
  ];
  return (
    <Page path="/emulation/decisions" toast={toast} onToastClose={close}>
      {decisions.error ? <Alert tone="danger">{messageOf(decisions.error)}</Alert> : null}
      {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      {creating ? (
        <DecisionForm
          onCancel={() => setCreating(false)}
          onDone={async (id, message) => {
            setCreating(false);
            await queryClient.invalidateQueries({ queryKey: ['emulation'] });
            setActiveId(id);
            setToast(message);
          }}
        />
      ) : null}
      <DataGrid
        label="Quyết định khen thưởng, tờ trình"
        columns={columns}
        rows={decisions.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.title}
        loading={!decisions.data && !decisions.error}
        emptyText="Chưa có quyết định."
        toolbar={
          overview.data?.can_manage ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Lập quyết định, tờ trình
            </Button>
          ) : null
        }
        rowActions={(row) =>
          row.status === 'draft' && overview.data?.can_manage ? (
            <Button variant="text" onClick={() => setDeleting(row)}>
              Xóa
            </Button>
          ) : null
        }
        onRowClick={(row) => setActiveId(activeId === row.id ? undefined : row.id)}
        activeRowId={activeId}
        renderRowDetail={(row) =>
          activeId === row.id ? <DecisionPanel id={row.id} onChanged={(message) => setToast(message)} /> : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      <ConfirmDeleteDialog
        open={deleting !== undefined}
        subject={deleting?.title ?? ''}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onCancel={() => setDeleting(undefined)}
      />
    </Page>
  );
}

// ---- 5.1. Sổ theo dõi khen thưởng ----

function ManualAwardForm({ onDone, onCancel }: { onDone(message: string): void; onCancel(): void }) {
  const overview = useOverview();
  const titles = useTitles();
  const [value, setValue] = useState({
    year_name: '',
    title_code: '',
    target: 'individual' as EmulationTargetCode,
    subject_id: '',
    decision_number: '',
    decision_date: '',
    issuer: '',
    note: '',
  });
  const title = titles.data?.find((row) => row.code === value.title_code);
  const save = useMutation({
    mutationFn: () =>
      addManualAward({
        year_name: value.year_name,
        title_code: value.title_code,
        title_name: title?.name ?? value.title_code,
        title_kind: title?.kind ?? 'title',
        target: value.target,
        staff_id: value.target === 'individual' ? value.subject_id || null : null,
        department_id: value.target === 'collective' ? value.subject_id || null : null,
        decision_number: nullable(value.decision_number),
        decision_date: value.decision_date || null,
        issuer: nullable(value.issuer),
        note: nullable(value.note),
      }),
    onSuccess: (row) => onDone(`Đã nhập ${row.title_name} năm học ${row.year_name} cho ${row.subject_name}`),
  });
  const errors = fieldErrorsOf(save.error);
  const set = (patch: Partial<typeof value>) => setValue((current) => ({ ...current, ...patch }));
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Nhập khen thưởng năm trước"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormRow label="Năm học (ví dụ 2024-2025)" error={errors.year_name}>
        <input
          className={FORM_CONTROL_CLASS}
          value={value.year_name}
          onChange={(event) => set({ year_name: event.target.value })}
        />
      </FormRow>
      <FormRow label="Danh hiệu, hình thức" error={errors.title_code}>
        <select
          className={FORM_CONTROL_CLASS}
          value={value.title_code}
          onChange={(event) => {
            const next = titles.data?.find((row) => row.code === event.target.value);
            set({ title_code: event.target.value, target: next?.target ?? 'individual', subject_id: '' });
          }}
        >
          <option value="">Chọn danh hiệu</option>
          {(titles.data ?? []).map((row) => (
            <option key={row.id} value={row.code}>
              {row.name}
            </option>
          ))}
        </select>
      </FormRow>
      <FormRow
        label={value.target === 'individual' ? 'Cá nhân' : 'Tập thể (tổ)'}
        error={errors.staff_id ?? errors.department_id}
      >
        <select
          className={FORM_CONTROL_CLASS}
          value={value.subject_id}
          onChange={(event) => set({ subject_id: event.target.value })}
        >
          <option value="">Chọn</option>
          {value.target === 'individual'
            ? (overview.data?.staff ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.full_name} ({row.code})
                </option>
              ))
            : (overview.data?.departments ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
        </select>
      </FormRow>
      <FormRow label="Số quyết định">
        <input
          className={FORM_CONTROL_CLASS}
          value={value.decision_number}
          onChange={(event) => set({ decision_number: event.target.value })}
        />
      </FormRow>
      <FormRow label="Ngày quyết định" error={errors.decision_date}>
        <input
          type="date"
          className={FORM_CONTROL_CLASS}
          value={value.decision_date}
          onChange={(event) => set({ decision_date: event.target.value })}
        />
      </FormRow>
      <FormRow label="Cấp khen">
        <input
          className={FORM_CONTROL_CLASS}
          value={value.issuer}
          onChange={(event) => set({ issuer: event.target.value })}
        />
      </FormRow>
      <Actions>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Hủy
        </Button>
      </Actions>
    </form>
  );
}

export function HistoryPage() {
  const queryClient = useQueryClient();
  const overview = useOverview();
  const titles = useTitles();
  const grid = useGridSettings('emulation-history');
  const { toast, setToast, close } = useToast();
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState('');
  const [titleCode, setTitleCode] = useState('');
  const [adding, setAdding] = useState(false);
  const filter = { q: search || undefined, target: target || undefined, title_code: titleCode || undefined };
  const history = useQuery({ queryKey: ['emulation', 'history', filter], queryFn: () => listHistory(filter) });
  const file = useMutation({ mutationFn: () => exportHistory(filter) });
  const certificate = useMutation({ mutationFn: (id: string) => downloadCertificate(id) });
  const remove = useMutation({
    mutationFn: (row: AwardRow) => deleteManualAward(row.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['emulation'] });
      setToast('Đã xóa khen thưởng nhập tay');
    },
  });
  // Số năm đạt từng danh hiệu của mỗi cá nhân, tập thể trong kết quả đang lọc
  const summary = useMemo(() => {
    const counts = new Map<string, Set<number>>();
    for (const row of history.data ?? []) {
      const key = `${row.subject_name} – ${row.title_name}`;
      counts.set(key, (counts.get(key) ?? new Set()).add(row.year_start));
    }
    return [...counts.entries()].filter(([, years]) => years.size > 1);
  }, [history.data]);
  const columns: Array<DataGridColumn<AwardRow>> = [
    { id: 'year', header: 'Năm học', cell: (row) => row.year_name },
    {
      id: 'subject',
      header: 'Cá nhân, tập thể',
      alwaysVisible: true,
      className: 'font-medium',
      cell: (row) => row.subject_name,
    },
    { id: 'unit', header: 'Tổ, bộ phận', cell: (row) => row.staff_department ?? row.department_name ?? '' },
    { id: 'title', header: 'Danh hiệu, hình thức', cell: (row) => row.title_name },
    { id: 'number', header: 'Số quyết định', cell: (row) => row.decision_number ?? '' },
    { id: 'date', header: 'Ngày', cell: (row) => formatDate(row.decision_date) },
    { id: 'issuer', header: 'Cấp khen', cell: (row) => row.issuer ?? '' },
    { id: 'source', header: 'Nguồn', cell: (row) => (row.source === 'manual' ? 'Nhập tay' : 'Quyết định') },
    { id: 'code', header: 'Mã tra cứu', hiddenByDefault: true, cell: (row) => row.lookup_code },
  ];
  return (
    <Page path="/emulation/history" toast={toast} onToastClose={close}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-label font-medium text-text">
          Đối tượng
          <select className={selectClass} value={target} onChange={(event) => setTarget(event.target.value)}>
            <option value="">Tất cả</option>
            {Object.entries(EMULATION_TARGET_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Danh hiệu
          <select className={selectClass} value={titleCode} onChange={(event) => setTitleCode(event.target.value)}>
            <option value="">Tất cả</option>
            {(titles.data ?? []).map((row) => (
              <option key={row.id} value={row.code}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {history.error ? <Alert tone="danger">{messageOf(history.error)}</Alert> : null}
      {(file.error ?? certificate.error ?? remove.error) ? (
        <Alert tone="danger">{messageOf(file.error ?? certificate.error ?? remove.error)}</Alert>
      ) : null}
      {adding ? (
        <ManualAwardForm
          onCancel={() => setAdding(false)}
          onDone={async (message) => {
            setAdding(false);
            await queryClient.invalidateQueries({ queryKey: ['emulation'] });
            setToast(message);
          }}
        />
      ) : null}
      {summary.length > 0 ? (
        <section className="rounded-xl border border-border bg-card p-4 text-content" aria-label="Đạt nhiều năm">
          <h2 className="font-semibold">Đạt nhiều năm</h2>
          <ul>
            {summary.map(([key, years]) => (
              <li key={key}>
                {key}: {years.size} năm ({[...years].sort().join(', ')})
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <DataGrid
        label="Sổ theo dõi khen thưởng"
        columns={columns}
        rows={history.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `${row.subject_name} – ${row.title_name} ${row.year_name}`}
        loading={!history.data && !history.error}
        emptyText="Chưa có khen thưởng."
        search={{ label: 'Tìm theo tên cá nhân, tập thể', value: search, onChange: setSearch }}
        toolbar={
          <span className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={file.isPending} onClick={() => file.mutate()}>
              Xuất Excel
            </Button>
            {overview.data?.can_manage ? (
              <Button variant="primary" onClick={() => setAdding(true)}>
                Nhập khen thưởng năm trước
              </Button>
            ) : null}
          </span>
        }
        rowActions={(row) => (
          <span className="flex gap-2">
            <Button variant="text" onClick={() => certificate.mutate(row.id)}>
              Giấy khen
            </Button>
            {row.editable ? (
              <Button variant="text" onClick={() => remove.mutate(row)}>
                Xóa
              </Button>
            ) : null}
          </span>
        )}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </Page>
  );
}

// ---- 5.2. Báo cáo đợt thi đua ----

export function ReportsPage() {
  const choice = useCampaignChoice();
  const grid = useGridSettings('emulation-report');
  const report = useQuery({
    queryKey: ['emulation', 'report', choice.id],
    queryFn: () => readCampaignReport(choice.id),
    enabled: choice.id !== '',
  });
  const file = useMutation({ mutationFn: () => exportCampaignReport(choice.id) });
  type Row = NonNullable<typeof report.data>['by_title'][number];
  const columns: Array<DataGridColumn<Row>> = [
    {
      id: 'name',
      header: 'Danh hiệu, hình thức',
      alwaysVisible: true,
      className: 'font-medium',
      cell: (row) => row.name,
    },
    { id: 'target', header: 'Đối tượng', cell: (row) => row.target_label },
    { id: 'registered', header: 'Đăng ký', cell: (row) => row.registered },
    { id: 'accepted', header: 'Đăng ký được duyệt', cell: (row) => row.registration_accepted },
    { id: 'nominated', header: 'Hồ sơ đề nghị', cell: (row) => row.nominated },
    { id: 'passed', header: 'Hội đồng thông qua', cell: (row) => row.passed },
    { id: 'failed', header: 'Không thông qua', cell: (row) => row.failed },
    { id: 'awarded', header: 'Đã khen thưởng', cell: (row) => row.awarded },
  ];
  return (
    <Page path="/emulation/reports">
      <div className="flex flex-wrap items-end gap-3">
        <CampaignSelect value={choice.id} onChange={choice.setChosen} />
        <Button variant="secondary" disabled={!choice.id || file.isPending} onClick={() => file.mutate()}>
          Xuất Excel
        </Button>
      </div>
      {(report.error ?? file.error) ? <Alert tone="danger">{messageOf(report.error ?? file.error)}</Alert> : null}
      {report.data ? (
        <p className="text-content" data-testid="emulation-report-totals">
          Cán bộ, giáo viên, nhân viên đang làm việc: {report.data.staff_count}. Phúc khảo, khiếu nại:{' '}
          {report.data.appeals.total} ({report.data.appeals.pending} chờ, {report.data.appeals.accepted} chấp nhận,{' '}
          {report.data.appeals.rejected} không chấp nhận).
        </p>
      ) : null}
      <DataGrid
        label="Kết quả theo danh hiệu"
        columns={columns}
        rows={report.data?.by_title ?? []}
        getRowId={(row) => row.title_id}
        getRowLabel={(row) => row.name}
        loading={choice.id !== '' && !report.data && !report.error}
        emptyText="Chọn đợt thi đua."
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </Page>
  );
}

// ---- 6.1. Danh hiệu và hình thức khen thưởng ----

// Tiêu chí nhập mỗi dòng: "mã | tên | trọng số | điểm tối đa"
const criteriaText = (criteria: EmulationCriterion[]) =>
  criteria.map((item) => [item.code, item.title, item.weight, item.max_score].join(' | ')).join('\n');
const parseCriteria = (text: string): EmulationCriterion[] =>
  text
    .split('\n')
    .map((line) => line.split('|').map((part) => part.trim()))
    .filter((parts) => parts[0])
    .map(([code, title, weight, max]) => ({
      code: code ?? '',
      title: title ?? '',
      weight: Number(weight ?? 0),
      max_score: Number(max ?? 0),
    }));
const numberOrNull = (text: string) => (text.trim() === '' ? null : Number(text.replace(',', '.')));

function TitleForm({
  title,
  onDone,
  onCancel,
}: {
  title: EmulationTitle | null;
  onDone(message: string): void;
  onCancel(): void;
}) {
  const [value, setValue] = useState({
    code: title?.code ?? '',
    name: title?.name ?? '',
    description: title?.description ?? '',
    kind: title?.kind ?? 'title',
    target: title?.target ?? 'individual',
    decision_level: title?.decision_level ?? 'school',
    min_kpi_rank: title?.min_kpi_rank ?? '',
    requires_initiative: title?.requires_initiative ?? false,
    prerequisite_code: title?.prerequisite_code ?? '',
    consecutive_years: String(title?.consecutive_years ?? 0),
    quota_percent: title?.quota_percent ?? '',
    quota_base_code: title?.quota_base_code ?? '',
    vote_threshold_percent: title?.vote_threshold_percent ?? '50',
    min_score: title?.min_score ?? '',
    criteria: criteriaText(title?.criteria ?? []),
    sort_order: String(title?.sort_order ?? 0),
    status: title?.status ?? 'active',
  });
  const save = useMutation({
    mutationFn: () =>
      saveTitle(title?.id ?? null, {
        code: value.code,
        name: value.name,
        description: nullable(value.description),
        kind: value.kind,
        target: value.target,
        decision_level: value.decision_level,
        min_kpi_rank: nullable(value.min_kpi_rank),
        requires_initiative: value.requires_initiative,
        prerequisite_code: nullable(value.prerequisite_code),
        consecutive_years: Number(value.consecutive_years || 0),
        quota_percent: numberOrNull(value.quota_percent),
        quota_base_code: nullable(value.quota_base_code),
        vote_threshold_percent: numberOrNull(value.vote_threshold_percent) ?? 50,
        min_score: numberOrNull(value.min_score),
        criteria: parseCriteria(value.criteria),
        sort_order: Number(value.sort_order || 0),
        status: value.status,
      } satisfies TitleInput),
    onSuccess: (saved) => onDone(`Đã ghi ${saved.name}`),
  });
  const errors = fieldErrorsOf(save.error);
  const criteriaError = Object.entries(errors).find(([key]) => key.startsWith('criteria'))?.[1];
  const set = (patch: Partial<typeof value>) => setValue((current) => ({ ...current, ...patch }));
  const text = (label: string, key: keyof typeof value, field?: string) => (
    <FormRow label={label} error={errors[field ?? key]}>
      <input
        className={FORM_CONTROL_CLASS}
        value={String(value[key])}
        onChange={(event) => set({ [key]: event.target.value })}
      />
    </FormRow>
  );
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-label="Danh hiệu, hình thức khen thưởng"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thông tin">
        {text('Mã', 'code')}
        {text('Tên', 'name')}
        <FormRow label="Tiêu chuẩn, mô tả">
          <textarea
            className={textareaClass}
            value={value.description}
            onChange={(event) => set({ description: event.target.value })}
          />
        </FormRow>
        <FormRow label="Loại">
          <select
            className={FORM_CONTROL_CLASS}
            value={value.kind}
            onChange={(event) => set({ kind: event.target.value as 'title' })}
          >
            {Object.entries(EMULATION_KIND_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Đối tượng">
          <select
            className={FORM_CONTROL_CLASS}
            value={value.target}
            onChange={(event) => set({ target: event.target.value as EmulationTargetCode })}
          >
            {Object.entries(EMULATION_TARGET_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Cấp quyết định">
          <select
            className={FORM_CONTROL_CLASS}
            value={value.decision_level}
            onChange={(event) => set({ decision_level: event.target.value as 'school' })}
          >
            {Object.entries(EMULATION_LEVEL_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </FormRow>
      </FormBlock>
      <FormBlock title="Điều kiện">
        {text('Mức xếp loại KPI tối thiểu (mã của bộ quy tắc: excellent, good, pass)', 'min_kpi_rank')}
        <label className="flex items-center gap-2 text-content">
          <input
            type="checkbox"
            checked={value.requires_initiative}
            onChange={(event) => set({ requires_initiative: event.target.checked })}
          />
          Cần sáng kiến, giải pháp
        </label>
        {text('Danh hiệu tiền đề (mã)', 'prerequisite_code')}
        {text('Số năm liên tục đạt danh hiệu tiền đề', 'consecutive_years')}
        {text('Tỉ lệ tối đa (%)', 'quota_percent')}
        {text('Danh hiệu làm gốc tính tỉ lệ (mã)', 'quota_base_code')}
        {text('Tỉ lệ phiếu đồng ý tối thiểu (%)', 'vote_threshold_percent')}
        {text('Điểm tiêu chí tối thiểu (thang 100)', 'min_score')}
      </FormBlock>
      <FormBlock title="Tiêu chí, trọng số">
        <FormRow label="Mỗi dòng: mã | tên tiêu chí | trọng số | điểm tối đa" error={criteriaError}>
          <textarea
            className={`${FORM_CONTROL_CLASS} min-h-32`}
            value={value.criteria}
            onChange={(event) => set({ criteria: event.target.value })}
          />
        </FormRow>
      </FormBlock>
      <FormBlock title="Hiển thị">
        {text('Thứ tự', 'sort_order')}
        <FormRow label="Trạng thái">
          <select
            className={FORM_CONTROL_CLASS}
            value={value.status}
            onChange={(event) => set({ status: event.target.value as 'active' | 'inactive' })}
          >
            <option value="active">Đang dùng</option>
            <option value="inactive">Ngừng dùng</option>
          </select>
        </FormRow>
      </FormBlock>
      <Actions>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Hủy
        </Button>
      </Actions>
    </form>
  );
}

export function TitlesPage() {
  const queryClient = useQueryClient();
  const overview = useOverview();
  const grid = useGridSettings('emulation-titles');
  const { toast, setToast, close } = useToast();
  const [editing, setEditing] = useState<EmulationTitle | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<EmulationTitle>();
  const titles = useQuery({ queryKey: ['emulation', 'titles', 'all'], queryFn: () => listTitles(true) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['emulation'] });
  const defaults = useMutation({
    mutationFn: loadDefaultTitles,
    onSuccess: async (result) => {
      await refresh();
      setToast(`Đã nạp ${result.created} danh hiệu, bỏ qua ${result.skipped} đã có`);
    },
  });
  const remove = useMutation({
    mutationFn: (row: EmulationTitle) => deleteTitle(row.id),
    onSuccess: async (_result, row) => {
      setDeleting(undefined);
      await refresh();
      setToast(`Đã xóa ${row.name}`);
    },
    onError: () => setDeleting(undefined),
  });
  const manage = overview.data?.can_manage ?? false;
  const columns: Array<DataGridColumn<EmulationTitle>> = [
    { id: 'code', header: 'Mã', cell: (row) => row.code },
    { id: 'name', header: 'Tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
    { id: 'kind', header: 'Loại', cell: (row) => EMULATION_KIND_LABELS[row.kind] },
    { id: 'target', header: 'Đối tượng', cell: (row) => EMULATION_TARGET_LABELS[row.target] },
    { id: 'level', header: 'Cấp quyết định', cell: (row) => EMULATION_LEVEL_LABELS[row.decision_level] },
    { id: 'kpi', header: 'KPI tối thiểu', cell: (row) => row.min_kpi_rank ?? '' },
    {
      id: 'consecutive',
      header: 'Năm liên tục',
      cell: (row) => (row.prerequisite_code ? `${row.consecutive_years} năm ${row.prerequisite_code}` : ''),
    },
    {
      id: 'quota',
      header: 'Tỉ lệ tối đa',
      cell: (row) => (row.quota_percent ? `${Number(row.quota_percent)}% ${row.quota_base_code}` : ''),
    },
    { id: 'vote', header: 'Phiếu tối thiểu', cell: (row) => `${Number(row.vote_threshold_percent)}%` },
    { id: 'criteria', header: 'Số tiêu chí', cell: (row) => row.criteria.length },
    { id: 'revision', header: 'Phiên bản', hiddenByDefault: true, cell: (row) => row.revision },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => (
        <StatusBadge
          tone={row.status === 'active' ? 'success' : 'neutral'}
          label={row.status === 'active' ? 'Đang dùng' : 'Ngừng dùng'}
        />
      ),
    },
  ];
  return (
    <Page path="/emulation/titles" toast={toast} onToastClose={close}>
      {titles.error ? <Alert tone="danger">{messageOf(titles.error)}</Alert> : null}
      {(defaults.error ?? remove.error) ? (
        <Alert tone="danger">{messageOf(defaults.error ?? remove.error)}</Alert>
      ) : null}
      {editing !== undefined ? (
        <TitleForm
          key={editing?.id ?? 'new'}
          title={editing}
          onCancel={() => setEditing(undefined)}
          onDone={async (message) => {
            setEditing(undefined);
            await refresh();
            setToast(message);
          }}
        />
      ) : null}
      <DataGrid
        label="Danh hiệu và hình thức khen thưởng"
        columns={columns}
        rows={titles.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        loading={!titles.data && !titles.error}
        emptyText="Chưa có danh mục; bấm Nạp danh mục mặc định."
        toolbar={
          manage ? (
            <span className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => setEditing(null)}>
                Thêm danh hiệu
              </Button>
              <Button variant="secondary" disabled={defaults.isPending} onClick={() => defaults.mutate()}>
                Nạp danh mục mặc định
              </Button>
            </span>
          ) : null
        }
        rowActions={(row) =>
          manage ? (
            <span className="flex gap-2">
              <Button variant="text" onClick={() => setEditing(row)}>
                Sửa
              </Button>
              {row.nomination_count === 0 ? (
                <Button variant="text" onClick={() => setDeleting(row)}>
                  Xóa
                </Button>
              ) : null}
            </span>
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      <ConfirmDeleteDialog
        open={deleting !== undefined}
        subject={deleting?.name ?? ''}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onCancel={() => setDeleting(undefined)}
      />
    </Page>
  );
}

// ---- Trang tra cứu giấy khen công khai ----

function initialCode(): string {
  return new URLSearchParams(window.location.search).get('ma')?.trim().toUpperCase() ?? '';
}

export function VerifyAwardPage() {
  const [input, setInput] = useState(initialCode);
  const [code, setCode] = useState(initialCode);
  const result = useQuery({
    queryKey: ['emulation-verify', code],
    queryFn: () => verifyAward(code),
    enabled: code.length > 0,
    retry: false,
  });
  const data = result.data;
  const row = (label: string, value: string | null | undefined) => (
    <div className="grid grid-cols-1 gap-1 border-b border-border py-2 md:grid-cols-[12rem_1fr]">
      <dt className="text-label font-medium text-text-secondary">{label}</dt>
      <dd className="break-all text-content text-text">{value ?? ''}</dd>
    </div>
  );
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 bg-page p-4">
      <h1 className="text-page-title font-bold text-text">Tra cứu khen thưởng</h1>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setCode(input.trim().toUpperCase());
        }}
      >
        <label className="flex flex-col gap-1 text-label font-medium text-text">
          Mã tra cứu
          <input className={FORM_CONTROL_CLASS} value={input} onChange={(event) => setInput(event.target.value)} />
        </label>
        <Button type="submit" variant="primary">
          Tra cứu
        </Button>
      </form>
      {result.error ? <Alert tone="danger">{messageOf(result.error)}</Alert> : null}
      {data ? (
        <section aria-label="Kết quả tra cứu" className="rounded-xl border border-border bg-card p-4">
          <Alert tone="success">Khen thưởng có trong sổ của trường</Alert>
          <dl>
            {row('Trường', data.school_name)}
            {row(data.target_label, data.subject_name)}
            {row(data.kind_label, data.title_name)}
            {row('Năm học', data.year_name)}
            {row('Số quyết định', data.decision_number)}
            {row('Ngày quyết định', formatDate(data.decision_date))}
            {row('Cấp khen', data.issuer)}
          </dl>
        </section>
      ) : null}
    </main>
  );
}
