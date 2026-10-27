import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-23 phần 23c (YCTD-213): trò chơi kiến thức và thẻ đáp án giấy ở màn hình lớp. Claude tự chọn theo ủy quyền của Eric ngày
// 2026-10-11:
// - `classroom_game_sessions`: một lượt chơi của một lớp (ô chữ, vòng quay, hỏi đáp theo vòng, thẻ đáp án giấy); câu hỏi chỉ lấy từ
//   ngân hàng câu hỏi đã duyệt (22g1); `config` giữ mã câu hỏi, lưới ô chữ, danh sách phần thưởng; `group_scores` là điểm theo nhóm
//   lúc kết thúc. `client_id` do máy giáo viên sinh: lượt chơi lúc mất mạng gửi lại nhiều lần không trùng;
// - `classroom_game_answers`: kết quả từng câu của lượt chơi: học sinh (thẻ đáp án giấy, theo số thứ tự trong lớp) hoặc nhóm (hỏi
//   đáp, vòng quay, ô chữ) chọn gì, đúng hay sai. Không lưu hình ảnh: thẻ đáp án đọc bằng camera, xử lý trên máy giáo viên;
// - điểm trò chơi không vào sổ điểm Thông tư 22, 27; chỉ vào nề nếp, thi đua khi giáo viên chuyển sang bảng điểm nhanh của 23b
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('classroom_game_sessions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('client_id', 'uuid', (column) => column.notNull().unique())
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 200`))
      .addColumn('config', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('group_scores', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('question_count', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('started_at', 'timestamptz', (column) => column.notNull())
      .addColumn('finished_at', 'timestamptz', (column) => column.notNull())
      .addColumn('recorded_by', 'uuid', (column) => column.notNull())
      .addColumn('recorded_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'classroom_game_sessions_kind_check',
        sql`kind in ('crossword', 'wheel', 'quiz_rounds', 'answer_cards')`,
      )
      .execute();
    await database.schema
      .createIndex('classroom_game_sessions_class_index')
      .on('classroom_game_sessions')
      .columns(['class_id', 'finished_at'])
      .execute();

    await database.schema
      .createTable('classroom_game_answers')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('session_id', 'uuid', (column) =>
        column.notNull().references('classroom_game_sessions.id').onDelete('cascade'),
      )
      .addColumn('question_id', 'uuid', (column) => column.notNull().references('questions.id').onDelete('cascade'))
      .addColumn('child_id', 'uuid', (column) => column.references('children.id'))
      .addColumn('group_name', 'text', (column) => column.check(sql`char_length(group_name) between 1 and 60`))
      .addColumn('answer', 'text', (column) => column.check(sql`char_length(answer) <= 200`))
      .addColumn('correct', 'boolean', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('classroom_game_answers_target_check', sql`child_id is null or group_name is null`)
      .execute();
    await database.schema
      .createIndex('classroom_game_answers_session_index')
      .on('classroom_game_answers')
      .columns(['session_id', 'question_id'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('classroom_game_answers').execute();
    await database.schema.dropTable('classroom_game_sessions').execute();
  },
};
