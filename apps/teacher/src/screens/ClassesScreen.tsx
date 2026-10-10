import { useEffect, useState } from 'react';
import { Alert, ApplicationHeader, Button } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';
import { useSession } from '../session/session.js';

// MG-01 Lớp của tôi hôm nay: các lớp đang được phân công (YCTD-44)
export interface MyClass {
  id: string;
  name: string;
  enrolled_count: number;
  staff: Array<{ staff_user_id: string; assignment_role: 'homeroom' | 'subject' }>;
}

export function ClassesScreen({ onOpen }: { onOpen(myClass: MyClass): void }) {
  const session = useSession();
  const [classes, setClasses] = useState<MyClass[]>();
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    requestJson<MyClass[]>('/api/v1/classes?mine=true&status=active')
      .then(setClasses)
      .catch((error: unknown) =>
        setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ'),
      );
  }, []);

  return (
    <div className="min-h-screen">
      <ApplicationHeader title="Ứng dụng giáo viên" />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        <h1 className="text-page-title font-bold text-text">Lớp của tôi</h1>
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        {classes && classes.length === 0 ? (
          <p className="text-content text-text-secondary">Bạn chưa được phân công lớp nào.</p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {(classes ?? []).map((myClass) => (
            <li key={myClass.id}>
              <button
                type="button"
                onClick={() => onOpen(myClass)}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left"
              >
                <span className="text-content font-semibold">{myClass.name}</span>
                <span className="text-label text-text-secondary">{myClass.enrolled_count} trẻ</span>
              </button>
            </li>
          ))}
        </ul>
        <div>
          <Button onClick={() => void session.logout()}>Đăng xuất</Button>
        </div>
      </main>
    </div>
  );
}
