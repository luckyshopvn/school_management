import { Inject, Injectable, Logger } from '@nestjs/common';
import { ApplicationError } from '@school-management/server';
import { API_VERSION_PREFIX } from '@school-management/shared';
import { IDENTITY_CONFIGURATION, type IdentityConfiguration } from '../common/configuration.js';

// Dịch vụ định danh không đọc được cây đơn vị (nằm ở cơ sở dữ liệu năm học); hỏi máy chủ API bằng mã phiên của người đang thao tác
export interface OrgUnitSummary {
  id: string;
  name: string;
  unit_type: 'truong_chinh' | 'phan_hieu' | 'diem_truong';
  status: 'active' | 'inactive';
}

export abstract class OrganizationDirectory {
  abstract listUnits(accessToken: string): Promise<OrgUnitSummary[]>;
}

@Injectable()
export class ApiOrganizationDirectory extends OrganizationDirectory {
  private readonly logger = new Logger('OrganizationDirectory');

  constructor(@Inject(IDENTITY_CONFIGURATION) private readonly configuration: IdentityConfiguration) {
    super();
  }

  async listUnits(accessToken: string): Promise<OrgUnitSummary[]> {
    let response: Response;
    try {
      response = await fetch(`${this.configuration.apiBaseUrl}${API_VERSION_PREFIX}/org-units`, {
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      this.logger.error('Không liên lạc được với máy chủ API', error instanceof Error ? error.message : '');
      throw new ApplicationError('ERR_INTERNAL', 'Không đọc được cây đơn vị, vui lòng thử lại sau');
    }
    if (!response.ok) {
      this.logger.error(`Máy chủ API trả mã trạng thái ${response.status} khi đọc cây đơn vị`);
      throw new ApplicationError('ERR_INTERNAL', 'Không đọc được cây đơn vị, vui lòng thử lại sau');
    }
    return (await response.json()) as OrgUnitSummary[];
  }
}
