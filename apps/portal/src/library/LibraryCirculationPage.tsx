import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, ConfirmDialog, StatusBadge, TextField } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import {
  cancelReservation,
  createReservation,
  formatDate,
  formatMoney,
  lendCopies,
  listLoans,
  listReservations,
  remindOverdue,
  renewLoan,
  reportLost,
  RESERVATION_LABELS,
  RETURN_CONDITION_LABELS,
  returnCopy,
  type LendResult,
  type Loan,
  type LibraryTitle,
  type Reader,
  type Reservation,
  type ReturnCondition,
  type ReturnResult,
} from './library-api.js';
import {
  EmptyRow,
  ErrorAlert,
  HEAD_CLASS,
  LibraryFrame,
  PAGE_SIZE,
  Pager,
  Panel,
  ReaderPicker,
  ReasonDialog,
  SELECT_CLASS,
  TabBar,
  TH_CLASS,
  TitlePicker,
  useToast,
} from './library-common.js';

// Mượn, trả, đặt trước (DT-22 phần 22a, tài liệu 47 mục 13.4, YCTD-181). Ba thẻ: mượn (quét số thẻ bạn đọc rồi quét mã các
// bản sao, có thể mượn cho lớp), trả (quét mã bản sao, tính tiền phạt trễ hạn, báo bản được giữ cho người đặt trước; danh
// sách đang mượn, quá hạn kèm gia hạn, báo mất, nhắc quá hạn) và đặt trước ấn phẩm hết bản sẵn sàng
type Tab = 'borrow' | 'return' | 'reservations';
const TAB_LABELS: Record<Tab, string> = { borrow: 'Mượn', return: 'Trả', reservations: 'Đặt trước' };

function BorrowTab({ orgUnitId, onDone }: { orgUnitId: string | undefined; onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const [reader, setReader] = useState<Reader>();
  const [classId, setClassId] = useState('');
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [result, setResult] = useState<LendResult>();
  const classes = useQuery({
    queryKey: ['classes', orgUnitId],
    queryFn: () => listClasses(orgUnitId ?? ''),
    enabled: orgUnitId !== undefined,
  });
  const lend = useMutation({
    mutationFn: () => lendCopies({ reader_id: reader?.id ?? '', copy_codes: codes, class_id: classId || null }),
    onSuccess: async (lent) => {
      setResult(lent);
      setCodes([]);
      await queryClient.invalidateQueries({ queryKey: ['library-loans'] });
      await queryClient.invalidateQueries({ queryKey: ['library-titles'] });
      onDone(`Đã cho ${lent.reader.full_name} mượn ${lent.loans.length} bản`);
    },
  });
  const addCode = () => {
    const value = code.trim();
    if (value !== '' && !codes.includes(value)) {
      setCodes([...codes, value]);
    }
    setCode('');
  };
  return (
    <div className="flex flex-col gap-4">
      <ReaderPicker
        selected={reader}
        onSelect={(next) => {
          setReader(next);
          setResult(undefined);
        }}
      />
      {reader?.status === 'locked' ? (
        <Alert tone="warning">Thẻ của bạn đọc này đang khóa, chưa cho mượn được.</Alert>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Mượn cho lớp (không bắt buộc)
          <select value={classId} onChange={(event) => setClassId(event.target.value)} className={SELECT_CLASS}>
            <option value="">Không</option>
            {(classes.data ?? [])
              .filter((item) => item.status === 'active')
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          addCode();
        }}
      >
        <TextField
          label="Quét hoặc nhập mã bản sao rồi nhấn Enter"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <Button type="submit" disabled={code.trim() === ''}>
          Thêm vào danh sách
        </Button>
        <Button
          variant="primary"
          disabled={lend.isPending || !reader || codes.length === 0}
          onClick={() => lend.mutate()}
        >
          Cho mượn ({codes.length})
        </Button>
      </form>
      <ErrorAlert error={lend.error} />
      {codes.length > 0 ? (
        <ul className="flex flex-wrap gap-2 text-content">
          {codes.map((item) => (
            <li key={item} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1">
              {item}
              <Button
                variant="text"
                aria-label={`Bỏ ${item}`}
                onClick={() => setCodes(codes.filter((value) => value !== item))}
              >
                Bỏ
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {result ? (
        <Alert tone="success">
          Đã cho {result.reader.full_name} mượn:{' '}
          {result.loans.map((loan) => `${loan.copy_no} ${loan.title} (hạn ${formatDate(loan.due_on)})`).join('; ')}
        </Alert>
      ) : null}
    </div>
  );
}

function LoanList({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'open' | 'overdue'>('open');
  const [text, setText] = useState('');
  const [applied, setApplied] = useState('');
  const [offset, setOffset] = useState(0);
  const [losing, setLosing] = useState<Loan>();
  const loans = useQuery({
    queryKey: ['library-loans', status, applied, offset],
    queryFn: () => listLoans({ status, query: applied || undefined, limit: PAGE_SIZE, offset }),
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['library-loans'] });
    onDone(message);
  };
  const renew = useMutation({
    mutationFn: renewLoan,
    onSuccess: (result) => refresh(`Đã gia hạn đến ngày ${formatDate(result.due_on)}`),
  });
  const lost = useMutation({
    mutationFn: (input: { loan: Loan; note: string }) => reportLost(input.loan.id, input.note || null),
    onSuccess: async () => {
      setLosing(undefined);
      await refresh('Đã ghi nhận báo mất');
    },
    onError: () => setLosing(undefined),
  });
  const remind = useMutation({
    mutationFn: remindOverdue,
    onSuccess: (result) =>
      refresh(
        result.loans === 0
          ? 'Không có bạn đọc cần nhắc (đã nhắc trong ngày hoặc chưa có người nhận thông báo)'
          : `Đã gửi nhắc ${result.readers} bạn đọc về ${result.loans} bản quá hạn`,
      ),
  });
  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setOffset(0);
          setApplied(text.trim());
        }}
      >
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Danh sách
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as 'open' | 'overdue');
              setOffset(0);
            }}
            className={SELECT_CLASS}
          >
            <option value="open">Đang mượn</option>
            <option value="overdue">Quá hạn</option>
          </select>
        </label>
        <TextField
          label="Nhan đề, mã bản, tên hoặc số thẻ"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Button type="submit" variant="primary">
          Tìm kiếm
        </Button>
        <Button disabled={remind.isPending} onClick={() => remind.mutate()}>
          Nhắc quá hạn
        </Button>
      </form>
      <ErrorAlert error={loans.error ?? renew.error ?? lost.error ?? remind.error} />
      <table className="w-full text-content" aria-label="Danh sách lượt mượn">
        <thead className={HEAD_CLASS}>
          <tr>
            <th className={TH_CLASS}>Số đăng ký</th>
            <th className={TH_CLASS}>Nhan đề</th>
            <th className={TH_CLASS}>Bạn đọc</th>
            <th className={TH_CLASS}>Ngày mượn</th>
            <th className={TH_CLASS}>Hạn trả</th>
            <th className={TH_CLASS}>Gia hạn</th>
            <th className={TH_CLASS} />
          </tr>
        </thead>
        <tbody>
          {loans.data && loans.data.items.length === 0 ? <EmptyRow columns={7} message="Không có lượt mượn" /> : null}
          {(loans.data?.items ?? []).map((loan) => (
            <tr key={loan.id} className="border-t border-border">
              <td className={TH_CLASS}>{loan.copy_no}</td>
              <td className={TH_CLASS}>
                {loan.title}
                {loan.kind === 'textbook' ? ' (sách giáo khoa)' : ''}
              </td>
              <td className={TH_CLASS}>
                {loan.reader_name} ({loan.card_no})
              </td>
              <td className={TH_CLASS}>{formatDate(loan.loaned_on)}</td>
              <td className={TH_CLASS}>
                {formatDate(loan.due_on)}
                {loan.overdue_days > 0 ? <StatusBadge tone="danger" label={`Trễ ${loan.overdue_days} ngày`} /> : null}
              </td>
              <td className={TH_CLASS}>{loan.renewals}</td>
              <td className={TH_CLASS}>
                <div className="flex flex-wrap gap-2">
                  <Button
                    aria-label={`Gia hạn ${loan.copy_no}`}
                    disabled={renew.isPending}
                    onClick={() => renew.mutate(loan.id)}
                  >
                    Gia hạn
                  </Button>
                  <Button aria-label={`Báo mất ${loan.copy_no}`} onClick={() => setLosing(loan)}>
                    Báo mất
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager total={loans.data?.total ?? 0} offset={offset} onChange={setOffset} />
      <ReasonDialog
        open={losing !== undefined}
        title="Báo mất sách"
        description={`Ghi nhận bản ${losing?.copy_no ?? ''} do ${losing?.reader_name ?? ''} mượn là đã mất; bản sao được đánh dấu mất. Bồi thường chỉ ghi chú, không thu tiền ở đây.`}
        label="Ghi chú (không bắt buộc)"
        confirmLabel="Báo mất"
        required={false}
        busy={lost.isPending}
        onConfirm={(note) => losing && lost.mutate({ loan: losing, note })}
        onCancel={() => setLosing(undefined)}
      />
    </div>
  );
}

function ReturnTab({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [condition, setCondition] = useState<ReturnCondition>('good');
  const [returned, setReturned] = useState<ReturnResult[]>([]);
  const giveBack = useMutation({
    mutationFn: () => returnCopy(code.trim(), condition),
    onSuccess: async (result) => {
      setReturned([result, ...returned].slice(0, 20));
      setCode('');
      setCondition('good');
      await queryClient.invalidateQueries({ queryKey: ['library-loans'] });
      await queryClient.invalidateQueries({ queryKey: ['library-titles'] });
      onDone(`Đã nhận trả bản ${result.copy_no}`);
    },
  });
  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (code.trim() !== '') {
            giveBack.mutate();
          }
        }}
      >
        <TextField
          label="Quét hoặc nhập mã bản sao rồi nhấn Enter"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Tình trạng khi trả
          <select
            value={condition}
            onChange={(event) => setCondition(event.target.value as ReturnCondition)}
            className={SELECT_CLASS}
          >
            {(Object.keys(RETURN_CONDITION_LABELS) as ReturnCondition[]).map((item) => (
              <option key={item} value={item}>
                {RETURN_CONDITION_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="primary" disabled={giveBack.isPending || code.trim() === ''}>
          Nhận trả
        </Button>
      </form>
      <ErrorAlert error={giveBack.error} />
      {returned.length > 0 ? (
        <ul className="flex flex-col gap-2 text-content">
          {returned.map((item) => (
            <li key={item.id} className="rounded-lg border border-border px-3 py-2">
              <span className="font-semibold">{item.copy_no}</span> của {item.reader_name}:{' '}
              {item.status === 'lost' ? 'ghi nhận mất' : `đã trả (${RETURN_CONDITION_LABELS[item.return_condition]})`}
              {item.overdue_days > 0 ? `, trễ ${item.overdue_days} ngày` : ''}
              {Number(item.fine_amount) > 0 ? `, tiền phạt ${formatMoney(item.fine_amount)}` : ''}
              {item.reservation_for ? (
                <span className="ml-2 font-semibold text-info">Đã giữ cho {item.reservation_for}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <LoanList onDone={onDone} />
    </div>
  );
}

function ReservationsTab({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const [reader, setReader] = useState<Reader>();
  const [title, setTitle] = useState<LibraryTitle>();
  const [cancelling, setCancelling] = useState<Reservation>();
  const reservations = useQuery({ queryKey: ['library-reservations'], queryFn: listReservations });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['library-reservations'] });
    onDone(message);
  };
  const create = useMutation({
    mutationFn: () => createReservation(reader?.id ?? '', title?.id ?? ''),
    onSuccess: async () => {
      setTitle(undefined);
      await refresh('Đã đặt trước');
    },
  });
  const cancel = useMutation({
    mutationFn: (reservation: Reservation) => cancelReservation(reservation.id),
    onSuccess: async () => {
      setCancelling(undefined);
      await refresh('Đã hủy lượt đặt trước');
    },
    onError: () => setCancelling(undefined),
  });
  return (
    <div className="flex flex-col gap-4">
      <ReaderPicker selected={reader} onSelect={setReader} label="Bạn đọc đặt trước (quét số thẻ hoặc gõ tên)" />
      {title ? (
        <div className="flex flex-wrap items-center gap-3 text-content">
          <span className="font-semibold">{title.title}</span>
          <span className="text-text-secondary">
            sẵn sàng {title.copies_available}/{title.copies_total}
          </span>
          <Button onClick={() => setTitle(undefined)}>Chọn ấn phẩm khác</Button>
        </div>
      ) : (
        <TitlePicker label="Tìm ấn phẩm cần đặt" onPick={setTitle} />
      )}
      <div>
        <Button variant="primary" disabled={create.isPending || !reader || !title} onClick={() => create.mutate()}>
          Đặt trước
        </Button>
      </div>
      <p className="text-label text-text-secondary">
        Chỉ đặt trước được ấn phẩm đã hết bản sẵn sàng; khi có bản trả về, bản được giữ cho người đặt sớm nhất và hết
        hạn giữ chỗ theo số ngày ở 4.1 Quy định mượn.
      </p>
      <ErrorAlert error={create.error ?? reservations.error ?? cancel.error} />
      <table className="w-full text-content" aria-label="Danh sách đặt trước">
        <thead className={HEAD_CLASS}>
          <tr>
            <th className={TH_CLASS}>Ấn phẩm</th>
            <th className={TH_CLASS}>Bạn đọc</th>
            <th className={TH_CLASS}>Ngày đặt</th>
            <th className={TH_CLASS}>Trạng thái</th>
            <th className={TH_CLASS}>Bản giữ, hạn giữ</th>
            <th className={TH_CLASS} />
          </tr>
        </thead>
        <tbody>
          {reservations.data && reservations.data.length === 0 ? (
            <EmptyRow columns={6} message="Chưa có lượt đặt trước" />
          ) : null}
          {(reservations.data ?? []).map((item) => (
            <tr key={item.id} className="border-t border-border">
              <td className={`${TH_CLASS} font-semibold`}>{item.title}</td>
              <td className={TH_CLASS}>
                {item.reader_name} ({item.card_no})
              </td>
              <td className={TH_CLASS}>{formatDate(item.reserved_at)}</td>
              <td className={TH_CLASS}>
                <StatusBadge
                  tone={item.status === 'ready' ? 'info' : 'neutral'}
                  label={RESERVATION_LABELS[item.status] ?? item.status}
                />
              </td>
              <td className={TH_CLASS}>{item.copy_no ? `${item.copy_no}, đến ${formatDate(item.expires_on)}` : ''}</td>
              <td className={TH_CLASS}>
                <Button aria-label={`Hủy đặt trước ${item.title}`} onClick={() => setCancelling(item)}>
                  Hủy
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ConfirmDialog
        open={cancelling !== undefined}
        title="Hủy đặt trước"
        confirmLabel="Hủy đặt trước"
        busy={cancel.isPending}
        onConfirm={() => cancelling && cancel.mutate(cancelling)}
        onCancel={() => setCancelling(undefined)}
      >
        Hủy lượt đặt trước {cancelling?.title} của {cancelling?.reader_name}. Bản đang giữ (nếu có) chuyển cho người kế
        tiếp.
      </ConfirmDialog>
    </div>
  );
}

export function LibraryCirculationPage() {
  const toast = useToast();
  const unitChoice = useUnitChoice();
  const [tab, setTab] = useState<Tab>('borrow');
  return (
    <LibraryFrame path="/library/circulation" toast={toast}>
      <div className="flex flex-wrap items-end gap-4">
        <UnitSelect units={unitChoice.units} selectedId={unitChoice.selectedId} onSelect={unitChoice.select} />
        <TabBar tabs={TAB_LABELS} value={tab} label="Mượn, trả, đặt trước" onChange={setTab} />
      </div>
      <Panel>
        {tab === 'borrow' ? <BorrowTab orgUnitId={unitChoice.selectedId} onDone={toast.show} /> : null}
        {tab === 'return' ? <ReturnTab onDone={toast.show} /> : null}
        {tab === 'reservations' ? <ReservationsTab onDone={toast.show} /> : null}
      </Panel>
    </LibraryFrame>
  );
}
