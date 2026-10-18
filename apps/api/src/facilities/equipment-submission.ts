import { Injectable } from '@nestjs/common';
import { PERMISSION_CODES } from '@school-management/shared';
import type { CurrentUser } from '../authentication/current-user.js';
import { UpperLevelForms } from '../submissions/upper-level-submissions.js';
import { EquipmentService, type EquipmentFilter } from './equipment.js';
import { FacilitiesData } from './facilities-data.js';

// 2.3 Gửi thiết bị dạy học lên cấp trên (khảo sát mục 4, dòng 2.3; DT-16 phần 16i, YCTD-128) theo mẫu gửi lên cấp trên chạy
// nội bộ của 16a: biểu mẫu là tổng hợp thiết bị dạy học toàn trường (danh mục tối thiểu và thiết bị ngoài danh mục), hoàn
// thiện dữ liệu theo các điều kiện dưới đây, cho đánh dấu "Trường không có dữ liệu"; Xuất tệp gửi, nộp bằng tay, Đánh dấu
// đã gửi, Gửi yêu cầu mở khóa. Chưa có giao diện lập trình của Sở nên không truyền dữ liệu đi
export const EQUIPMENT_SUMMARY_FORM = 'equipment-summary';
const WHOLE_SCHOOL: EquipmentFilter = {
  orgUnitId: null,
  ageGroup: null,
  equipmentGroup: null,
  developmentArea: null,
  isMinimum: null,
  classId: null,
};

@Injectable()
export class EquipmentSubmissionForm {
  constructor(
    private readonly equipment: EquipmentService,
    private readonly data: FacilitiesData,
    forms: UpperLevelForms,
  ) {
    forms.register({
      code: EQUIPMENT_SUMMARY_FORM,
      name: '2.3 Tổng hợp thiết bị dạy học',
      permission: PERMISSION_CODES.facilitiesReport,
      unlockPermission: PERMISSION_CODES.schoolProfileManage,
      allowNoData: true,
      completeness: (currentUser) => this.completeness(currentUser),
      snapshot: async (currentUser, ipAddress) => {
        await this.assertWholeSchool(currentUser);
        const report = await this.equipment.report(currentUser, WHOLE_SCHOOL);
        return { file: await this.equipment.export(currentUser, WHOLE_SCHOOL, ipAddress), data: report };
      },
    });
  }

  private assertWholeSchool(currentUser: CurrentUser) {
    return this.data.assertWholeSchool(
      currentUser,
      [PERMISSION_CODES.facilitiesReport],
      'Thiết bị dạy học gửi lên cấp trên lập cho toàn trường, cần phạm vi toàn trường',
    );
  }

  async completeness(currentUser: CurrentUser) {
    await this.assertWholeSchool(currentUser);
    const report = await this.equipment.report(currentUser, WHOLE_SCHOOL);
    const database = await this.data.database();
    const classes = await this.data.classes(database, report.org_unit_ids);
    const holdings = await this.data.holdings(database, report.org_unit_ids);
    const unitsWithClasses = [...new Set(classes.map((row) => row.org_unit_id))];
    const unitsWithHoldings = new Set(holdings.map((row) => row.org_unit_id));
    return [
      { label: 'Mọi nhóm, lớp đã xếp được nhóm tuổi theo bậc học', done: report.unclassified_classes.length === 0 },
      {
        label: 'Mọi đơn vị có nhóm, lớp đã nhập số thiết bị hiện có',
        done: unitsWithClasses.every((unitId) => unitsWithHoldings.has(unitId)),
      },
      { label: 'Danh mục có thiết bị đang dùng', done: report.rows.length > 0 },
    ];
  }
}
