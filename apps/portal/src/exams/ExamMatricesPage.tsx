import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import { messageOf, NO_LEVEL_MESSAGE, ScopeFilters, useExamScope } from './exam-filters.js';
import {
  COGNITIVE_LABELS,
  listMatrices,
  listTopics,
  QUESTION_TYPE_LABELS,
  saveMatrix,
  type CognitiveLevel,
  type Matrix,
  type MatrixRow,
  type QuestionType,
} from './exams-api.js';

// 8.2 Ma trận đề (DT-21 phần 22g1, YCTD-168): ma trận theo môn, khối (dòng chủ đề × mức nhận thức × dạng câu, số câu, điểm
// mỗi câu, yêu cầu cần đạt là bảng đặc tả), tỉ lệ điểm theo mức mẫu và sai số; máy chủ kiểm tổng điểm, tỉ lệ và báo lệch
const LEVELS = Object.keys(COGNITIVE_LABELS) as CognitiveLevel[];
const EMPTY_ROW: MatrixRow = {
  topic_id: null,
  topic_name: '',
  cognitive_level: 'recognition',
  question_type: 'multiple_choice',
  count: 1,
  score_each: 0.25,
  requirement: '',
};

export function ExamMatricesPage() {
  const scope = useExamScope();
  const reviewer = useHasPermission(PERMISSION_CODES.examReview);
  const manager = useHasPermission(PERMISSION_CODES.examManage);
  const canEdit = reviewer || manager;
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const matrices = useQuery({
    queryKey: ['exam-matrices', scope.level],
    queryFn: () => listMatrices(scope.level ?? 'THCS'),
    enabled: Boolean(scope.level),
  });
  const topics = useQuery({
    queryKey: ['question-topics', scope.subjectId],
    queryFn: () => listTopics(scope.subjectId),
    enabled: Boolean(scope.subjectId),
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [ratios, setRatios] = useState<Record<CognitiveLevel, number>>({
    recognition: 40,
    comprehension: 30,
    application: 20,
    high_application: 10,
  });
  const [rows, setRows] = useState<MatrixRow[]>([{ ...EMPTY_ROW }]);
  const save = useMutation({
    mutationFn: () =>
      saveMatrix(editing, {
        school_level: scope.level,
        subject_id: scope.subjectId,
        grade_level_code: scope.grade,
        name,
        total_score: 10,
        target_ratios: ratios,
        rows,
      }),
    onSuccess: async (matrix) => {
      setEditing(matrix.id);
      await queryClient.invalidateQueries({ queryKey: ['exam-matrices'] });
      setToastMessage(
        matrix.issues.length === 0
          ? 'Đã lưu ma trận, ma trận hợp lệ'
          : 'Đã lưu ma trận; ma trận còn lệch, xem phần kiểm tra',
      );
    },
  });
  const open = (matrix: Matrix) => {
    scope.setSubjectId(matrix.subject_id);
    scope.setGrade(matrix.grade_level_code);
    setEditing(matrix.id);
    setName(matrix.name);
    setRatios(matrix.target_ratios);
    setRows(matrix.rows);
  };
  const current = matrices.data?.find((matrix) => matrix.id === editing);
  const update = (index: number, changes: Partial<MatrixRow>) =>
    setRows((items) => items.map((item, position) => (position === index ? { ...item, ...changes } : item)));

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/exam-matrices')}</h1>
        {!scope.level ? (
          <Alert tone="info">{NO_LEVEL_MESSAGE}</Alert>
        ) : (
          <>
            <section className="flex flex-col gap-2" aria-label="Các ma trận">
              <table className="w-full text-content" aria-label="Ma trận đề">
                <thead className="text-left text-label font-medium text-text-secondary">
                  <tr>
                    <th className="px-3 py-2">Tên</th>
                    <th className="px-3 py-2">Khối</th>
                    <th className="px-3 py-2">Số câu</th>
                    <th className="px-3 py-2">Điểm</th>
                    <th className="px-3 py-2">Kiểm tra</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {(matrices.data ?? []).map((matrix) => (
                    <tr key={matrix.id} className="border-t border-border">
                      <td className="px-3 py-2">{matrix.name}</td>
                      <td className="px-3 py-2">{matrix.grade_level_code}</td>
                      <td className="px-3 py-2">{matrix.summary.count}</td>
                      <td className="px-3 py-2">{matrix.summary.score}</td>
                      <td className="px-3 py-2">
                        {matrix.issues.length === 0 ? 'Hợp lệ' : `${matrix.issues.length} điểm lệch`}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="text" onClick={() => open(matrix)}>
                          Mở
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            {canEdit ? (
              <section className="flex flex-col gap-3" aria-label="Soạn ma trận">
                <h2 className="text-section-title font-semibold text-text">
                  {editing ? 'Sửa ma trận' : 'Ma trận mới'}
                </h2>
                <ScopeFilters scope={scope} />
                {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
                <label className="text-label font-medium text-text">
                  Tên ma trận
                  <input
                    aria-label="Tên ma trận"
                    className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  {LEVELS.map((level) => (
                    <label key={level} className="text-label font-medium text-text">
                      Tỉ lệ {COGNITIVE_LABELS[level]} (%)
                      <input
                        type="number"
                        aria-label={`Tỉ lệ ${COGNITIVE_LABELS[level]}`}
                        className={`mt-2 block w-24 ${FORM_CONTROL_CLASS}`}
                        value={ratios[level]}
                        onChange={(event) => setRatios({ ...ratios, [level]: Number(event.target.value) })}
                      />
                    </label>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-content" aria-label="Dòng của ma trận">
                    <thead className="text-left text-label font-medium text-text-secondary">
                      <tr>
                        <th className="px-2 py-2">Chủ đề</th>
                        <th className="px-2 py-2">Mức</th>
                        <th className="px-2 py-2">Dạng</th>
                        <th className="px-2 py-2">Số câu</th>
                        <th className="px-2 py-2">Điểm mỗi câu</th>
                        <th className="px-2 py-2">Yêu cầu cần đạt</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={index} className="border-t border-border">
                          <td className="px-2 py-1">
                            <select
                              aria-label={`Chủ đề dòng ${index + 1}`}
                              className={FORM_CONTROL_CLASS}
                              value={row.topic_id ?? ''}
                              onChange={(event) => update(index, { topic_id: event.target.value || null })}
                            >
                              <option value="">Mọi chủ đề</option>
                              {(topics.data ?? []).map((topic) => (
                                <option key={topic.id} value={topic.id}>
                                  {topic.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <select
                              aria-label={`Mức dòng ${index + 1}`}
                              className={FORM_CONTROL_CLASS}
                              value={row.cognitive_level}
                              onChange={(event) =>
                                update(index, { cognitive_level: event.target.value as CognitiveLevel })
                              }
                            >
                              {LEVELS.map((level) => (
                                <option key={level} value={level}>
                                  {COGNITIVE_LABELS[level]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <select
                              aria-label={`Dạng dòng ${index + 1}`}
                              className={FORM_CONTROL_CLASS}
                              value={row.question_type}
                              onChange={(event) => update(index, { question_type: event.target.value as QuestionType })}
                            >
                              {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              aria-label={`Số câu dòng ${index + 1}`}
                              className={`w-20 ${FORM_CONTROL_CLASS}`}
                              value={row.count}
                              onChange={(event) => update(index, { count: Number(event.target.value) })}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              step="0.25"
                              aria-label={`Điểm mỗi câu dòng ${index + 1}`}
                              className={`w-24 ${FORM_CONTROL_CLASS}`}
                              value={row.score_each}
                              onChange={(event) => update(index, { score_each: Number(event.target.value) })}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              aria-label={`Yêu cầu cần đạt dòng ${index + 1}`}
                              className={FORM_CONTROL_CLASS}
                              value={row.requirement ?? ''}
                              onChange={(event) => update(index, { requirement: event.target.value })}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <Button
                              variant="text"
                              onClick={() => setRows(rows.filter((_item, position) => position !== index))}
                            >
                              Bỏ
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setRows([...rows, { ...EMPTY_ROW }])}>Thêm dòng</Button>
                  <Button
                    variant="primary"
                    disabled={!name.trim() || !scope.subjectId || !scope.grade || save.isPending}
                    onClick={() => save.mutate()}
                  >
                    Lưu ma trận
                  </Button>
                  {editing ? (
                    <Button
                      onClick={() => {
                        setEditing(null);
                        setName('');
                        setRows([{ ...EMPTY_ROW }]);
                      }}
                    >
                      Ma trận mới
                    </Button>
                  ) : null}
                </div>
                {current ? (
                  <section aria-label="Kiểm tra ma trận" className="flex flex-col gap-1">
                    <p className="text-content text-text">
                      {current.summary.count} câu, {current.summary.score} điểm;{' '}
                      {LEVELS.map((level) => `${COGNITIVE_LABELS[level]} ${current.summary.ratios[level]}%`).join(', ')}
                    </p>
                    {current.issues.length === 0 ? (
                      <Alert tone="success">Ma trận hợp lệ.</Alert>
                    ) : (
                      current.issues.map((issue, index) => (
                        <Alert key={index} tone="warning">
                          {issue.message}
                        </Alert>
                      ))
                    )}
                  </section>
                ) : null}
              </section>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
