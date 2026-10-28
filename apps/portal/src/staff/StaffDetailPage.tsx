import { useCallback, useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { StaffPayItemsSection } from '../payroll/StaffPayItemsSection.js';
import { readStaffPayItems } from '../payroll/payroll-api.js';
import { MoetProfileSection } from '../imports/MoetProfileSection.js';
import { WorkHistorySection } from './WorkHistorySection.js';
import { readWorkHistory } from '../work/work-api.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  StatusBadge,
  TextField,
  Toast,
} from '@school-management/ui';
import { listDepartments, listJobTitles } from '../catalogs/catalogs-api.js';
import { formatMoney } from '../fees/fees-api.js';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  CONTRACT_TYPE_LABELS,
  createContract,
  linkAccount,
  readStaff,
  STAFF_STATUS_LABELS,
  terminateContract,
  unlinkAccount,
  updateStaffProfile,
  type ContractType,
  type StaffDetail,
} from './staff-api.js';
import { StaffProfileForm, staffProfileValues } from './StaffProfileForm.js';

// Trang hồ sơ cán bộ, giáo viên `/staff/$staffId` (MH-12; P07-01, P07-02; YCTD-58, YCTD-112; tách khỏi khung dưới dòng của
// lưới ở YCTD-309): đầu trang có họ tên, chức danh, phòng ban và nút quay lại danh sách; mỗi phần một thẻ, thẻ đang mở
// lưu ở `?tab=`. Thẻ Hợp đồng chỉ hiện với người xem được hợp đồng (BR-46, máy chủ trả `contracts` là null); thẻ Lương và
// phụ cấp, Quá trình công tác ẩn khi máy chủ từ chối quyền xem
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';

// Thông tin riêng của trường: mã nhân sự, phòng ban, chức danh, ngày vào làm; đơn vị chính không đổi ở đây
function SchoolInfoForm({
  staff,
  editable,
  onSaved,
}: {
  staff: StaffDetail;
  editable: boolean;
  onSaved(message: string): void;
}) {
  const departments = useQuery({
    queryKey: ['departments', staff.org_unit_id],
    queryFn: () => listDepartments(staff.org_unit_id),
  });
  const jobTitles = useQuery({
    queryKey: ['job-titles', staff.org_unit_id],
    queryFn: () => listJobTitles(staff.org_unit_id),
  });
  const initial = {
    code: staff.code,
    department_id: staff.department_id ?? '',
    job_title_id: staff.job_title_id ?? '',
    start_date: staff.start_date,
  };
  const [values, setValues] = useState(initial);
  const [notice, setNotice] = useState<string>();
  const save = useMutation({
    mutationFn: async () => {
      const changes = Object.fromEntries(
        (Object.keys(initial) as Array<keyof typeof initial>)
          .filter((key) => values[key] !== initial[key])
          .map((key) => [key, values[key] || null]),
      );
      if (Object.keys(changes).length === 0) {
        return false;
      }
      await updateStaffProfile(staff.id, changes);
      return true;
    },
    onSuccess: (changed) =>
      changed ? onSaved('Đã ghi thông tin riêng của trường') : setNotice('Không có thông tin nào thay đổi'),
  });
  const errors =
    save.error instanceof ApiError
      ? Object.fromEntries(save.error.details.map((detail) => [detail.field, detail.message]))
      : {};
  const options = <Item extends { id: string; name: string; status: string }>(
    items: Item[] | undefined,
    current: string,
  ) =>
    (items ?? [])
      .filter((item) => item.status === 'active' || item.id === current)
      .map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ));
  return (
    <form
      noValidate
      aria-label="Thông tin riêng của trường"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setNotice(undefined);
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      {notice ? <Alert tone="info">{notice}</Alert> : null}
      <FormBlock title="Thông tin của trường">
        <FormRow label="Mã nhân sự" error={errors.code}>
          <input
            value={values.code}
            disabled={!editable}
            onChange={(event) => setValues({ ...values, code: event.target.value })}
            className={FORM_CONTROL_CLASS}
          />
        </FormRow>
        <FormRow label="Đơn vị">
          <span className="text-content">{staff.unit_name}</span>
        </FormRow>
        <FormRow label="Phòng ban" error={errors.department_id}>
          <select
            value={values.department_id}
            disabled={!editable}
            onChange={(event) => setValues({ ...values, department_id: event.target.value })}
            className={FORM_CONTROL_CLASS}
          >
            <option value="">Không chọn</option>
            {options(departments.data, initial.department_id)}
          </select>
        </FormRow>
        <FormRow label="Chức danh" error={errors.job_title_id}>
          <select
            value={values.job_title_id}
            disabled={!editable}
            onChange={(event) => setValues({ ...values, job_title_id: event.target.value })}
            className={FORM_CONTROL_CLASS}
          >
            <option value="">Không chọn</option>
            {options(jobTitles.data, initial.job_title_id)}
          </select>
        </FormRow>
        <FormRow label="Ngày vào làm" error={errors.start_date}>
          <input
            type="date"
            value={values.start_date}
            disabled={!editable}
            onChange={(event) => setValues({ ...values, start_date: event.target.value })}
            className={FORM_CONTROL_CLASS}
          />
        </FormRow>
        {staff.end_date ? (
          <FormRow label="Ngày nghỉ việc">
            <span className="text-content">{staff.end_date}</span>
          </FormRow>
        ) : null}
        {editable ? (
          <div>
            <Button type="submit" variant="primary" disabled={save.isPending}>
              Ghi
            </Button>
          </div>
        ) : null}
      </FormBlock>
    </form>
  );
}

// Tài khoản đăng nhập liên kết với hồ sơ
function AccountSection({
  staff,
  editable,
  onChanged,
}: {
  staff: StaffDetail;
  editable: boolean;
  onChanged(message: string): Promise<void>;
}) {
  const [login, setLogin] = useState('');
  const action = useMutation({
    mutationFn: async (kind: 'link' | 'unlink'): Promise<string> => {
      if (kind === 'link') {
        await linkAccount(staff.id, login);
        return 'Đã liên kết tài khoản';
      }
      await unlinkAccount(staff.id);
      return 'Đã bỏ liên kết tài khoản';
    },
    onSuccess: onChanged,
  });
  return (
    <section className="flex flex-col gap-2" aria-label="Tài khoản đăng nhập">
      {action.error ? <Alert tone="danger">{messageOf(action.error)}</Alert> : null}
      <div className="flex flex-wrap items-end gap-2">
        <span className="text-content">Tài khoản: {staff.has_account ? 'đã liên kết' : 'chưa liên kết'}</span>
        {editable && !staff.has_account ? (
          <>
            <TextField
              label="Tên đăng nhập hoặc số điện thoại"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
            />
            <Button disabled={action.isPending} onClick={() => action.mutate('link')}>
              Liên kết tài khoản
            </Button>
          </>
        ) : null}
        {editable && staff.has_account ? (
          <Button variant="text" disabled={action.isPending} onClick={() => action.mutate('unlink')}>
            Bỏ liên kết
          </Button>
        ) : null}
      </div>
    </section>
  );
}

// Hợp đồng lao động và lương thỏa thuận; chỉ dựng khi máy chủ trả danh sách hợp đồng (BR-46)
function ContractsSection({
  staff,
  contracts,
  editable,
  onChanged,
}: {
  staff: StaffDetail;
  contracts: NonNullable<StaffDetail['contracts']>;
  editable: boolean;
  onChanged(message: string): Promise<void>;
}) {
  const [contractNo, setContractNo] = useState('');
  const [contractType, setContractType] = useState<ContractType>('fixed_term');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [allowanceName, setAllowanceName] = useState('');
  const [allowanceAmount, setAllowanceAmount] = useState('');
  const [terminatedOn, setTerminatedOn] = useState(today());
  const [reason, setReason] = useState('');
  const activeContract = contracts.find((contract) => contract.status === 'active');
  const action = useMutation({
    mutationFn: async (kind: 'contract' | 'terminate'): Promise<string> => {
      if (kind === 'contract') {
        await createContract(staff.id, {
          contract_no: contractNo,
          contract_type: contractType,
          start_date: startDate,
          ...(contractType !== 'indefinite' && endDate ? { end_date: endDate } : {}),
          base_salary: Number(baseSalary || 0),
          allowances: allowanceName ? [{ name: allowanceName, amount: Number(allowanceAmount || 0) }] : [],
        });
        return 'Đã lập hợp đồng';
      }
      await terminateContract(activeContract?.id ?? '', terminatedOn, reason);
      return 'Đã chấm dứt hợp đồng, tài khoản đã bị khóa';
    },
    onSuccess: onChanged,
  });
  return (
    <section className="flex flex-col gap-2" aria-label="Hợp đồng lao động">
      <h2 className="text-content font-semibold text-text">Hợp đồng lao động</h2>
      {action.error ? <Alert tone="danger">{messageOf(action.error)}</Alert> : null}
      {contracts.length === 0 ? (
        <p className="text-content text-text-secondary">Chưa có hợp đồng.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-content">
          {contracts.map((contract) => (
            <li key={contract.id} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{contract.contract_no}</span>
              <span>{CONTRACT_TYPE_LABELS[contract.contract_type]}</span>
              <span>
                {contract.start_date} đến {contract.end_date ?? 'không thời hạn'}
              </span>
              <span>Lương {formatMoney(contract.base_salary)}</span>
              {contract.allowances.map((allowance) => (
                <span key={allowance.name}>
                  {allowance.name} {formatMoney(allowance.amount)}
                </span>
              ))}
              <StatusBadge
                tone={contract.status === 'active' ? 'success' : 'neutral'}
                label={contract.status === 'active' ? 'Còn hiệu lực' : `Đã chấm dứt ${contract.terminated_on ?? ''}`}
              />
            </li>
          ))}
        </ul>
      )}
      {editable && activeContract ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-44">
            <TextField
              label="Ngày chấm dứt"
              type="date"
              value={terminatedOn}
              onChange={(event) => setTerminatedOn(event.target.value)}
            />
          </div>
          <TextField label="Lý do chấm dứt" value={reason} onChange={(event) => setReason(event.target.value)} />
          <Button variant="danger" disabled={action.isPending} onClick={() => action.mutate('terminate')}>
            Chấm dứt hợp đồng
          </Button>
        </div>
      ) : null}
      {editable && !activeContract ? (
        <form
          className="flex flex-col gap-2 rounded-lg border border-border p-3"
          aria-label="Lập hợp đồng"
          onSubmit={(event) => {
            event.preventDefault();
            action.mutate('contract');
          }}
        >
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <TextField label="Số hợp đồng" value={contractNo} onChange={(event) => setContractNo(event.target.value)} />
            <label className="text-label font-medium text-text">
              Loại hợp đồng
              <select
                value={contractType}
                onChange={(event) => setContractType(event.target.value as ContractType)}
                className={selectClass}
              >
                {(['probation', 'fixed_term', 'indefinite'] as const).map((value) => (
                  <option key={value} value={value}>
                    {CONTRACT_TYPE_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="Lương thỏa thuận"
              type="number"
              value={baseSalary}
              onChange={(event) => setBaseSalary(event.target.value)}
            />
            <TextField
              label="Ngày bắt đầu"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            {contractType !== 'indefinite' ? (
              <TextField
                label="Ngày kết thúc"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            ) : null}
            <TextField
              label="Tên phụ cấp"
              value={allowanceName}
              onChange={(event) => setAllowanceName(event.target.value)}
            />
            <TextField
              label="Số tiền phụ cấp"
              type="number"
              value={allowanceAmount}
              onChange={(event) => setAllowanceAmount(event.target.value)}
            />
          </div>
          <div>
            <Button type="submit" variant="primary" disabled={action.isPending}>
              Lập hợp đồng
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

type StaffTab = 'general' | 'moet' | 'contracts' | 'pay' | 'history';

const TAB_LABELS: Record<StaffTab, string> = {
  general: 'Thông tin chung',
  moet: 'Hồ sơ CSDL Bộ',
  contracts: 'Hợp đồng',
  pay: 'Lương và phụ cấp',
  history: 'Quá trình công tác',
};

// Thẻ ngang cuộn được trên màn hình hẹp; phím mũi tên chuyển thẻ như mẫu tablist của WAI-ARIA
function StaffTabs({
  tabs,
  current,
  idPrefix,
  onSelect,
}: {
  tabs: StaffTab[];
  current: StaffTab;
  idPrefix: string;
  onSelect(tab: StaffTab): void;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const next = tabs[(tabs.indexOf(current) + step + tabs.length) % tabs.length] ?? current;
    onSelect(next);
    document.getElementById(`${idPrefix}-${next}`)?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label="Thông tin hồ sơ"
      className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0"
    >
      {tabs.map((item) => (
        <button
          key={item}
          type="button"
          role="tab"
          id={`${idPrefix}-${item}`}
          aria-selected={current === item}
          aria-controls={`${idPrefix}-${item}-panel`}
          tabIndex={current === item ? 0 : -1}
          onClick={() => onSelect(item)}
          onKeyDown={onKeyDown}
          className={`-mb-px min-h-11 shrink-0 whitespace-nowrap border-b-2 px-4 text-content ${
            current === item
              ? 'border-brand font-semibold text-brand-strong'
              : 'border-transparent text-text-secondary hover:text-text'
          }`}
        >
          {TAB_LABELS[item]}
        </button>
      ))}
    </div>
  );
}

function TabPanel({
  tab,
  current,
  idPrefix,
  children,
}: {
  tab: StaffTab;
  current: StaffTab;
  idPrefix: string;
  children: ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-${tab}-panel`}
      aria-labelledby={`${idPrefix}-${tab}`}
      hidden={current !== tab}
      className="flex flex-col gap-4"
    >
      {current === tab ? children : null}
    </div>
  );
}

export function StaffDetailPage() {
  const { staffId } = useParams({ strict: false }) as { staffId: string };
  const search: { tab?: string } = useSearch({ strict: false });
  const navigate = useNavigate();
  const canManage = useHasPermission(PERMISSION_CODES.staffManage);
  const queryClient = useQueryClient();
  const tabIdPrefix = useId();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const detail = useQuery({ queryKey: ['staff-detail', staffId], queryFn: () => readStaff(staffId) });
  // Cùng khóa truy vấn với hai phần bên trong để biết người dùng có được xem hay không (máy chủ trả 403 thì ẩn thẻ)
  const payItems = useQuery({
    queryKey: ['staff-pay-items', staffId],
    queryFn: () => readStaffPayItems(staffId),
    retry: false,
  });
  const workHistory = useQuery({
    queryKey: ['work-history', staffId],
    queryFn: () => readWorkHistory(staffId),
    retry: false,
  });

  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['staff-detail', staffId] });
    await queryClient.invalidateQueries({ queryKey: ['staff'] });
    setToastMessage(message);
  };

  const data = detail.data;
  const tabs: StaffTab[] = [
    'general',
    'moet',
    ...(data?.contracts ? (['contracts'] as const) : []),
    ...(payItems.isError ? [] : (['pay'] as const)),
    ...(workHistory.isError ? [] : (['history'] as const)),
  ];
  const current: StaffTab = tabs.includes(search.tab as StaffTab) ? (search.tab as StaffTab) : 'general';
  const select = (tab: StaffTab) =>
    void navigate({
      to: '/staff/$staffId',
      params: { staffId },
      search: tab === 'general' ? {} : { tab },
      replace: true,
    });
  const subtitle = data ? [data.job_title_name, data.department_name, data.unit_name].filter(Boolean).join(' · ') : '';

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <Link
          to="/staff"
          className="flex min-h-11 w-fit items-center gap-1 text-content font-medium text-link hover:underline"
        >
          <span aria-hidden="true">‹</span> Quay lại {menuPageTitle('/staff') || 'danh sách cán bộ, giáo viên'}
        </Link>
        {detail.error ? <Alert tone="danger">{messageOf(detail.error)}</Alert> : null}
        {!data && !detail.error ? <p className="text-content text-text-secondary">Đang tải hồ sơ...</p> : null}
        {data ? (
          <div className="flex flex-col gap-4" role="group" aria-label={`Hồ sơ của ${data.full_name}`}>
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-page-title font-bold text-text">{data.full_name}</h1>
                  <StatusBadge
                    tone={data.status === 'active' ? 'success' : 'neutral'}
                    label={STAFF_STATUS_LABELS[data.status]}
                  />
                </div>
                {subtitle ? <p className="text-content text-text-secondary">{subtitle}</p> : null}
              </div>
              <span className="text-content text-text-secondary">Mã nhân sự {data.code}</span>
            </header>

            <StaffTabs tabs={tabs} current={current} idPrefix={tabIdPrefix} onSelect={select} />

            <section className="rounded-xl border border-border bg-card p-4 md:p-6">
              <TabPanel tab="general" current={current} idPrefix={tabIdPrefix}>
                <SchoolInfoForm
                  key={`${data.code}|${data.department_id ?? ''}|${data.job_title_id ?? ''}|${data.start_date}`}
                  staff={data}
                  editable={canManage}
                  onSaved={(message) => void refresh(message)}
                />
                <AccountSection staff={data} editable={canManage} onChanged={refresh} />
              </TabPanel>
              <TabPanel tab="moet" current={current} idPrefix={tabIdPrefix}>
                <StaffProfileForm
                  key={JSON.stringify(staffProfileValues(data))}
                  staff={data}
                  editable={canManage}
                  onSaved={(message) => void refresh(message)}
                />
                <MoetProfileSection entries={data.moet_profile} />
              </TabPanel>
              {data.contracts ? (
                <TabPanel tab="contracts" current={current} idPrefix={tabIdPrefix}>
                  <ContractsSection staff={data} contracts={data.contracts} editable={canManage} onChanged={refresh} />
                </TabPanel>
              ) : null}
              <TabPanel tab="pay" current={current} idPrefix={tabIdPrefix}>
                <StaffPayItemsSection staffId={staffId} />
              </TabPanel>
              <TabPanel tab="history" current={current} idPrefix={tabIdPrefix}>
                <WorkHistorySection staffId={staffId} />
              </TabPanel>
            </section>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
