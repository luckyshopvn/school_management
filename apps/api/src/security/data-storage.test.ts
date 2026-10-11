import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName } from '@school-management/database';
import { sql } from 'kysely';
import { openTestAcademicYear, startApiTestEnvironment, type ApiTestEnvironment } from '../test-support.js';

// Kiểm tra nơi lưu dữ liệu nhạy cảm và ranh giới giữa giao diện với cơ sở dữ liệu (DT-09 phần 9a): CTC-DD-038, CT-101
const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return name === 'node_modules' || name === 'dist' ? [] : sourceFiles(path);
    }
    return /\.(ts|tsx|js|jsx|json)$/.test(name) ? [path] : [];
  });
}

describe('Lưu trữ dữ liệu nhạy cảm và ranh giới giao diện', () => {
  let environment: ApiTestEnvironment;
  let schoolYearUrl = '';

  before(async () => {
    environment = await startApiTestEnvironment();
    const principal = await environment.loginAs('VT-02', null);
    await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    const row = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    schoolYearUrl = replaceDatabaseName(environment.systemDatabaseUrl, row.database_name);
  });

  after(async () => {
    await environment.close();
  });

  it('CTC-DD-038: cơ sở dữ liệu hệ thống và năm học không có cột mật khẩu; chỉ cơ sở dữ liệu định danh lưu giá trị băm', async () => {
    for (const url of [environment.systemDatabaseUrl, schoolYearUrl]) {
      const database = createDatabase<unknown>(url);
      try {
        const columns = await sql<{ table_name: string; column_name: string }>`
          select table_name, column_name from information_schema.columns
          where table_schema = 'public' and (column_name ilike '%password%' or column_name ilike '%otp%')
        `.execute(database);
        assert.deepEqual(columns.rows, [], url);
      } finally {
        await database.destroy();
      }
    }
    const identityColumns = await sql<{ column_name: string }>`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'users' and column_name ilike '%password%'
    `.execute(environment.identity.database);
    assert.ok(identityColumns.rows.some((row) => row.column_name === 'password_hash'));
    assert.ok(identityColumns.rows.every((row) => row.column_name !== 'password'));
  });

  it('CT-101: gói giao diện của ba kênh không có thư viện kết nối cơ sở dữ liệu, chuỗi kết nối hay truy vấn trực tiếp', () => {
    const forbidden = [/\bkysely\b/, /["']pg["']/, /DATABASE_URL/, /postgres(ql)?:\/\//, /\bselect\s+\*\s+from\b/i];
    for (const application of ['portal', 'teacher', 'parent']) {
      const directory = join(repositoryRoot, 'apps', application);
      const files = [join(directory, 'package.json'), ...sourceFiles(join(directory, 'src'))];
      for (const file of files) {
        const text = readFileSync(file, 'utf8');
        for (const pattern of forbidden) {
          assert.ok(!pattern.test(text), `${file} chứa ${pattern}`);
        }
      }
    }
  });
});
