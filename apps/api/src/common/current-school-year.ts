import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, ruleViolationError, validationError } from '@school-management/server';
import type { Kysely } from 'kysely';
import { Databases } from './databases.js';
import { isUuid } from './request-fields.js';
import { VIEWED_ACADEMIC_YEAR_HEADER, viewedSchoolYear } from './viewed-school-year.js';

export interface CurrentSchoolYear {
  academicYearId: string;
  databaseName: string;
  database: Kysely<SchoolYearDatabase>;
}

// Năm học đang dùng là năm duy nhất ghi được dữ liệu nghiệp vụ (BR-93). Từ YCTD-342 yêu cầu đọc có tiêu đề năm học đang xem
// thì nhận cơ sở dữ liệu của năm học đã đóng đó (chỉ đọc ở mức cơ sở dữ liệu); yêu cầu ghi kèm năm đã đóng bị từ chối
@Injectable()
export class CurrentSchoolYearResolver {
  constructor(private readonly databases: Databases) {}

  async find(): Promise<CurrentSchoolYear | undefined> {
    const viewed = viewedSchoolYear();
    if (viewed) {
      const closed = await this.closedYear(viewed.academicYearId);
      if (closed) {
        if (!viewed.readOnlyRequest) {
          throw ruleViolationError(
            'BR-93',
            `Năm học ${closed.name} đã đóng, chỉ xem được; chuyển về năm học đang dùng để nhập, sửa dữ liệu`,
          );
        }
        return {
          academicYearId: closed.id,
          databaseName: closed.database_name,
          database: this.databases.schoolYear<SchoolYearDatabase>(closed.database_name),
        };
      }
    }
    const row = await this.databases.system
      .selectFrom('academic_years')
      .innerJoin('academic_year_databases', 'academic_year_databases.academic_year_id', 'academic_years.id')
      .select(['academic_years.id', 'academic_year_databases.database_name'])
      .where('academic_years.status', '=', 'open')
      .executeTakeFirst();
    if (!row) {
      return undefined;
    }
    return {
      academicYearId: row.id,
      databaseName: row.database_name,
      database: this.databases.schoolYear<SchoolYearDatabase>(row.database_name),
    };
  }

  async require(): Promise<CurrentSchoolYear> {
    const current = await this.find();
    if (!current) {
      throw ruleViolationError('BR-93', 'Chưa có năm học đang dùng, hãy mở năm học trước');
    }
    return current;
  }

  // Năm học đang xem: mã sai dạng là lỗi dữ liệu, không có năm học hoặc năm còn nháp là không tìm thấy; năm đang dùng thì trả
  // undefined để đi tiếp như yêu cầu không có tiêu đề
  private async closedYear(academicYearId: string) {
    if (!isUuid(academicYearId)) {
      throw validationError([{ field: VIEWED_ACADEMIC_YEAR_HEADER, message: 'Mã năm học không hợp lệ' }]);
    }
    const year = await this.databases.system
      .selectFrom('academic_years')
      .leftJoin('academic_year_databases', 'academic_year_databases.academic_year_id', 'academic_years.id')
      .select([
        'academic_years.id',
        'academic_years.name',
        'academic_years.status',
        'academic_year_databases.database_name',
      ])
      .where('academic_years.id', '=', academicYearId)
      .executeTakeFirst();
    if (!year || year.status === 'draft' || !year.database_name) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy năm học đang xem');
    }
    return year.status === 'closed' ? { id: year.id, name: year.name, database_name: year.database_name } : undefined;
  }
}
