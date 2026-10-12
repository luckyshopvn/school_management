import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Tương tác và ý kiến, đồ bị mất của trẻ (P15-01 đến P15-06, P02-11; BR-66, BR-67, BR-68, BR-70, BR-72, BR-75; YCTD-79)
export const migration: Migration = {
  async up(database) {
    // P15-01: một luồng trao đổi cho mỗi cặp trẻ và tài khoản phụ huynh; phía nhà trường là giáo viên của lớp hiện tại
    // của trẻ và quản lý đơn vị
    await database.schema
      .createTable('message_threads')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('guardian_user_id', 'uuid', (column) => column.notNull())
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('last_message_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('message_threads_child_guardian_unique', ['child_id', 'guardian_user_id'])
      .execute();

    await database.schema
      .createTable('messages')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('thread_id', 'uuid', (column) => column.notNull().references('message_threads.id'))
      .addColumn('sender_user_id', 'uuid', (column) => column.notNull())
      .addColumn('sender_side', 'text', (column) => column.notNull())
      .addColumn('sender_name', 'text', (column) => column.notNull())
      .addColumn('content', 'text', (column) => column.notNull())
      .addColumn('sent_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('read_at', 'timestamptz')
      .addColumn('read_by', 'uuid')
      .addCheckConstraint('messages_sender_side_check', sql`sender_side in ('guardian', 'staff')`)
      .execute();
    await database.schema
      .createIndex('messages_thread_index')
      .on('messages')
      .columns(['thread_id', 'sent_at'])
      .execute();

    await database.schema
      .createTable('feedbacks')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('child_id', 'uuid', (column) => column.references('children.id'))
      .addColumn('submitted_by_user_id', 'uuid', (column) => column.notNull())
      .addColumn('submitter_name', 'text', (column) => column.notNull())
      .addColumn('category', 'text', (column) => column.notNull())
      .addColumn('content', 'text', (column) => column.notNull())
      .addColumn('privacy_level', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('received'))
      .addColumn('assigned_to_user_id', 'uuid')
      .addColumn('handled_by', 'uuid')
      .addColumn('handled_at', 'timestamptz')
      .addColumn('handling_note', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'feedbacks_category_check',
        sql`category in ('teaching', 'care', 'meal', 'facility', 'fee', 'other')`,
      )
      .addCheckConstraint('feedbacks_privacy_check', sql`privacy_level in ('named', 'anonymous')`)
      .addCheckConstraint('feedbacks_status_check', sql`status in ('received', 'in_progress', 'resolved')`)
      .execute();

    // P15-05: danh mục khảo sát dùng chung toàn trường, bộ câu hỏi mẫu chép sang khảo sát khi lập
    await database.schema
      .createTable('survey_templates')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('name', 'text', (column) => column.notNull().unique())
      .addColumn('description', 'text')
      .addColumn('questions', 'jsonb', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('survey_templates_status_check', sql`status in ('active', 'inactive')`)
      .execute();

    // P15-03, P15-04, P15-05: bình chọn và biểu quyết có một câu hỏi chọn một; khảo sát có nhiều câu hỏi
    await database.schema
      .createTable('polls')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('poll_type', 'text', (column) => column.notNull())
      .addColumn('title', 'text', (column) => column.notNull())
      .addColumn('description', 'text')
      .addColumn('class_id', 'uuid', (column) => column.references('classes.id'))
      .addColumn('audience', 'text', (column) => column.notNull())
      .addColumn('start_at', 'timestamptz', (column) => column.notNull())
      .addColumn('end_at', 'timestamptz', (column) => column.notNull())
      .addColumn('is_anonymous', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('survey_template_id', 'uuid', (column) => column.references('survey_templates.id'))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('published_at', 'timestamptz')
      .addColumn('closed_at', 'timestamptz')
      .addColumn('results_published_at', 'timestamptz')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('polls_type_check', sql`poll_type in ('poll', 'vote', 'survey')`)
      .addCheckConstraint('polls_audience_check', sql`audience in ('guardians', 'staff', 'everyone')`)
      .addCheckConstraint('polls_status_check', sql`status in ('draft', 'open', 'closed')`)
      .addCheckConstraint('polls_range_check', sql`end_at > start_at`)
      .execute();

    await database.schema
      .createTable('poll_questions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('poll_id', 'uuid', (column) => column.notNull().references('polls.id'))
      .addColumn('question_text', 'text', (column) => column.notNull())
      .addColumn('answer_type', 'text', (column) => column.notNull())
      .addColumn('order_no', 'integer', (column) => column.notNull())
      .addColumn('is_required', 'boolean', (column) => column.notNull().defaultTo(true))
      .addCheckConstraint(
        'poll_questions_answer_type_check',
        sql`answer_type in ('single_choice', 'multiple_choice', 'text', 'rating')`,
      )
      .execute();

    await database.schema
      .createTable('poll_options')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('poll_id', 'uuid', (column) => column.notNull().references('polls.id'))
      .addColumn('question_id', 'uuid', (column) => column.notNull().references('poll_questions.id'))
      .addColumn('label', 'text', (column) => column.notNull())
      .addColumn('order_no', 'integer', (column) => column.notNull())
      .execute();

    // BR-67: mỗi tài khoản một phiếu cho mỗi bình chọn, biểu quyết, khảo sát; phiếu đã gửi không sửa
    await database.schema
      .createTable('poll_responses')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('poll_id', 'uuid', (column) => column.notNull().references('polls.id'))
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('submitted_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('poll_responses_poll_user_unique', ['poll_id', 'user_id'])
      .execute();

    await database.schema
      .createTable('poll_answers')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('response_id', 'uuid', (column) => column.notNull().references('poll_responses.id'))
      .addColumn('question_id', 'uuid', (column) => column.notNull().references('poll_questions.id'))
      .addColumn('option_id', 'uuid', (column) => column.references('poll_options.id'))
      .addColumn('answer_text', 'text')
      .addColumn('answer_number', 'integer')
      .execute();

    // P15-06: bình luận chung theo cặp loại đối tượng và mã đối tượng; không xóa, chỉ ẩn kèm lý do (BR-66)
    await database.schema
      .createTable('interaction_comments')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('target_type', 'text', (column) => column.notNull())
      .addColumn('target_id', 'uuid', (column) => column.notNull())
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('author_name', 'text', (column) => column.notNull())
      .addColumn('author_side', 'text', (column) => column.notNull())
      .addColumn('content', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('reported_at', 'timestamptz')
      .addColumn('reported_by', 'uuid')
      .addColumn('hidden_at', 'timestamptz')
      .addColumn('hidden_by', 'uuid')
      .addColumn('hide_reason', 'text')
      .addCheckConstraint('interaction_comments_target_check', sql`target_type in ('poll')`)
      .addCheckConstraint('interaction_comments_side_check', sql`author_side in ('guardian', 'staff')`)
      .execute();
    await database.schema
      .createIndex('interaction_comments_target_index')
      .on('interaction_comments')
      .columns(['target_type', 'target_id', 'created_at'])
      .execute();

    await database.schema
      .createTable('comment_moderations')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('comment_id', 'uuid', (column) => column.notNull().references('interaction_comments.id'))
      .addColumn('action', 'text', (column) => column.notNull())
      .addColumn('reason', 'text', (column) => column.notNull())
      .addColumn('handled_by', 'uuid', (column) => column.notNull())
      .addColumn('handled_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('comment_moderations_action_check', sql`action in ('hide', 'restore', 'note')`)
      .execute();

    await database.schema
      .createTable('interaction_likes')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('target_type', 'text', (column) => column.notNull())
      .addColumn('target_id', 'uuid', (column) => column.notNull())
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('interaction_likes_target_check', sql`target_type in ('poll', 'comment')`)
      .addUniqueConstraint('interaction_likes_target_user_unique', ['target_type', 'target_id', 'user_id'])
      .execute();

    // P02-11: phiếu đồ bị mất do phụ huynh báo hoặc giáo viên ghi nhận đồ nhặt được
    await database.schema
      .createTable('lost_items')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('child_id', 'uuid', (column) => column.references('children.id'))
      .addColumn('class_id', 'uuid', (column) => column.references('classes.id'))
      .addColumn('report_type', 'text', (column) => column.notNull())
      .addColumn('description', 'text', (column) => column.notNull())
      .addColumn('noticed_on', 'date', (column) => column.notNull())
      .addColumn('photo_file_id', 'uuid', (column) => column.references('files.id'))
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('reported_by', 'uuid', (column) => column.notNull())
      .addColumn('reported_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('found_by', 'uuid')
      .addColumn('found_at', 'timestamptz')
      .addColumn('found_note', 'text')
      .addColumn('closed_by', 'uuid')
      .addColumn('closed_at', 'timestamptz')
      .addColumn('result_note', 'text')
      .addColumn('cancelled_by', 'uuid')
      .addColumn('cancelled_at', 'timestamptz')
      .addCheckConstraint('lost_items_report_type_check', sql`report_type in ('lost', 'found')`)
      .addCheckConstraint(
        'lost_items_status_check',
        sql`status in ('reported', 'found', 'returned', 'not_found', 'cancelled')`,
      )
      .addCheckConstraint('lost_items_owner_check', sql`child_id is not null or class_id is not null`)
      .execute();
    await database.schema
      .createIndex('lost_items_child_index')
      .on('lost_items')
      .columns(['child_id', 'reported_at'])
      .execute();
  },
  async down(database) {
    for (const table of [
      'lost_items',
      'interaction_likes',
      'comment_moderations',
      'interaction_comments',
      'poll_answers',
      'poll_responses',
      'poll_options',
      'poll_questions',
      'polls',
      'survey_templates',
      'feedbacks',
      'messages',
      'message_threads',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};
