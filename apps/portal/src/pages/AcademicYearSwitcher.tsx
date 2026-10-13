import { useQueries, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { listAcademicYears, readCalendar, type Calendar } from '../academic-years/academic-years-api.js';

type TermKey = 'first_term' | 'second_term' | 'summer_term';

const TERM_LABELS: Record<TermKey, string> = {
  first_term: 'Học kỳ I',
  second_term: 'Học kỳ II',
  summer_term: 'Kỳ hè',
};

const TERM_KEYS: TermKey[] = ['first_term', 'second_term', 'summer_term'];

// Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD
function vietnamToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

// Các học kỳ đã khai báo của năm học (bỏ kỳ chưa có ngày)
function termsOf(calendar: Calendar | undefined): Array<{ key: TermKey; start_date: string; end_date: string }> {
  if (!calendar) {
    return [];
  }
  return TERM_KEYS.flatMap((key) => {
    const range = calendar[key];
    return range && range.start_date && range.end_date ? [{ key, ...range }] : [];
  });
}

// Học kỳ chứa ngày hôm nay theo lịch năm học (academic_terms); ngoài mọi học kỳ thì trả undefined
export function currentTermOf(calendar: Calendar | undefined, today: string): TermKey | undefined {
  return termsOf(calendar).find((term) => term.start_date <= today && today <= term.end_date)?.key;
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M7 2h2v2h6V2h2v2h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3V2Zm12 8H5v9h14v-9ZM5 8h14V6H5v2Z" />
    </svg>
  );
}

// Năm học và học kỳ đang dùng ở thanh đầu trang (YCTD-102). Máy chủ API chỉ đọc và ghi năm học đang dùng (BR-93), chưa có
// cách đọc cơ sở dữ liệu năm học đã đóng, nên năm học cũ chỉ hiện trong danh sách và không chọn được. Học kỳ chỉ để hiển
// thị vì chưa trang nào lọc theo học kỳ
export function AcademicYearSwitcher() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const years = useQuery({ queryKey: ['academic-years'], queryFn: listAcademicYears });
  const listed = (years.data ?? []).filter((year) => year.status !== 'draft');
  const currentYear = listed.find((year) => year.status === 'open');
  const currentCalendar = useQuery({
    queryKey: ['academic-year-calendar', currentYear?.id],
    queryFn: () => readCalendar(currentYear?.id ?? ''),
    enabled: Boolean(currentYear),
  });
  // Lịch của các năm học khác chỉ tải khi mở danh sách
  const otherCalendars = useQueries({
    queries: listed
      .filter((year) => year.id !== currentYear?.id)
      .map((year) => ({
        queryKey: ['academic-year-calendar', year.id],
        queryFn: () => readCalendar(year.id),
        enabled: open,
      })),
  });
  const calendarOf = (yearId: string): Calendar | undefined => {
    if (yearId === currentYear?.id) {
      return currentCalendar.data;
    }
    const index = listed.filter((year) => year.id !== currentYear?.id).findIndex((year) => year.id === yearId);
    return otherCalendars[index]?.data;
  };
  const today = vietnamToday();
  const currentTerm = currentTermOf(currentCalendar.data, today);
  const termLabel = currentTerm ? TERM_LABELS[currentTerm] : 'Ngoài học kỳ';

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onPointer = (event: MouseEvent) => {
      if (container.current && !container.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (years.isPending) {
    return <span className="hidden h-4 w-36 animate-pulse rounded bg-header-strong md:inline" aria-hidden="true" />;
  }
  const buttonText = currentYear ? `${currentYear.name} · ${termLabel}` : 'Chưa có năm học đang dùng';

  return (
    <div className="relative hidden md:block" ref={container}>
      <button
        type="button"
        className="flex h-9 items-center gap-2 rounded-md border border-white/60 px-2.5 text-label font-semibold text-white hover:bg-header-strong"
        aria-label={currentYear ? `Năm học đang dùng: ${currentYear.name}, ${termLabel}` : 'Chưa có năm học đang dùng'}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="academic-year-context"
        onClick={() => setOpen(!open)}
      >
        <CalendarIcon />
        <span>{buttonText}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Năm học và học kỳ"
          className="absolute right-0 top-10 z-30 w-80 max-w-[calc(100vw-32px)] whitespace-normal rounded-md border border-border bg-card py-2 text-text shadow-lg"
        >
          {listed.length === 0 ? (
            <p className="px-3 py-1 text-label text-text-secondary">Chưa có năm học nào được mở</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {listed.map((year) => {
                const isCurrent = year.id === currentYear?.id;
                const terms = termsOf(calendarOf(year.id));
                return (
                  <li key={year.id}>
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-label ${isCurrent ? 'bg-selected font-semibold' : 'cursor-not-allowed text-text-secondary'}`}
                      aria-current={isCurrent ? 'true' : undefined}
                      aria-disabled={!isCurrent}
                      title={isCurrent ? undefined : 'Chưa hỗ trợ xem năm học cũ'}
                      onClick={() => {
                        if (isCurrent) {
                          setOpen(false);
                        }
                      }}
                    >
                      <span>Năm học {year.name}</span>
                      <span className="text-label text-text-secondary">
                        {isCurrent ? 'Đang dùng' : 'Đã đóng · chưa hỗ trợ xem'}
                      </span>
                    </button>
                    {terms.length > 0 ? (
                      <ul className="flex flex-col pl-6 pr-3" aria-label={`Học kỳ của năm học ${year.name}`}>
                        {terms.map((term) => {
                          const isCurrentTerm = isCurrent && term.key === currentTerm;
                          return (
                            <li
                              key={term.key}
                              className={`flex justify-between gap-2 py-0.5 text-label ${isCurrentTerm ? 'font-semibold text-brand-strong' : 'text-text-secondary'}`}
                            >
                              <span>
                                {TERM_LABELS[term.key]}
                                {isCurrentTerm ? ' (hiện tại)' : ''}
                              </span>
                              <span>
                                {formatDate(term.start_date)} – {formatDate(term.end_date)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
