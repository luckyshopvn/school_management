import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  COMPLETION_OUTCOME_LABELS,
  PERMISSION_CODES,
  SUPPORT_PLAN_LABELS,
  YEAR_RESULT_LABELS,
  type YearResultCode,
} from '@school-management/shared';
import { Alert, Button, StatusBadge, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import {
  decideAward,
  downloadPdf,
  loadTitleDefaults,
  messageOf,
  prepareRecords,
  proposeAward,
  readClassAwards,
  readClassRecords,
  readCompletion,
  readTitles,
  reopenRecord,
  saveComment,
  saveCompletion,
  signRecord,
  type SupportPlan,
} from './learning-records-api.js';

// 7.6 Học bạ, khen thưởng, lên lớp (DT-20 phần 20e, YCTD-163): khen thưởng cuối năm (gợi ý theo kết quả cuối năm, giáo viên
// chủ nhiệm đề nghị, Ban Giám hiệu duyệt, giấy khen có mã tra cứu), hoàn thành chương trình (rèn luyện trong hè, kiểm tra
// lại, ở lại lớp; khối cuối cấp hoàn thành tiểu học), học bạ (lập từ kết quả đã khoá, nhận xét, Hiệu trưởng xác nhận và kí)
type Tab = 'awards' | 'completion' | 'records' | 'titles';
const TAB_LABELS: Record<Tab, string> = {
  awards: 'Khen thưởng',
  completion: 'Hoàn thành chương trình',
  records: 'Học bạ',
  titles: 'Danh hiệu',
};
const SELECT_CLASS = 'rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const resultLabel = (code: string | null) =>
  code ? (YEAR_RESULT_LABELS[code as YearResultCode] ?? code) : 'Chưa xác nhận';

function AwardsTab({ classId, onSaved }: { classId: string; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const view = useQuery({ queryKey: ['class-awards', classId], queryFn: () => readClassAwards(classId), retry: false });
  const [titleByChild, setTitleByChild] = useState<Record<string, string>>({});
  const [achievement, setAchievement] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['class-awards', classId] });
    onSaved(message);
  };
  const propose = useMutation({
    mutationFn: (input: { childId: string; titleId: string }) =>
      proposeAward(classId, {
        child_id: input.childId,
        title_id: input.titleId,
        achievement: achievement[input.childId] || null,
      }),
    onSuccess: () => refresh('Đã đề nghị khen thưởng'),
  });
  const decide = useMutation({
    mutationFn: (input: { awardId: string; approve: boolean }) =>
      decideAward(input.awardId, { approve: input.approve, note: note || null }),
    onSuccess: (_result, input) => refresh(input.approve ? 'Đã duyệt khen thưởng' : 'Đã không duyệt'),
  });
  const download = useMutation({
    mutationFn: (input: { awardId: string; code: string }) =>
      downloadPdf(`/api/v1/learning-records/awards/${input.awardId}/certificate`, `giay-khen-${input.code}.pdf`),
  });
  if (view.error) {
    return <Alert tone="warning">{messageOf(view.error)}</Alert>;
  }
  const data = view.data;
  if (!data) {
    return null;
  }
  const error = propose.error ?? decide.error ?? download.error;
  const canPropose = data.access.homeroom || data.access.approve;
  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {data.titles.length === 0 ? (
        <Alert tone="info">Chưa có danh hiệu. Ban Giám hiệu nạp danh hiệu mặc định ở thẻ Danh hiệu.</Alert>
      ) : null}
      {data.access.approve ? (
        <TextField
          label="Ghi chú khi duyệt, không duyệt"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      ) : null}
      <table className="w-full text-content" aria-label="Khen thưởng của lớp">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-2 py-2">Học sinh</th>
            <th className="px-2 py-2">Kết quả cuối năm</th>
            <th className="px-2 py-2">Khen thưởng</th>
            {canPropose ? <th className="px-2 py-2">Đề nghị</th> : null}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.child_id} className="border-t border-border align-top">
              <td className="px-2 py-2 font-medium">{row.full_name}</td>
              <td className="px-2 py-2">{resultLabel(row.year_result)}</td>
              <td className="px-2 py-2">
                <ul className="flex flex-col gap-1">
                  {row.awards.map((award) => (
                    <li key={award.id} className="flex flex-wrap items-center gap-2">
                      <span>{award.title_name}</span>
                      <StatusBadge
                        tone={award.status === 'approved' ? 'success' : award.status === 'rejected' ? 'danger' : 'info'}
                        label={
                          award.status === 'approved'
                            ? 'Đã duyệt'
                            : award.status === 'rejected'
                              ? 'Không duyệt'
                              : 'Chờ duyệt'
                        }
                      />
                      {award.status === 'proposed' && data.access.approve ? (
                        <>
                          <Button
                            aria-label={`Duyệt ${award.title_name} của ${row.full_name}`}
                            disabled={decide.isPending}
                            onClick={() => decide.mutate({ awardId: award.id, approve: true })}
                          >
                            Duyệt
                          </Button>
                          <Button
                            disabled={decide.isPending}
                            onClick={() => decide.mutate({ awardId: award.id, approve: false })}
                          >
                            Không duyệt
                          </Button>
                        </>
                      ) : null}
                      {award.status === 'approved' && award.lookup_code ? (
                        <Button
                          aria-label={`Giấy khen ${award.title_name} của ${row.full_name}`}
                          onClick={() => download.mutate({ awardId: award.id, code: award.lookup_code ?? '' })}
                        >
                          Giấy khen ({award.lookup_code})
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </td>
              {canPropose ? (
                <td className="flex flex-col gap-1 px-2 py-2">
                  <select
                    aria-label={`Danh hiệu cho ${row.full_name}`}
                    value={titleByChild[row.child_id] ?? row.suggested_title_ids[0] ?? ''}
                    onChange={(event) => setTitleByChild({ ...titleByChild, [row.child_id]: event.target.value })}
                    className="rounded-lg border border-border bg-card px-2 py-1"
                  >
                    <option value="">Chọn danh hiệu</option>
                    {data.titles.map((title) => (
                      <option key={title.id} value={title.id}>
                        {title.name}
                        {row.suggested_title_ids.includes(title.id) ? ' (gợi ý)' : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={`Thành tích của ${row.full_name}`}
                    placeholder="Thành tích (danh hiệu tiêu biểu, đột xuất)"
                    className="rounded-lg border border-border bg-card px-2 py-1"
                    value={achievement[row.child_id] ?? ''}
                    onChange={(event) => setAchievement({ ...achievement, [row.child_id]: event.target.value })}
                  />
                  <Button
                    aria-label={`Đề nghị khen thưởng ${row.full_name}`}
                    disabled={propose.isPending}
                    onClick={() =>
                      propose.mutate({
                        childId: row.child_id,
                        titleId: titleByChild[row.child_id] ?? row.suggested_title_ids[0] ?? '',
                      })
                    }
                  >
                    Đề nghị
                  </Button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompletionTab({ classId, onSaved }: { classId: string; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const view = useQuery({
    queryKey: ['class-completion', classId],
    queryFn: () => readCompletion(classId),
    retry: false,
  });
  const [draft, setDraft] = useState<
    Record<string, { plan: SupportPlan | ''; result: 'completed' | 'not_completed' | ''; note: string }>
  >({});
  useEffect(() => {
    if (view.data) {
      setDraft(
        Object.fromEntries(
          view.data.rows.map((row) => [
            row.child_id,
            {
              plan: row.result?.support_plan ?? '',
              result: row.result?.support_result ?? '',
              note: row.result?.support_note ?? '',
            },
          ]),
        ),
      );
    }
  }, [view.data]);
  const save = useMutation({
    mutationFn: () =>
      saveCompletion(
        classId,
        (view.data?.rows ?? [])
          .filter((row) => row.year_result)
          .map((row) => ({
            child_id: row.child_id,
            support_plan: row.year_result === 'not_completed' ? draft[row.child_id]?.plan || null : null,
            support_result: row.year_result === 'not_completed' ? draft[row.child_id]?.result || null : null,
            support_note: draft[row.child_id]?.note || null,
          })),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['class-completion', classId] });
      onSaved('Đã ghi kết quả hoàn thành chương trình');
    },
  });
  if (view.error) {
    return <Alert tone="warning">{messageOf(view.error)}</Alert>;
  }
  const data = view.data;
  if (!data) {
    return null;
  }
  const canEdit = (data.access.homeroom || data.access.approve) && data.year_end_locked;
  const set = (childId: string, field: 'plan' | 'result' | 'note', value: string) =>
    setDraft({ ...draft, [childId]: { ...(draft[childId] ?? { plan: '', result: '', note: '' }), [field]: value } });
  return (
    <section className="flex flex-col gap-3" aria-label="Hoàn thành chương trình">
      <p className="text-label text-text-secondary">
        {data.last_grade
          ? 'Khối cuối cấp: học sinh hoàn thành là hoàn thành chương trình tiểu học.'
          : `Học sinh hoàn thành lên khối ${data.next_grade_level ?? ''}.`}
        {data.year_end_locked ? '' : ' Kỳ cuối năm chưa khoá số liệu nên chưa ghi được.'}
      </p>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <table className="w-full text-content">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-2 py-2">Học sinh</th>
            <th className="px-2 py-2">Kết quả cuối năm</th>
            <th className="px-2 py-2">Rèn luyện, kiểm tra lại</th>
            <th className="px-2 py-2">Kết quả</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.child_id} className="border-t border-border align-top">
              <td className="px-2 py-2 font-medium">{row.full_name}</td>
              <td className="px-2 py-2">{resultLabel(row.year_result)}</td>
              <td className="px-2 py-2">
                {row.year_result === 'not_completed' ? (
                  <div className="flex flex-col gap-1">
                    <select
                      aria-label={`Hình thức của ${row.full_name}`}
                      value={draft[row.child_id]?.plan ?? ''}
                      disabled={!canEdit}
                      onChange={(event) => set(row.child_id, 'plan', event.target.value)}
                      className="rounded-lg border border-border bg-card px-2 py-1"
                    >
                      <option value="">Chưa chọn</option>
                      {(Object.keys(SUPPORT_PLAN_LABELS) as SupportPlan[]).map((plan) => (
                        <option key={plan} value={plan}>
                          {SUPPORT_PLAN_LABELS[plan]}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={`Đánh giá bổ sung của ${row.full_name}`}
                      value={draft[row.child_id]?.result ?? ''}
                      disabled={!canEdit}
                      onChange={(event) => set(row.child_id, 'result', event.target.value)}
                      className="rounded-lg border border-border bg-card px-2 py-1"
                    >
                      <option value="">Chưa đánh giá bổ sung</option>
                      <option value="completed">Đạt</option>
                      <option value="not_completed">Chưa đạt</option>
                    </select>
                  </div>
                ) : null}
              </td>
              <td className="px-2 py-2">
                {row.result
                  ? `${COMPLETION_OUTCOME_LABELS[row.result.outcome]}${row.result.next_grade_level ? ` (khối năm sau ${row.result.next_grade_level})` : ''}`
                  : row.suggested_outcome
                    ? `Gợi ý: ${COMPLETION_OUTCOME_LABELS[row.suggested_outcome]}`
                    : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {canEdit ? (
        <div>
          <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
            Ghi kết quả hoàn thành chương trình
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function RecordsTab({ classId, onSaved }: { classId: string; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const view = useQuery({
    queryKey: ['class-records', classId],
    queryFn: () => readClassRecords(classId),
    retry: false,
  });
  const [comments, setComments] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (view.data) {
      setComments(
        Object.fromEntries(
          view.data.rows
            .filter((row) => row.record)
            .map((row) => [row.record?.id ?? '', row.record?.homeroom_comment ?? '']),
        ),
      );
    }
  }, [view.data]);
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['class-records', classId] });
    onSaved(message);
  };
  const prepare = useMutation({
    mutationFn: () => prepareRecords(classId),
    onSuccess: (result) => refresh(`Đã lập ${result.prepared} học bạ`),
  });
  const comment = useMutation({
    mutationFn: (recordId: string) => saveComment(recordId, comments[recordId] ?? ''),
    onSuccess: () => refresh('Đã lưu nhận xét'),
  });
  const sign = useMutation({ mutationFn: signRecord, onSuccess: () => refresh('Đã xác nhận và kí học bạ') });
  const reopen = useMutation({
    mutationFn: (recordId: string) => reopenRecord(recordId, reason),
    onSuccess: () => refresh('Đã mở lại học bạ'),
  });
  const download = useMutation({
    mutationFn: (input: { recordId: string; name: string }) =>
      downloadPdf(`/api/v1/learning-records/learning-records/${input.recordId}/file`, `hoc-ba-${input.name}.pdf`),
  });
  if (view.error) {
    return <Alert tone="warning">{messageOf(view.error)}</Alert>;
  }
  const data = view.data;
  if (!data) {
    return null;
  }
  const error = prepare.error ?? comment.error ?? sign.error ?? reopen.error ?? download.error;
  const canEdit = data.access.homeroom || data.access.approve;
  return (
    <section className="flex flex-col gap-3" aria-label="Học bạ của lớp">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <div className="flex flex-wrap items-end gap-3">
        {canEdit ? (
          <Button
            variant="primary"
            disabled={prepare.isPending || !data.year_end_locked}
            onClick={() => prepare.mutate()}
          >
            Lập học bạ
          </Button>
        ) : null}
        {data.access.approve ? (
          <TextField label="Lý do mở lại" value={reason} onChange={(event) => setReason(event.target.value)} />
        ) : null}
        {data.year_end_locked ? null : (
          <span className="text-label text-text-secondary">
            Kỳ cuối năm chưa khoá số liệu nên chưa lập được học bạ.
          </span>
        )}
      </div>
      <table className="w-full text-content">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-2 py-2">Học sinh</th>
            <th className="px-2 py-2">Trạng thái</th>
            <th className="px-2 py-2">Nhận xét của giáo viên chủ nhiệm</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => {
            const record = row.record;
            return (
              <tr key={row.child_id} className="border-t border-border align-top">
                <td className="px-2 py-2 font-medium">{row.full_name}</td>
                <td className="px-2 py-2">
                  {record ? (
                    <StatusBadge
                      tone={record.status === 'signed' ? 'success' : 'info'}
                      label={record.status === 'signed' ? `Đã kí (${record.signer_name ?? ''})` : 'Nháp'}
                    />
                  ) : (
                    'Chưa lập'
                  )}
                </td>
                <td className="px-2 py-2">
                  {record ? (
                    <input
                      aria-label={`Nhận xét học bạ của ${row.full_name}`}
                      className="w-full rounded-lg border border-border bg-card px-2 py-1"
                      value={comments[record.id] ?? ''}
                      disabled={!canEdit || record.status === 'signed'}
                      onChange={(event) => setComments({ ...comments, [record.id]: event.target.value })}
                      onBlur={() => {
                        if (
                          canEdit &&
                          record.status !== 'signed' &&
                          (comments[record.id] ?? '') !== (record.homeroom_comment ?? '')
                        ) {
                          comment.mutate(record.id);
                        }
                      }}
                    />
                  ) : null}
                </td>
                <td className="flex flex-wrap gap-2 px-2 py-2">
                  {record ? (
                    <Button onClick={() => download.mutate({ recordId: record.id, name: row.full_name })}>
                      Tải PDF
                    </Button>
                  ) : null}
                  {record && data.access.approve && record.status === 'draft' ? (
                    <Button
                      variant="primary"
                      aria-label={`Kí học bạ của ${row.full_name}`}
                      disabled={sign.isPending}
                      onClick={() => sign.mutate(record.id)}
                    >
                      Xác nhận và kí
                    </Button>
                  ) : null}
                  {record && data.access.approve && record.status === 'signed' ? (
                    <Button
                      disabled={reopen.isPending || reason.trim() === ''}
                      onClick={() => reopen.mutate(record.id)}
                    >
                      Mở lại
                    </Button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function TitlesTab({ onSaved }: { onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const titles = useQuery({ queryKey: ['award-titles'], queryFn: readTitles });
  const defaults = useMutation({
    mutationFn: loadTitleDefaults,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['award-titles'] });
      await queryClient.invalidateQueries({ queryKey: ['class-awards'] });
      onSaved(`Đã nạp ${result.created} danh hiệu mặc định`);
    },
  });
  return (
    <div className="flex flex-col gap-3">
      {defaults.error ? <Alert tone="danger">{messageOf(defaults.error)}</Alert> : null}
      <div>
        <Button disabled={defaults.isPending} onClick={() => defaults.mutate()}>
          Nạp danh hiệu mặc định (Thông tư 27/2020)
        </Button>
      </div>
      <ul className="flex flex-col gap-1 text-content" aria-label="Danh hiệu khen thưởng">
        {(titles.data ?? []).map((title) => (
          <li key={title.id}>
            {title.name} · {title.kind === 'year_end' ? 'Cuối năm' : 'Đột xuất'}
            {title.status === 'inactive' ? ' · Ngừng dùng' : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LearningRecordsPage() {
  const canApprove = useHasPermission(PERMISSION_CODES.studentRecordApprove);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [tab, setTab] = useState<Tab>('awards');
  const [classId, setClassId] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const classes = useQuery({
    queryKey: ['classes', orgUnitId],
    queryFn: () => listClasses(orgUnitId ?? ''),
    enabled: orgUnitId !== undefined,
  });
  const primaryClasses = (classes.data ?? []).filter((item) => item.status === 'active' && item.school_level === 'TH');
  const selectedClassId = classId || primaryClasses[0]?.id || '';
  const tabs = (Object.keys(TAB_LABELS) as Tab[]).filter((code) => canApprove || code !== 'titles');
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/learning-records')}</h1>
        <div className="flex flex-wrap items-end gap-4">
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Lớp
            <select
              value={selectedClassId}
              onChange={(event) => setClassId(event.target.value)}
              className={SELECT_CLASS}
            >
              {primaryClasses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Học bạ, khen thưởng, lên lớp">
          {tabs.map((code) => (
            <Button
              key={code}
              role="tab"
              aria-selected={tab === code}
              variant={tab === code ? 'primary' : 'secondary'}
              onClick={() => setTab(code)}
            >
              {TAB_LABELS[code]}
            </Button>
          ))}
        </div>
        {classes.data && primaryClasses.length === 0 ? <Alert tone="info">Đơn vị chưa có lớp Tiểu học.</Alert> : null}
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
          {tab === 'titles' ? <TitlesTab onSaved={setToastMessage} /> : null}
          {selectedClassId && tab === 'awards' ? (
            <AwardsTab classId={selectedClassId} onSaved={setToastMessage} />
          ) : null}
          {selectedClassId && tab === 'completion' ? (
            <CompletionTab classId={selectedClassId} onSaved={setToastMessage} />
          ) : null}
          {selectedClassId && tab === 'records' ? (
            <RecordsTab classId={selectedClassId} onSaved={setToastMessage} />
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
