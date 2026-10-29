import { Controller, Get, HttpCode, Inject, Injectable, Param, Post, Req } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, currentTenant } from '@school-management/server';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog } from '../common/audit-log.js';
import { API_CONFIGURATION, type ApiConfiguration } from '../common/configuration.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid } from '../common/request-fields.js';
import { gradeNumber } from '../learning/homework/homework-rules.js';
import { MARKET_LINK_LIFETIME_MS, signMarketLinkCode } from './market-link-code.js';
import { hashStudentForMarket } from './market-tokens.js';

// Phần ở trường của việc liên kết hồ sơ con ở chợ gia sư với trường (DT-27 phần 27f, YCTD-256; tài liệu 47 mục 19.5). Cha mẹ đăng
// nhập ứng dụng phụ huynh của trường, chọn con, bấm "Lấy mã liên kết với Chợ gia sư" (là đồng ý chuyển ba giá trị: mã trường, mã học
// sinh dạng băm, cấp và lớp); mã hạn 10 phút, ghi nhật ký của trường. Claude tự chọn thay luồng chuyển đăng nhập của DT-24 (chợ chuyển
// sang tên miền của trường rồi quay lại): mã dán tay không cần chợ biết tên miền của trường, chợ không bao giờ gọi vào trường; luồng
// chuyển tự động có thể thêm sau mà không đổi dạng mã
type Database = Kysely<SchoolYearDatabase>;

@Injectable()
export class SchoolMarketLinkService {
  constructor(
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {}

  // Ứng dụng phụ huynh chỉ hiện nút khi nền tảng đã nối chợ
  available() {
    return {
      available: Boolean(
        this.configuration.marketLinkSecret && this.configuration.marketplaceDatabaseUrl && currentTenant(),
      ),
    };
  }

  async issue(request: Request, currentUser: CurrentUser, childId: string) {
    const secret = this.configuration.marketLinkSecret;
    const tenant = currentTenant();
    if (!secret || !this.configuration.marketplaceDatabaseUrl || !tenant) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy');
    }
    const database: Database = (await this.currentSchoolYear.require()).database;
    const guardian = isUuid(childId)
      ? await database
          .selectFrom('child_guardians')
          .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
          .select('guardians.id')
          .where('child_guardians.child_id', '=', childId)
          .where('guardians.user_id', '=', currentUser.id)
          .executeTakeFirst()
      : undefined;
    if (!guardian) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ cha mẹ, người giám hộ của học sinh làm được việc này');
    }
    const klass = await database
      .selectFrom('class_enrollments')
      .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select(['classes.school_level', 'classes.grade_level'])
      .where('class_enrollments.child_id', '=', childId)
      .where('class_enrollments.is_current', '=', true)
      .executeTakeFirst();
    const grade = gradeNumber(klass?.grade_level);
    const level = klass?.school_level;
    if (!klass || grade < 1 || (level !== 'TH' && level !== 'THCS' && level !== 'THPT')) {
      throw new ApplicationError('ERR_CONFLICT', 'Con chưa có lớp phổ thông đang học ở trường, chưa liên kết được');
    }
    const expiresAt = this.clock.now().getTime() + MARKET_LINK_LIFETIME_MS;
    const code = signMarketLinkCode(secret, {
      schoolCode: tenant.code,
      studentHash: hashStudentForMarket(secret, tenant.code, childId),
      schoolLevel: level,
      grade,
      expiresAt,
    });
    await writeAuditLog(database, {
      origin: originOf(request, currentUser),
      orgUnitId: null,
      entityName: 'market_link',
      entityId: childId,
      action: 'create',
      before: null,
      after: { school_level: level, grade },
    });
    return { code, expires_at: new Date(expiresAt).toISOString() };
  }
}

// Cha mẹ lấy mã liên kết cho con (kênh parent, kiểm cha mẹ trong dịch vụ như các điểm cuối khác của con)
@Controller('children/:id/market-link')
export class SchoolMarketLinkController {
  constructor(private readonly links: SchoolMarketLinkService) {}

  @Get()
  available() {
    return this.links.available();
  }

  @Post()
  @HttpCode(200)
  issue(@Req() request: Request, @Param('id') childId: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.links.issue(request, currentUser, childId);
  }
}
