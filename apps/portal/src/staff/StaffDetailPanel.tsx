import { useId, useState } from 'react';
import { StaffPayItemsSection } from '../payroll/StaffPayItemsSection.js';
import { MoetProfileSection } from '../imports/MoetProfileSection.js';
import { WorkHistorySection } from './WorkHistorySection.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, FormBlock, FormRow, StatusBadge, TextField } from '@school-management/ui';
import { listDepartments, listJobTitles } from '../catalogs/catalogs-api.js';
import { formatMoney } from '../fees/fees-api.js';
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

// Hồ sơ cán bộ, giáo viên trong MH-12 (P07-01, P07-02; YCTD-58) có hai thẻ (DT-15 phần 15d, YCTD-112): "Hồ sơ cán bộ, giáo
// viên" theo thứ tự ô nhập của Sở có nút Ghi; "Thông tin riêng của trường" gồm mã nhân sự, phòng ban, chức danh, ngày vào
// làm, tài khoản liên kết, hợp đồng lao động và lương thỏa thuận (chỉ người xem được hợp đồng, BR-46), lương và phụ cấp,
// quá trình công tác
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

export function StaffDetailPanel({ staffId, onChanged }: { staffId: string; onChanged(message: string): void }) {
  const canManage = useHasPermission(PERMISSION_CODES.staffManage);
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ['staff-detail', staffId], queryFn: () => readStaff(staffId) });
  const [login, setLogin] = useState('');
  const [contractNo, setContractNo] = useState('');
  const [contractType, setContractType] = useState<ContractType>('fixed_term');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [allowanceName, setAllowanceName] = useState('');
  const [allowanceAmount, setAllowanceAmount] = useState('');
  const [terminatedOn, setTerminatedOn] = useState(today());
  const [reason, setReason] = useState('');
  // Thẻ hồ sơ theo Sở và thẻ thông tin riêng của trường (YCTD-112)
  const [tab, setTab] = useState<'profile' | 'school'>('profile');
  const tabIdPrefix = useId();

  const action = useMutation({
    mutationFn: async (kind: 'link' | 'unlink' | 'contract' | 'terminate'): Promise<string> => {
      if (kind === 'link') {
        await linkAccount(staffId, login);
        return 'Đã liên kết tài khoản';
      }
      if (kind === 'unlink') {
        await unlinkAccount(staffId);
        return 'Đã bỏ liên kết tài khoản';
      }
      if (kind === 'contract') {
        await createContract(staffId, {
          contract_no: contractNo,
          contract_type: contractType,
          start_date: startDate,
          ...(contractType !== 'indefinite' && endDate ? { end_date: endDate } : {}),
          base_salary: Number(baseSalary || 0),
          allowances: allowanceName ? [{ name: allowanceName, amount: Number(allowanceAmount || 0) }] : [],
        });
        return 'Đã lập hợp đồng';
      }
      const active = detail.data?.contracts?.find((contract) => contract.status === 'active');
      await terminateContract(active?.id ?? '', terminatedOn, reason);
      return 'Đã chấm dứt hợp đồng, tài khoản đã bị khóa';
    },
    onSuccess: async (message) => {
      await queryClient.invalidateQueries({ queryKey: ['staff-detail', staffId] });
      await queryClient.invalidateQueries({ queryKey: ['staff'] });
      onChanged(message);
    },
  });

  const data = detail.data;
  if (detail.error) {
    return <Alert tone="danger">{messageOf(detail.error)}</Alert>;
  }
  if (!data) {
    return <p className="text-content text-text-secondary">Đang tải hồ sơ...</p>;
  }
  const activeContract = data.contracts?.find((contract) => contract.status === 'active');
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['staff-detail', staffId] });
    await queryClient.invalidateQueries({ queryKey: ['staff'] });
    onChanged(message);
  };
  const tabs = [
    { id: 'profile', label: 'Hồ sơ cán bộ, giáo viên' },
    { id: 'school', label: 'Thông tin riêng của trường' },
  ] as const;
  return (
    <div className="flex flex-col gap-4" role="group" aria-label={`Hồ sơ của ${data.full_name}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-section-title font-semibold text-text">{data.full_name}</h2>
        <StatusBadge tone={data.status === 'active' ? 'success' : 'neutral'} label={STAFF_STATUS_LABELS[data.status]} />
      </div>
      <div role="tablist" aria-label="Thông tin hồ sơ" className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${tabIdPrefix}-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`${tabIdPrefix}-${item.id}-panel`}
            onClick={() => setTab(item.id)}
            className={`-mb-px rounded-t-lg border border-b-0 px-3 py-2 text-content ${
              tab === item.id
                ? 'border-border bg-card font-semibold text-text'
                : 'border-transparent text-text-secondary'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${tabIdPrefix}-profile-panel`}
        aria-labelledby={`${tabIdPrefix}-profile`}
        hidden={tab !== 'profile'}
        className="flex flex-col gap-4"
      >
        <StaffProfileForm
          key={JSON.stringify(staffProfileValues(data))}
          staff={data}
          editable={canManage}
          onSaved={(message) => void refresh(message)}
        />
        <MoetProfileSection entries={data.moet_profile} />
      </div>

      <div
        role="tabpanel"
        id={`${tabIdPrefix}-school-panel`}
        aria-labelledby={`${tabIdPrefix}-school`}
        hidden={tab !== 'school'}
        className="flex flex-col gap-4"
      >
        <SchoolInfoForm
          key={`${data.code}|${data.department_id ?? ''}|${data.job_title_id ?? ''}|${data.start_date}`}
          staff={data}
          editable={canManage}
          onSaved={(message) => void refresh(message)}
        />
        {action.error ? <Alert tone="danger">{messageOf(action.error)}</Alert> : null}
        <div className="flex flex-wrap items-end gap-2">
          <span className="text-content">Tài khoản: {data.has_account ? 'đã liên kết' : 'chưa liên kết'}</span>
          {canManage && !data.has_account ? (
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
          {canManage && data.has_account ? (
            <Button variant="text" disabled={action.isPending} onClick={() => action.mutate('unlink')}>
              Bỏ liên kết
            </Button>
          ) : null}
        </div>
        {data.contracts ? (
          <section className="flex flex-col gap-2" aria-label="Hợp đồng lao động">
            <h3 className="text-content font-semibold text-text">Hợp đồng lao động</h3>
            {data.contracts.length === 0 ? (
              <p className="text-content text-text-secondary">Chưa có hợp đồng.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-content">
                {data.contracts.map((contract) => (
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
                      label={
                        contract.status === 'active' ? 'Còn hiệu lực' : `Đã chấm dứt ${contract.terminated_on ?? ''}`
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
            {canManage && activeContract ? (
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
            {canManage && !activeContract ? (
              <form
                className="flex flex-col gap-2 rounded-lg border border-border p-3"
                aria-label="Lập hợp đồng"
                onSubmit={(event) => {
                  event.preventDefault();
                  action.mutate('contract');
                }}
              >
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <TextField
                    label="Số hợp đồng"
                    value={contractNo}
                    onChange={(event) => setContractNo(event.target.value)}
                  />
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
        ) : null}
        <StaffPayItemsSection staffId={staffId} />
        <WorkHistorySection staffId={staffId} />
      </div>
    </div>
  );
}
