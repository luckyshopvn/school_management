import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { uuidParameter } from '../common/uuid-parameter.js';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import type { AcademicTermType } from '@school-management/database';
import { AcademicYearsService, type WeekChange } from './academic-years.service.js';
import { parseCalendar } from './calendar.js';

type RequestBody = Record<string, unknown> | undefined;

const TERM_TYPES: AcademicTermType[] = ['first_term', 'second_term', 'summer_term'];

// Tuần nghỉ (tuần đệm) và ghi chú (tên tuần đệm) luôn gửi; học kỳ chọn khác lịch, hiển thị chỉ gửi khi đổi (DT-16 phần 16e,
// 3.4 Khai báo tuần của Sở)
function parseWeekChanges(body: RequestBody): WeekChange[] {
  const weeks = body?.weeks;
  const errors: FieldError[] = [];
  if (!Array.isArray(weeks) || weeks.length === 0) {
    throw validationError([{ field: 'weeks', message: 'Cần ít nhất một tuần' }]);
  }
  const changes = weeks.map((item: unknown, index) => {
    const week = (item ?? {}) as Record<string, unknown>;
    if (!Number.isInteger(week.week_no)) {
      errors.push({ field: `weeks[${index}].week_no`, message: 'Số tuần không hợp lệ' });
    }
    if (typeof week.is_off !== 'boolean') {
      errors.push({ field: `weeks[${index}].is_off`, message: 'Phải là đúng hoặc sai' });
    }
    if (week.note !== undefined && week.note !== null && typeof week.note !== 'string') {
      errors.push({ field: `weeks[${index}].note`, message: 'Ghi chú phải là chữ' });
    }
    const note = typeof week.note === 'string' && week.note.trim() !== '' ? week.note.trim() : null;
    if (
      week.term_type !== undefined &&
      week.term_type !== null &&
      !TERM_TYPES.includes(week.term_type as AcademicTermType)
    ) {
      errors.push({
        field: `weeks[${index}].term_type`,
        message: 'Học kỳ là first_term, second_term, summer_term hoặc trống',
      });
    }
    if (week.is_visible !== undefined && typeof week.is_visible !== 'boolean') {
      errors.push({ field: `weeks[${index}].is_visible`, message: 'Phải là đúng hoặc sai' });
    }
    return {
      week_no: week.week_no as number,
      is_off: week.is_off as boolean,
      note,
      ...(week.term_type !== undefined ? { term_type: (week.term_type ?? null) as AcademicTermType | null } : {}),
      ...(typeof week.is_visible === 'boolean' ? { is_visible: week.is_visible } : {}),
    };
  });
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return changes;
}

// Năm học và lịch năm học (P01-02); mọi người đã đăng nhập xem được, chỉ VT-02 sửa được (PQ-11)
@Controller('academic-years')
export class AcademicYearsController {
  constructor(private readonly academicYearsService: AcademicYearsService) {}

  @Get()
  list() {
    return this.academicYearsService.listAcademicYears();
  }

  @Post()
  @RequirePermission(PERMISSION_CODES.academicYearManage)
  create(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      throw validationError([{ field: 'name', message: 'Bắt buộc nhập tên năm học' }]);
    }
    return this.academicYearsService.createAcademicYear(name, currentUser.id);
  }

  @Get(':id/calendar')
  readCalendar(@Param('id', uuidParameter('Mã năm học không hợp lệ')) academicYearId: string) {
    return this.academicYearsService.readCalendar(academicYearId);
  }

  @Put(':id/calendar')
  @RequirePermission(PERMISSION_CODES.academicYearManage)
  saveCalendar(
    @Param('id', uuidParameter('Mã năm học không hợp lệ')) academicYearId: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const { calendar, errors } = parseCalendar(body);
    if (!calendar) {
      throw validationError(errors);
    }
    return this.academicYearsService.saveCalendar(academicYearId, calendar, currentUser.id);
  }

  @Get(':id/weeks')
  listWeeks(@Param('id', uuidParameter('Mã năm học không hợp lệ')) academicYearId: string) {
    return this.academicYearsService.listWeeks(academicYearId);
  }

  @Patch(':id/weeks')
  @RequirePermission(PERMISSION_CODES.academicYearManage)
  updateWeeks(
    @Param('id', uuidParameter('Mã năm học không hợp lệ')) academicYearId: string,
    @Body() body: RequestBody,
  ) {
    return this.academicYearsService.updateWeeks(academicYearId, parseWeekChanges(body));
  }

  @Post(':id/open')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.academicYearManage)
  open(
    @Param('id', uuidParameter('Mã năm học không hợp lệ')) academicYearId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.academicYearsService.openAcademicYear(academicYearId, currentUser.id);
  }

  // 5.7 Chuyển hồ sơ lên năm học mới (DT-16 phần 16e): Thực hiện là mở năm học ở trên; Hủy khi năm mới chưa phát sinh dữ liệu
  @Get('rollover/status')
  @RequirePermission(PERMISSION_CODES.academicYearManage)
  rolloverStatus() {
    return this.academicYearsService.rolloverStatus();
  }

  @Post(':id/cancel-open')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.academicYearManage)
  cancelOpen(@Param('id', uuidParameter('Mã năm học không hợp lệ')) academicYearId: string) {
    return this.academicYearsService.cancelOpen(academicYearId);
  }
}
