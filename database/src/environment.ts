import type { DatabaseKind } from './migrate.js';

const environmentVariableByKind: Record<DatabaseKind, string> = {
  identity: 'IDENTITY_DATABASE_URL',
  system: 'SYSTEM_DATABASE_URL',
  'school-year': 'SCHOOL_YEAR_DATABASE_URL',
};

export function readConnectionString(kind: DatabaseKind): string {
  const variableName = environmentVariableByKind[kind];
  const value = process.env[variableName];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${variableName}`);
  }
  return value;
}
