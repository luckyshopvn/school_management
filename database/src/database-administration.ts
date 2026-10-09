import { sql } from 'kysely';
import { createDatabase } from './connection.js';
import { replaceDatabaseName } from './environment.js';

// Tạo và xóa cơ sở dữ liệu bằng tài khoản kết nối có quyền tạo cơ sở dữ liệu (QĐ-21)
const DATABASE_NAME_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

function assertDatabaseName(databaseName: string): void {
  if (!DATABASE_NAME_PATTERN.test(databaseName)) {
    throw new Error(`Tên cơ sở dữ liệu không hợp lệ: ${databaseName}`);
  }
}

export async function createEmptyDatabase(connectionString: string, databaseName: string): Promise<void> {
  assertDatabaseName(databaseName);
  const database = createDatabase<unknown>(connectionString);
  try {
    await sql`create database ${sql.id(databaseName)}`.execute(database);
    // Chỉ tài khoản sở hữu kết nối được, giống các cơ sở dữ liệu khác của hệ thống
    await sql`revoke connect on database ${sql.id(databaseName)} from public`.execute(database);
  } finally {
    await database.destroy();
  }
}

export async function dropDatabaseIfExists(connectionString: string, databaseName: string): Promise<void> {
  assertDatabaseName(databaseName);
  const database = createDatabase<unknown>(connectionString);
  try {
    await sql`drop database if exists ${sql.id(databaseName)} with (force)`.execute(database);
  } finally {
    await database.destroy();
  }
}

// Cơ sở dữ liệu năm học đã đóng chỉ đọc ở mức PostgreSQL (BR-93)
export async function makeDatabaseReadOnly(connectionString: string, databaseName: string): Promise<void> {
  assertDatabaseName(databaseName);
  const database = createDatabase<unknown>(connectionString);
  try {
    await sql`alter database ${sql.id(databaseName)} set default_transaction_read_only = on`.execute(database);
  } finally {
    await database.destroy();
  }
}

export async function listDatabasesWithPrefix(connectionString: string, prefix: string): Promise<string[]> {
  const database = createDatabase<unknown>(connectionString);
  try {
    const result = await sql<{
      datname: string;
    }>`select datname from pg_database where datname like ${`${prefix}%`}`.execute(database);
    return result.rows.map((row) => row.datname);
  } finally {
    await database.destroy();
  }
}

export { replaceDatabaseName };
