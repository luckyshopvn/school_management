import { Inject, Injectable, Logger } from '@nestjs/common';
import { ApplicationError, unauthenticatedError } from '@school-management/server';
import { API_VERSION_PREFIX } from '@school-management/shared';
import { API_CONFIGURATION, type ApiConfiguration } from '../common/configuration.js';
import type { CurrentUserDescription } from './current-user.js';

const IDENTITY_TIMEOUT_MILLISECONDS = 5000;

// Hỏi dịch vụ định danh vai trò và quyền hiện hành ở mỗi yêu cầu, không lưu bộ nhớ đệm (QĐ-20, PQ-04)
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
}

export interface StaffDirectoryEntry {
  user_id: string;
  full_name: string;
  role_code: string;
  org_unit_id: string | null;
}
