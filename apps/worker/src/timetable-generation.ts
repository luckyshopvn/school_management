import {
  GENERATION_QUEUE_KEY,
  GENERATION_TTL_SECONDS,
  generationCancelKey,
  generationJobKey,
  generationResultKey,
  generationStateKey,
  type GenerationJob,
  type GenerationState,
} from '@school-management/server/timetable-generation';
import { solveTimetable, type SolverResult } from '@school-management/server/timetable-solver';

// Máy xếp thời khoá biểu chạy nền (DT-20 phần 22c2, YCTD-164): lấy mã lần xếp từ hàng đợi Redis, đọc đề bài, chạy máy xếp có
// giới hạn thời gian, ghi tiến độ khoảng 4 lần mỗi giây và kết quả vào Redis. Tiến trình không đọc cơ sở dữ liệu; máy chủ API
// đọc tiến độ, lưu phương án. Mỗi lúc chạy một lần xếp; người dùng huỷ thì máy dừng ở lần báo tiến độ kế tiếp
export interface GenerationStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>;
}

export interface GenerationQueue extends GenerationStore {
  blpop(key: string, timeoutSeconds: number): Promise<[string, string] | null>;
}

type Solve = typeof solveTimetable;

async function writeState(store: GenerationStore, runId: string, state: Omit<GenerationState, 'updated_at'>) {
  const value: GenerationState = { ...state, updated_at: new Date().toISOString() };
  await store.set(generationStateKey(runId), JSON.stringify(value), 'EX', GENERATION_TTL_SECONDS);
}

export async function runGenerationJob(store: GenerationStore, runId: string, solve: Solve = solveTimetable) {
  const base = { percent: 0, variant: 0, variant_count: 0, best_score: null, best_hard: null, message: null };
  const text = await store.get(generationJobKey(runId));
  if (!text) {
    await writeState(store, runId, { ...base, status: 'failed', message: 'Không tìm thấy đề bài của lần xếp' });
    return;
  }
  if (await store.get(generationCancelKey(runId))) {
    await writeState(store, runId, { ...base, status: 'cancelled', message: 'Đã huỷ trước khi chạy' });
    return;
  }
  const job = JSON.parse(text) as GenerationJob;
  await writeState(store, runId, { ...base, status: 'running', variant_count: job.variant_count });
  let result: SolverResult;
  try {
    result = await solve(job.input, {
      time_limit_ms: job.time_limit_seconds * 1000,
      variant_count: job.variant_count,
      seed: job.seed,
      on_progress: async (progress) => {
        await writeState(store, runId, {
          status: 'running',
          percent: progress.percent,
          variant: progress.variant,
          variant_count: progress.variant_count,
          best_score: progress.best_score,
          best_hard: progress.best_hard,
          message: null,
        });
        return Boolean(await store.get(generationCancelKey(runId)));
      },
    });
  } catch (error) {
    await writeState(store, runId, {
      ...base,
      status: 'failed',
      message: `Máy xếp lỗi: ${error instanceof Error ? error.message : String(error)}`,
    });
    return;
  }
  await store.set(generationResultKey(runId), JSON.stringify(result), 'EX', GENERATION_TTL_SECONDS);
  const best = result.variants[0];
  await writeState(store, runId, {
    status: result.status === 'stopped' ? 'cancelled' : 'completed',
    percent: 100,
    variant: result.variants.length,
    variant_count: job.variant_count,
    best_score: best?.score ?? null,
    best_hard: best?.hard_count ?? null,
    message: result.status === 'stopped' ? 'Đã huỷ; giữ các phương án đã xếp xong' : null,
    issues: result.issues,
  });
}

// Vòng lấy việc; dừng khi `isRunning` trả false (nhận SIGTERM)
export async function consumeGenerationQueue(
  queue: GenerationQueue,
  isRunning: () => boolean,
  log: Pick<Console, 'log' | 'error'> = console,
) {
  while (isRunning()) {
    let item: [string, string] | null;
    try {
      item = await queue.blpop(GENERATION_QUEUE_KEY, 5);
    } catch (error) {
      if (!isRunning()) return;
      log.error('Không đọc được hàng đợi máy xếp thời khoá biểu', error);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }
    if (!item) continue;
    const runId = item[1];
    log.log(`Bắt đầu xếp thời khoá biểu ${runId}`);
    try {
      await runGenerationJob(queue, runId);
    } catch (error) {
      log.error(`Lần xếp ${runId} lỗi`, error);
    }
    log.log(`Xong lần xếp thời khoá biểu ${runId}`);
  }
}
