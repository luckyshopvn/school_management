import { useEffect, useState } from 'react';
import { Alert } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Sách con đang mượn ở thư viện trường (DT-22 phần 22a, YCTD-181): từng bản kèm hạn trả; sách giáo khoa cấp đầu năm có hạn là
// hết năm học. Máy chủ kiểm tra quan hệ phụ huynh; con chưa có thẻ thư viện thì chưa mượn sách nào
interface ChildLoans {
  reader: { card_no: string; status: 'active' | 'locked' } | null;
  loans: Array<{
    id: string;
    copy_no: string;
    title: string;
    kind: 'regular' | 'textbook';
    due_on: string;
    overdue_days: number;
  }>;
}

export function LibraryPanel({ child }: { child: { id: string; full_name: string } }) {
  const [data, setData] = useState<ChildLoans>();
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    requestJson<ChildLoans>(`/api/v1/library/children/${child.id}/loans`)
      .then(setData)
      .catch((error: unknown) =>
        setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ'),
      );
  }, [child.id]);

  return (
    <section className="flex flex-col gap-3" aria-label={`Sách thư viện của ${child.full_name}`}>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {data && !data.reader ? (
        <p className="text-content text-text-secondary">Con chưa có thẻ thư viện, chưa mượn sách nào.</p>
      ) : null}
      {data?.reader && data.loans.length === 0 ? (
        <p className="text-content text-text-secondary">Con không đang mượn sách nào.</p>
      ) : null}
      <ul className="flex flex-col gap-2" aria-label={`Sách ${child.full_name} đang mượn`}>
        {(data?.loans ?? []).map((loan) => (
          <li key={loan.id} className="rounded-lg border border-border bg-card p-3 text-content">
            <span className="font-semibold">{loan.title}</span>
            {loan.kind === 'textbook' ? ' (sách giáo khoa)' : ''}
            <br />
            <span className="text-label text-text-secondary">
              Hạn trả {loan.due_on.split('-').reverse().join('/')}
              {loan.overdue_days > 0 ? ` · quá hạn ${loan.overdue_days} ngày` : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
