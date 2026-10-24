import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SchoolLevelCode } from '@school-management/shared';
import { FORM_CONTROL_CLASS } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { useEnabledSchoolLevels } from '../school-levels/enabled-levels.js';
import { listGrades, listSubjects } from './exams-api.js';

// Bộ chọn cấp (THCS, THPT đang bật), môn, khối dùng chung cho các trang kiểm tra, đánh giá (DT-21 phần 22g1)
export const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

export function useExamScope() {
  const enabled = useEnabledSchoolLevels();
  const levels = enabled.levels.filter((level) => level.value === 'THCS' || level.value === 'THPT');
  const [chosenLevel, setChosenLevel] = useState<SchoolLevelCode>();
  const level = levels.find((item) => item.value === chosenLevel)?.value ?? levels[0]?.value;
  const subjects = useQuery({
    queryKey: ['subjects', level],
    queryFn: () => listSubjects(level ?? 'THCS'),
    enabled: Boolean(level),
  });
  const grades = useQuery({
    queryKey: ['grade-levels', level],
    queryFn: () => listGrades(level ?? 'THCS'),
    enabled: Boolean(level),
  });
  const [subjectId, setSubjectId] = useState('');
  const [grade, setGrade] = useState('');
  return {
    levels,
    level,
    setLevel: (value: SchoolLevelCode) => {
      setChosenLevel(value);
      setSubjectId('');
      setGrade('');
    },
    subjects: subjects.data ?? [],
    grades: grades.data ?? [],
    subjectId,
    setSubjectId,
    grade,
    setGrade,
  };
}

export function ScopeFilters({ scope }: { scope: ReturnType<typeof useExamScope> }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {scope.levels.length > 1 ? (
        <label className="text-label font-medium text-text">
          Cấp học
          <select
            aria-label="Cấp học"
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={scope.level}
            onChange={(event) => scope.setLevel(event.target.value as SchoolLevelCode)}
          >
            {scope.levels.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="text-label font-medium text-text">
        Môn
        <select
          aria-label="Môn"
          className={`mt-2 block ${FORM_CONTROL_CLASS}`}
          value={scope.subjectId}
          onChange={(event) => scope.setSubjectId(event.target.value)}
        >
          <option value="">Chọn môn</option>
          {scope.subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-label font-medium text-text">
        Khối
        <select
          aria-label="Khối"
          className={`mt-2 block ${FORM_CONTROL_CLASS}`}
          value={scope.grade}
          onChange={(event) => scope.setGrade(event.target.value)}
        >
          <option value="">Chọn khối</option>
          {scope.grades.map((grade) => (
            <option key={grade.code} value={grade.code}>
              {grade.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export const NO_LEVEL_MESSAGE = 'Trường chưa bật cấp THCS hoặc THPT; bật cấp học ở 1.4 Cấu hình trường.';
