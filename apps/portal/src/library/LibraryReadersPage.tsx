import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, StatusBadge, TextField } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import {
  formatDate,
  formatMoney,
  listReaders,
  printReaderCards,
  READER_KIND_LABELS,
  readerLoanHistory,
  setReaderStatus,
  syncReaders,
  type Reader,
  type ReaderKind,
} from './library-api.js';
import {
  EmptyRow,
  ErrorAlert,
  HEAD_CLASS,
  LibraryFrame,
  PAGE_SIZE,
  Pager,
  Panel,
  ReasonDialog,
  SELECT_CLASS,
  TH_CLASS,
  toggleId,
  useToast,
} from './library-common.js';

// Bạn đọc thư viện (DT-22 phần 22a, tài liệu 47 mục 13.4, YCTD-181): cán bộ và học sinh được cấp thẻ tự động từ danh sách
// nhân sự, học sinh đang học ("Đồng bộ thẻ"; người không còn trong trường bị khóa thẻ); khóa, mở khóa thẻ, in thẻ có mã QR
// là số thẻ, xem lịch sử mượn. Dữ liệu cá nhân học sinh chỉ người có quyền quản lý thư viện được xem

function HistoryPanel({ reader, onClose }: { reader: Reader; onClose(): void }) {
  const history = useQuery({
    queryKey: ['library-reader-loans', reader.id],
    queryFn: () => readerLoanHistory(reader.id),
  });
  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-section-title font-semibold text-text">
          Lịch sử mượn của {reader.full_name} ({reader.card_no})
        </h2>
        <Button onClick={onClose}>Đóng</Button>
      </div>
      <ErrorAlert error={history.error} />
      <table className="w-full text-content" aria-label="Lịch sử mượn của bạn đọc">
        <thead className={HEAD_CLASS}>
          <tr>
            <th className={TH_CLASS}>Số đăng ký</th>
            <th className={TH_CLASS}>Nhan đề</th>
            <th className={TH_CLASS}>Ngày mượn</th>
            <th className={TH_CLASS}>Hạn trả</th>
            <th className={TH_CLASS}>Ngày trả</th>
            <th className={TH_CLASS}>Tình trạng</th>
            <th className={TH_CLASS}>Tiền phạt</th>
          </tr>
        </thead>
        <tbody>
          {history.data && history.data.items.length === 0 ? (
            <EmptyRow columns={7} message="Chưa mượn sách nào" />
          ) : null}
          {(history.data?.items ?? []).map((loan) => (
            <tr key={loan.id} className="border-t border-border">
              <td className={TH_CLASS}>{loan.copy_no}</td>
              <td className={TH_CLASS}>
                {loan.title}
                {loan.kind === 'textbook' ? ' (sách giáo khoa)' : ''}
              </td>
              <td className={TH_CLASS}>{formatDate(loan.loaned_on)}</td>
              <td className={TH_CLASS}>{formatDate(loan.due_on)}</td>
              <td className={TH_CLASS}>{formatDate(loan.returned_on)}</td>
              <td className={TH_CLASS}>
                {loan.status === 'open'
                  ? loan.overdue_days > 0
                    ? `Đang mượn, trễ ${loan.overdue_days} ngày`
                    : 'Đang mượn'
                  : loan.status === 'lost'
                    ? 'Mất'
                    : 'Đã trả'}
              </td>
              <td className={TH_CLASS}>{Number(loan.fine_amount) > 0 ? formatMoney(loan.fine_amount) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

export function LibraryReadersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const [kind, setKind] = useState<ReaderKind | ''>('');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState<'active' | 'locked' | ''>('');
  const [text, setText] = useState('');
  const [applied, setApplied] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [locking, setLocking] = useState<Reader>();
  const [history, setHistory] = useState<Reader>();
  const classes = useQuery({
    queryKey: ['classes', unitChoice.selectedId],
    queryFn: () => listClasses(unitChoice.selectedId ?? ''),
    enabled: unitChoice.selectedId !== undefined,
  });
  const readers = useQuery({
    queryKey: ['library-readers', kind, classId, status, applied, offset],
    queryFn: () =>
      listReaders({
        kind: kind || undefined,
        class_id: classId || undefined,
        status: status || undefined,
        query: applied || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['library-readers'] });
    toast.show(message);
  };
  const sync = useMutation({
    mutationFn: syncReaders,
    onSuccess: (result) =>
      refresh(
        `Đã cấp thẻ cho ${result.issued_staff} cán bộ, ${result.issued_students} học sinh; khóa ${result.locked} thẻ của người không còn trong trường`,
      ),
  });
  const lock = useMutation({
    mutationFn: (input: { reader: Reader; status: 'active' | 'locked'; reason: string | null }) =>
      setReaderStatus(input.reader.id, input.status, input.reason),
    onSuccess: async (_, input) => {
      setLocking(undefined);
      await refresh(input.status === 'locked' ? 'Đã khóa thẻ' : 'Đã mở khóa thẻ');
    },
    onError: () => setLocking(undefined),
  });
  const cards = useMutation({
    mutationFn: () => printReaderCards(selected),
    onSuccess: () => toast.show(`Đã tạo tệp in ${selected.length} thẻ`),
  });
  const items = readers.data?.items ?? [];
  const levelClasses = (classes.data ?? []).filter((item) => item.status === 'active');
  return (
    <LibraryFrame path="/library/readers" toast={toast}>
      <Panel>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setOffset(0);
            setApplied(text.trim());
          }}
        >
          <UnitSelect
            units={unitChoice.units}
            selectedId={unitChoice.selectedId}
            onSelect={(id) => {
              unitChoice.select(id);
              setClassId('');
              setOffset(0);
            }}
          />
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Loại bạn đọc
            <select
              value={kind}
              onChange={(event) => {
                setKind(event.target.value as ReaderKind | '');
                setOffset(0);
              }}
              className={SELECT_CLASS}
            >
              <option value="">Tất cả</option>
              <option value="staff">Cán bộ</option>
              <option value="student">Học sinh</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Lớp
            <select
              value={classId}
              onChange={(event) => {
                setClassId(event.target.value);
                setOffset(0);
              }}
              className={SELECT_CLASS}
            >
              <option value="">Tất cả</option>
              {levelClasses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Trạng thái thẻ
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as 'active' | 'locked' | '');
                setOffset(0);
              }}
              className={SELECT_CLASS}
            >
              <option value="">Tất cả</option>
              <option value="active">Đang dùng</option>
              <option value="locked">Đã khóa</option>
            </select>
          </label>
          <TextField label="Tên hoặc số thẻ" value={text} onChange={(event) => setText(event.target.value)} />
          <Button type="submit" variant="primary">
            Tìm kiếm
          </Button>
          <Button disabled={sync.isPending} onClick={() => sync.mutate()}>
            Đồng bộ thẻ
          </Button>
          <Button disabled={selected.length === 0 || cards.isPending} onClick={() => cards.mutate()}>
            In thẻ ({selected.length})
          </Button>
        </form>
        <p className="text-label text-text-secondary">
          Đồng bộ thẻ cấp thẻ cho cán bộ và học sinh đang học chưa có thẻ, khóa thẻ của người đã thôi việc hoặc nghỉ
          học.
        </p>
        <ErrorAlert error={readers.error ?? sync.error ?? lock.error ?? cards.error} />
        {readers.data && readers.data.total === 0 && applied === '' && kind === '' && status === '' ? (
          <Alert tone="info">Chưa có thẻ nào. Bấm Đồng bộ thẻ để cấp thẻ cho cán bộ và học sinh.</Alert>
        ) : null}
        <table className="w-full text-content" aria-label="Danh sách bạn đọc">
          <thead className={HEAD_CLASS}>
            <tr>
              <th className={TH_CLASS}>
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả bạn đọc trong trang"
                  checked={items.length > 0 && items.every((item) => selected.includes(item.id))}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? [...new Set([...selected, ...items.map((item) => item.id)])]
                        : selected.filter((id) => !items.some((item) => item.id === id)),
                    )
                  }
                />
              </th>
              <th className={TH_CLASS}>Số thẻ</th>
              <th className={TH_CLASS}>Họ tên</th>
              <th className={TH_CLASS}>Loại</th>
              <th className={TH_CLASS}>Lớp</th>
              <th className={TH_CLASS}>Đang mượn</th>
              <th className={TH_CLASS}>Quá hạn</th>
              <th className={TH_CLASS}>Thẻ</th>
              <th className={TH_CLASS} />
            </tr>
          </thead>
          <tbody>
            {readers.data && items.length === 0 ? <EmptyRow columns={9} message="Không có bạn đọc" /> : null}
            {items.map((reader) => (
              <tr key={reader.id} className="border-t border-border">
                <td className={TH_CLASS}>
                  <input
                    type="checkbox"
                    aria-label={`Chọn ${reader.full_name}`}
                    checked={selected.includes(reader.id)}
                    onChange={() => setSelected(toggleId(selected, reader.id))}
                  />
                </td>
                <td className={TH_CLASS}>{reader.card_no}</td>
                <td className={`${TH_CLASS} font-semibold`}>{reader.full_name}</td>
                <td className={TH_CLASS}>{READER_KIND_LABELS[reader.reader_kind]}</td>
                <td className={TH_CLASS}>{reader.class_name ?? ''}</td>
                <td className={TH_CLASS}>{reader.open_loans}</td>
                <td className={TH_CLASS}>{reader.overdue_loans}</td>
                <td className={TH_CLASS}>
                  <StatusBadge
                    tone={reader.status === 'active' ? 'success' : 'danger'}
                    label={reader.status === 'active' ? 'Đang dùng' : 'Đã khóa'}
                  />
                  {reader.status === 'locked' && reader.locked_reason ? ` ${reader.locked_reason}` : ''}
                </td>
                <td className={TH_CLASS}>
                  <div className="flex flex-wrap gap-2">
                    <Button aria-label={`Lịch sử mượn của ${reader.full_name}`} onClick={() => setHistory(reader)}>
                      Lịch sử mượn
                    </Button>
                    {reader.status === 'active' ? (
                      <Button aria-label={`Khóa thẻ ${reader.card_no}`} onClick={() => setLocking(reader)}>
                        Khóa thẻ
                      </Button>
                    ) : (
                      <Button
                        aria-label={`Mở khóa thẻ ${reader.card_no}`}
                        disabled={lock.isPending}
                        onClick={() => lock.mutate({ reader, status: 'active', reason: null })}
                      >
                        Mở khóa
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager total={readers.data?.total ?? 0} offset={offset} onChange={setOffset} />
      </Panel>
      {history ? <HistoryPanel key={history.id} reader={history} onClose={() => setHistory(undefined)} /> : null}
      <ReasonDialog
        open={locking !== undefined}
        title="Khóa thẻ bạn đọc"
        description={`Khóa thẻ ${locking?.card_no ?? ''} của ${locking?.full_name ?? ''}; bạn đọc không mượn, đặt trước được cho đến khi mở khóa.`}
        confirmLabel="Khóa thẻ"
        busy={lock.isPending}
        onConfirm={(reason) => locking && lock.mutate({ reader: locking, status: 'locked', reason })}
        onCancel={() => setLocking(undefined)}
      />
    </LibraryFrame>
  );
}
