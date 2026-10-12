import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, TextField } from '@school-management/ui';
import { messageOf, readWorkHistory, send } from '../work/work-api.js';

// Quá trình công tác và chứng chỉ của một nhân sự trong MH-12 (P07-03; BR-37; YCTD-81): phòng nhân sự ghi thêm mốc công
// tác và chứng chỉ; mốc đã ghi chỉ ghi thêm ngày kết thúc
export function WorkHistorySection({ staffId }: { staffId: string }) {
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ['work-history', staffId], queryFn: () => readWorkHistory(staffId), retry: false });
  const [fromDate, setFromDate] = useState('');
  const [note, setNote] = useState('');
  const [certificateName, setCertificateName] = useState('');
  const [issuedBy, setIssuedBy] = useState('');
  const [issuedDate, setIssuedDate] = useState('');
  const [expireDate, setExpireDate] = useState('');
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['work-history', staffId] });
  const addHistory = useMutation({
    mutationFn: () => send('POST', `/api/v1/staff/${staffId}/work-history`, { from_date: fromDate, note }),
    onSuccess: () => {
      setNote('');
      return refresh();
    },
  });
  const addCertificate = useMutation({
    mutationFn: () =>
      send('POST', `/api/v1/staff/${staffId}/certificates`, {
        name: certificateName,
        issued_by: issuedBy,
        issued_date: issuedDate,
        expire_date: expireDate || null,
      }),
    onSuccess: () => {
      setCertificateName('');
      return refresh();
    },
  });
  if (data.error) {
    return null;
  }
  const canManage = data.data?.can_manage ?? false;
  const error = addHistory.error ?? addCertificate.error;
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-card p-4" aria-label="Quá trình công tác và chứng chỉ">
      <h3 className="text-section-title font-semibold text-text">Quá trình công tác và chứng chỉ</h3>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <ul className="flex flex-col gap-1 text-content">
        {(data.data?.history ?? []).map((row) => (
          <li key={row.id}>
            {row.from_date} – {row.to_date ?? 'nay'}: {row.unit_name}
            {row.is_main_unit ? '' : ' (đơn vị kiêm nhiệm)'}
            {row.department_name ? `, ${row.department_name}` : ''}
            {row.job_title_name ? `, ${row.job_title_name}` : ''}
            {row.note ? `. ${row.note}` : ''}
          </li>
        ))}
      </ul>
      {canManage ? (
        <form
          aria-label="Ghi mốc công tác"
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            addHistory.mutate();
          }}
        >
          <TextField
            label="Từ ngày"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
          <TextField label="Nội dung công tác" value={note} onChange={(event) => setNote(event.target.value)} />
          <Button type="submit" disabled={addHistory.isPending || !fromDate || note.trim() === ''}>
            Ghi mốc công tác
          </Button>
        </form>
      ) : null}
      <ul className="flex flex-col gap-1 text-content" aria-label="Chứng chỉ">
        {(data.data?.certificates ?? []).map((row) => (
          <li key={row.id}>
            {row.name}
            {row.certificate_no ? ` số ${row.certificate_no}` : ''}, {row.issued_by} cấp ngày {row.issued_date}
            {row.expire_date ? `, hết hạn ${row.expire_date}` : ''}
          </li>
        ))}
      </ul>
      {canManage ? (
        <form
          aria-label="Thêm chứng chỉ"
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            addCertificate.mutate();
          }}
        >
          <TextField
            label="Tên chứng chỉ"
            value={certificateName}
            onChange={(event) => setCertificateName(event.target.value)}
          />
          <TextField label="Nơi cấp" value={issuedBy} onChange={(event) => setIssuedBy(event.target.value)} />
          <TextField
            label="Ngày cấp"
            type="date"
            value={issuedDate}
            onChange={(event) => setIssuedDate(event.target.value)}
          />
          <TextField
            label="Ngày hết hạn"
            type="date"
            value={expireDate}
            onChange={(event) => setExpireDate(event.target.value)}
          />
          <Button type="submit" disabled={addCertificate.isPending || !certificateName || !issuedBy || !issuedDate}>
            Thêm chứng chỉ
          </Button>
        </form>
      ) : null}
    </section>
  );
}
