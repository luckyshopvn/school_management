import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ALL_SCHOOL_LEVELS,
  portalWorkspacesForLevels,
  schoolLevelContextLabel,
  schoolLevelTerms,
  workingSchoolLevels,
  type SchoolLevelCode,
  type PortalWorkspace,
  type SchoolLevelTerms,
} from '@school-management/shared';
import { fetchCurrentUser, requestJson } from '../session/api-client.js';
import { readPortalSchoolLevels, type PortalSchoolLevel } from '../portal-shell/portal-shell-api.js';
import { listSchoolLevels } from './school-levels-api.js';

// Cấp đang làm việc ở cổng quản trị (DT-19 phần 19c, YCTD-153): cấp người dùng được xem lấy từ ngữ cảnh trường, cấp đã chọn
// lưu theo tài khoản ở dịch vụ định danh (giữ qua các máy). Trường một cấp luôn làm việc ở cấp đó và không hiện bộ chọn
const PRESCHOOL_ONLY: PortalSchoolLevel[] = [
  { code: 'MN', display_name: 'Mầm non', learner_term: 'Trẻ', context_label: 'Cấp MN' },
];

export interface WorkingSchoolLevels {
  // Đã tải xong ngữ cảnh trường; chưa xong thì mọi thứ giữ như trường mầm non
  ready: boolean;
  visible: PortalSchoolLevel[];
  working: PortalSchoolLevel[];
  // Cấp đã chọn, null là "Tất cả"
  selected: SchoolLevelCode | null;
  // Giá trị tham số cấp dùng chung (?school_level=) gửi lên API; undefined là mọi cấp được xem
  parameter: SchoolLevelCode | undefined;
  terms: SchoolLevelTerms;
  contextLabel: string;
}

export function useWorkingSchoolLevels(): WorkingSchoolLevels {
  const context = useQuery({ queryKey: ['portal-context', 'school-levels'], queryFn: readPortalSchoolLevels });
  const currentUser = useQuery({ queryKey: ['current-user'], queryFn: fetchCurrentUser });
  const levels = context.data?.school_levels;
  const preferred = currentUser.data?.working_school_level ?? null;
  return useMemo(() => {
    const visible = levels && levels.length > 0 ? levels : PRESCHOOL_ONLY;
    const codes = workingSchoolLevels(
      visible.map((level) => level.code),
      preferred,
    );
    const working = visible.filter((level) => codes.includes(level.code));
    const selected = visible.length > 1 && working.length === 1 ? (working[0]?.code ?? null) : null;
    return {
      ready: levels !== undefined,
      visible,
      working,
      selected,
      parameter: selected ?? undefined,
      terms: schoolLevelTerms(working),
      contextLabel: schoolLevelContextLabel(working),
    };
  }, [levels, preferred]);
}

// Nhãn thuật ngữ theo cấp đang làm việc ("Trẻ" hay "Học sinh"), dùng thay chữ ghi cứng ở từng trang
export function useSchoolLevelTerms(): SchoolLevelTerms {
  return useWorkingSchoolLevels().terms;
}

function saveWorkingSchoolLevel(code: SchoolLevelCode | null): Promise<{ working_school_level: string | null }> {
  return requestJson('/api/v1/auth/me/working-school-level', {
    method: 'PUT',
    body: JSON.stringify({ school_level: code }),
  });
}

// Bộ chọn cấp ở thanh đầu trang, cạnh ô ngữ cảnh năm học: chỉ hiện khi người dùng được xem từ hai cấp trở lên. "Tất cả" là
// mặc định; đổi cấp thì menu, nhãn thuật ngữ và ô ngữ cảnh đổi theo ngay
export function SchoolLevelSwitcher() {
  const levels = useWorkingSchoolLevels();
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: saveWorkingSchoolLevel,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['current-user'] });
    },
  });
  if (levels.visible.length < 2) {
    return null;
  }
  return (
    <label className="hidden items-center gap-1.5 text-label font-semibold text-white md:flex">
      <span>Cấp học</span>
      <select
        className="h-9 rounded-md border border-white/60 bg-header px-2 text-label font-semibold text-white hover:bg-header-strong"
        aria-label="Cấp học đang làm việc"
        data-testid="school-level-switcher"
        value={levels.selected ?? ALL_SCHOOL_LEVELS}
        disabled={save.isPending}
        onChange={(event) => {
          const value = event.target.value;
          save.mutate(value === ALL_SCHOOL_LEVELS ? null : (value as SchoolLevelCode));
        }}
      >
        <option value={ALL_SCHOOL_LEVELS}>Tất cả</option>
        {levels.visible.map((level) => (
          <option key={level.code} value={level.code}>
            {level.display_name}
          </option>
        ))}
      </select>
      {save.isError ? (
        <span role="alert" className="text-label">
          Chưa lưu được cấp học
        </span>
      ) : null}
    </label>
  );
}

// Phân hệ và mục menu thuộc cấp trường đang bật, cho cây quyền ở 1.3 Phân quyền nhóm theo menu (DT-19 phần 19c): mục của
// cấp chưa bật ẩn khỏi cây; trường chỉ có Mầm non giữ đủ cây như trước. Chưa tải xong thì dùng cây của trường mầm non
export function useEnabledLevelWorkspaces(): PortalWorkspace[] {
  const levels = useQuery({ queryKey: ['school-levels'], queryFn: listSchoolLevels });
  return useMemo(() => {
    const enabled = levels.data?.levels.filter((level) => level.is_enabled);
    return portalWorkspacesForLevels(
      enabled && enabled.length > 0 ? enabled : [{ code: 'MN', display_name: 'Mầm non' }],
    );
  }, [levels.data]);
}
