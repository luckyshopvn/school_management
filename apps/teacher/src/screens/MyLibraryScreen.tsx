import { useEffect, useState } from 'react';
import { Alert, ApplicationHeader, Button } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Sách tôi đang mượn ở thư viện trường (DT-22 phần 22a, YCTD-181): số thẻ, từng bản kèm hạn trả và số ngày trễ. Chưa có thẻ
// thì thủ thư cấp ở cổng quản trị (Thư viện, Bạn đọc)
interface MyLoans {
  reader: { card_no: string; status: 'active' | 'locked' } | null;
  loans: Array<{ id: string; copy_no: string; title: string; due_on: string; overdue_days: number }>;
}

export function MyLibraryScreen({ onBack }: { onBack(): void }) {
  const [data, setData] = useState<MyLoans>();
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    requestJson<MyLoans>('/api/v1/library/my-loans')
      .then(setData)
      .catch((error: unknown) =>
        setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ'),
      );
  }, []);

  return (
    <div className="min-h-screen">
      <ApplicationHeader title="Sách tôi đang mượn" />
      <main className="mx-auto flex max-w-md flex-col md:max-w-3xl gap-4 px-4 py-6">
        <div>
          <Button variant="text" onClick={onBack}>
            Quay lại
          </Button>
        </div>
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        {data && !data.reader ? (
          <p className="text-content text-text-secondary">Bạn chưa có thẻ thư viện. Liên hệ thủ thư để được cấp thẻ.</p>
        ) : null}
        {data?.reader ? (
          <p className="text-content text-text-secondary">
            Số thẻ {data.reader.card_no}
            {data.reader.status === 'locked' ? ' (đang khóa)' : ''}
          </p>
        ) : null}
        {data?.reader && data.loans.length === 0 ? (
          <p className="text-content text-text-secondary">Bạn không mượn sách nào.</p>
        ) : null}
        <ul className="flex flex-col gap-2" aria-label="Sách đang mượn">
          {(data?.loans ?? []).map((loan) => (
            <li key={loan.id} className="rounded-lg border border-border bg-card p-3 text-content">
              <span className="font-semibold">{loan.title}</span>
              <br />
              <span className="text-label text-text-secondary">
                {loan.copy_no} · hạn trả {loan.due_on.split('-').reverse().join('/')}
                {loan.overdue_days > 0 ? ` · quá hạn ${loan.overdue_days} ngày` : ''}
              </span>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
