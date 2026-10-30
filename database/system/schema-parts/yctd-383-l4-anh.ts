import type { ColumnType, Generated } from 'kysely';

// Gia sư AI trả phí, lát L4 ảnh bài tập (YCTD-383; migration hệ thống 0140_add_ai_tutor_images). Cột `image_text` của
// `ai_tutor_messages` khai ở `yctd-383-gia-su-ai.ts`
export type AiTutorImageContentType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface AiTutorMessageImagesTable {
  id: Generated<string>;
  message_id: string;
  child_id: string;
  position: number;
  // Trống sau khi việc nền xóa tệp (30 ngày)
  storage_key: string | null;
  content_type: AiTutorImageContentType;
  size_bytes: number;
  created_at: ColumnType<Date, Date | undefined, never>;
  deleted_at: Date | null;
}

declare module '../schema.js' {
  interface SystemDatabase {
    ai_tutor_message_images: AiTutorMessageImagesTable;
  }
}
