import type { PortalQuickLinkPath } from './index.js';

// Quyền quyết định mục menu nào hiện với người dùng (DT-15 phần 15e, chuyển từ cổng quản trị sang gói dùng chung để màn
// hình "Phân quyền theo menu" dùng cùng một nguồn). Điều kiện giữ đúng như thanh điều hướng cũ trước DT-15; mục không có
// điều kiện thì ai đăng nhập cũng thấy. Máy chủ vẫn kiểm tra quyền ở mọi yêu cầu (AI-12).
//
// Một điều kiện là một mã quyền, "một trong" (anyOf), "tất cả" (allOf) hoặc "cổng" (gate): mục hiện khi thỏa cả cổng lẫn
// điều kiện chính. Cổng là điều kiện chung của cả nhóm menu cũ (ví dụ phải có một quyền tài chính bất kỳ); quyền của cổng
// không tính là quyền của mục nên tích chọn mục không cấp kèm cả nhóm quyền của cổng. Mã quyền viết thẳng chuỗi vì tệp
// này được index.ts xuất lại, đọc PERMISSION_CODES ở đây sẽ vướng vòng nạp mô đun
export type MenuPermissionRule =
  | string
  | { anyOf: MenuPermissionRule[] }
  | { allOf: MenuPermissionRule[] }
  | { gate: MenuPermissionRule; rule: MenuPermissionRule };

const anyOf = (...rules: MenuPermissionRule[]): MenuPermissionRule => ({ anyOf: rules });
const gated = (gate: MenuPermissionRule, rule: MenuPermissionRule): MenuPermissionRule => ({ gate, rule });

const ACCOUNTS = anyOf('P01.account.manage', 'P01.account.manage-in-unit');
const FINAL_YEAR = anyOf('P02.final-year.view', 'P02.final-year.manage', 'P02.final-year.approve');
const ENTRY_INTAKE = anyOf('P02.entry-intake.view', 'P02.entry-intake.manage', 'P02.entry-intake.transfer');
const INCOMING = anyOf('P09.incoming-document.view', 'P09.incoming-document.register', 'P09.incoming-document.search');
// Văn bản đi (DT-18 phần 18b)
const OUTGOING = anyOf(
  'P09.outgoing-document.draft',
  'P09.outgoing-document.sign',
  'P09.outgoing-document.issue',
  'P09.outgoing-document.search',
);
// Website trường (DT-18 phần 18f)
const WEBSITE_CONTENT = anyOf('P14.website.edit', 'P14.website.approve');
// Phân hệ KPI (DT-18 phần 18d)
const KPI_ANY = anyOf('P09.kpi.participate', 'P09.kpi.manage', 'P09.kpi.advise', 'P09.kpi.configure');
// Giao việc, lịch, hồ sơ công việc theo VNPT iOffice (DT-18 phần 18c): việc cần xử lý cho mọi cán bộ có quyền của phân hệ
const STAFF_WORK = anyOf('P09.task.direct', 'P09.work-file.use', 'P09.schedule.view');
// Hồ sơ chuyên môn (DT-18 phần 18e)
const PROFESSIONAL_ANY = anyOf(
  'P09.professional-record.use',
  'P09.professional-record.review',
  'P09.professional-record.approve',
  'P09.professional-record.manage',
);
// Kế hoạch giáo dục (DT-18 phần 22i)
const EDUCATION_PLAN_ANY = anyOf(
  'P09.education-plan.use',
  'P09.education-plan.review',
  'P09.education-plan.approve',
  'P09.education-plan.finalize',
  'P09.education-plan.manage',
);
// Hồ sơ bồi dưỡng giáo viên (DT-22 phần 22e)
const TRAINING_ANY = anyOf('P09.training.use', 'P09.training.review', 'P09.training.manage');
const TRAINING_OVERSIGHT = anyOf('P09.training.review', 'P09.training.manage');
// Thi đua, khen thưởng (DT-18 phần 22d)
const EMULATION_ANY = anyOf('P09.emulation.use', 'P09.emulation.manage', 'P09.emulation.decide');
const EMULATION_MANAGE = anyOf('P09.emulation.manage', 'P09.emulation.decide');
// Bảo đảm chất lượng, tự đánh giá (DT-18 phần 22f)
const QUALITY_ANY = anyOf('P09.quality.use', 'P09.quality.manage');
const SCHEDULE_ANY = anyOf('P09.schedule.view', 'P09.schedule.manage', 'P09.meeting-room.manage');
// Điều kiện của nhóm "Trẻ và lớp" cũ
const CHILDREN_AND_CLASSES = anyOf('P02.class.manage', 'P02.view', 'P02.edit');
const STATISTICS = anyOf('P17.child-statistics.view', 'P17.staff-statistics.view');
const VIEW_FEES = anyOf('P05.view', 'P05.fee-catalog.manage', 'P05.discount-type.manage');
const VIEW_CASHFLOW = anyOf('P06.view', 'P06.cashflow-category.manage');
const REGISTRATIONS = anyOf('P05.view', 'P05.registration.manage', 'P05.late-registration.approve');
const DEBT_COLLECTION = anyOf('P05.debt-reminder.manage', 'P05.overdue-debt.propose', 'P05.overdue-debt.decide');
const FISCAL_PERIODS = anyOf('P06.period-close.request', 'P06.period-close.approve');
const LEDGER = anyOf('P06.ledger.view', 'P06.ledger.manage');
// Điều kiện của nhóm "Học phí và tài chính" cũ, áp cho từng mục của phân hệ Tài chính – học phí
const FINANCE = anyOf(
  VIEW_FEES,
  VIEW_CASHFLOW,
  REGISTRATIONS,
  'P05.debt.view',
  DEBT_COLLECTION,
  FISCAL_PERIODS,
  LEDGER,
);

// Mục có quyền thuộc sẵn cổng (ví dụ Biểu phí cần một quyền xem phí, quyền đó đã thỏa nhóm tài chính) thì viết gọn không
// kèm cổng; kết quả hiện hay ẩn vẫn như điều kiện cũ
export const MENU_PERMISSION_RULES: Partial<Record<PortalQuickLinkPath, MenuPermissionRule>> = {
  // Quản lý giáo dục Mầm non
  '/school-profile': anyOf('P01.school-profile.manage', 'P17.report.emis'),
  // Phân hiệu, điểm trường: như mục Phòng ban, sửa cần quyền quản lý cây đơn vị (YCTD-111)
  '/branches': anyOf('P01.view', 'P01.org-unit.manage'),
  '/school-sites': anyOf('P01.view', 'P01.org-unit.manage'),
  '/settings': anyOf('P01.view', 'P01.setting.manage'),
  // Rà soát kiểm định xem như hồ sơ trường; tách trường cần quyền cập nhật hồ sơ trường (DT-16 phần 16e)
  '/accreditation-review': anyOf('P01.school-profile.manage', 'P17.report.emis'),
  '/school-splits': 'P01.school-profile.manage',
  '/classes': CHILDREN_AND_CLASSES,
  // Nhập lớp học tách khỏi trang Nhập dữ liệu; cùng quyền nhập dữ liệu ban đầu của máy chủ (YCTD-111)
  '/class-imports': gated(CHILDREN_AND_CLASSES, 'P01.import.children'),
  // Phân công phụ trách lớp: ai xem được lớp đều xem được, phân công cần quyền quản lý lớp (YCTD-111)
  '/class-assignments': CHILDREN_AND_CLASSES,
  // Nền Tiểu học (DT-20 phần 20a): môn học như danh mục dùng chung (sửa cần quyền quản lý danh mục); phân công giảng dạy
  // theo môn như phân công phụ trách lớp
  '/subjects': anyOf('P01.view', 'P01.catalog.manage', 'P02.class.manage'),
  '/teaching-assignments': CHILDREN_AND_CLASSES,
  // Thời khoá biểu (DT-20 phần 22c1): ai xem được lớp đều xem bản đã ban hành; lập, ban hành cần P02.timetable.manage
  '/period-slots': anyOf('P01.view', 'P02.timetable.manage'),
  '/timetables': anyOf('P02.class.manage', 'P02.view', 'P02.edit', 'P02.timetable.manage'),
  '/student-assessments': anyOf('P02.assessment.enter', 'P02.assessment.view', 'P02.assessment.manage'),
  // Sổ đầu bài, chuyên cần theo tiết (DT-20 phần 20d): ai xem được lớp đều xem; ký sổ theo tuần cần P02.class-log.review
  '/class-logs': anyOf('P02.class.manage', 'P02.view', 'P02.edit', 'P02.class-log.review'),
  '/period-attendance': anyOf('P02.class.manage', 'P02.view', 'P02.edit', 'P02.class-log.review'),
  // Khai báo tuần: ai xem được thiết lập thì xem, sửa cần quyền quản lý năm học như 2.1 Năm học (DT-16 phần 16e)
  '/school-weeks': anyOf('P01.view', 'P01.academic-year.manage'),
  '/staff': 'P07.staff.view',
  '/children': CHILDREN_AND_CLASSES,
  // Biến động học sinh: người lập hoặc duyệt hồ sơ học sinh (YCTD-108)
  '/student-movements': gated(CHILDREN_AND_CLASSES, anyOf('P02.child.manage', 'P02.approve')),
  // Trước đây hiện ở nhóm Trẻ và lớp, hoặc ở nhóm Nhân sự cho người chỉ nhập nhân sự
  // Nhập nhân sự tách sang "3.1.3. Nhập nhân sự từ Excel" (DT-16 phần 16f); nhập học sinh sang "4.1.2. Nhập học sinh từ Excel"
  // (DT-16 phần 16g): trang còn công nợ đầu kỳ cho kế toán
  '/imports': 'P05.opening-debt.import',
  '/staff-imports': gated('P07.staff.view', 'P01.import.staff'),
  // Nhân sự đủ theo Sở (DT-16 phần 16f): xem như hồ sơ nhân sự, thao tác cần quyền quản lý hồ sơ (máy chủ kiểm tra)
  '/staff-branches': 'P07.staff.view',
  '/staff-identity': 'P07.staff.view',
  '/staff-movements': 'P07.staff.view',
  '/staff-statistics': 'P17.staff-statistics.view',
  '/staff-identity-progress': 'P17.staff-statistics.view',
  '/child-groups': gated(CHILDREN_AND_CLASSES, anyOf('P02.child-group.manage', 'P02.view')),
  // Cập nhật địa danh hành chính: như Biến động học sinh, người lập hoặc duyệt hồ sơ học sinh (YCTD-116)
  '/administrative-units': gated(CHILDREN_AND_CLASSES, anyOf('P02.child.manage', 'P02.approve')),
  // Học sinh đủ theo Sở (DT-16 phần 16g): nhập học sinh như nhập trẻ; sắp xếp, điện thoại nhận tin, số định danh, tiến độ
  // xác thực cho người lập hoặc duyệt hồ sơ; tài khoản học và thi, mật khẩu mặc định cho người quản lý tài khoản
  '/student-imports': gated(CHILDREN_AND_CLASSES, anyOf('P01.import.children', 'P02.child.manage', 'P02.approve')),
  '/student-order': gated(CHILDREN_AND_CLASSES, anyOf('P02.child.manage', 'P02.approve')),
  '/sms-phones': gated(CHILDREN_AND_CLASSES, anyOf('P02.child.manage', 'P02.approve')),
  '/national-ids': gated(CHILDREN_AND_CLASSES, anyOf('P02.child.manage', 'P02.approve')),
  '/learning-accounts': gated(CHILDREN_AND_CLASSES, 'P01.account.manage'),
  '/default-passwords': 'P01.account.manage',
  '/national-id-progress': anyOf('P02.child.manage', 'P02.approve'),
  '/growth': anyOf('P10.health.manage', 'P17.report.growth'),
  '/growth-report': 'P17.report.growth',
  '/program-completion': gated(
    CHILDREN_AND_CLASSES,
    anyOf('P02.program-completion.manage', 'P02.program-completion.approve'),
  ),
  '/kitchen': anyOf('P12.kitchen.manage', 'P12.menu.approve', 'P17.report.kitchen'),
  // Bán trú, nề nếp lớp Tiểu học (DT-20 phần 20b)
  '/boarding': 'P04.boarding.manage',
  '/conduct': anyOf('P02.conduct.record', 'P02.conduct.manage'),
  // Thông tin sức khỏe học sinh theo học kỳ (DT-16 phần 16h): như nhập cân đo
  '/student-health': anyOf('P10.health.manage', 'P17.report.growth'),
  '/health': anyOf('P10.health.manage', 'P10.medical-event.record'),
  '/medicines': anyOf('P10.medicine.manage', 'P10.medication.administer', 'P10.medicine-purchase.approve'),
  '/attendance': CHILDREN_AND_CLASSES,
  '/statistics': STATISTICS,
  // Chuyển hồ sơ lên năm học mới: như mở năm học (DT-16 phần 16e)
  '/year-rollover': 'P01.academic-year.manage',
  '/missing-profiles': STATISTICS,
  '/student-statistics': STATISTICS,
  // Văn thư lưu trữ (YCTD-118): người có quyền quản lý, xuất thì cũng được cấp quyền xem
  '/archive-records': anyOf('P09.archive.view', 'P09.archive.manage', 'P09.archive.export'),
  '/archive-fonds': anyOf('P09.archive.view', 'P09.archive.manage'),
  '/archive-holdings': anyOf('P09.archive.view', 'P09.archive.manage'),
  '/archive-report': anyOf('P09.archive.view', 'P09.archive.export'),
  // Cơ sở vật chất, TBDH; Báo cáo số liệu
  '/facility-rooms': anyOf('P17.report.facilities', 'P13.equipment.manage', 'P01.room.manage'),
  '/equipment': anyOf('P17.report.facilities', 'P13.equipment.manage'),
  '/emis': 'P17.report.emis',
  // Quản lý kí hồ sơ (DT-16 phần 16k): ai có một quyền của phân hệ đều xem được các mục; thao tác kiểm tra ở máy chủ
  '/signing-certificate': anyOf('P01.signing.view', 'P01.signing.certificate'),
  '/signing-certificate-sync': anyOf('P01.signing.view', 'P01.signing.certificate'),
  '/signing-dossiers': anyOf('P01.signing.view', 'P01.signing.manage', 'P01.signing.sign'),
  '/signing-submissions': anyOf('P01.signing.view', 'P01.signing.manage'),
  // Tuyển sinh đầu cấp (DT-17 phần 17c): 3.1, 3.2 đọc nhóm người dùng, tài khoản ở dịch vụ định danh nên cần thêm quyền quản
  // lý tài khoản; 5.1 hiện với người trả lời hỗ trợ tuyển sinh
  '/entry-admissions/final-year': FINAL_YEAR,
  '/entry-admissions/completion': FINAL_YEAR,
  '/entry-admissions/school-map': FINAL_YEAR,
  '/entry-admissions/services': FINAL_YEAR,
  '/entry-admissions/roles': gated(ACCOUNTS, FINAL_YEAR),
  '/entry-admissions/users': gated(ACCOUNTS, FINAL_YEAR),
  '/entry-admissions/staff': FINAL_YEAR,
  '/entry-admissions/classes': FINAL_YEAR,
  '/entry-admissions/statistics': FINAL_YEAR,
  '/entry-admissions/support': anyOf('P02.final-year.view', 'P02.admission-support.reply'),
  '/entry-admissions/advanced': ENTRY_INTAKE,
  '/entry-admissions/intake': ENTRY_INTAKE,
  '/entry-admissions/notices': ENTRY_INTAKE,
  '/entry-admissions/transfer': ENTRY_INTAKE,
  '/entry-admissions/transfer-results': ENTRY_INTAKE,
  '/admitted-students': ENTRY_INTAKE,
  // Văn bản đến theo VNPT iOffice (DT-18 phần 18a): danh sách của mình cho mọi người có một quyền của phân hệ; quản lý văn
  // bản đến, liên thông cho văn thư; tra cứu cho người có quyền tra cứu hoặc văn thư; quản trị văn bản cho người quản trị,
  // văn thư xem sổ văn bản để in sổ
  '/incoming-documents': INCOMING,
  '/incoming-documents/manage': 'P09.incoming-document.register',
  '/incoming-documents/for-information': INCOMING,
  '/incoming-documents/starred': INCOMING,
  '/incoming-documents/followed': INCOMING,
  '/incoming-documents/search': anyOf('P09.incoming-document.search', 'P09.incoming-document.register'),
  '/incoming-documents/interconnect': 'P09.incoming-document.register',
  '/document-books': anyOf(
    'P09.incoming-document.admin',
    'P09.incoming-document.register',
    'P09.outgoing-document.issue',
  ),
  '/external-units': 'P09.incoming-document.admin',
  '/external-unit-groups': 'P09.incoming-document.admin',
  '/document-catalogs': 'P09.incoming-document.admin',
  '/document-leaders': 'P09.incoming-document.admin',
  '/kpi/periods': 'P09.kpi.configure',
  '/kpi/rule-sets': 'P09.kpi.configure',
  '/kpi/profiles': 'P09.kpi.configure',
  '/kpi/legacy-import': 'P09.kpi.configure',
  '/kpi/catalog': KPI_ANY,
  '/kpi/my-tasks': 'P09.kpi.participate',
  '/kpi/assignments': 'P09.kpi.manage',
  '/kpi/grading': 'P09.kpi.manage',
  '/kpi/my-evaluation': 'P09.kpi.participate',
  '/kpi/evaluations': 'P09.kpi.manage',
  '/kpi/advisory': 'P09.kpi.advise',
  '/kpi/voting': 'P09.kpi.vote',
  '/kpi/reports': KPI_ANY,
  // Văn bản đi theo VNPT iOffice (DT-18 phần 18b): danh sách của mình cho mọi người có một quyền văn bản đi; quản lý văn bản
  // đi, liên thông cho văn thư; tra cứu cho người có quyền tra cứu hoặc văn thư
  '/outgoing-documents': OUTGOING,
  '/outgoing-documents/manage': 'P09.outgoing-document.issue',
  '/outgoing-documents/interconnect': 'P09.outgoing-document.issue',
  '/outgoing-documents/search': anyOf('P09.outgoing-document.search', 'P09.outgoing-document.issue'),
  // Giao việc, lịch, hồ sơ công việc, báo cáo theo VNPT iOffice (DT-18 phần 18c): giao việc cho người có quyền giao việc;
  // việc đã giao gồm cả việc giao theo quyền cũ của 3.1 Công việc và kế hoạch; hồ sơ nộp lưu cho văn thư lưu trữ
  '/directives/new': 'P09.task.direct',
  '/directives/inbox': STAFF_WORK,
  '/directives/outbox': anyOf('P09.task.direct', 'P09.task.assign'),
  '/work-files': 'P09.work-file.use',
  '/work-files/shared': 'P09.work-file.use',
  '/work-files/transferred': 'P09.work-file.use',
  '/work-files/archive': 'P09.archive.manage',
  '/work-files/expired': anyOf('P09.archive.view', 'P09.archive.manage'),
  '/unit-schedules': 'P09.schedule.manage',
  '/meeting-schedules': SCHEDULE_ANY,
  '/room-bookings': SCHEDULE_ANY,
  '/meeting-rooms': 'P09.meeting-room.manage',
  '/schedule-templates': 'P09.schedule.manage',
  '/document-reports/incoming': 'P09.document-report.view',
  '/document-reports/summary': 'P09.document-report.view',
  '/document-reports/statistics': 'P09.document-report.view',
  '/website/settings': 'P14.website.configure',
  '/website/domains': 'P14.website.configure',
  '/website/news': WEBSITE_CONTENT,
  '/website/announcements': WEBSITE_CONTENT,
  '/website/pages': WEBSITE_CONTENT,
  '/website/disclosures': WEBSITE_CONTENT,
  '/website/albums': WEBSITE_CONTENT,
  '/website/review': 'P14.website.approve',
  '/website/contacts': WEBSITE_CONTENT,
  // Hồ sơ chuyên môn (DT-18 phần 18e): Việc của tôi không có điều kiện, ai đăng nhập cũng thấy; kho cho người có một quyền
  // của hồ sơ chuyên môn; duyệt cho tổ trưởng và Ban Giám hiệu; đợt nộp, thống kê, thiết lập cho người quản lý kho
  '/professional-records': PROFESSIONAL_ANY,
  '/professional-records/groups': PROFESSIONAL_ANY,
  '/professional-records/school': PROFESSIONAL_ANY,
  '/professional-records/review': anyOf('P09.professional-record.review', 'P09.professional-record.approve'),
  '/professional-rounds': PROFESSIONAL_ANY,
  '/professional-records/statistics': anyOf('P09.professional-record.manage', 'P09.professional-record.approve'),
  '/professional-folders': 'P09.professional-record.manage',
  '/professional-work-groups': 'P09.professional-record.manage',
  '/education-plans': EDUCATION_PLAN_ANY,
  '/education-plans/groups': EDUCATION_PLAN_ANY,
  '/education-plans/school': EDUCATION_PLAN_ANY,
  '/education-plans/review': anyOf(
    'P09.education-plan.review',
    'P09.education-plan.approve',
    'P09.education-plan.finalize',
  ),
  '/education-plans/progress': anyOf(
    'P09.education-plan.manage',
    'P09.education-plan.approve',
    'P09.education-plan.finalize',
  ),
  '/education-plan-templates': EDUCATION_PLAN_ANY,
  // Hồ sơ bồi dưỡng giáo viên (DT-22 phần 22e): giáo viên xem khoá, đăng ký, hồ sơ của mình; tổ trưởng xem tổ mình; Ban Giám
  // hiệu quản lý
  '/training/mine': TRAINING_ANY,
  '/training/courses': TRAINING_ANY,
  '/training/records': TRAINING_OVERSIGHT,
  '/training/competency': TRAINING_OVERSIGHT,
  '/training/settings': 'P09.training.manage',
  '/emulation/campaigns': EMULATION_ANY,
  '/emulation/registrations': EMULATION_ANY,
  '/emulation/nominations': EMULATION_ANY,
  '/emulation/nominations/review': EMULATION_MANAGE,
  '/emulation/council': EMULATION_MANAGE,
  '/emulation/voting': EMULATION_ANY,
  '/emulation/appeals': EMULATION_ANY,
  '/emulation/decisions': EMULATION_MANAGE,
  '/emulation/history': EMULATION_ANY,
  '/emulation/reports': EMULATION_MANAGE,
  '/emulation/titles': EMULATION_ANY,
  '/quality/assessments': QUALITY_ANY,
  '/quality/reports': QUALITY_ANY,
  '/quality/evidences': QUALITY_ANY,
  '/quality/recognition': QUALITY_ANY,
  '/quality/frameworks': QUALITY_ANY,
  '/emis/facilities': 'P17.report.emis',
  '/emis/health': 'P17.report.emis',
  '/emis/end-of-year': 'P17.report.emis',
  '/emis/staff': 'P17.report.emis',
  '/emis/foreign-language': 'P17.report.emis',
  '/emis/preschool-end-of-year': 'P17.report.emis',
  '/emis/send': 'P17.report.emis',
  // Cơ sở vật chất đủ theo Sở (DT-16 phần 16i): 6.1 xem như báo cáo cơ sở vật chất, ghi cần quyền cập nhật hồ sơ trường; 6.2
  // như 1.1; 1.2 như báo cáo cơ sở vật chất; 2.2 như 2.1; 2.3 gửi theo quyền báo cáo cơ sở vật chất
  '/facility-investments': anyOf('P17.report.facilities', 'P01.school-profile.manage'),
  '/facility-input': anyOf('P17.report.facilities', 'P13.equipment.manage', 'P01.room.manage'),
  '/facility-report': anyOf('P17.report.facilities', 'P01.school-profile.manage'),
  '/equipment-outside': anyOf('P17.report.facilities', 'P13.equipment.manage'),
  '/equipment-submission': 'P17.report.facilities',
  // Quản trị hệ thống
  '/roles': ACCOUNTS,
  '/role-workspaces': ACCOUNTS,
  '/role-permissions': ACCOUNTS,
  '/accounts': ACCOUNTS,
  '/departments': anyOf('P01.view', 'P01.department.manage'),
  '/catalogs': anyOf('P01.view', 'P01.catalog.manage'),
  '/rooms': anyOf('P01.view', 'P01.room.manage', 'P01.catalog.manage'),
  '/approval-thresholds': 'P01.view',
  '/api-clients': gated(ACCOUNTS, 'P01.api-client.manage'),
  '/integrations': 'P01.integration.manage',
  // Tài khoản đồng bộ của Bộ, của Sở (DT-16 phần 16d)
  '/sync-accounts': 'P01.integration.manage',
  '/audit-logs': 'P01.view',
  // Ý kiến phản hồi (YCTD-110)
  '/feedback': 'P01.feedback.manage',
  // Tệp đã tạo của tác vụ xuất nền (DT-16 phần 16a): người xuất được dữ liệu
  '/generated-files': 'P17.data.export',
  // Thông báo hệ thống, ứng dụng liên kết (DT-16 phần 16c)
  '/system-announcements': 'P01.announcement.manage',
  '/app-links': 'P01.announcement.manage',
  // Quản trị và trình diễn (DT-18 phần 18h)
  '/impersonations': 'P01.account.impersonate',
  '/school-data-export': 'P01.data.export-all',
  '/demo-environment': anyOf('P01.account.manage', 'P01.account.impersonate'),
  // Bán trú: kiểm thực ba bước và an toàn thực phẩm (DT-18 phần 22b): bếp, người kiểm thực; người xem báo cáo bếp và quản lý
  // đơn vị duyệt thực đơn xem được sổ, lô và truy xuất
  '/food-safety/inspections': anyOf('P12.food-safety.inspect', 'P12.kitchen.manage', 'P12.menu.approve'),
  '/food-safety/samples': anyOf('P12.food-safety.inspect', 'P12.kitchen.manage', 'P12.menu.approve'),
  '/food-safety/lots': anyOf('P12.kitchen.manage', 'P12.food-safety.inspect', 'P17.report.kitchen'),
  '/food-safety/supplier-records': anyOf('P12.kitchen.manage', 'P12.food-safety.inspect', 'P17.report.kitchen'),
  '/food-safety/trace': anyOf(
    'P12.food-safety.inspect',
    'P12.kitchen.manage',
    'P12.menu.approve',
    'P17.report.kitchen',
  ),
  // Tài chính – học phí
  '/fees': VIEW_FEES,
  '/registrations': REGISTRATIONS,
  '/invoices': anyOf('P05.view', gated(FINANCE, 'P05.fee-calculation.manage')),
  '/fee-approvals': gated(FINANCE, 'P05.fee-document.approve'),
  '/debts': 'P05.debt.view',
  '/debt-collection': DEBT_COLLECTION,
  '/receipts': anyOf('P06.view', gated(FINANCE, anyOf('P06.receipt.manage', 'P06.cash-account.manage'))),
  '/payments': anyOf('P06.view', gated(FINANCE, anyOf('P06.payment.manage', 'P06.payment.approve'))),
  '/cash-accounts': anyOf('P06.view', gated(FINANCE, anyOf('P06.receipt.manage', 'P06.cash-account.manage'))),
  '/cash-book': anyOf('P06.view', gated(FINANCE, anyOf('P06.receipt.manage', 'P06.cash-account.manage'))),
  '/bank-reconciliation': anyOf('P06.view', gated(FINANCE, 'P06.bank-transaction.manage')),
  '/payables': anyOf('P06.view', gated(FINANCE, 'P06.payable.manage')),
  '/cashflow-categories': VIEW_CASHFLOW,
  '/ledger': LEDGER,
  '/fiscal-periods': FISCAL_PERIODS,
  // Nhân sự – chấm công, lương
  '/work-schedules': anyOf('P08.work-schedule.manage', 'P08.attendance.view'),
  '/payrolls': 'P08.payroll.view',
  '/payroll-settlements': 'P08.payroll.view',
  '/pay-items': anyOf('P08.payroll.view', 'P08.pay-item-type.manage'),
  '/bonus-deductions': anyOf('P08.payroll.view', 'P08.bonus-deduction.manage'),
  // Bếp – kho, mua hàng; Tương tác – truyền thông; Giảng dạy; Tuyển sinh, tuyển dụng
  '/inventory': anyOf(
    'P13.asset.manage',
    'P13.purchase-order.manage',
    'P13.stocktake.approve',
    'P13.purchase-request.approve',
  ),
  '/purchase-requests': anyOf('P13.purchase-request.create', 'P13.purchase-request.approve'),
  '/interactions': anyOf('P15.interaction.manage', 'P15.message.send', 'P02.lost-item.manage'),
  '/activities': anyOf(
    'P14.activity.approve',
    'P14.content.manage',
    'P14.library.manage',
    'P14.extracurricular.manage',
  ),
  '/teaching': anyOf('P03.lesson-plan.review', 'P03.curriculum.manage', 'P03.lesson.manage'),
  '/admissions': anyOf(
    'P16.admission-campaign.manage',
    'P16.application.manage',
    'P16.application.review',
    'P16.admission-post.manage',
  ),
  '/recruitment': anyOf(
    'P18.recruitment-request.create',
    'P18.recruitment-request.approve',
    'P18.recruitment.manage',
    'P18.interview.manage',
  ),
  // Thiết bị: nơi để, tem QR, kiểm kê, đối sánh danh mục tối thiểu (DT-18 phần 18g); người chỉ có quyền quét vẫn mở được
  // trang kiểm kê để quét trên web di động
  '/equipment-locations': anyOf('P13.equipment.manage', 'P17.report.facilities'),
  '/equipment-stocktakes': anyOf('P13.equipment.manage', 'P13.equipment.stocktake'),
  '/equipment-minimum': anyOf('P17.report.facilities', 'P13.equipment.manage'),
};

export function isMenuRuleSatisfied(rule: MenuPermissionRule, has: (code: string) => boolean): boolean {
  if (typeof rule === 'string') {
    return has(rule);
  }
  if ('anyOf' in rule) {
    return rule.anyOf.some((child) => isMenuRuleSatisfied(child, has));
  }
  if ('allOf' in rule) {
    return rule.allOf.every((child) => isMenuRuleSatisfied(child, has));
  }
  return isMenuRuleSatisfied(rule.gate, has) && isMenuRuleSatisfied(rule.rule, has);
}

// Mục menu có hiện với người có các quyền này không; mục không có điều kiện thì luôn hiện
export function isMenuPathVisible(path: PortalQuickLinkPath, has: (code: string) => boolean): boolean {
  const rule = MENU_PERMISSION_RULES[path];
  return rule === undefined || isMenuRuleSatisfied(rule, has);
}

function collect(rule: MenuPermissionRule, includeGates: boolean, inGate: boolean, into: string[]): void {
  if (typeof rule === 'string') {
    if (includeGates === inGate && !into.includes(rule)) {
      into.push(rule);
    }
    return;
  }
  if ('anyOf' in rule || 'allOf' in rule) {
    for (const child of 'anyOf' in rule ? rule.anyOf : rule.allOf) {
      collect(child, includeGates, inGate, into);
    }
    return;
  }
  collect(rule.gate, includeGates, true, into);
  collect(rule.rule, includeGates, inGate, into);
}

// Quyền của một mục menu: các mã trong điều kiện, không kể quyền chỉ nằm ở cổng; tích chọn mục là chọn hết các mã này
export function menuPermissionCodes(path: PortalQuickLinkPath): string[] {
  const rule = MENU_PERMISSION_RULES[path];
  const codes: string[] = [];
  if (rule !== undefined) {
    collect(rule, false, false, codes);
  }
  return codes;
}

// Quyền ở cổng của mục: người dùng cần thêm ít nhất một trong các quyền này thì mục mới hiện
export function menuGatePermissionCodes(path: PortalQuickLinkPath): string[] {
  const rule = MENU_PERMISSION_RULES[path];
  const codes: string[] = [];
  if (rule !== undefined) {
    collect(rule, true, false, codes);
  }
  return codes.filter((code) => !menuPermissionCodes(path).includes(code));
}
