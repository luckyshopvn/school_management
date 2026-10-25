import type { TenancyRuntime } from '@school-management/database';
import { requireTenant, TenantContextMissingError } from '@school-management/server';
import type { ApiConfiguration } from './configuration.js';

// Ở chế độ nhiều trường (DT-SaaS phần S1a) các giá trị cấu hình riêng của từng trường không còn đọc từ biến môi trường mà
// từ trường trong ngữ cảnh của yêu cầu: khóa mã hóa và khóa băm số định danh của trẻ, tiền tố tên cơ sở dữ liệu năm học, địa
// chỉ cơ sở dữ liệu hệ thống. Cấu hình được trả về là cùng một đối tượng với các thuộc tính đọc theo ngữ cảnh, nên mã nghiệp vụ
// (`configuration.childDataEncryptionKey`, ...) không đổi. Thiếu ngữ cảnh hoặc trường chưa có khóa là lỗi (đóng chặt)
export function withTenantAccessors(base: ApiConfiguration, tenancy: TenancyRuntime): ApiConfiguration {
  const keyFrom = (name: 'childDataEncryptionKey' | 'childDataHashKey'): Buffer => {
    const tenant = requireTenant('khóa mã hóa dữ liệu trẻ');
    const key = tenant?.[name];
    if (!key) {
      throw tenant
        ? new Error(`Trường ${tenant.code} chưa có khóa mã hóa dữ liệu trẻ`)
        : new TenantContextMissingError('khóa mã hóa dữ liệu trẻ');
    }
    return key;
  };
  const configuration = { ...base } as ApiConfiguration;
  Object.defineProperties(configuration, {
    childDataEncryptionKey: { enumerable: true, get: () => keyFrom('childDataEncryptionKey') },
    childDataHashKey: { enumerable: true, get: () => keyFrom('childDataHashKey') },
    schoolYearDatabasePrefix: {
      enumerable: true,
      get: () => {
        const tenant = requireTenant('tiền tố cơ sở dữ liệu năm học');
        if (!tenant) {
          throw new TenantContextMissingError('tiền tố cơ sở dữ liệu năm học');
        }
        return tenant.yearDatabasePrefix;
      },
    },
    systemDatabaseUrl: {
      enumerable: true,
      get: () => {
        const tenant = requireTenant('cơ sở dữ liệu hệ thống');
        if (!tenant) {
          throw new TenantContextMissingError('cơ sở dữ liệu hệ thống');
        }
        return tenancy.registry.connectionString(tenant, 'system', 'system');
      },
    },
  });
  return configuration;
}
