import { Controller, Get, Injectable, Param } from '@nestjs/common';
import { ApplicationError } from '@school-management/server';
import { AuthenticatedUser, StudentEndpoint } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { uuidParameter } from '../common/uuid-parameter.js';

// Chế độ xem của nhân viên hỗ trợ ở ứng dụng phụ huynh, học sinh (YCTD-315b, Eric yêu cầu ngày 2026-10-29): Admin vào thẳng không
// đăng nhập thành một phụ huynh, học sinh cụ thể; ứng dụng cho chọn lớp rồi chọn học sinh để xem, phiên luôn chỉ đọc (kênh phụ huynh,
// học sinh nhận phạm vi chỉ đọc ở dịch vụ định danh). Chỉ phiên Admin vào thẳng (full_access) gọi được; chỉ trả tên lớp, tên học sinh
// để chọn, dữ liệu còn lại đi qua các điểm cuối sẵn có của ứng dụng
const ID = uuidParameter('Mã không hợp lệ');

@Injectable()
export class SupportViewService {
  constructor(private readonly currentSchoolYear: CurrentSchoolYearResolver) {}

  private assertAdmin(currentUser: CurrentUser): void {
    if (!currentUser.isPlatformAdminSupport) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Chỉ quản trị nền tảng trong phiên vào thẳng dùng được chế độ xem này',
      );
    }
  }

  async classes(currentUser: CurrentUser) {
    this.assertAdmin(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const items = await database
      .selectFrom('classes')
      .select(['id', 'name', 'school_level', 'grade_level'])
      .where('status', '=', 'active')
      .orderBy('school_level')
      .orderBy('grade_level')
      .orderBy('name')
      .execute();
    return { items };
  }

  async students(currentUser: CurrentUser, classId: string) {
    this.assertAdmin(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const items = await database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .select(['children.id', 'children.full_name'])
      .where('class_enrollments.class_id', '=', classId)
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .where('children.deleted_at', 'is', null)
      .orderBy('children.full_name')
      .execute();
    return { items };
  }
}

// Ứng dụng phụ huynh (kênh parent)
@Controller('support-view')
export class SupportViewController {
  constructor(private readonly view: SupportViewService) {}

  @Get('classes')
  classes(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.view.classes(currentUser);
  }

  @Get('classes/:id/students')
  students(@Param('id', ID) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.view.students(currentUser, id);
  }
}

// Ứng dụng học sinh (kênh student chỉ gọi được điểm cuối /student/*)
@Controller('student/support-view')
@StudentEndpoint()
export class StudentSupportViewController {
  constructor(private readonly view: SupportViewService) {}

  @Get('classes')
  classes(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.view.classes(currentUser);
  }

  @Get('classes/:id/students')
  students(@Param('id', ID) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.view.students(currentUser, id);
  }
}
