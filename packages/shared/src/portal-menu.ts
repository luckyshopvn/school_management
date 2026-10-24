import type { PortalQuickLinkPath } from './index.js';
import type { SchoolLevelCode } from './school-levels.js';

// Cây menu ngang của cổng quản trị theo hệ thống của Sở (DT-15 phần 15a, tài liệu 32 mục 3): mỗi phân hệ một menu đánh số
// thứ bậc 1., 1.1., 1.1.1.; số giữ đúng số của Sở ở phân hệ Quản lý giáo dục Mầm non, Cơ sở vật chất, Báo cáo số liệu,
// Quản trị hệ thống (mục chưa có thì để trống số); phân hệ riêng đánh số liên tục. Mỗi trang chỉ có ở một chỗ. Quyền hiện
// từng mục do cổng quản trị kiểm tra; máy chủ vẫn kiểm tra quyền ở mọi yêu cầu
export type PortalWorkspaceKey =
  | 'education'
  | 'facilities'
  | 'entry-admissions'
  | 'emis'
  | 'signing'
  | 'documents'
  | 'system'
  | 'finance'
  | 'personnel'
  | 'logistics'
  | 'interaction'
  | 'teaching'
  | 'admissions'
  | 'reports'
  | 'kpi'
  | 'website'
  | 'professional-records'
  | 'emulation'
  | 'quality-assurance';

export interface PortalMenuNode {
  // Số thứ bậc có dấu chấm cuối như của Sở, ví dụ "4.1.1."
  number: string;
  label: string;
  path?: PortalQuickLinkPath;
  children?: PortalMenuNode[];
  // Cấp học của mục (DT-19 phần 19c): không ghi là mọi cấp; có ghi thì mục chỉ hiện khi trường bật và người dùng đang làm
  // việc ở một trong các cấp đó
  levels?: readonly SchoolLevelCode[];
}

export interface PortalWorkspace {
  key: PortalWorkspaceKey;
  label: string;
  menu: PortalMenuNode[];
  // Cấp học của phân hệ, cùng quy ước với mục menu (DT-19 phần 19c)
  levels?: readonly SchoolLevelCode[];
  // Phân hệ đặt tên theo cấp: một cấp thì "<levelTitle> <tên cấp>" (trường mầm non giữ "Quản lý giáo dục Mầm non" như Sở),
  // nhiều cấp thì chỉ "<levelTitle>"; tên cấp lấy từ school_levels, không ghi cứng
  levelTitle?: string;
}

const leaf = (number: string, label: string, path: PortalQuickLinkPath): PortalMenuNode => ({ number, label, path });
const group = (number: string, label: string, children: PortalMenuNode[]): PortalMenuNode => ({
  number,
  label,
  children,
});
// Mục chỉ của Tiểu học: nhóm 7 (DT-20 phần 20a) tạm đánh số tiếp sau nhóm cuối của Sở, đánh lại khi khảo sát hệ thống của
// Sở cấp Tiểu học (tài liệu 32 mục 11.1); 4.8 Bán trú, 4.9 Nề nếp, thi đua lớp (phần 20b)
const primary = (node: PortalMenuNode): PortalMenuNode => ({ ...node, levels: ['TH'] });
// Mục của THCS, THPT (DT-21 phần 21a): nhóm 7 dùng chung ba cấp; mục riêng cấp THCS, THPT thêm vào nhóm đó
const secondary = (node: PortalMenuNode, levels: readonly SchoolLevelCode[] = ['THCS', 'THPT']): PortalMenuNode => ({
  ...node,
  levels,
});
// Mục chỉ của Mầm non (DT-19 phần 19c): hồ sơ cuối cấp mầm non, biểu EMIS Mầm non, cân đo theo tháng tuổi, hoàn thành
// chương trình Mầm non. Cấp khác thêm mục của mình ở DT-20, DT-21 bằng cùng thuộc tính
const preschool = (node: PortalMenuNode): PortalMenuNode => ({ ...node, levels: ['MN'] });

export const PORTAL_WORKSPACES: PortalWorkspace[] = [
  {
    key: 'education',
    label: 'Quản lý giáo dục Mầm non',
    levelTitle: 'Quản lý giáo dục',
    menu: [
      group('1.', 'Trường học', [
        leaf('1.1.', 'Hồ sơ trường', '/school-profile'),
        leaf('1.2.', 'Quản lý phân hiệu', '/branches'),
        leaf('1.3.', 'Quản lý điểm trường', '/school-sites'),
        leaf('1.4.', 'Cấu hình trường', '/settings'),
        leaf('1.6.', 'Tài khoản đồng bộ của Bộ, của Sở', '/sync-accounts'),
        // Rà soát kiểm định, tách trường bản chạy nội bộ (DT-16 phần 16e)
        leaf('1.7.', 'Rà soát thông tin kiểm định CLGD', '/accreditation-review'),
        leaf('1.8.', 'Tách trường', '/school-splits'),
      ]),
      group('2.', 'Lớp học', [
        leaf('2.1.', 'Hồ sơ lớp học', '/classes'),
        leaf('2.2.', 'Nhập lớp học từ Excel', '/class-imports'),
      ]),
      group('3.', 'Nhân sự', [
        group('3.1.', 'Hồ sơ nhân sự', [
          leaf('3.1.1.', 'Hồ sơ cán bộ, giáo viên', '/staff'),
          leaf('3.1.2.', 'Nhân sự phân hiệu', '/staff-branches'),
          leaf('3.1.3.', 'Nhập nhân sự từ Excel', '/staff-imports'),
          leaf('3.1.5.', 'Xác thực số định danh nhân sự với CSDLQG về dân cư', '/staff-identity'),
        ]),
        leaf('3.2.', 'Đánh giá chuẩn nghề nghiệp', '/professional-standards'),
        leaf('3.3.', 'Phân công phụ trách lớp', '/class-assignments'),
        // Khai báo tuần dùng chung lịch năm học (DT-16 phần 16e)
        leaf('3.4.', 'Khai báo tuần', '/school-weeks'),
        leaf('3.5.', 'Biến động nhân sự', '/staff-movements'),
      ]),
      group('4.', 'Học sinh', [
        group('4.1.', 'Hồ sơ học sinh', [
          leaf('4.1.1.', 'Quản lý hồ sơ học sinh', '/children'),
          // Nhập học sinh, sắp xếp, điện thoại nhận tin, số định danh, tài khoản học và thi (DT-16 phần 16g); nhập dữ liệu
          // khác (công nợ đầu kỳ) giữ trang chung, đánh số tiếp sau mục cuối 4.1.12 của Sở
          leaf('4.1.2.', 'Nhập học sinh từ Excel', '/student-imports'),
          leaf('4.1.3.', 'Sắp xếp học sinh', '/student-order'),
          leaf('4.1.5.', 'Điện thoại nhận tin của phụ huynh', '/sms-phones'),
          leaf('4.1.6.', 'Nhóm học sinh', '/child-groups'),
          leaf('4.1.8.', 'Thu thập, xác thực số định danh', '/national-ids'),
          leaf('4.1.10.', 'Tài khoản học và thi', '/learning-accounts'),
          leaf('4.1.11.', 'Cập nhật địa danh hành chính', '/administrative-units'),
          leaf('4.1.13.', 'Nhập dữ liệu khác từ Excel', '/imports'),
        ]),
        leaf('4.2.', 'Biến động học sinh', '/student-movements'),
        preschool(
          group('4.3.', 'Cân nặng, chiều cao', [
            leaf('4.3.1.', 'Nhập kết quả sức khỏe nuôi dưỡng', '/growth'),
            leaf('4.3.2.', 'Tổng hợp cân nặng, chiều cao', '/growth-report'),
          ]),
        ),
        preschool(leaf('4.4.', 'Hoàn thành chương trình', '/program-completion')),
        leaf('4.5.', 'Thực đơn bữa ăn', '/kitchen'),
        group('4.6.', 'Sức khỏe học sinh', [
          leaf('4.6.1.', 'Nhập thông tin sức khỏe học sinh', '/student-health'),
          leaf('4.6.2.', 'Y tế học đường', '/health'),
          leaf('4.6.3.', 'Thuốc và dặn thuốc', '/medicines'),
        ]),
        leaf('4.7.', 'Điểm danh', '/attendance'),
        primary(leaf('4.8.', 'Bán trú', '/boarding')),
        primary(leaf('4.9.', 'Nề nếp, thi đua lớp', '/conduct')),
      ]),
      group('5.', 'Công cụ hỗ trợ', [
        leaf('5.1.', 'Thống kê lớp, nhân sự, học sinh', '/statistics'),
        leaf('5.2.', 'Thống kê nhân sự', '/staff-statistics'),
        leaf('5.3.', 'Thống kê học sinh', '/student-statistics'),
        // Mã định danh, mật khẩu mặc định; tiến độ xác thực số định danh học sinh (DT-16 phần 16g)
        leaf('5.4.', 'Mã định danh, mật khẩu mặc định', '/default-passwords'),
        leaf('5.5.', 'Tiến độ xác thực số định danh học sinh', '/national-id-progress'),
        leaf('5.6.', 'Tiến độ xác thực số định danh nhân sự', '/staff-identity-progress'),
        // Chuyển hồ sơ lên năm học mới: Thực hiện, Hủy (DT-16 phần 16e)
        leaf('5.7.', 'Chuyển hồ sơ lên năm học mới', '/year-rollover'),
        leaf('5.8.', 'Thống kê hồ sơ chưa nhập đủ', '/missing-profiles'),
        group('5.10.', 'Văn thư lưu trữ', [
          leaf('5.10.1.', 'Hồ sơ tài liệu', '/archive-records'),
          leaf('5.10.2.', 'Phông lưu trữ', '/archive-fonds'),
          leaf('5.10.3.', 'Thông tin lưu trữ', '/archive-holdings'),
          leaf('5.10.4.', 'Báo cáo lưu trữ', '/archive-report'),
        ]),
        // Danh sách trúng tuyển của Tuyển sinh đầu cấp: xếp lớp rồi chuyển sang hồ sơ học sinh (DT-17 phần 17d)
        leaf('5.11.', 'Danh sách trúng tuyển Tuyển sinh đầu cấp', '/admitted-students'),
      ]),
      // Cơ sở vật chất trong phân hệ Mầm non (DT-16 phần 16i): 6.2 mở màn hình khai báo cơ sở vật chất như mục 1.1 của
      // phân hệ Cơ sở vật chất, TBDH
      group('6.', 'Cơ sở vật chất', [
        leaf('6.1.', 'Thực trạng và nhu cầu đầu tư phòng học, nhà công vụ', '/facility-investments'),
        leaf('6.2.', 'Nhập liệu cơ sở vật chất', '/facility-input'),
      ]),
      secondary(
        group('7.', 'Dạy học', [
          leaf('7.1.', 'Môn học và hoạt động giáo dục', '/subjects'),
          leaf('7.2.', 'Phân công giảng dạy theo môn', '/teaching-assignments'),
          // Thời khoá biểu phần khung (DT-20 phần 22c1); THCS, THPT dùng chung (DT-21 phần 21b)
          leaf('7.3.', 'Khung giờ tiết học', '/period-slots'),
          leaf('7.4.', 'Thời khoá biểu', '/timetables'),
          // Đánh giá học sinh theo Thông tư 27/2020 (DT-20 phần 20c)
          primary(leaf('7.5.', 'Đánh giá học sinh', '/student-assessments')),
          // Sổ đầu bài, điểm danh theo tiết (DT-20 phần 20d); THCS, THPT dùng chung ở DT-21 phần 21d
          primary(leaf('7.6.', 'Sổ đầu bài', '/class-logs')),
          primary(leaf('7.7.', 'Chuyên cần theo tiết', '/period-attendance')),
          // Học bạ số, khen thưởng, hoàn thành chương trình, lên lớp (DT-20 phần 20e)
          primary(leaf('7.8.', 'Học bạ, khen thưởng, lên lớp', '/learning-records')),
          // Máy xếp, dạy thay, đổi tiết, báo cáo, mã QR (DT-20 phần 22c2)
          leaf('7.9.', 'Xếp thời khoá biểu tự động', '/timetable-generator'),
          leaf('7.10.', 'Dạy thay, đổi tiết', '/timetable-changes'),
          leaf('7.11.', 'Báo cáo tiết dạy, dùng phòng, mã QR', '/timetable-reports'),
          // Tổ hợp môn (THPT) và tổ bộ môn (DT-21 phần 21a)
          secondary(leaf('7.12.', 'Tổ hợp môn', '/subject-combinations'), ['THPT']),
          secondary(leaf('7.13.', 'Tổ bộ môn', '/subject-teams')),
          // Sổ điểm theo Thông tư 22/2021 (DT-21 phần 21c)
          secondary(leaf('7.14.', 'Sổ điểm', '/scores')),
        ]),
        ['TH', 'THCS', 'THPT'],
      ),
    ],
  },
  {
    key: 'facilities',
    label: 'Quản lý cơ sở vật chất, TBDH',
    menu: [
      // 1.2, 2.2, 2.3 thành mục riêng như của Sở (DT-16 phần 16i)
      group('1.', 'Cơ sở vật chất', [
        leaf('1.1.', 'Khai báo cơ sở vật chất', '/facility-rooms'),
        leaf('1.2.', 'Báo cáo cơ sở vật chất', '/facility-report'),
      ]),
      group('2.', 'Thiết bị dạy học', [
        leaf('2.1.', 'Tổng hợp thiết bị dạy học', '/equipment'),
        leaf('2.2.', 'Thiết bị ngoài danh mục tối thiểu', '/equipment-outside'),
        leaf('2.3.', 'Gửi thiết bị dạy học lên cấp trên', '/equipment-submission'),
        // Nơi để, tem QR, kiểm kê bằng điện thoại, đối sánh danh mục tối thiểu (DT-18 phần 18g)
        leaf('2.4.', 'Nơi để và tem QR thiết bị', '/equipment-locations'),
        leaf('2.5.', 'Kiểm kê thiết bị', '/equipment-stocktakes'),
        leaf('2.6.', 'Đối sánh danh mục tối thiểu', '/equipment-minimum'),
      ]),
    ],
  },
  {
    // Tuyển sinh đầu cấp (DT-17 phần 17c, khảo sát mục 10.2.2): số mục như trang riêng của Sở; 1.3 đến 1.7 thêm ở 17d. Tên
    // nhóm 1. đến 5. khảo sát chưa ghi, Claude tự đặt
    key: 'entry-admissions',
    label: 'Tuyển sinh đầu cấp',
    menu: [
      group('1.', 'Hồ sơ tuyển sinh', [
        preschool(leaf('1.1.', 'Hồ sơ học sinh cuối cấp mầm non', '/entry-admissions/final-year')),
        leaf('1.2.', 'Gửi xác nhận hoàn thành hồ sơ cuối cấp lên cấp trên', '/entry-admissions/completion'),
        // 1.3 đến 1.7 (DT-17 phần 17d)
        leaf('1.3.', 'Danh sách học sinh đăng ký trường tiên tiến', '/entry-admissions/advanced'),
        leaf('1.4.', 'Tiếp nhận hồ sơ tuyển sinh', '/entry-admissions/intake'),
        leaf('1.5.', 'Gửi thông báo tuyển sinh đầu cấp', '/entry-admissions/notices'),
        leaf('1.6.', 'Chuyển hồ sơ trúng tuyển sang CSDL', '/entry-admissions/transfer'),
        leaf('1.7.', 'Danh sách kết quả chuyển hồ sơ', '/entry-admissions/transfer-results'),
        leaf('1.8.', 'Thông tin trường tuyển sinh theo bản đồ GIS', '/entry-admissions/school-map'),
      ]),
      group('2.', 'Danh mục', [leaf('2.1.', 'Các dịch vụ được đăng ký tại trường', '/entry-admissions/services')]),
      group('3.', 'Người dùng', [
        leaf('3.1.', 'Nhóm người dùng', '/entry-admissions/roles'),
        leaf('3.2.', 'Danh sách người dùng', '/entry-admissions/users'),
        leaf('3.3.', 'Danh sách nhân sự', '/entry-admissions/staff'),
        leaf('3.4.', 'Danh sách lớp', '/entry-admissions/classes'),
      ]),
      group('4.', 'Thống kê', [leaf('4.1.', 'Thống kê hồ sơ cuối cấp', '/entry-admissions/statistics')]),
      group('5.', 'Hỗ trợ', [leaf('5.1.', 'Danh sách hỗ trợ tuyển sinh', '/entry-admissions/support')]),
    ],
  },
  {
    key: 'emis',
    label: 'Báo cáo số liệu',
    // Đủ bảy biểu của khảo sát mục 5 (DT-16 phần 16j); 1.1 tách Lập, Gửi như Sở (DT-17 phần 17a, khảo sát mục 10.4.1)
    menu: [
      group('1.', 'Báo cáo đầu năm', [
        preschool(
          group('1.1.', 'Báo cáo EMIS đầu năm', [
            leaf('1.1.1.', 'Lập báo cáo đầu năm', '/emis'),
            leaf('1.1.2.', 'Gửi báo cáo đầu năm', '/emis/send'),
          ]),
        ),
        leaf('1.2.', 'Báo cáo cơ sở vật chất', '/emis/facilities'),
        leaf('1.3.', 'Báo cáo sức khỏe học sinh đầu năm', '/emis/health'),
      ]),
      group('2.', 'Báo cáo cuối năm', [
        preschool(leaf('2.1.', 'Báo cáo EMIS cuối năm', '/emis/end-of-year')),
        leaf('2.2.', 'Báo cáo đội ngũ', '/emis/staff'),
        leaf('2.3.', 'Đề án ngoại ngữ', '/emis/foreign-language'),
        preschool(leaf('2.4.', 'Báo cáo giáo dục mầm non cuối năm', '/emis/preschool-end-of-year')),
      ]),
    ],
  },
  {
    // Mục 6 của Sở, bản chạy nội bộ (DT-16 phần 16k): không có chữ ký số thật nên mục 2.2 gọi "Kí hồ sơ" thay cho "Ký số
    // hồ sơ"; tên nhóm 1., 2. khảo sát chưa ghi, Claude tự đặt
    key: 'signing',
    label: 'Quản lý kí hồ sơ',
    menu: [
      group('1.', 'Chứng thư số', [leaf('1.1.', 'Chứng thư số nhà trường', '/signing-certificate')]),
      group('2.', 'Kí hồ sơ', [
        leaf('2.1.', 'Đồng bộ chứng thư số', '/signing-certificate-sync'),
        leaf('2.2.', 'Kí hồ sơ trường, lớp, nhân sự, học sinh', '/signing-dossiers'),
        leaf('2.3.', 'Xác nhận hoàn thành và gửi hồ sơ', '/signing-submissions'),
      ]),
    ],
  },
  {
    // Quản lý văn bản và điều hành theo VNPT iOffice (DT-18, tài liệu 32 mục 9; quyết định của Eric ngày 2026-10-19). Phần
    // 18a làm Văn bản đến và Quản trị văn bản; 18b thêm Văn bản đi (nhóm 3); 18c thêm Quản lý công việc, Hồ sơ công việc,
    // Quản lý lịch đơn vị, Báo cáo (nhóm 4 đến 7). Số nhóm, tên mục Claude tự đặt theo menu của iOffice
    key: 'documents',
    label: 'Quản lý văn bản và điều hành',
    menu: [
      group('1.', 'Văn bản đến', [
        leaf('1.1.', 'Văn bản đến', '/incoming-documents'),
        leaf('1.2.', 'Quản lý văn bản đến', '/incoming-documents/manage'),
        leaf('1.3.', 'Văn bản xem để biết', '/incoming-documents/for-information'),
        leaf('1.4.', 'Văn bản đánh dấu', '/incoming-documents/starred'),
        leaf('1.5.', 'Văn bản theo dõi', '/incoming-documents/followed'),
        leaf('1.6.', 'Tra cứu văn bản', '/incoming-documents/search'),
        leaf('1.7.', 'Liên thông văn bản', '/incoming-documents/interconnect'),
      ]),
      group('2.', 'Quản trị văn bản', [
        leaf('2.1.', 'Sổ văn bản', '/document-books'),
        leaf('2.2.', 'Đơn vị bên ngoài', '/external-units'),
        leaf('2.3.', 'Khai báo nhóm đơn vị ban hành', '/external-unit-groups'),
        leaf('2.4.', 'Danh mục văn bản', '/document-catalogs'),
        leaf('2.5.', 'Lãnh đạo nhận văn bản', '/document-leaders'),
      ]),
      // Văn bản đi (phần 18b): Dự thảo, Chờ xử lý, Đã xử lý, Đã ban hành như menu Quản lý văn bản đi của iOffice
      group('3.', 'Văn bản đi', [
        leaf('3.1.', 'Văn bản đi', '/outgoing-documents'),
        leaf('3.2.', 'Quản lý văn bản đi', '/outgoing-documents/manage'),
        leaf('3.3.', 'Liên thông văn bản đi', '/outgoing-documents/interconnect'),
        leaf('3.4.', 'Tra cứu văn bản đi', '/outgoing-documents/search'),
      ]),
      group('4.', 'Quản lý công việc', [
        leaf('4.1.', 'Giao việc', '/directives/new'),
        leaf('4.2.', 'Công việc cần xử lý', '/directives/inbox'),
        leaf('4.3.', 'Công việc đã giao', '/directives/outbox'),
      ]),
      group('5.', 'Hồ sơ công việc', [
        leaf('5.1.', 'Hồ sơ cá nhân', '/work-files'),
        leaf('5.2.', 'Hồ sơ được chia sẻ', '/work-files/shared'),
        leaf('5.3.', 'Hồ sơ được chuyển giao', '/work-files/transferred'),
        leaf('5.4.', 'Hồ sơ nộp lưu', '/work-files/archive'),
        leaf('5.5.', 'Hồ sơ hết hạn bảo quản', '/work-files/expired'),
      ]),
      group('6.', 'Quản lý lịch đơn vị', [
        leaf('6.1.', 'Đăng ký lịch đơn vị', '/unit-schedules'),
        leaf('6.2.', 'Lịch họp', '/meeting-schedules'),
        leaf('6.3.', 'Đăng ký phòng họp', '/room-bookings'),
        leaf('6.4.', 'Phòng họp', '/meeting-rooms'),
        leaf('6.5.', 'Mẫu lịch', '/schedule-templates'),
      ]),
      group('7.', 'Báo cáo', [
        leaf('7.1.', 'Báo cáo thực hiện văn bản đến', '/document-reports/incoming'),
        leaf('7.2.', 'Báo cáo tổng hợp', '/document-reports/summary'),
        leaf('7.3.', 'Thống kê số liệu trong đơn vị', '/document-reports/statistics'),
      ]),
    ],
  },
  {
    key: 'system',
    label: 'Quản trị hệ thống',
    menu: [
      group('1.', 'Người dùng và phân quyền', [
        leaf('1.1.', 'Nhóm người dùng', '/roles'),
        leaf('1.2.', 'Phân quyền nhóm theo phần mềm', '/role-workspaces'),
        leaf('1.3.', 'Phân quyền nhóm theo menu', '/role-permissions'),
        leaf('1.4.', 'Danh sách người dùng', '/accounts'),
      ]),
      group('2.', 'Thiết lập', [
        leaf('2.1.', 'Năm học', '/academic-years'),
        leaf('2.2.', 'Cây đơn vị', '/org-units'),
        leaf('2.3.', 'Phòng ban và chức danh', '/departments'),
        leaf('2.4.', 'Danh mục dùng chung', '/catalogs'),
        leaf('2.5.', 'Phòng học và bậc học', '/rooms'),
        leaf('2.6.', 'Hạn mức phê duyệt', '/approval-thresholds'),
      ]),
      group('3.', 'Kết nối và nhật ký', [
        leaf('3.1.', 'Khóa API cho đối tác', '/api-clients'),
        leaf('3.2.', 'Kết nối ngoài', '/integrations'),
        leaf('3.3.', 'Nhật ký thao tác', '/audit-logs'),
        leaf('3.4.', 'Ý kiến phản hồi', '/feedback'),
        leaf('3.5.', 'Tệp đã tạo', '/generated-files'),
        // Thông báo bật lên khi vào trang, lưới ứng dụng liên kết (DT-16 phần 16c)
        leaf('3.6.', 'Thông báo hệ thống', '/system-announcements'),
        leaf('3.7.', 'Ứng dụng liên kết', '/app-links'),
      ]),
      // Quản trị và trình diễn (DT-18 phần 18h)
      group('4.', 'Quản trị và trình diễn', [
        leaf('4.1.', 'Đăng nhập thay', '/impersonations'),
        leaf('4.2.', 'Xuất toàn bộ dữ liệu', '/school-data-export'),
        leaf('4.3.', 'Bản trình diễn', '/demo-environment'),
      ]),
    ],
  },
  {
    key: 'finance',
    label: 'Tài chính – học phí',
    menu: [
      group('1.', 'Học phí và dịch vụ', [
        leaf('1.1.', 'Biểu phí và dịch vụ', '/fees'),
        leaf('1.2.', 'Đăng ký dịch vụ', '/registrations'),
        leaf('1.3.', 'Học phí', '/invoices'),
        leaf('1.4.', 'Duyệt miễn giảm và điều chỉnh', '/fee-approvals'),
        leaf('1.5.', 'Công nợ', '/debts'),
        leaf('1.6.', 'Nhắc nợ và xử lý quá hạn', '/debt-collection'),
      ]),
      group('2.', 'Thu chi', [
        leaf('2.1.', 'Phiếu thu', '/receipts'),
        leaf('2.2.', 'Phiếu chi', '/payments'),
        leaf('2.3.', 'Quỹ và ngân hàng', '/cash-accounts'),
        leaf('2.4.', 'Sổ quỹ', '/cash-book'),
        leaf('2.5.', 'Đối chiếu ngân hàng', '/bank-reconciliation'),
        leaf('2.6.', 'Nợ nhà cung cấp', '/payables'),
        leaf('2.7.', 'Khoản mục thu chi', '/cashflow-categories'),
      ]),
      group('3.', 'Kế toán', [
        leaf('3.1.', 'Sổ kế toán', '/ledger'),
        leaf('3.2.', 'Chốt kỳ tài chính', '/fiscal-periods'),
      ]),
    ],
  },
  {
    key: 'personnel',
    label: 'Nhân sự – chấm công, lương',
    menu: [
      group('1.', 'Chấm công và nghỉ phép', [
        leaf('1.1.', 'Chấm công', '/staff-attendance'),
        leaf('1.2.', 'Đơn nghỉ phép', '/leave-requests'),
        leaf('1.3.', 'Quy định phép năm', '/leave-policies'),
        leaf('1.4.', 'Ngày lễ và lịch bù', '/school-days'),
        leaf('1.5.', 'Lịch công tác', '/work-schedules'),
      ]),
      group('2.', 'Lương', [
        leaf('2.1.', 'Bảng lương', '/payrolls'),
        leaf('2.2.', 'Quyết toán và điều chỉnh lương', '/payroll-settlements'),
        leaf('2.3.', 'Danh mục lương và biểu thuế', '/pay-items'),
        leaf('2.4.', 'Thưởng và khấu trừ', '/bonus-deductions'),
        leaf('2.5.', 'Phiếu lương của tôi', '/my-payslips'),
      ]),
      group('3.', 'Công việc và đánh giá', [
        leaf('3.1.', 'Công việc và kế hoạch', '/work'),
        leaf('3.2.', 'Đánh giá nhân sự', '/evaluations'),
      ]),
    ],
  },
  {
    key: 'logistics',
    label: 'Bếp – kho, mua hàng',
    menu: [
      leaf('1.', 'Kho và tài sản', '/inventory'),
      leaf('2.', 'Đề nghị mua hàng', '/purchase-requests'),
      // Bán trú: kiểm thực ba bước và an toàn thực phẩm (DT-18 phần 22b); tên mục do Claude tự đặt theo ủy quyền của Eric ngày
      // 2026-10-11
      group('3.', 'Bán trú và an toàn thực phẩm', [
        leaf('3.1.', 'Kiểm thực ba bước', '/food-safety/inspections'),
        leaf('3.2.', 'Lưu và hủy mẫu thức ăn', '/food-safety/samples'),
        leaf('3.3.', 'Lô hàng nhập', '/food-safety/lots'),
        leaf('3.4.', 'Hồ sơ an toàn thực phẩm của nhà cung cấp', '/food-safety/supplier-records'),
        leaf('3.5.', 'Truy xuất nguồn gốc', '/food-safety/trace'),
      ]),
    ],
  },
  {
    key: 'interaction',
    label: 'Tương tác – truyền thông',
    menu: [leaf('1.', 'Tương tác với phụ huynh', '/interactions'), leaf('2.', 'Hoạt động và tin tức', '/activities')],
  },
  {
    key: 'teaching',
    label: 'Giảng dạy',
    menu: [leaf('1.', 'Bài học và giáo án', '/teaching')],
  },
  {
    key: 'admissions',
    label: 'Tuyển sinh, tuyển dụng',
    menu: [leaf('1.', 'Tuyển sinh', '/admissions'), leaf('2.', 'Tuyển dụng', '/recruitment')],
  },
  {
    key: 'reports',
    label: 'Báo cáo',
    menu: [leaf('1.', 'Báo cáo và bảng điều khiển', '/reports')],
  },
  {
    // Đánh giá KPI (DT-18 phần 18d): hệ thống KPI riêng của trường chuyển vào; phân hệ riêng nên đánh số liên tục, tên mục
    // do Claude tự đặt theo ủy quyền của Eric ngày 2026-10-11
    key: 'kpi',
    label: 'Đánh giá KPI',
    menu: [
      group('1.', 'Thiết lập', [
        leaf('1.1.', 'Kỳ đánh giá', '/kpi/periods'),
        leaf('1.2.', 'Bộ quy tắc chấm', '/kpi/rule-sets'),
        leaf('1.3.', 'Đối tượng đánh giá', '/kpi/profiles'),
        leaf('1.4.', 'Nhập dữ liệu từ hệ thống KPI cũ', '/kpi/legacy-import'),
      ]),
      group('2.', 'Danh mục', [leaf('2.1.', 'Danh mục công việc chuẩn', '/kpi/catalog')]),
      group('3.', 'Công việc', [
        leaf('3.1.', 'Việc của tôi', '/kpi/my-tasks'),
        leaf('3.2.', 'Giao việc và duyệt đăng ký', '/kpi/assignments'),
        leaf('3.3.', 'Chấm điểm công việc', '/kpi/grading'),
      ]),
      group('4.', 'Đánh giá, xếp loại', [
        leaf('4.1.', 'Tự đánh giá, xếp loại', '/kpi/my-evaluation'),
        leaf('4.2.', 'Đánh giá, xếp loại cán bộ', '/kpi/evaluations'),
        leaf('4.3.', 'Tổng hợp tham mưu', '/kpi/advisory'),
        leaf('4.4.', 'Biểu quyết xếp loại', '/kpi/voting'),
      ]),
      group('5.', 'Báo cáo', [leaf('5.1.', 'Báo cáo KPI', '/kpi/reports')]),
    ],
  },
  {
    // Website trường trên tên miền riêng (DT-18 phần 18f): phân hệ riêng nên đánh số liên tục, tên mục do Claude tự đặt theo
    // ủy quyền của Eric ngày 2026-10-11
    key: 'website',
    label: 'Website trường',
    menu: [
      group('1.', 'Thiết lập', [
        leaf('1.1.', 'Thông tin website', '/website/settings'),
        leaf('1.2.', 'Tên miền', '/website/domains'),
      ]),
      group('2.', 'Nội dung', [
        leaf('2.1.', 'Tin tức', '/website/news'),
        leaf('2.2.', 'Thông báo', '/website/announcements'),
        leaf('2.3.', 'Giới thiệu, cơ cấu tổ chức', '/website/pages'),
        leaf('2.4.', 'Công khai theo quy định', '/website/disclosures'),
        leaf('2.5.', 'Thư viện ảnh', '/website/albums'),
      ]),
      group('3.', 'Duyệt và liên hệ', [
        leaf('3.1.', 'Nội dung chờ duyệt', '/website/review'),
        leaf('3.2.', 'Thư liên hệ', '/website/contacts'),
      ]),
    ],
  },
  {
    // Hồ sơ chuyên môn và Việc của tôi (DT-18 phần 18e) theo mô tả công khai của GIKIDI Nhà Trường; phân hệ riêng nên đánh
    // số liên tục, tên mục do Claude tự đặt theo ủy quyền của Eric ngày 2026-10-11. Mục Việc của tôi gom việc đang chờ ở mọi
    // phân hệ, có số đếm trên menu
    key: 'professional-records',
    label: 'Hồ sơ chuyên môn',
    menu: [
      leaf('1.', 'Việc của tôi', '/my-work'),
      group('2.', 'Kho hồ sơ', [
        leaf('2.1.', 'Hồ sơ cá nhân', '/professional-records'),
        leaf('2.2.', 'Hồ sơ tổ, nhóm', '/professional-records/groups'),
        leaf('2.3.', 'Hồ sơ trường', '/professional-records/school'),
      ]),
      group('3.', 'Nộp và duyệt', [
        leaf('3.1.', 'Đợt nộp hồ sơ', '/professional-rounds'),
        leaf('3.2.', 'Duyệt hồ sơ', '/professional-records/review'),
        leaf('3.3.', 'Thống kê nộp hồ sơ', '/professional-records/statistics'),
      ]),
      group('4.', 'Thiết lập', [
        leaf('4.1.', 'Thư mục và luồng duyệt', '/professional-folders'),
        leaf('4.2.', 'Nhóm công tác', '/professional-work-groups'),
      ]),
      // Kế hoạch giáo dục (DT-18 phần 22i) gộp vào phân hệ này như kế hoạch DT-22 (dùng chung kho hồ sơ, nhóm công tác)
      group('5.', 'Kế hoạch giáo dục', [
        leaf('5.1.', 'Kế hoạch của tôi', '/education-plans'),
        leaf('5.2.', 'Kế hoạch tổ, nhóm', '/education-plans/groups'),
        leaf('5.3.', 'Kế hoạch của trường', '/education-plans/school'),
        leaf('5.4.', 'Duyệt kế hoạch', '/education-plans/review'),
        leaf('5.5.', 'Tiến độ duyệt kế hoạch', '/education-plans/progress'),
        leaf('5.6.', 'Thư viện mẫu kế hoạch', '/education-plan-templates'),
      ]),
    ],
  },
  {
    // Thi đua, khen thưởng cán bộ, giáo viên (DT-18 phần 22d): phân hệ riêng nên đánh số liên tục, tên mục do Claude tự đặt
    // theo ủy quyền của Eric ngày 2026-10-11
    key: 'emulation',
    label: 'Thi đua, khen thưởng',
    menu: [
      group('1.', 'Phong trào thi đua', [
        leaf('1.1.', 'Đợt thi đua', '/emulation/campaigns'),
        leaf('1.2.', 'Đăng ký thi đua', '/emulation/registrations'),
      ]),
      group('2.', 'Hồ sơ đề nghị', [
        leaf('2.1.', 'Hồ sơ đề nghị của tôi', '/emulation/nominations'),
        leaf('2.2.', 'Tiếp nhận hồ sơ', '/emulation/nominations/review'),
      ]),
      group('3.', 'Hội đồng thi đua', [
        leaf('3.1.', 'Hội đồng và phiên họp', '/emulation/council'),
        leaf('3.2.', 'Bỏ phiếu bình xét', '/emulation/voting'),
        leaf('3.3.', 'Phúc khảo, khiếu nại', '/emulation/appeals'),
      ]),
      group('4.', 'Khen thưởng', [leaf('4.1.', 'Quyết định khen thưởng', '/emulation/decisions')]),
      group('5.', 'Báo cáo', [
        leaf('5.1.', 'Sổ theo dõi khen thưởng', '/emulation/history'),
        leaf('5.2.', 'Báo cáo đợt thi đua', '/emulation/reports'),
      ]),
      group('6.', 'Danh mục', [leaf('6.1.', 'Danh hiệu và hình thức khen thưởng', '/emulation/titles')]),
    ],
  },
  {
    // Bảo đảm chất lượng, tự đánh giá (DT-18 phần 22f) theo mô tả công khai của trang bảo đảm chất lượng đã khảo sát; phân hệ
    // riêng nên đánh số liên tục, tên mục do Claude tự đặt theo ủy quyền của Eric ngày 2026-10-11. Mục 1.7 Rà soát thông tin
    // kiểm định CLGD vẫn ở phân hệ Quản lý giáo dục Mầm non như Sở; mục 2.1 ở đây đọc và ghi vào đó
    key: 'quality-assurance',
    label: 'Bảo đảm chất lượng',
    menu: [
      group('1.', 'Tự đánh giá', [
        leaf('1.1.', 'Đợt tự đánh giá', '/quality/assessments'),
        leaf('1.2.', 'Phiếu đánh giá tiêu chí', '/quality/reports'),
        leaf('1.3.', 'Minh chứng', '/quality/evidences'),
      ]),
      group('2.', 'Kiểm định và thiết lập', [
        leaf('2.1.', 'Theo dõi công nhận', '/quality/recognition'),
        leaf('2.2.', 'Bộ tiêu chuẩn đánh giá', '/quality/frameworks'),
      ]),
    ],
  },
];

// Một mục lá kèm phân hệ và chuỗi mục cha, dùng cho Truy cập nhanh và trợ giúp kiểm thử
export interface PortalMenuEntry {
  workspace: PortalWorkspace;
  trail: PortalMenuNode[];
  node: PortalMenuNode & { path: PortalQuickLinkPath };
}

export function listPortalMenuEntries(workspaces: PortalWorkspace[] = PORTAL_WORKSPACES): PortalMenuEntry[] {
  const entries: PortalMenuEntry[] = [];
  const walk = (workspace: PortalWorkspace, nodes: PortalMenuNode[], trail: PortalMenuNode[]) => {
    for (const node of nodes) {
      if (node.path) {
        entries.push({ workspace, trail: [...trail, node], node: node as PortalMenuEntry['node'] });
      }
      if (node.children) {
        walk(workspace, node.children, [...trail, node]);
      }
    }
  };
  for (const workspace of workspaces) {
    walk(workspace, workspace.menu, []);
  }
  return entries;
}

// Mục hiển thị trên menu: số và tên, ví dụ "4.1.1. Quản lý hồ sơ học sinh"
export function portalMenuText(node: PortalMenuNode): string {
  return `${node.number} ${node.label}`;
}

// Mục thuộc các cấp đang làm việc không (DT-19 phần 19c): mục không ghi cấp là của mọi cấp
export function isForSchoolLevels(
  levels: readonly SchoolLevelCode[] | undefined,
  activeLevels: readonly SchoolLevelCode[],
): boolean {
  return !levels || levels.some((level) => activeLevels.includes(level));
}

// Cây menu theo cấp đang làm việc (cấp người dùng chọn, hoặc mọi cấp người dùng được xem khi chọn "Tất cả"): bỏ mục, nhóm,
// phân hệ không thuộc cấp; nhóm, phân hệ không còn mục nào cũng bỏ; phân hệ có levelTitle đặt lại tên theo cấp. Trường chỉ
// bật Mầm non giữ y hệt cây menu (tên, số thứ bậc, thứ tự) như trước DT-19
export function portalWorkspacesForLevels(
  activeLevels: ReadonlyArray<{ code: SchoolLevelCode; display_name: string }>,
  workspaces: PortalWorkspace[] = PORTAL_WORKSPACES,
): PortalWorkspace[] {
  const codes = activeLevels.map((level) => level.code);
  const filterNodes = (nodes: PortalMenuNode[]): PortalMenuNode[] =>
    nodes.flatMap((node) => {
      if (!isForSchoolLevels(node.levels, codes)) {
        return [];
      }
      if (node.children) {
        const children = filterNodes(node.children);
        return children.length > 0 ? [{ ...node, children }] : [];
      }
      return [node];
    });
  return workspaces.flatMap((workspace) => {
    if (!isForSchoolLevels(workspace.levels, codes)) {
      return [];
    }
    const menu = filterNodes(workspace.menu);
    if (menu.length === 0) {
      return [];
    }
    const only = activeLevels.length === 1 ? activeLevels[0] : undefined;
    const label = workspace.levelTitle
      ? only
        ? `${workspace.levelTitle} ${only.display_name}`
        : workspace.levelTitle
      : workspace.label;
    return [{ ...workspace, label, menu }];
  });
}

// Đường dẫn của các mục menu không thuộc cấp nào trong danh sách, dùng để ẩn lối tắt "Truy cập nhanh" và mục của cây quyền
// thuộc cấp trường chưa bật. Trường chỉ bật Mầm non thì danh sách trống (không ẩn gì)
export function portalMenuPathsOutsideLevels(levels: readonly SchoolLevelCode[]): Set<PortalQuickLinkPath> {
  const inside = new Set(
    listPortalMenuEntries(portalWorkspacesForLevels(levels.map((code) => ({ code, display_name: code })))).map(
      (entry) => entry.node.path,
    ),
  );
  return new Set(
    listPortalMenuEntries()
      .map((entry) => entry.node.path)
      .filter((path) => !inside.has(path)),
  );
}
