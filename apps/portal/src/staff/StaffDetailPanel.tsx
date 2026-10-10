import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, StatusBadge, TextField } from '@school-management/ui';
import { formatMoney } from '../fees/fees-api.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  CONTRACT_TYPE_LABELS,
  createContract,
  linkAccount,
  readStaff,
  terminateContract,
  unlinkAccount,
  type ContractType,
} from './staff-api.js';

// Chi tiết hồ sơ nhân sự trong MH-12: thông tin, tài khoản liên kết, hợp đồng lao động (P07-01, P07-02; YCTD-58)
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';

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
  return (
    <div className="flex flex-col gap-4" role="group" aria-label={`Hồ sơ của ${data.full_name}`}>
      {action.error ? <Alert tone="danger">{messageOf(action.error)}</Alert> : null}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-content md:grid-cols-4">
        <dt className="text-text-secondary">Đơn vị</dt>
        <dd>{data.unit_name}</dd>
        <dt className="text-text-secondary">Số định danh</dt>
        <dd>{data.id_number_masked ?? ''}</dd>
        <dt className="text-text-secondary">Điện thoại</dt>
        <dd>{data.phone ?? ''}</dd>
        <dt className="text-text-secondary">Ngày vào làm</dt>
        <dd>{data.start_date}</dd>
      </dl>
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
    </div>
  );
}
