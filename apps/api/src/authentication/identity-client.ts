import { Inject, Injectable, Logger } from '@nestjs/common';
import { ApplicationError, unauthenticatedError } from '@school-management/server';
import { API_VERSION_PREFIX } from '@school-management/shared';
import { API_CONFIGURATION, type ApiConfiguration } from '../common/configuration.js';
import type { CurrentUserDescription } from './current-user.js';

const IDENTITY_TIMEOUT_MILLISECONDS = 5000;

// Hỏi dịch vụ định danh vai trò và quyền hiện hành ở mỗi yêu cầu, không lưu bộ nhớ đệm (QĐ-20, PQ-04)
export interface ApiClientIdentity {
  id: string;
  name: string;
  scopes: Array<'reports' | 'finance' | 'children' | 'staff'>;
  legal_basis: string | null;
}

@Injectable()
export class IdentityClient {
  private readonly logger = new Logger('IdentityClient');

  constructor(@Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration) {}

  async describeCurrentUser(accessToken: string): Promise<CurrentUserDescription> {
    let response: Response;
    try {
      response = await fetch(`${this.configuration.identityBaseUrl}${API_VERSION_PREFIX}/auth/me`, {
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(IDENTITY_TIMEOUT_MILLISECONDS),
      });
    } catch (error) {
      this.logger.error('Không liên lạc được với dịch vụ định danh', error instanceof Error ? error.message : '');
      throw new ApplicationError('ERR_INTERNAL', 'Dịch vụ xác thực tạm thời không truy cập được, vui lòng thử lại sau');
    }
    if (response.status === 401) {
      throw unauthenticatedError();
    }
    if (!response.ok) {
      this.logger.error(`Dịch vụ định danh trả mã trạng thái ${response.status}`);
      throw new ApplicationError('ERR_INTERNAL', 'Dịch vụ xác thực tạm thời không truy cập được, vui lòng thử lại sau');
    }
    return (await response.json()) as CurrentUserDescription;
  }

  // Danh bạ nhân sự theo vai trò và đơn vị, gọi bằng mã phiên của người đang thao tác (YCTD-44)
  async listStaff(accessToken: string, roleCode: string, orgUnitId: string): Promise<StaffDirectoryEntry[]> {
    const query = new URLSearchParams({ role_code: roleCode, org_unit_id: orgUnitId });
    let response: Response;
    try {
      response = await fetch(`${this.configuration.identityBaseUrl}${API_VERSION_PREFIX}/users/directory?${query}`, {
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(IDENTITY_TIMEOUT_MILLISECONDS),
      });
    } catch (error) {
      this.logger.error('Không liên lạc được với dịch vụ định danh', error instanceof Error ? error.message : '');
      throw new ApplicationError('ERR_INTERNAL', 'Không đọc được danh sách nhân sự, vui lòng thử lại sau');
    }
    if (response.status === 403) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền phân công giáo viên ở đơn vị này');
    }
    if (!response.ok) {
      this.logger.error(`Dịch vụ định danh trả mã trạng thái ${response.status} khi đọc danh bạ nhân sự`);
      throw new ApplicationError('ERR_INTERNAL', 'Không đọc được danh sách nhân sự, vui lòng thử lại sau');
    }
    return (await response.json()) as StaffDirectoryEntry[];
  }

  // Tạo hoặc gắn vai trò phụ huynh cho số điện thoại, bằng mã phiên của người duyệt hồ sơ (QT-01 bước 9, YCTD-45)
  async ensureGuardianAccount(
    accessToken: string,
    input: { phone: string; full_name: string; org_unit_id: string },
  ): Promise<GuardianAccountResult> {
    let response: Response;
    try {
      response = await fetch(`${this.configuration.identityBaseUrl}${API_VERSION_PREFIX}/users/guardian-accounts`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(IDENTITY_TIMEOUT_MILLISECONDS),
      });
    } catch (error) {
      this.logger.error('Không liên lạc được với dịch vụ định danh', error instanceof Error ? error.message : '');
      throw new ApplicationError('ERR_INTERNAL', 'Không tạo được tài khoản phụ huynh, vui lòng thử lại sau');
    }
    if (!response.ok) {
      // Lỗi nghiệp vụ của dịch vụ định danh (ví dụ chưa đặt mật khẩu mặc định) trả nguyên cho người dùng
      const body = (await response.json().catch(() => ({}))) as {
        error?: {
          code?: string;
          message?: string;
          details?: Array<{ field: string; message: string }>;
          rule_code?: string;
        };
      };
      if (response.status === 403 || response.status === 422 || response.status === 400) {
        throw new ApplicationError(
          (body.error?.code as 'ERR_FORBIDDEN' | 'ERR_RULE_VIOLATION' | 'ERR_VALIDATION') ?? 'ERR_INTERNAL',
          body.error?.message ?? 'Không tạo được tài khoản phụ huynh',
          body.error?.details ?? [],
          undefined,
          body.error?.rule_code,
        );
      }
      this.logger.error(`Dịch vụ định danh trả mã trạng thái ${response.status} khi tạo tài khoản phụ huynh`);
      throw new ApplicationError('ERR_INTERNAL', 'Không tạo được tài khoản phụ huynh, vui lòng thử lại sau');
    }
    return (await response.json()) as GuardianAccountResult;
  }

  // Tra tài khoản nhân sự có sẵn để liên kết với hồ sơ nhân sự (P07-01, YCTD-58)
  lookupStaffAccount(accessToken: string, input: { login: string; org_unit_id: string }) {
    return this.postJson<StaffAccountResult>(accessToken, '/users/staff-accounts/lookup', input, 'tra tài khoản');
  }

  // Khóa tài khoản khi chấm dứt hợp đồng lao động (BR-05, YCTD-58)
  terminateEmployment(accessToken: string, userId: string, orgUnitId: string) {
    return this.postJson<StaffAccountResult>(
      accessToken,
      `/users/${userId}/terminate-employment`,
      { org_unit_id: orgUnitId },
      'khóa tài khoản',
    );
  }

  // Kiểm tra khóa API của đối tác kèm địa chỉ mạng gọi tới (P01-14, BM-65, YCTD-63); khóa sai trả ERR_UNAUTHENTICATED
  async verifyApiKey(key: string, ip: string): Promise<ApiClientIdentity> {
    let response: Response;
    try {
      response = await fetch(`${this.configuration.identityBaseUrl}${API_VERSION_PREFIX}/api-clients/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, ip }),
        signal: AbortSignal.timeout(IDENTITY_TIMEOUT_MILLISECONDS),
      });
    } catch (error) {
      this.logger.error('Không liên lạc được với dịch vụ định danh', error instanceof Error ? error.message : '');
      throw new ApplicationError('ERR_INTERNAL', 'Không kiểm tra được khóa API, vui lòng thử lại sau');
    }
    if (response.status === 401) {
      throw new ApplicationError(
        'ERR_UNAUTHENTICATED',
        'Khóa API không hợp lệ, đã thu hồi, hết hạn hoặc sai địa chỉ mạng',
      );
    }
    if (!response.ok) {
      throw new ApplicationError('ERR_INTERNAL', 'Không kiểm tra được khóa API, vui lòng thử lại sau');
    }
    return (await response.json()) as ApiClientIdentity;
  }

  // Danh sách người dùng của 1.4 (P01-06), bằng mã phiên của người thao tác; dịch vụ định danh lọc theo phạm vi (DT-16 16d)
  listAccounts(accessToken: string, query: URLSearchParams) {
    return this.requestJson<IdentityAccountPage>(
      accessToken,
      `/users?${query.toString()}`,
      undefined,
      'đọc danh sách người dùng',
    );
  }

  // Tạo tài khoản kèm nhóm quyền cho nhân sự chưa có tài khoản (Lấy danh sách CBQL/GV, DT-16 phần 16d)
  createAccount(
    accessToken: string,
    input: {
      full_name: string;
      phone: string | null;
      username: string | null;
      valid_until: null;
      roles: Array<{ role_code: string; org_unit_id: string | null }>;
    },
  ) {
    return this.postJson<{ account: { id: string }; temporary_password: string | null }>(
      accessToken,
      '/users',
      input,
      'tạo tài khoản',
    );
  }

  // Gọi dịch vụ định danh bằng mã phiên của người thao tác; lỗi nghiệp vụ trả nguyên mã lỗi và nội dung
  private postJson<Result>(accessToken: string, path: string, body: unknown, action: string): Promise<Result> {
    return this.requestJson<Result>(accessToken, path, body, action);
  }

  // Có nội dung thì gửi POST, không có thì GET
  private async requestJson<Result>(accessToken: string, path: string, body: unknown, action: string): Promise<Result> {
    let response: Response;
    try {
      response = await fetch(`${this.configuration.identityBaseUrl}${API_VERSION_PREFIX}${path}`, {
        ...(body === undefined
          ? { headers: { authorization: `Bearer ${accessToken}` } }
          : {
              method: 'POST',
              headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
              body: JSON.stringify(body),
            }),
        signal: AbortSignal.timeout(IDENTITY_TIMEOUT_MILLISECONDS),
      });
    } catch (error) {
      this.logger.error('Không liên lạc được với dịch vụ định danh', error instanceof Error ? error.message : '');
      throw new ApplicationError('ERR_INTERNAL', `Không ${action} được, vui lòng thử lại sau`);
    }
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: {
          code?: string;
          message?: string;
          details?: Array<{ field: string; message: string }>;
          rule_code?: string;
        };
      };
      if ([400, 403, 404, 409, 422].includes(response.status) && payload.error?.code) {
        throw new ApplicationError(
          payload.error.code as 'ERR_FORBIDDEN',
          payload.error.message ?? `Không ${action} được`,
          payload.error.details ?? [],
          undefined,
          payload.error.rule_code,
        );
      }
      this.logger.error(`Dịch vụ định danh trả mã trạng thái ${response.status} khi ${action}`);
      throw new ApplicationError('ERR_INTERNAL', `Không ${action} được, vui lòng thử lại sau`);
    }
    return (await response.json()) as Result;
  }
}

export interface StaffAccountResult {
  user_id: string;
  full_name: string;
  username: string | null;
  phone: string | null;
  status: 'active' | 'locked';
}

export interface GuardianAccountResult {
  user_id: string;
  created: boolean;
  role_added: boolean;
}

export interface StaffDirectoryEntry {
  user_id: string;
  full_name: string;
  role_code: string;
  org_unit_id: string | null;
}

// Một trang của danh sách người dùng ở dịch vụ định danh (GET /users)
export interface IdentityAccount {
  id: string;
  full_name: string;
  phone: string | null;
  username: string | null;
  status: 'active' | 'locked';
  must_change_password: boolean;
  valid_until: string | null;
  last_login_at: string | null;
  password_changed_at: string;
  password_expires_at: string | null;
  assignments: Array<{ assignment_id: string; role_code: string; role_name: string; org_unit_id: string | null }>;
}

export interface IdentityAccountPage {
  items: IdentityAccount[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}
