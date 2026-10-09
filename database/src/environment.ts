export type ServiceDatabaseKind = 'identity' | 'system';

const environmentVariableByKind: Record<ServiceDatabaseKind, string> = {
  identity: 'IDENTITY_DATABASE_URL',
  system: 'SYSTEM_DATABASE_URL',
};

export function readConnectionString(kind: ServiceDatabaseKind): string {
  const variableName = environmentVariableByKind[kind];
  const value = process.env[variableName];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${variableName}`);
  }
  return value;
}

// Cơ sở dữ liệu năm học dùng cùng máy chủ và tài khoản kết nối với cơ sở dữ liệu hệ thống, chỉ khác tên (QĐ-15)
export function replaceDatabaseName(connectionString: string, databaseName: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${databaseName}`;
  return url.toString();
}
