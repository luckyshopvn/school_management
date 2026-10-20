import { Controller, Get, Inject, Injectable, Logger, Query } from '@nestjs/common';
import {
  MY_WORK_SOURCE_LABELS,
  type MyWorkCount,
  type MyWorkItem,
  type MyWorkSourceCode,
} from '@school-management/shared';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { MyWorkSource } from './my-work-sources.js';

// Việc của tôi (DT-18 phần 18e, YCTD-142): gom việc đang chờ người dùng từ mọi nguồn đã khai báo, lọc theo nguồn, theo hạn
// (quá hạn, sắp đến hạn) và tìm theo chữ; điểm cuối đếm cho số trên menu. Nguồn lỗi không làm hỏng cả màn hình: màn hình
// báo nguồn chưa đọc được để người dùng mở phân hệ đó. Ai đăng nhập cũng gọi được (mỗi nguồn tự kiểm tra quyền)
export const MY_WORK_SOURCES = Symbol('MY_WORK_SOURCES');

export interface MyWorkResult {
  items: MyWorkItem[];
  count: MyWorkCount;
  failed_sources: MyWorkSourceCode[];
}

@Injectable()
export class MyWorkService {
  private readonly logger = new Logger('MyWork');

  constructor(@Inject(MY_WORK_SOURCES) private readonly sources: MyWorkSource[]) {}

  async collect(currentUser: CurrentUser): Promise<MyWorkResult> {
    const results = await Promise.all(
      this.sources.map(async (source) => {
        try {
          return { code: source.code, items: await source.collect(currentUser), failed: false };
        } catch (error) {
          this.logger.error(`Nguồn ${source.code} của Việc của tôi lỗi: ${(error as Error).message}`);
          return { code: source.code, items: [] as MyWorkItem[], failed: true };
        }
      }),
    );
    const items = results
      .flatMap((result) => result.items)
      .sort((left, right) => {
        if (left.overdue !== right.overdue) {
          return left.overdue ? -1 : 1;
        }
        if (left.deadline && right.deadline) {
          return left.deadline.localeCompare(right.deadline);
        }
        if (left.deadline || right.deadline) {
          return left.deadline ? -1 : 1;
        }
        return (right.received_at ?? '').localeCompare(left.received_at ?? '');
      });
    const bySource: MyWorkCount['by_source'] = {};
    for (const entry of items) {
      bySource[entry.source] = (bySource[entry.source] ?? 0) + 1;
    }
    return {
      items,
      count: { total: items.length, overdue: items.filter((entry) => entry.overdue).length, by_source: bySource },
      failed_sources: results.filter((result) => result.failed).map((result) => result.code),
    };
  }
}

@Controller('my-work')
export class MyWorkController {
  constructor(private readonly myWork: MyWorkService) {}

  @Get()
  async list(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    const result = await this.myWork.collect(currentUser);
    const source = typeof query.source === 'string' && query.source in MY_WORK_SOURCE_LABELS ? query.source : null;
    const state = query.state === 'overdue' || query.state === 'due_soon' ? query.state : null;
    const text = typeof query.q === 'string' ? query.q.trim().toLowerCase().slice(0, 200) : '';
    const items = result.items.filter(
      (entry) =>
        (!source || entry.source === source) &&
        (!state || entry[state]) &&
        (!text ||
          entry.title.toLowerCase().includes(text) ||
          (entry.detail ?? '').toLowerCase().includes(text) ||
          entry.kind.toLowerCase().includes(text)),
    );
    return { ...result, items };
  }

  @Get('count')
  async count(@AuthenticatedUser() currentUser: CurrentUser): Promise<MyWorkCount> {
    return (await this.myWork.collect(currentUser)).count;
  }
}
