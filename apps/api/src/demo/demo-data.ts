import type { DemoAccount } from '@school-management/database';

// Dữ liệu giả của bản trình diễn (DT-18 phần 18h, YCTD-145). Mọi tên người, tên trường, số điện thoại, số định danh đều
// bịa: số điện thoại dạng 0900 000 xxx, số định danh bắt đầu 000. Dữ liệu tạo bằng chính các điểm cuối của máy chủ API như
// người dùng thao tác, nên đi qua đủ kiểm tra nghiệp vụ, mã hóa và nhật ký. Phủ các phân hệ cũ (trường, lớp, nhân sự, học
// sinh, điểm danh, y tế, bếp, học phí, hoạt động, giảng dạy, tương tác, kho, cơ sở vật chất, văn thư lưu trữ, tuyển dụng,
// tuyển sinh, thuốc) và các phần DT-18 đã gộp: 18a văn bản đến, 18b văn bản đi, 18c giao việc và lịch đơn vị, 18d KPI,
// 18f website, 18g nơi để và kiểm kê thiết bị. Mỗi phân hệ một bước; bước lỗi được ghi lại, các bước sau vẫn chạy
export const DEMO_SEED_VERSION = '18h-1';

export interface DemoUser {
  key: string;
  login: string;
  full_name: string;
  role_code: string;
  role_name: string;
  // Mã đơn vị trong DEMO_UNITS; null là toàn trường
  unit: 'TC' | 'DT1' | null;
  app: DemoAccount['app'];
  // Có hồ sơ nhân sự
  staff: boolean;
}

export const DEMO_UNITS = [
  { code: 'TC', name: 'Trường Mầm non Trình Diễn', unit_type: 'truong_chinh' },
  { code: 'DT1', name: 'Điểm trường Hoa Mai', unit_type: 'diem_truong' },
] as const;

// Tài khoản trình diễn; mật khẩu chung DEMO_PASSWORD
export const DEMO_USERS: DemoUser[] = [
  {
    key: 'principal',
    login: 'demo.hieutruong',
    full_name: 'Trần Thị Mai Anh',
    role_code: 'VT-02',
    role_name: 'Hiệu trưởng',
    unit: null,
    app: 'portal',
    staff: true,
  },
  {
    key: 'deputy',
    login: 'demo.phohieutruong',
    full_name: 'Lê Văn Bình',
    role_code: 'VT-15',
    role_name: 'Phó Hiệu trưởng',
    unit: 'DT1',
    app: 'portal',
    staff: true,
  },
  {
    key: 'manager',
    login: 'demo.quanly',
    full_name: 'Phạm Thị Cúc',
    role_code: 'VT-03',
    role_name: 'Quản lý đơn vị',
    unit: 'DT1',
    app: 'portal',
    staff: true,
  },
  {
    key: 'personnel',
    login: 'demo.nhansu',
    full_name: 'Hoàng Văn Dũng',
    role_code: 'VT-06',
    role_name: 'Nhân sự, văn thư',
    unit: null,
    app: 'portal',
    staff: true,
  },
  {
    key: 'accountant',
    login: 'demo.ketoan',
    full_name: 'Ngô Thị Hà',
    role_code: 'VT-04',
    role_name: 'Kế toán',
    unit: 'DT1',
    app: 'portal',
    staff: true,
  },
  {
    key: 'nurse',
    login: 'demo.yte',
    full_name: 'Đỗ Thị Hạnh',
    role_code: 'VT-09',
    role_name: 'Nhân viên y tế',
    unit: 'DT1',
    app: 'portal',
    staff: true,
  },
  {
    key: 'kitchen',
    login: 'demo.bep',
    full_name: 'Vũ Văn Khang',
    role_code: 'VT-10',
    role_name: 'Nhân viên bếp',
    unit: 'DT1',
    app: 'portal',
    staff: true,
  },
  {
    key: 'storekeeper',
    login: 'demo.kho',
    full_name: 'Bùi Thị Lan',
    role_code: 'VT-11',
    role_name: 'Nhân viên kho và mua hàng',
    unit: 'DT1',
    app: 'portal',
    staff: true,
  },
  {
    key: 'admissions',
    login: 'demo.tuyensinh',
    full_name: 'Đặng Văn Minh',
    role_code: 'VT-12',
    role_name: 'Nhân viên tuyển sinh',
    unit: 'DT1',
    app: 'portal',
    staff: true,
  },
  {
    key: 'platform',
    login: 'demo.quantri',
    full_name: 'Quản trị nền tảng trình diễn',
    role_code: 'VT-01',
    role_name: 'Quản trị nền tảng',
    unit: null,
    app: 'portal',
    staff: false,
  },
  {
    key: 'teacherA',
    login: 'demo.giaovien1',
    full_name: 'Nguyễn Thị Ngọc',
    role_code: 'VT-07',
    role_name: 'Giáo viên chủ nhiệm',
    unit: 'DT1',
    app: 'teacher',
    staff: true,
  },
  {
    key: 'teacherB',
    login: 'demo.giaovien2',
    full_name: 'Trịnh Thị Oanh',
    role_code: 'VT-07',
    role_name: 'Giáo viên chủ nhiệm',
    unit: 'DT1',
    app: 'teacher',
    staff: true,
  },
];

const CHILD_NAMES = [
  ['Nguyễn Minh An', 'male'],
  ['Trần Bảo Châu', 'female'],
  ['Lê Gia Huy', 'male'],
  ['Phạm Khánh Linh', 'female'],
  ['Hoàng Đức Minh', 'male'],
  ['Võ Ngọc Diệp', 'female'],
  ['Đinh Quang Khải', 'male'],
  ['Phan Thảo Vy', 'female'],
  ['Lý Hoàng Nam', 'male'],
  ['Mai Thu Trang', 'female'],
  ['Cao Tuấn Kiệt', 'male'],
  ['Dương Bảo Ngọc', 'female'],
] as const;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

export interface DemoSession {
  userId: string;
  token: string;
}

export interface DemoSeedContext {
  baseUrl: string;
  sessions: Record<string, DemoSession>;
  today: string;
  log(message: string): void;
  // Gán vai trò theo đơn vị cho tài khoản trình diễn khi đã có cây đơn vị (mã đơn vị → mã dòng)
  assignUnitRoles(unitIds: Record<string, string>): Promise<void>;
}

export interface DemoSeedReport {
  steps: Array<{ name: string; ok: boolean; error?: string }>;
}

class DemoApiError extends Error {}

// Gọi máy chủ API trong tiến trình của lệnh bằng mã phiên của tài khoản trình diễn
class DemoApi {
  constructor(private readonly context: DemoSeedContext) {}

  async call<T = Record<string, unknown>>(user: string, method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.context.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.token(user)}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return this.read<T>(response, method, path);
  }

  async upload<T = Record<string, unknown>>(
    user: string,
    path: string,
    fields: Record<string, string>,
    file: { name: string; content: Buffer; type: string },
  ): Promise<T> {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.set(key, value);
    }
    form.set('file', new Blob([new Uint8Array(file.content)], { type: file.type }), file.name);
    const response = await fetch(`${this.context.baseUrl}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token(user)}` },
      body: form,
    });
    return this.read<T>(response, 'POST', path);
  }

  private token(user: string): string {
    const session = this.context.sessions[user];
    if (!session) {
      throw new DemoApiError(`Chưa có tài khoản trình diễn ${user}`);
    }
    return session.token;
  }

  private async read<T>(response: Response, method: string, path: string): Promise<T> {
    const text = await response.text();
    if (!response.ok) {
      throw new DemoApiError(`${method} ${path} trả ${response.status}: ${text.slice(0, 400)}`);
    }
    const contentType = response.headers.get('content-type') ?? '';
    return (contentType.includes('json') && text ? JSON.parse(text) : {}) as T;
  }
}

function addDays(date: string, days: number): string {
  const moment = new Date(`${date}T00:00:00Z`);
  moment.setUTCDate(moment.getUTCDate() + days);
  return moment.toISOString().slice(0, 10);
}

function weekday(date: string): number {
  // 1 = thứ Hai … 7 = Chủ nhật
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

// Năm học chứa hôm nay: bắt đầu tháng 9 năm nay hoặc năm trước
export function demoAcademicYear(today: string) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const startYear = month >= 8 ? year : year - 1;
  return {
    name: `${startYear}–${startYear + 1}`,
    calendar: {
      first_term: { start_date: `${startYear}-08-15`, end_date: `${startYear + 1}-01-15` },
      second_term: { start_date: `${startYear + 1}-01-18`, end_date: `${startYear + 1}-07-31` },
    },
    startYear,
  };
}

export async function seedDemoData(context: DemoSeedContext): Promise<DemoSeedReport> {
  const api = new DemoApi(context);
  const report: DemoSeedReport = { steps: [] };
  const today = context.today;
  const year = demoAcademicYear(today);
  const ids: Record<string, string> = {};
  const staffIds: Record<string, string> = {};
  const children: Array<{ id: string; classKey: string; guardianPhone: string }> = [];
  const user = (key: string) => context.sessions[key]?.userId ?? '';

  async function step(name: string, run: () => Promise<void>) {
    try {
      await run();
      report.steps.push({ name, ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.log(`Bước "${name}" lỗi: ${message}`);
      report.steps.push({ name, ok: false, error: message });
    }
  }

  // ---- Nền: năm học, đơn vị, khối, lớp, danh mục ----
  await step('Năm học và cây đơn vị', async () => {
    const created = await api.call('principal', 'POST', '/academic-years', { name: year.name });
    ids.year = created.id as string;
    await api.call('principal', 'PUT', `/academic-years/${ids.year}/calendar`, year.calendar);
    await api.call('principal', 'POST', `/academic-years/${ids.year}/open`);
    for (const unit of DEMO_UNITS) {
      const row = await api.call('principal', 'POST', '/org-units', {
        code: unit.code,
        name: unit.name,
        unit_type: unit.unit_type,
        address: unit.code === 'TC' ? 'Số 1 đường Trình Diễn' : 'Số 2 đường Trình Diễn',
      });
      ids[unit.code] = row.id as string;
    }
    await context.assignUnitRoles({ TC: ids.TC ?? '', DT1: ids.DT1 ?? '' });
  });

  await step('Khối, lớp, danh mục quan hệ', async () => {
    await api.call('principal', 'POST', '/grade-levels', {
      code: 'LA',
      name: 'Lá',
      age_from_months: 60,
      age_to_months: 71,
    });
    await api.call('principal', 'POST', '/grade-levels', {
      code: 'CHOI',
      name: 'Chồi',
      age_from_months: 48,
      age_to_months: 59,
    });
    for (const [key, code, name, grade] of [
      ['classA', 'LA1', 'Lá 1', 'LA'],
      ['classB', 'CHOI1', 'Chồi 1', 'CHOI'],
    ] as const) {
      const row = await api.call('principal', 'POST', '/classes', {
        org_unit_id: ids.DT1,
        code,
        name,
        grade_level: grade,
        max_size: 25,
      });
      ids[key] = row.id as string;
    }
    ids.mother = (
      await api.call('principal', 'POST', '/catalog-items', {
        catalog_type: 'parent_relationship',
        code: 'ME',
        name: 'Mẹ',
      })
    ).id as string;
    ids.father = (
      await api.call('principal', 'POST', '/catalog-items', {
        catalog_type: 'parent_relationship',
        code: 'BO',
        name: 'Bố',
      })
    ).id as string;
  });

  // ---- Nhân sự: hồ sơ và gắn tài khoản ----
  await step('Hồ sơ nhân sự', async () => {
    let sequence = 0;
    for (const demoUser of DEMO_USERS.filter((item) => item.staff)) {
      sequence += 1;
      const row = await api.call('personnel', 'POST', '/staff', {
        org_unit_id: ids[demoUser.unit ?? 'TC'],
        code: `NS${String(sequence).padStart(3, '0')}`,
        full_name: demoUser.full_name,
        start_date: `${year.startYear}-08-01`,
        phone: `0900000${String(100 + sequence)}`,
      });
      staffIds[demoUser.key] = row.id as string;
      await api.call('personnel', 'POST', `/staff/${staffIds[demoUser.key]}/account`, { login: demoUser.login });
    }
  });

  await step('Phân công giáo viên chủ nhiệm', async () => {
    for (const [classKey, teacher] of [
      ['classA', 'teacherA'],
      ['classB', 'teacherB'],
    ] as const) {
      await api.call('principal', 'POST', `/classes/${ids[classKey]}/staff-assignments`, {
        staff_user_id: user(teacher),
        assignment_role: 'homeroom',
        from_date: year.calendar.first_term.start_date,
      });
    }
  });

  // ---- Học sinh và phụ huynh ----
  await step('Hồ sơ học sinh, phụ huynh, duyệt vào lớp', async () => {
    let index = 0;
    for (const [fullName, gender] of CHILD_NAMES) {
      index += 1;
      const classKey = index % 2 === 1 ? 'classA' : 'classB';
      const dobYear = classKey === 'classA' ? year.startYear - 5 : year.startYear - 4;
      const file = await api.upload(
        'admissions',
        '/files',
        { org_unit_id: ids.DT1 ?? '', purpose: 'birth_certificate' },
        { name: 'giay-khai-sinh.png', content: PNG, type: 'image/png' },
      );
      const guardianPhone = `0900000${String(index).padStart(3, '0')}`;
      const child = await api.call('admissions', 'POST', '/children', {
        org_unit_id: ids.DT1,
        full_name: fullName,
        dob: `${dobYear}-0${(index % 9) + 1}-1${index % 9}`,
        gender,
        national_id: `000000${String(index).padStart(6, '0')}`,
        birth_certificate_file_id: file.id,
        photo_consent: index % 3 === 0 ? 'refused' : 'pending',
        health: index === 4 ? { has_allergies: true, allergies: 'Dị ứng tôm' } : { has_allergies: false },
        guardians: [
          {
            full_name: `Phụ huynh của ${fullName.split(' ').at(-1)}`,
            phone: guardianPhone,
            relationship_item_id: index % 2 === 0 ? ids.father : ids.mother,
            is_primary: true,
          },
        ],
        confirm_possible_duplicate: true,
      });
      await api.call('admissions', 'POST', `/children/${child.id as string}/submit`);
      await api.call('principal', 'POST', `/children/${child.id as string}/approve`, {
        class_id: ids[classKey],
        confirm_over_capacity: true,
      });
      children.push({ id: child.id as string, classKey, guardianPhone });
    }
  });

  await step('Điểm danh hôm nay', async () => {
    if (weekday(today) > 5) {
      return;
    }
    for (const [classKey, teacher] of [
      ['classA', 'teacherA'],
      ['classB', 'teacherB'],
    ] as const) {
      const entries = children
        .filter((child) => child.classKey === classKey)
        .map((child, position) => ({ child_id: child.id, status: position === 2 ? 'absent_notified' : 'present' }));
      await api.call(teacher, 'PUT', `/classes/${ids[classKey]}/attendance`, { date: today, entries });
    }
  });

  // ---- Y tế, bếp ----
  await step('Y tế: đợt cân đo, sổ theo dõi', async () => {
    const round = await api.call('nurse', 'POST', '/growth-rounds', {
      org_unit_id: ids.DT1,
      name: 'Cân đo đầu năm',
      measured_on: today,
    });
    await api.call('nurse', 'PUT', `/growth-rounds/${round.id as string}/measurements`, {
      rows: children.map((child, position) => ({
        child_id: child.id,
        weight_kg: 15 + (position % 5),
        height_cm: 100 + position,
      })),
    });
    const campaign = await api.call('nurse', 'POST', '/health-check-campaigns', {
      org_unit_id: ids.DT1,
      name: 'Khám sức khỏe định kỳ',
      from_date: today,
      to_date: addDays(today, 30),
    });
    await api.call('nurse', 'POST', '/health-check-schedules', {
      campaign_id: campaign.id,
      class_id: ids.classA,
      check_date: addDays(today, 7),
      location: 'Phòng y tế',
    });
  });

  await step('Bếp: nguyên liệu, món ăn, thực đơn tuần', async () => {
    const rice = await api.call('kitchen', 'POST', '/ingredients', {
      org_unit_id: ids.DT1,
      code: 'GAO',
      name: 'Gạo tẻ',
      unit: 'kg',
    });
    const pork = await api.call('kitchen', 'POST', '/ingredients', {
      org_unit_id: ids.DT1,
      code: 'THIT',
      name: 'Thịt heo',
      unit: 'kg',
    });
    const greens = await api.call('kitchen', 'POST', '/ingredients', {
      org_unit_id: ids.DT1,
      code: 'RAU',
      name: 'Rau cải',
      unit: 'kg',
    });
    const dish = await api.call('kitchen', 'POST', '/dishes', {
      org_unit_id: ids.DT1,
      name: 'Cơm thịt kho',
      group_name: 'Món mặn',
      norms: [
        { ingredient_id: rice.id, quantity_per_serving: 0.06 },
        { ingredient_id: pork.id, quantity_per_serving: 0.04 },
      ],
    });
    const soup = await api.call('kitchen', 'POST', '/dishes', {
      org_unit_id: ids.DT1,
      name: 'Canh cải nấu thịt',
      group_name: 'Món canh',
      norms: [{ ingredient_id: greens.id, quantity_per_serving: 0.05 }],
    });
    await api.call('kitchen', 'POST', '/food-suppliers', {
      org_unit_id: ids.DT1,
      name: 'Hợp tác xã rau sạch Trình Diễn',
    });
    const monday = addDays(today, 1 - weekday(today));
    const menu = await api.call('kitchen', 'POST', '/menus', {
      org_unit_id: ids.DT1,
      week_start_date: monday,
      items: [1, 2, 3, 4, 5].flatMap((day) => [
        { weekday: day, meal_type: 'lunch', dish_id: dish.id },
        { weekday: day, meal_type: 'lunch', dish_id: soup.id },
      ]),
    });
    await api.call('kitchen', 'POST', `/menus/${menu.id as string}/submit`);
    await api.call('manager', 'POST', `/menus/${menu.id as string}/approve`);
  });

  // ---- Học phí, thu chi ----
  await step('Học phí: dịch vụ, biểu phí, quỹ, danh mục thu chi', async () => {
    const services = await api.call<Array<{ id: string; code: string }>>('accountant', 'GET', '/services');
    const meal = services.find((service) => service.code === 'BAN_TRU');
    const stem = await api.call('accountant', 'POST', '/services', {
      code: 'STEM',
      name: 'STEM',
      unit: 'tháng',
      calculation_method: 'monthly',
    });
    await api.call('accountant', 'POST', '/fee-schedules', {
      name: `Biểu phí năm học ${year.name}`,
      effective_from: `${year.startYear}-08-01`,
      items: ['LA', 'CHOI'].flatMap((grade) => [
        { grade_level: grade, fee_type: 'tuition', amount: 1_500_000 },
        ...(meal ? [{ grade_level: grade, fee_type: 'service', service_id: meal.id, amount: 30_000 }] : []),
        { grade_level: grade, fee_type: 'service', service_id: stem.id, amount: 300_000 },
      ]),
    });
    await api.call('accountant', 'POST', '/cash-accounts', {
      org_unit_id: ids.DT1,
      account_type: 'cash',
      name: 'Quỹ tiền mặt',
      opening_balance: 5_000_000,
    });
    await api.call('accountant', 'POST', '/cashflow-categories', {
      code: 'THU_HOC_PHI',
      name: 'Thu học phí',
      group_name: 'Thu từ hoạt động giáo dục',
      flow_type: 'income',
    });
    await api.call('accountant', 'POST', '/cashflow-categories', {
      code: 'MUA_NGUYEN_LIEU',
      name: 'Mua nguyên liệu bếp',
      group_name: 'Chi hoạt động',
      flow_type: 'expense',
    });
    const nextMonth = addDays(`${today.slice(0, 8)}01`, 40).slice(0, 7);
    for (const child of children.slice(0, 4)) {
      await api
        .call('accountant', 'POST', '/service-registrations', {
          child_id: child.id,
          period: nextMonth,
          service_id: stem.id,
        })
        .catch(() => undefined);
    }
  });

  // ---- Hoạt động, giảng dạy, tương tác ----
  await step('Hoạt động, tin tức', async () => {
    const category = await api.call('manager', 'POST', '/activity-categories', {
      org_unit_id: ids.DT1,
      name: 'Hoạt động ngoài trời',
    });
    const activity = await api.call('teacherA', 'POST', '/activities', {
      class_id: ids.classA,
      category_id: category.id,
      title: 'Bé tham quan vườn rau',
      content: 'Các bé lớp Lá 1 tìm hiểu cách trồng và chăm sóc rau.',
      activity_date: today,
    });
    await api.call('manager', 'POST', `/activities/${activity.id as string}/approve`);
    const news = await api.call('manager', 'POST', '/news', {
      org_unit_id: ids.DT1,
      title: 'Thông báo họp phụ huynh đầu năm',
      content: 'Nhà trường mời phụ huynh dự họp đầu năm học tại hội trường.',
    });
    await api.call('manager', 'POST', `/news/${news.id as string}/publish`);
  });

  await step('Giảng dạy: bài học, kế hoạch bài dạy', async () => {
    const domain = await api.call('manager', 'POST', '/lesson-domains', {
      org_unit_id: ids.DT1,
      name: 'Phát triển nhận thức',
    });
    const lesson = await api.call('teacherA', 'POST', '/lessons', {
      name: 'Nhận biết các loại rau',
      objectives: 'Trẻ gọi tên được 5 loại rau quen thuộc.',
      domain_id: domain.id,
      is_shared: true,
    });
    const plan = await api.call('teacherA', 'POST', '/lesson-plans', {
      lesson_id: lesson.id,
      class_id: ids.classA,
      planned_date: addDays(today, 2),
      activities: 'Xem tranh, kể tên, chơi trò chơi đi chợ.',
      duration_minutes: 30,
    });
    await api.call('teacherA', 'POST', `/lesson-plans/${plan.id as string}/submit`);
    await api.call('manager', 'POST', `/lesson-plans/${plan.id as string}/approve`, {});
  });

  await step('Tương tác: khảo sát ý kiến phụ huynh', async () => {
    const now = new Date();
    const poll = await api.call('manager', 'POST', '/polls', {
      org_unit_id: ids.DT1,
      poll_type: 'poll',
      title: 'Chọn ngày tổ chức Ngày hội gia đình',
      start_at: new Date(now.getTime() - 60 * 60_000).toISOString(),
      end_at: new Date(now.getTime() + 7 * 24 * 60 * 60_000).toISOString(),
      options: ['Thứ Bảy tuần đầu tháng', 'Chủ nhật tuần đầu tháng'],
    });
    await api.call('manager', 'POST', `/polls/${poll.id as string}/publish`);
  });

  // ---- Kho, cơ sở vật chất, thiết bị (18g) ----
  await step('Kho, nhà cung cấp, tài sản', async () => {
    const item = await api.call('storekeeper', 'POST', '/stock-items', {
      org_unit_id: ids.DT1,
      code: 'GIAY-A4',
      name: 'Giấy A4',
      unit: 'ram',
      min_qty: 5,
    });
    await api.call('storekeeper', 'POST', '/stock-opening-balances', {
      org_unit_id: ids.DT1,
      balance_date: year.calendar.first_term.start_date,
      lines: [{ stock_item_id: item.id, quantity: 20, unit_price: 70_000 }],
    });
    await api.call('storekeeper', 'POST', '/suppliers', {
      org_unit_id: ids.DT1,
      name: 'Công ty Văn phòng phẩm Trình Diễn',
    });
    const asset = await api.call('storekeeper', 'POST', '/assets', {
      org_unit_id: ids.DT1,
      code: 'TS-0001',
      name: 'Tivi lớp học 43 inch',
      category: 'Thiết bị điện tử',
      unit: 'cái',
      original_cost: 8_000_000,
      purchase_date: year.calendar.first_term.start_date,
    });
    ids.asset = asset.id as string;
  });

  await step('Cơ sở vật chất, nơi để và kiểm kê thiết bị', async () => {
    const room = await api.call('manager', 'POST', '/rooms', {
      org_unit_id: ids.DT1,
      code: 'P101',
      name: 'Phòng Lá 1',
      capacity: 25,
    });
    const store = await api.call('manager', 'POST', '/equipment-locations', {
      org_unit_id: ids.DT1,
      code: 'KHO1',
      name: 'Kho thiết bị',
      location_type: 'store',
    });
    const classroom = await api.call('manager', 'POST', '/equipment-locations', {
      org_unit_id: ids.DT1,
      code: 'P101',
      name: 'Phòng Lá 1',
      location_type: 'room',
      room_id: room.id,
    });
    const placements = await api.call<Array<{ target_type: string; id: string }>>(
      'manager',
      'GET',
      `/equipment-placements?org_unit_id=${ids.DT1 ?? ''}`,
    );
    const targets = placements.map((row) => ({ target_type: row.target_type, id: row.id }));
    if (targets.length > 0) {
      await api.call('manager', 'PUT', '/equipment-placements', {
        org_unit_id: ids.DT1,
        location_id: classroom.id,
        targets,
      });
    }
    void store;
    await api.call('manager', 'POST', '/equipment-stocktakes', {
      org_unit_id: ids.DT1,
      name: 'Kiểm kê thiết bị học kỳ I',
      started_on: today,
    });
  });

  // ---- Văn bản đến, đi (18a, 18b) ----
  await step('Văn bản đến', async () => {
    await api.call('personnel', 'PUT', '/document-leaders', {
      leaders: [
        { user_id: user('principal'), title: 'Hiệu trưởng' },
        { user_id: user('deputy'), title: 'Phó Hiệu trưởng' },
      ],
    });
    const unit = await api.call('personnel', 'POST', '/external-units', {
      code: 'PGD-TD',
      name: 'Phòng Giáo dục và Đào tạo Trình Diễn',
    });
    const book = await api.call('personnel', 'POST', '/document-books', {
      name: 'Sổ văn bản đến',
      year: Number(today.slice(0, 4)),
      start_date: `${today.slice(0, 4)}-01-01`,
      end_date: `${today.slice(0, 4)}-12-31`,
      start_number: 1,
    });
    for (const [summary, symbol] of [
      ['V/v tổ chức Ngày hội đọc sách', '101/PGDĐT-GDMN'],
      ['V/v báo cáo số liệu đầu năm học', '102/PGDĐT-VP'],
    ] as const) {
      const document = await api.call('personnel', 'POST', '/incoming-documents', {
        summary,
        symbol,
        issuer_unit_id: unit.id,
        document_date: addDays(today, -3),
        book_id: book.id,
        arrival_date: today,
        deadline: addDays(today, 10),
      });
      await api.upload(
        'personnel',
        `/incoming-documents/${document.id as string}/files`,
        { scanned: 'true', kind: 'main' },
        {
          name: 'van-ban.pdf',
          content: PDF,
          type: 'application/pdf',
        },
      );
      await api.call('personnel', 'POST', `/incoming-documents/${document.id as string}/transfer`, {
        mode: 'leader',
        recipients: [{ user_id: user('principal') }],
      });
    }
  });

  await step('Văn bản đi', async () => {
    const book = await api.call('personnel', 'POST', '/document-books', {
      direction: 'outgoing',
      name: 'Sổ văn bản đi',
      year: Number(today.slice(0, 4)),
      start_number: 1,
      start_date: `${today.slice(0, 4)}-01-01`,
      end_date: `${today.slice(0, 4)}-12-31`,
    });
    await api.call('principal', 'PUT', '/signing/certificate', {
      signature_type: 'remote',
      provider: 'VNPT-CA',
      login_name: 'truong-trinh-dien',
      holder_name: 'Trần Thị Mai Anh',
      holder_title: 'Hiệu trưởng',
      serial_number: 'DEMO-0001',
      valid_from: `${year.startYear}-01-01`,
      valid_to: `${year.startYear + 5}-12-31`,
    });
    await api.call('principal', 'POST', '/signing/certificate/register', {});
    const draft = await api.call('accountant', 'POST', '/outgoing-documents', {
      summary: 'Thông báo thu học phí tháng tới',
      signer_id: user('principal'),
      drafting_unit_id: ids.TC,
    });
    await api.upload(
      'accountant',
      `/outgoing-documents/${draft.id as string}/files`,
      { kind: 'draft' },
      {
        name: 'du-thao.pdf',
        content: PDF,
        type: 'application/pdf',
      },
    );
    await api.call('accountant', 'POST', `/outgoing-documents/${draft.id as string}/submit`, {});
    await api.call('principal', 'POST', `/outgoing-documents/${draft.id as string}/sign`);
    await api.call('personnel', 'POST', `/outgoing-documents/${draft.id as string}/issue`, {
      book_id: book.id,
      issue_date: today,
      symbol_suffix: 'TB-MNTD',
    });
    // Một dự thảo còn chờ trình ký để màn hình có việc đang làm
    await api.call('accountant', 'POST', '/outgoing-documents', {
      summary: 'Kế hoạch tổ chức Ngày hội gia đình',
      signer_id: user('principal'),
      drafting_unit_id: ids.TC,
    });
  });

  // ---- Giao việc, lịch đơn vị (18c) ----
  await step('Giao việc', async () => {
    await api.call('principal', 'POST', '/task-directives', {
      content: 'Chuẩn bị Ngày hội đọc sách\nPhân công giáo viên trang trí góc sách các lớp.',
      duration_days: 7,
      assignments: [
        { role: 'main', target_type: 'staff', staff_id: staffIds.manager },
        { role: 'coordinate', target_type: 'staff', staff_id: staffIds.teacherA },
      ],
    });
    await api.call('manager', 'POST', '/tasks', {
      title: 'Cập nhật hồ sơ lớp Lá 1',
      assignee_staff_id: staffIds.teacherA,
      due_date: addDays(today, 7),
      priority: 'high',
    });
  });

  await step('Lịch đơn vị, phòng họp', async () => {
    const room = await api.call('personnel', 'POST', '/meeting-rooms', {
      name: 'Phòng họp số 1',
      location: 'Tầng 2',
      capacity: 20,
    });
    const booking = await api.call('nurse', 'POST', '/room-bookings', {
      room_id: room.id,
      title: 'Họp tổ y tế, bếp',
      date: addDays(today, 1),
      start_time: '14:00',
      end_time: '15:00',
    });
    await api.call('personnel', 'POST', `/room-bookings/${booking.id as string}/approve`, {});
    const entryDate = addDays(today, 2);
    await api.call('manager', 'POST', '/unit-schedules', {
      org_unit_id: ids.DT1,
      entry_date: entryDate,
      content: 'Họp giao ban đầu tuần',
      start_time: '07:30',
      end_time: '08:30',
      location: 'Phòng họp số 1',
    });
    const monday = addDays(entryDate, 1 - weekday(entryDate));
    await api.call('manager', 'POST', '/unit-schedules/publish', {
      from: monday,
      to: addDays(monday, 6),
      org_unit_id: ids.DT1,
    });
  });

  // ---- KPI (18d) ----
  await step('KPI: đối tượng, kỳ đánh giá, giao việc', async () => {
    const ruleSets = await api.call<
      Array<{ id: string; is_default: boolean; versions: Array<{ id: string; status: string }> }>
    >('principal', 'GET', '/kpi/rule-sets');
    const ruleSet = ruleSets.find((item) => item.is_default) ?? ruleSets[0];
    const versionId = ruleSet?.versions.find((item) => item.status === 'published')?.id;
    if (!ruleSet || !versionId) {
      throw new Error('Chưa có bộ quy tắc chấm KPI đã ban hành');
    }
    await api.call('principal', 'PUT', '/kpi/profiles', {
      staff_ids: [staffIds.teacherA, staffIds.teacherB, staffIds.nurse],
      rule_set_id: ruleSet.id,
      subject_group: 'staff',
      superior_staff_id: staffIds.manager,
    });
    const monthEnd = addDays(`${addDays(`${today.slice(0, 8)}01`, 40).slice(0, 8)}01`, -1);
    const period = await api.call('principal', 'POST', '/kpi/periods', {
      code: `DEMO-${today.slice(0, 7)}`,
      name: `Kỳ đánh giá tháng ${today.slice(5, 7)}/${today.slice(0, 4)}`,
      period_type: 'month',
      start_date: `${today.slice(0, 8)}01`,
      end_date: monthEnd,
      register_from: `${today.slice(0, 8)}01`,
      register_to: monthEnd,
    });
    const version = await api.call<{ config: { axes?: Array<{ code: string }> } }>(
      'principal',
      'GET',
      `/kpi/rule-versions/${versionId}`,
    );
    const axis = version.config.axes?.[0]?.code ?? 'chuyen-mon';
    await api.call('manager', 'POST', '/kpi/tasks/assign', {
      period_id: period.id,
      staff_ids: [staffIds.teacherA],
      name: 'Tổ chức tiết học trải nghiệm vườn rau',
      axis_code: axis,
      deadline: addDays(today, 10),
    });
  });

  // ---- Website (18f) ----
  await step('Website trường', async () => {
    const settings = await api.call('principal', 'GET', '/website/settings');
    await api.call('principal', 'PUT', '/website/settings', {
      ...settings,
      site_name: 'Trường Mầm non Trình Diễn',
      slogan: 'Vui học mỗi ngày',
      introduction: 'Trang trình diễn: thông tin giới thiệu mẫu, không phải trường thật.',
      address: 'Số 1 đường Trình Diễn',
      phone: '0280000000',
      email: 'lienhe@truong-trinh-dien.test',
      school_levels: ['MN'],
      demo_mode: true,
    });
    await api.call('principal', 'POST', '/website/sample-content');
  });

  // ---- Văn thư lưu trữ, tuyển dụng, tuyển sinh, thuốc ----
  await step('Văn thư lưu trữ', async () => {
    const fond = await api.call('principal', 'POST', '/archive-fonds', {
      code: 'PL01',
      name: 'Phông Trường Mầm non Trình Diễn',
    });
    await api.call('principal', 'POST', '/archive-records', {
      code: '01/HS-VT',
      title: 'Hồ sơ kế hoạch năm học',
      fond_id: fond.id,
      handler_name: 'Hoàng Văn Dũng',
      opened_on: year.calendar.first_term.start_date,
      due_date: year.calendar.second_term.end_date,
      status: 'pending',
      retention: 'permanent',
    });
  });

  await step('Tuyển dụng', async () => {
    const request = await api.call('manager', 'POST', '/recruitment-requests', {
      position: 'Giáo viên mầm non',
      quantity: 2,
      requirements: 'Tốt nghiệp cao đẳng sư phạm mầm non trở lên',
      reason: 'Mở thêm lớp',
      needed_by: addDays(today, 45),
    });
    await api.call('deputy', 'POST', `/recruitment-requests/${request.id as string}/approve`);
  });

  await step('Tuyển sinh trực tuyến', async () => {
    const campaign = await api.call('admissions', 'POST', '/admission-campaigns', {
      org_unit_id: ids.DT1,
      name: `Tuyển sinh năm học ${year.startYear + 1}–${year.startYear + 2}`,
      quota: 30,
      open_from: today,
      open_to: addDays(today, 60),
    });
    await api.call('admissions', 'POST', `/admission-campaigns/${campaign.id as string}/open`);
  });

  await step('Thuốc ở phòng y tế', async () => {
    const pharmacy = await api.call('nurse', 'POST', '/pharmacies', {
      org_unit_id: ids.DT1,
      name: 'Nhà thuốc Trình Diễn',
    });
    await api.call('nurse', 'POST', '/medicines', {
      org_unit_id: ids.DT1,
      code: 'PARA',
      name: 'Paracetamol 250 mg',
      unit: 'hộp',
      active_ingredient: 'Paracetamol',
      pharmacy_id: pharmacy.id,
      stock_qty: 5,
    });
  });

  return report;
}

// Tài khoản hiện ở trang chọn vai: nhân sự từ DEMO_USERS và hai phụ huynh đầu tiên
export function demoAccountList(): DemoAccount[] {
  return [
    ...DEMO_USERS.map((demoUser) => ({
      login: demoUser.login,
      full_name: demoUser.full_name,
      role_code: demoUser.role_code,
      role_name: demoUser.role_name,
      app: demoUser.app,
    })),
    ...CHILD_NAMES.slice(0, 2).map(([childName], index) => ({
      login: `0900000${String(index + 1).padStart(3, '0')}`,
      full_name: `Phụ huynh của ${childName.split(' ').at(-1)}`,
      role_code: 'VT-14',
      role_name: 'Phụ huynh',
      app: 'parent' as const,
    })),
  ];
}
