import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { notFoundError } from '../common/request-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

// Mọi quyền của phân hệ tuyển sinh; người có một trong các quyền được xem đợt, hồ sơ, tin trong phạm vi đơn vị (BR-01)
export const ADMISSION_PERMISSIONS = [
  PERMISSION_CODES.admissionCampaignManage,
  PERMISSION_CODES.admissionApplicationManage,
  PERMISSION_CODES.admissionApplicationReview,
  PERMISSION_CODES.admissionPostManage,
];

export interface UnitScope {
  wholeSchool: boolean;
  orgUnitIds: string[];
}

// Phân quyền phân hệ tuyển sinh (P16; YCTD-86): mỗi thao tác kiểm tra quyền trong phạm vi đơn vị của đợt tuyển sinh;
// người ở Trường chính có phạm vi toàn trường, người ở đơn vị cấp 2 chỉ thấy đợt của đơn vị đó (BR-01)
@Injectable()
export class AdmissionAccess {
  constructor(private readonly organizationScopes: OrganizationScopes) {}

  async viewScope(currentUser: CurrentUser): Promise<UnitScope> {
    const scopes = await Promise.all(
      ADMISSION_PERMISSIONS.filter((code) => currentUser.hasPermission(code)).map((code) =>
        this.organizationScopes.resolveStaff(currentUser, code),
      ),
    );
    if (scopes.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền của phân hệ tuyển sinh');
    }
    return {
      wholeSchool: scopes.some((scope) => scope.wholeSchool),
      orgUnitIds: [...new Set(scopes.flatMap((scope) => scope.orgUnitIds))],
    };
  }

  async assertCanView(currentUser: CurrentUser, orgUnitId: string): Promise<void> {
    const scope = await this.viewScope(currentUser);
    if (!scope.wholeSchool && !scope.orgUnitIds.includes(orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
  }

  async assertCan(currentUser: CurrentUser, permission: string, orgUnitId: string): Promise<void> {
    if (!currentUser.hasPermission(permission)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này', [
        { field: 'permission', message: permission },
      ]);
    }
    const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
    if (!scope.wholeSchool && !scope.orgUnitIds.includes(orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn', [
        { field: 'org_unit_id', message: permission },
      ]);
    }
  }

  async findCampaign(database: Executor, campaignId: string) {
    const campaign = await database
      .selectFrom('admission_campaigns')
      .innerJoin('org_units', 'org_units.id', 'admission_campaigns.org_unit_id')
      .selectAll('admission_campaigns')
      .select(['org_units.name as org_unit_name', 'org_units.unit_type as org_unit_type'])
      .where('admission_campaigns.id', '=', campaignId)
      .executeTakeFirst();
    if (!campaign) {
      throw notFoundError('Không tìm thấy đợt tuyển sinh', 'admission_campaign');
    }
    return campaign;
  }
}
