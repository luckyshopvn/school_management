import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { readMyWorkCount } from '../professional-records/professional-api.js';

// Số việc đang chờ trên menu và ở đầu trang (DT-18 phần 18e, YCTD-142): làm mới mỗi phút như chuông thông báo; số quá hạn
// tô đỏ. Số nằm ngoài tên truy cập của mục menu (aria-hidden) để tên mục giữ đúng số thứ bậc và nhãn
export const MY_WORK_PATH = '/my-work';

export function useMyWorkCount() {
  return useQuery({ queryKey: ['my-work', 'count'], queryFn: readMyWorkCount, refetchInterval: 60_000 });
}

function CountBubble({ total, overdue, className }: { total: number; overdue: number; className: string }) {
  if (!total) {
    return null;
  }
  return (
    <span
      className={`${className} min-w-[22px] rounded-full px-1 text-center text-label font-semibold leading-[22px] text-white ${overdue ? 'bg-danger' : 'bg-brand'}`}
      aria-hidden="true"
      data-testid="my-work-count"
    >
      {total > 99 ? '99+' : total}
    </span>
  );
}

function MyWorkMenuCount() {
  const count = useMyWorkCount();
  return (
    <CountBubble total={count.data?.total ?? 0} overdue={count.data?.overdue ?? 0} className="ml-2 inline-block" />
  );
}

// Đặt sau tên mục menu; chỉ mục Việc của tôi có số
export function MenuBadge({ path }: { path: string | undefined }) {
  return path === MY_WORK_PATH ? <MyWorkMenuCount /> : null;
}

// Nút Việc của tôi ở đầu trang, cạnh chuông thông báo
export function MyWorkHeaderLink() {
  const count = useMyWorkCount();
  const total = count.data?.total ?? 0;
  const overdue = count.data?.overdue ?? 0;
  return (
    <Link
      to={MY_WORK_PATH}
      className="relative flex h-11 min-w-11 items-center justify-center rounded-full px-2 text-label font-medium text-current hover:bg-current/10"
      aria-label={
        total ? `Việc của tôi, ${total} việc đang chờ${overdue ? `, ${overdue} quá hạn` : ''}` : 'Việc của tôi'
      }
    >
      <span className="hidden md:inline">Việc của tôi</span>
      <span className="md:hidden">Việc</span>
      <CountBubble total={total} overdue={overdue} className="ml-1 inline-block" />
    </Link>
  );
}
