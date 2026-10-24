import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GENERATION_QUEUE_KEY,
  generationCancelKey,
  generationJobKey,
  generationResultKey,
  generationStateKey,
  type GenerationJob,
  type GenerationState,
} from '@school-management/server/timetable-generation';
import type { SolverResult } from '@school-management/server/timetable-solver';
import { consumeGenerationQueue, runGenerationJob, type GenerationQueue } from './timetable-generation.js';

// Máy xếp chạy nền (DT-20 phần 22c2, YCTD-164), kịch bản CT-22c2-7: kho Redis giả trong bộ nhớ
class MemoryQueue implements GenerationQueue {
  readonly values = new Map<string, string>();
  readonly lists = new Map<string, string[]>();
  readonly states: GenerationState[] = [];

  async get(key: string) {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string) {
    this.values.set(key, value);
    if (key.endsWith(':state')) {
      this.states.push(JSON.parse(value) as GenerationState);
    }
    return 'OK';
  }

  async blpop(key: string): Promise<[string, string] | null> {
    const item = this.lists.get(key)?.shift();
    return item ? [key, item] : null;
  }
}

const job = (runId: string): GenerationJob => ({
  run_id: runId,
  time_limit_seconds: 1,
  variant_count: 1,
  seed: 1,
  input: {
    days: [1, 2],
    periods: [
      { period_no: 1, session: 'morning' },
      { period_no: 2, session: 'morning' },
    ],
    demands: [
      {
        class_id: '1A',
        class_name: '1A',
        subject_id: 'TV',
        subject_name: 'Tiếng Việt',
        teacher_id: 'GV',
        teacher_name: 'Cô An',
        room_id: null,
        room_name: null,
        periods: 3,
      },
    ],
  },
});

describe('Máy xếp thời khoá biểu chạy nền', () => {
  it('CT-22c2-7: lấy việc từ hàng đợi, ghi tiến độ, kết quả; huỷ trước khi chạy; thiếu đề bài; máy xếp lỗi', async () => {
    const queue = new MemoryQueue();
    queue.values.set(generationJobKey('run-1'), JSON.stringify(job('run-1')));
    queue.lists.set(GENERATION_QUEUE_KEY, ['run-1']);
    let rounds = 0;
    await consumeGenerationQueue(queue, () => (rounds += 1) <= 2, { log: () => {}, error: () => {} });
    const result = JSON.parse(queue.values.get(generationResultKey('run-1')) ?? '{}') as SolverResult;
    assert.equal(result.status, 'feasible');
    assert.equal(result.variants[0]?.placements.length, 3);
    const final = JSON.parse(queue.values.get(generationStateKey('run-1')) ?? '{}') as GenerationState;
    assert.equal(final.status, 'completed');
    assert.equal(final.percent, 100);
    assert.equal(final.best_hard, 0);
    assert.equal(queue.states[0]?.status, 'running');

    queue.values.set(generationJobKey('run-2'), JSON.stringify(job('run-2')));
    queue.values.set(generationCancelKey('run-2'), '1');
    await runGenerationJob(queue, 'run-2');
    assert.equal(
      (JSON.parse(queue.values.get(generationStateKey('run-2')) ?? '{}') as GenerationState).status,
      'cancelled',
    );
    assert.equal(queue.values.get(generationResultKey('run-2')), undefined);

    await runGenerationJob(queue, 'run-3');
    const missing = JSON.parse(queue.values.get(generationStateKey('run-3')) ?? '{}') as GenerationState;
    assert.equal(missing.status, 'failed');
    assert.match(missing.message ?? '', /Không tìm thấy đề bài/);

    queue.values.set(generationJobKey('run-4'), JSON.stringify(job('run-4')));
    await runGenerationJob(queue, 'run-4', () => Promise.reject(new Error('hết bộ nhớ')));
    const failed = JSON.parse(queue.values.get(generationStateKey('run-4')) ?? '{}') as GenerationState;
    assert.equal(failed.status, 'failed');
    assert.match(failed.message ?? '', /Máy xếp lỗi: hết bộ nhớ/);
  });
});
