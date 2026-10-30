import type { Generated } from 'kysely';

// Gia sư AI trả phí, lát L0 (YCTD-383): thêm cột vào bảng có sẵn bằng gộp khai báo interface, không sửa schema.ts
// (0230_add_assignment_ai_blocked)
declare module '../schema.js' {
  interface AssignmentsTable {
    // Bài tập giáo viên đánh dấu "không dùng AI"
    ai_blocked: Generated<boolean>;
  }
}

export {};
