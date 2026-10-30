import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { Alert, Button, StatusBadge } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Thẻ QR điểm danh của lớp (YCTD-389 lát L1): cấp thẻ cho học sinh chưa có, cấp lại khi mất thẻ (thẻ cũ không quét được nữa), in
// thẻ khổ danh thiếp. Mã trên thẻ là chuỗi ngẫu nhiên, không có thông tin cá nhân; tên và lớp chỉ in để học sinh nhận thẻ
interface ClassCards {
  class_name: string;
  children: Array<{ child_id: string; full_name: string; code: string | null; issued_at: string | null }>;
}

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

// Mã 16 ký tự in thành bốn nhóm cho dễ gõ tay
function groupCode(code: string): string {
  return code.match(/.{1,4}/g)?.join(' ') ?? code;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

async function printCards(data: ClassCards, learner: string): Promise<boolean> {
  const cards = await Promise.all(
    data.children
      .filter((child) => child.code)
      .map(async (child) => {
        const image = await QRCode.toDataURL(child.code ?? '', { margin: 1, width: 220 });
        return `<div class="the"><img src="${image}" alt=""><div><b>${escapeHtml(child.full_name)}</b><br>Lớp ${escapeHtml(
          data.class_name,
        )}<br><span class="ma">${groupCode(child.code ?? '')}</span><br><small>Thẻ điểm danh ra vào cổng</small></div></div>`;
      }),
  );
  const page = window.open('', '_blank');
  if (!page) {
    return false;
  }
  page.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Thẻ QR lớp ${escapeHtml(
    data.class_name,
  )}</title><style>
    body{font-family:system-ui,"Segoe UI",Arial,sans-serif;margin:8mm;color:#0F172A}
    .luoi{display:grid;grid-template-columns:repeat(2,85mm);gap:6mm}
    .the{width:85mm;height:54mm;border:1px solid #94A3B8;border-radius:3mm;padding:3mm;box-sizing:border-box;display:flex;gap:3mm;align-items:center;break-inside:avoid;font-size:11pt}
    .the img{width:34mm;height:34mm}.ma{font-family:monospace;font-size:11pt;letter-spacing:.5px}small{color:#475569}
  </style></head><body><p>${escapeHtml(learner)} lớp ${escapeHtml(data.class_name)}: ${cards.length} thẻ</p><div class="luoi">${cards.join(
    '',
  )}</div><script>window.onload=()=>window.print()</script></body></html>`);
  page.document.close();
  return true;
}

export function GateCardsPanel({ classId, learner }: { classId: string; learner: string }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const cards = useQuery({
    queryKey: ['gate-cards', classId],
    queryFn: () => requestJson<ClassCards>(`/api/v1/classes/${classId}/gate-cards`),
    retry: false,
  });
  const issue = useMutation({
    mutationFn: (reissueChildIds: string[]) =>
      requestJson<ClassCards & { issued_count: number }>(`/api/v1/classes/${classId}/gate-cards`, {
        method: 'POST',
        body: JSON.stringify({ reissue_child_ids: reissueChildIds }),
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(['gate-cards', classId], result);
      setMessage({ tone: 'success', text: `Đã cấp ${result.issued_count} thẻ` });
    },
    onError: (error) => setMessage({ tone: 'danger', text: messageOf(error) }),
  });

  if (cards.isPending) {
    return <p className="text-content text-text-secondary">Đang tải thẻ…</p>;
  }
  if (cards.isError) {
    return <Alert tone="warning">{messageOf(cards.error)}</Alert>;
  }
  const data = cards.data;
  const missing = data.children.filter((child) => !child.code).length;
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Thẻ QR của lớp">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-section-title font-bold text-text">Thẻ QR lớp {data.class_name}</h2>
        <div className="flex flex-wrap gap-2">
          <Button disabled={missing === 0 || issue.isPending} onClick={() => issue.mutate([])}>
            Cấp thẻ cho {missing} {learner.toLocaleLowerCase('vi')} chưa có
          </Button>
          <Button
            variant="primary"
            disabled={data.children.every((child) => !child.code)}
            onClick={() =>
              void printCards(data, learner).then((opened) => {
                if (!opened) {
                  setMessage({
                    tone: 'danger',
                    text: 'Trình duyệt chặn cửa sổ in; cho phép cửa sổ bật lên rồi thử lại',
                  });
                }
              })
            }
          >
            In thẻ
          </Button>
        </div>
      </div>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {data.children.length === 0 ? (
        <p className="text-content text-text-secondary">Lớp chưa có {learner.toLocaleLowerCase('vi')} đang học.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {data.children.map((child) => (
            <li key={child.child_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0 break-words font-medium">{child.full_name}</span>
              <span className="flex flex-wrap items-center gap-2">
                {child.code ? (
                  <>
                    <span className="font-mono text-label">{groupCode(child.code)}</span>
                    <Button
                      variant="text"
                      disabled={issue.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Cấp lại thẻ cho ${child.full_name}? Thẻ cũ sẽ không quét được nữa, không hoàn tác được.`,
                          )
                        ) {
                          issue.mutate([child.child_id]);
                        }
                      }}
                    >
                      Cấp lại
                    </Button>
                  </>
                ) : (
                  <StatusBadge tone="neutral" label="Chưa có thẻ" />
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
