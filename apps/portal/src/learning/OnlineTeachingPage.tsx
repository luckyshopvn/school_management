import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { RecognitionSettings } from './RecognitionSettings.js';
import {
  createDecision,
  listDecisions,
  listSpaces,
  publishRules,
  readLearningConfig,
  readRules,
  revokeDecision,
} from './learning-api.js';

// 9.3 Hình thức và nội quy dạy học trực tuyến (DT-28 phần 28b, YCTD-272) theo Thông tư 09/2021/TT-BGDĐT: mọi lớp mặc định dạy
// học trực tuyến hỗ trợ dạy trực tiếp; dạy thay thế chỉ khi Hiệu trưởng quyết định vì lý do bất khả kháng (Điều 5 khoản 4) và
// nhập quyết định ở đây (số, ngày, lý do, lớp, thời gian); nội quy dạy học trực tuyến do trường ban hành có phiên bản (Điều 15
// khoản 3), học sinh hoặc phụ huynh xác nhận đã đọc
const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

function DecisionForm({ onSaved }: { onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const spaces = useQuery({ queryKey: ['learning-spaces', 'all'], queryFn: () => listSpaces('all') });
  const [decisionNo, setDecisionNo] = useState('');
  const [decisionDate, setDecisionDate] = useState('');
  const [reason, setReason] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [classIds, setClassIds] = useState<string[]>([]);
  const classes = [
    ...new Map(
      (spaces.data ?? []).flatMap((space) =>
        space.class_id && space.class_name ? [[space.class_id, space.class_name] as const] : [],
      ),
    ).entries(),
  ].sort((left, right) => left[1].localeCompare(right[1], 'vi'));
  const create = useMutation({
    mutationFn: () =>
      createDecision({
        decision_no: decisionNo,
        decision_date: decisionDate,
        reason,
        class_ids: classIds,
        starts_on: startsOn,
        ends_on: endsOn,
      }),
    onSuccess: async () => {
      setDecisionNo('');
      setReason('');
      setClassIds([]);
      await queryClient.invalidateQueries({ queryKey: ['online-teaching-decisions'] });
      onSaved('Đã ghi quyết định dạy học trực tuyến thay thế');
    },
  });
  return (
    <form
      aria-label="Ghi quyết định dạy học trực tuyến thay thế"
      className="flex flex-col gap-3 rounded border border-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-label font-medium text-text">
          Số quyết định
          <input
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={decisionNo}
            onChange={(event) => setDecisionNo(event.target.value)}
          />
        </label>
        <label className="text-label font-medium text-text">
          Ngày quyết định
          <input
            type="date"
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={decisionDate}
            onChange={(event) => setDecisionDate(event.target.value)}
          />
        </label>
        <label className="text-label font-medium text-text">
          Từ ngày
          <input
            type="date"
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={startsOn}
            onChange={(event) => setStartsOn(event.target.value)}
          />
        </label>
        <label className="text-label font-medium text-text">
          Đến ngày
          <input
            type="date"
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={endsOn}
            onChange={(event) => setEndsOn(event.target.value)}
          />
        </label>
      </div>
      <label className="text-label font-medium text-text">
        Lý do bất khả kháng
        <input
          className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <fieldset className="flex flex-wrap gap-3">
        <legend className="text-label font-medium text-text">Lớp áp dụng (không chọn là toàn trường)</legend>
        {classes.map(([id, name]) => (
          <label key={id} className="flex items-center gap-2 text-content text-text">
            <input
              type="checkbox"
              checked={classIds.includes(id)}
              onChange={(event) =>
                setClassIds(event.target.checked ? [...classIds, id] : classIds.filter((item) => item !== id))
              }
            />
            {name}
          </label>
        ))}
      </fieldset>
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <div>
        <Button
          type="submit"
          disabled={!decisionNo || !decisionDate || !reason || !startsOn || !endsOn || create.isPending}
        >
          Ghi quyết định
        </Button>
      </div>
    </form>
  );
}

function RulesPanel({ canDecide, onSaved }: { canDecide: boolean; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const rules = useQuery({ queryKey: ['online-learning-rules'], queryFn: readRules });
  const [draft, setDraft] = useState<string>();
  const publish = useMutation({
    mutationFn: () => publishRules(draft ?? ''),
    onSuccess: async () => {
      setDraft(undefined);
      await queryClient.invalidateQueries({ queryKey: ['online-learning-rules'] });
      onSaved('Đã ban hành nội quy dạy học trực tuyến');
    },
  });
  const current = rules.data?.current;
  return (
    <section aria-label="Nội quy dạy học trực tuyến" className="flex flex-col gap-3">
      <h2 className="text-section-title font-semibold text-text">Nội quy dạy học trực tuyến</h2>
      {current ? (
        <p className="text-label text-text-secondary">
          Phiên bản {current.version}, ban hành bởi {current.published_by_name}; {rules.data?.acknowledged ?? 0} học
          sinh đã xác nhận đã đọc
        </p>
      ) : (
        <p className="text-content text-text-secondary">Trường chưa ban hành nội quy dạy học trực tuyến.</p>
      )}
      <label className="text-label font-medium text-text">
        Nội dung nội quy
        <textarea
          className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
          rows={8}
          readOnly={!canDecide}
          value={draft ?? current?.content ?? ''}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      {canDecide ? (
        <div>
          <Button disabled={!draft || publish.isPending} onClick={() => publish.mutate()}>
            Ban hành phiên bản mới
          </Button>
        </div>
      ) : null}
      {publish.error ? <Alert tone="danger">{messageOf(publish.error)}</Alert> : null}
    </section>
  );
}

export function OnlineTeachingPage() {
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: ['learning-config'], queryFn: readLearningConfig });
  const decisions = useQuery({ queryKey: ['online-teaching-decisions'], queryFn: listDecisions });
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const revoke = useMutation({
    mutationFn: revokeDecision,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['online-teaching-decisions'] });
      setToastMessage('Đã thu hồi quyết định');
    },
  });
  const canDecide = config.data?.can_decide === true;
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/online-teaching')}</h1>
        <p className="text-content text-text-secondary">
          Mọi lớp dạy học trực tuyến hỗ trợ dạy trực tiếp. Dạy học trực tuyến thay thế chỉ khi học sinh không đến trường
          vì lý do bất khả kháng và Hiệu trưởng quyết định (Thông tư 09/2021/TT-BGDĐT Điều 5 khoản 4); kiểm tra định kỳ
          vẫn làm tại trường trừ trường hợp đó (Điều 6).
        </p>
        <h2 className="text-section-title font-semibold text-text">Quyết định dạy học trực tuyến thay thế</h2>
        {decisions.error ? <Alert tone="danger">{messageOf(decisions.error)}</Alert> : null}
        <table className="w-full text-content" aria-label="Quyết định dạy học trực tuyến thay thế">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-2">Số, ngày</th>
              <th className="px-3 py-2">Lý do</th>
              <th className="px-3 py-2">Thời gian</th>
              <th className="px-3 py-2">Phạm vi</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(decisions.data ?? []).map((decision) => (
              <tr key={decision.id} className="border-t border-border">
                <td className="px-3 py-2">
                  {decision.decision_no}, {decision.decision_date}
                </td>
                <td className="px-3 py-2">{decision.reason}</td>
                <td className="px-3 py-2">
                  {decision.starts_on} đến {decision.ends_on}
                </td>
                <td className="px-3 py-2">
                  {decision.class_ids.length === 0 ? 'Toàn trường' : `${decision.class_ids.length} lớp`}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge
                    tone={decision.status === 'active' ? 'success' : 'neutral'}
                    label={decision.status === 'active' ? 'Đang hiệu lực' : 'Đã thu hồi'}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  {canDecide && decision.status === 'active' ? (
                    <Button variant="text" onClick={() => revoke.mutate(decision.id)}>
                      Thu hồi
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
            {decisions.data && decisions.data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-2 text-text-secondary">
                  Chưa có quyết định dạy học trực tuyến thay thế.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {revoke.error ? <Alert tone="danger">{messageOf(revoke.error)}</Alert> : null}
        {canDecide ? <DecisionForm onSaved={setToastMessage} /> : null}
        <RulesPanel canDecide={canDecide} onSaved={setToastMessage} />
        {/* Huy hiệu, chứng nhận (DT-28 phần 28i): chỉ Ban Giám hiệu */}
        {canDecide ? <RecognitionSettings onSaved={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}
