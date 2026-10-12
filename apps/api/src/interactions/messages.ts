import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import type { MessageSenderSide, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { sql, type Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification, type NotificationRecipient } from '../common/notification-queue.js';
import {
  isUuid,
  notFoundError,
  readOptionalUuid,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { guardianUserIds } from '../finance/receivables.js';
import { InteractionAccess, readLimitedText } from './interaction-access.js';

// Trao đổi hai chiều giữa phụ huynh và nhà trường (P15-01; BR-70, BR-72; YCTD-79). Mỗi cặp trẻ và tài khoản phụ huynh có
// một luồng; phía nhà trường là giáo viên đang được phân công ở lớp hiện tại của trẻ và quản lý đơn vị có quyền
// P15.message.send. Người nhận có thông báo trong ứng dụng; tin được ghi thời điểm đã đọc. Không làm thời gian thực
const MAXIMUM_MESSAGE = 2000;

interface ThreadRow {
  id: string;
  org_unit_id: string;
  child_id: string;
  guardian_user_id: string;
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: InteractionAccess,
    private readonly clock: Clock,
  ) {}

  // Phía của người gọi trong luồng; người ngoài luồng bị từ chối (BR-72)
  private async sideIn(
    database: Kysely<SchoolYearDatabase>,
    currentUser: CurrentUser,
    thread: ThreadRow,
  ): Promise<MessageSenderSide> {
    if (thread.guardian_user_id === currentUser.id) {
      return 'guardian';
    }
    if (await this.canActAsStaff(database, currentUser, thread.child_id, thread.org_unit_id)) {
      return 'staff';
    }
    throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không tham gia luồng trao đổi này');
  }

  private async canActAsStaff(
    database: Kysely<SchoolYearDatabase>,
    currentUser: CurrentUser,
    childId: string,
    orgUnitId: string,
  ): Promise<boolean> {
    if (await this.access.canManageUnit(currentUser, PERMISSION_CODES.messageSend, orgUnitId)) {
      return true;
    }
    const child = await this.access.findChild(database, childId);
    const classIds = await this.access.teacherClassIds(database, currentUser, PERMISSION_CODES.messageSend);
    return child.class_id !== null && classIds.includes(child.class_id);
  }

  private async findThread(database: Kysely<SchoolYearDatabase>, threadId: string): Promise<ThreadRow> {
    const thread = await database
      .selectFrom('message_threads')
      .select(['id', 'org_unit_id', 'child_id', 'guardian_user_id'])
      .where('id', '=', threadId)
      .executeTakeFirst();
    if (!thread) {
      throw notFoundError('Không tìm thấy luồng trao đổi', 'message_thread');
    }
    return thread;
  }

  async listThreads(currentUser: CurrentUser, filter: { childId: string | null; classId: string | null }) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.access.managerScope(currentUser, PERMISSION_CODES.messageSend);
    const classIds = await this.access.teacherClassIds(database, currentUser, PERMISSION_CODES.messageSend);
    let query = database
      .selectFrom('message_threads')
      .innerJoin('children', 'children.id', 'message_threads.child_id')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select((expression) => [
        'message_threads.id',
        'message_threads.org_unit_id',
        'message_threads.child_id',
        'children.full_name as child_name',
        'class_enrollments.class_id',
        'classes.name as class_name',
        'message_threads.guardian_user_id',
        expression
          .selectFrom('guardians')
          .select('guardians.full_name')
          .whereRef('guardians.user_id', '=', 'message_threads.guardian_user_id')
          .limit(1)
          .as('guardian_name'),
        expression
          .selectFrom('messages')
          .select('messages.content')
          .whereRef('messages.thread_id', '=', 'message_threads.id')
          .orderBy('messages.sent_at', 'desc')
          .limit(1)
          .as('last_message'),
        'message_threads.last_message_at',
      ])
      .orderBy('message_threads.last_message_at', 'desc');
    if (!scope.wholeSchool) {
      query = query.where((expression) => {
        const conditions = [expression('message_threads.guardian_user_id', '=', currentUser.id)];
        if (scope.orgUnitIds.length > 0) {
          conditions.push(expression('message_threads.org_unit_id', 'in', scope.orgUnitIds));
        }
        if (classIds.length > 0) {
          conditions.push(expression('class_enrollments.class_id', 'in', classIds));
        }
        return expression.or(conditions);
      });
    }
    if (filter.childId) {
      query = query.where('message_threads.child_id', '=', filter.childId);
    }
    if (filter.classId) {
      query = query.where('class_enrollments.class_id', '=', filter.classId);
    }
    const threads = await query.execute();
    const unread = threads.length
      ? await database
          .selectFrom('messages')
          .select(['thread_id', 'sender_side', sql<number>`count(*)::int`.as('count')])
          .where(
            'thread_id',
            'in',
            threads.map((thread) => thread.id),
          )
          .where('read_at', 'is', null)
          .groupBy(['thread_id', 'sender_side'])
          .execute()
      : [];
    return threads.map((thread) => {
      // Tin chưa đọc là tin của phía bên kia
      const otherSide: MessageSenderSide = thread.guardian_user_id === currentUser.id ? 'staff' : 'guardian';
      return {
        ...thread,
        my_side: otherSide === 'staff' ? 'guardian' : 'staff',
        unread_count: unread.find((row) => row.thread_id === thread.id && row.sender_side === otherSide)?.count ?? 0,
      };
    });
  }

  // Mở luồng (hoặc dùng luồng đã có) cho một trẻ và gửi tin đầu tiên
  async startThread(
    currentUser: CurrentUser,
    input: { child_id: string; guardian_user_id: string | null; content: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.access.findChild(database, input.child_id);
    const guardians = await guardianUserIds(database, child.id);
    let guardianUserId: string;
    if (guardians.includes(currentUser.id) && (!input.guardian_user_id || input.guardian_user_id === currentUser.id)) {
      guardianUserId = currentUser.id;
    } else {
      if (!(await this.canActAsStaff(database, currentUser, child.id, child.org_unit_id))) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không được trao đổi với phụ huynh của trẻ này');
      }
      if (input.guardian_user_id) {
        if (!guardians.includes(input.guardian_user_id)) {
          throw validationError([{ field: 'guardian_user_id', message: 'Tài khoản này không là phụ huynh của trẻ' }]);
        }
        guardianUserId = input.guardian_user_id;
      } else if (guardians.length === 1 && guardians[0]) {
        guardianUserId = guardians[0];
      } else {
        throw validationError([
          {
            field: 'guardian_user_id',
            message: guardians.length === 0 ? 'Trẻ chưa có phụ huynh dùng ứng dụng' : 'Chọn phụ huynh nhận tin',
          },
        ]);
      }
    }
    await database
      .insertInto('message_threads')
      .values({
        org_unit_id: child.org_unit_id,
        child_id: child.id,
        guardian_user_id: guardianUserId,
        created_by: currentUser.id,
      })
      .onConflict((conflict) => conflict.columns(['child_id', 'guardian_user_id']).doNothing())
      .execute();
    const thread = await database
      .selectFrom('message_threads')
      .select(['id', 'org_unit_id', 'child_id', 'guardian_user_id'])
      .where('child_id', '=', child.id)
      .where('guardian_user_id', '=', guardianUserId)
      .executeTakeFirstOrThrow();
    const message = await this.send(database, currentUser, thread, input.content, origin);
    return { thread_id: thread.id, message };
  }

  async postMessage(currentUser: CurrentUser, threadId: string, content: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const thread = await this.findThread(database, threadId);
    return this.send(database, currentUser, thread, content, origin);
  }

  private async send(
    database: Kysely<SchoolYearDatabase>,
    currentUser: CurrentUser,
    thread: ThreadRow,
    content: string,
    origin: ChangeOrigin,
  ) {
    const side = await this.sideIn(database, currentUser, thread);
    const child = await this.access.findChild(database, thread.child_id);
    const now = this.clock.now();
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('messages')
        .values({
          thread_id: thread.id,
          sender_user_id: currentUser.id,
          sender_side: side,
          sender_name: currentUser.description.full_name,
          content,
          sent_at: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await transaction
        .updateTable('message_threads')
        .set({ last_message_at: now })
        .where('id', '=', thread.id)
        .execute();
      let recipients: NotificationRecipient[];
      if (side === 'guardian') {
        // Tin của phụ huynh tới giáo viên chủ nhiệm của lớp; trẻ chưa có lớp hoặc lớp chưa có chủ nhiệm thì tới quản lý
        const homerooms = await this.access.homeroomUserIds(transaction, child.class_id);
        recipients = homerooms.length
          ? homerooms.map((userId) => ({ userId, channel: 'in_app' as const }))
          : [{ roleCode: 'VT-03', orgUnitId: thread.org_unit_id, channel: 'in_app' }];
      } else {
        recipients = [{ userId: thread.guardian_user_id, channel: 'in_app' }];
      }
      await queueNotification(transaction, {
        orgUnitId: thread.org_unit_id,
        templateCode: 'message_received',
        title: side === 'guardian' ? `Tin nhắn từ phụ huynh của ${child.full_name}` : 'Tin nhắn từ nhà trường',
        body: content.length > 200 ? `${content.slice(0, 200)}…` : content,
        targetType: 'message_threads',
        targetId: thread.id,
        recipients,
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: thread.org_unit_id,
        entityName: 'messages',
        entityId: created.id,
        action: 'create',
        before: null,
        after: { thread_id: thread.id, sender_side: side },
      });
      return created;
    });
  }

  async listMessages(currentUser: CurrentUser, threadId: string) {
    const { database } = await this.currentSchoolYear.require();
    const thread = await this.findThread(database, threadId);
    const side = await this.sideIn(database, currentUser, thread);
    const child = await this.access.findChild(database, thread.child_id);
    const messages = await database
      .selectFrom('messages')
      .select(['id', 'sender_user_id', 'sender_side', 'sender_name', 'content', 'sent_at', 'read_at'])
      .where('thread_id', '=', threadId)
      .orderBy('sent_at')
      .execute();
    return {
      thread: { ...thread, child_name: child.full_name, class_name: child.class_name, my_side: side },
      messages,
    };
  }

  // BR-70: ghi thời điểm đã đọc cho tin của phía bên kia
  async markRead(currentUser: CurrentUser, threadId: string) {
    const { database } = await this.currentSchoolYear.require();
    const thread = await this.findThread(database, threadId);
    const side = await this.sideIn(database, currentUser, thread);
    const updated = await database
      .updateTable('messages')
      .set({ read_at: this.clock.now(), read_by: currentUser.id })
      .where('thread_id', '=', threadId)
      .where('sender_side', '<>', side)
      .where('read_at', 'is', null)
      .executeTakeFirst();
    return { marked: Number(updated.numUpdatedRows) };
  }
}

function readContent(body: RequestBody, errors: FieldError[]): string {
  return readLimitedText(body, 'content', errors, { required: true, maximum: MAXIMUM_MESSAGE }) ?? '';
}

@Controller()
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('message-threads')
  listThreads(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    for (const field of ['child_id', 'class_id']) {
      if (query[field] !== undefined && !isUuid(query[field])) {
        throw validationError([{ field, message: 'Mã không hợp lệ' }]);
      }
    }
    return this.messages.listThreads(currentUser, {
      childId: query.child_id ?? null,
      classId: query.class_id ?? null,
    });
  }

  @Post('message-threads')
  @HttpCode(201)
  startThread(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      child_id: readRequiredUuid(body, 'child_id', errors, 'Bắt buộc chọn trẻ'),
      guardian_user_id: readOptionalUuid(body, 'guardian_user_id', errors) ?? null,
      content: readContent(body, errors),
    };
    if (errors.length) {
      throw validationError(errors);
    }
    return this.messages.startThread(currentUser, input, originOf(request, currentUser));
  }

  @Get('message-threads/:id/messages')
  listMessages(
    @Param('id', uuidParameter('Mã luồng không hợp lệ')) threadId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.messages.listMessages(currentUser, threadId);
  }

  @Post('message-threads/:id/messages')
  @HttpCode(201)
  postMessage(
    @Param('id', uuidParameter('Mã luồng không hợp lệ')) threadId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const content = readContent(body, errors);
    if (errors.length) {
      throw validationError(errors);
    }
    return this.messages.postMessage(currentUser, threadId, content, originOf(request, currentUser));
  }

  @Post('message-threads/:id/read')
  @HttpCode(200)
  markRead(
    @Param('id', uuidParameter('Mã luồng không hợp lệ')) threadId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.messages.markRead(currentUser, threadId);
  }
}
