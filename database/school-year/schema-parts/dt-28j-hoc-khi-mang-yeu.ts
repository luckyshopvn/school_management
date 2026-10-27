// Học khi mạng yếu (DT-28 phần 28j, YCTD-280): thêm cột vào bảng có sẵn bằng gộp khai báo interface, không sửa schema.ts
// (0193_add_offline_submission_keys)
declare module '../schema.js' {
  interface AssignmentSubmissionsTable {
    // Mã chống trùng của lần nộp, thời điểm em bấm nộp trên máy
    client_submit_key: string | null;
    client_submitted_at: Date | null;
  }

  interface SubmissionFilesTable {
    // Mã chống trùng do máy sinh khi gửi lại
    client_key: string | null;
  }
}

export {};
