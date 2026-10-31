import { useEffect, useState } from 'react';
import { ApiError, fetchCurrentUser, requestJson, type CurrentUser } from '../session/api-client.js';
import type { MyClass } from '../screens/ClassesScreen.js';
import { AI_TUTOR_FLAGS_PATH, type AiTutorFlagList } from '../screens/AiTutorFlagsScreen.js';

// Dữ liệu chung của trang chủ và thanh bên (YCTD-395, trước nằm trong ClassesScreen): người dùng và quyền, lớp đang phân công, cờ
// Gia sư AI. Tải lại mỗi khi `version` đổi (về trang chủ) để số cờ, danh sách lớp mới như khi mở lại trang chủ trước đây
export interface TeacherFeatureState {
  user?: CurrentUser;
  classes?: MyClass[];
  errorMessage?: string;
  aiTutorFlags?: AiTutorFlagList;
}

export function useTeacherFeatures(version: number): TeacherFeatureState {
  const [state, setState] = useState<TeacherFeatureState>({});

  useEffect(() => {
    let active = true;
    const update = (part: Partial<TeacherFeatureState>) => {
      if (active) {
        setState((current) => ({ ...current, ...part }));
      }
    };
    fetchCurrentUser()
      .then((user) => update({ user }))
      .catch(() => update({ user: undefined }));
    // Cờ của Gia sư AI (YCTD-383 lát L3): máy chủ chỉ trả cờ của lớp mình chủ nhiệm; lỗi thì ẩn mục
    requestJson<AiTutorFlagList>(AI_TUTOR_FLAGS_PATH)
      .then((aiTutorFlags) => update({ aiTutorFlags }))
      .catch(() => update({ aiTutorFlags: undefined }));
    requestJson<MyClass[]>('/api/v1/classes?mine=true&status=active')
      .then((classes) => update({ classes, errorMessage: undefined }))
      .catch((error: unknown) =>
        update({ errorMessage: error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ' }),
      );
    return () => {
      active = false;
    };
  }, [version]);

  return state;
}
