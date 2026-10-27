// Cổng và tên cơ sở dữ liệu riêng của kiểm thử giao diện, không đụng môi trường phát triển đang chạy
export const E2E_SYSTEM_DATABASE_NAME = 'school_system_e2e';
export const E2E_SCHOOL_YEAR_DATABASE_PREFIX = 'school_year_e2e_';
export const E2E_IDENTITY_PORT = 3201;
export const E2E_API_PORT = 3200;
export const E2E_PORTAL_PORT = 5373;
export const E2E_PARENT_PORT = 5375;
export const E2E_TEACHER_PORT = 5376;
// Ứng dụng học sinh tách khỏi ứng dụng phụ huynh (YCTD-300)
export const E2E_STUDENT_PORT = 5379;
// Nhà cung cấp OIDC giả lập của spec 165 (DT-25): dịch vụ định danh e2e khai nhà cung cấp này ở EXTERNAL_IDENTITY_PROVIDERS; spec tự
// chạy máy chủ giả lập ở cổng này. Mã ứng dụng và khóa bí mật là giá trị kiểm thử, không phải khóa thật
export const E2E_OIDC_MOCK_PORT = 3299;
export const E2E_OIDC_PROVIDER_CODE = 'oidc-gia-lap';
export const E2E_OIDC_CLIENT_ID = 'ung-dung-thu-e2e';
export const E2E_OIDC_CLIENT_SECRET = 'gia-tri-kiem-thu-e2e';
