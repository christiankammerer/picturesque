// SPDX-License-Identifier: GPL-3.0-or-later
//
// PRF-03 / PRF-04: a pool of workers for decoding, hashing and resizing.
// Each worker runs one task at a time, so at most `size` run at once.

/** PRF-04: hardwareConcurrency − 1, at least 1, at most 4. */
export function poolSize(hardwareConcurrency: number | undefined): number {
  return Math.min(4, Math.max(1, (hardwareConcurrency ?? 2) - 1));
}

/** The parts of a Worker the pool uses (so tests can pass a fake). */
export interface WorkerLike {
  postMessage(message: unknown, transfer: Transferable[]): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  terminate(): void;
}

export interface TaskMessage<T> {
  task: number;
  payload: T;
}

export type ReplyMessage<R> = { task: number; ok: true; result: R } | { task: number; ok: false; error: string };

export interface Job<T> {
  payload: T;
  transfer?: Transferable[];
}

interface Queued<T, R> {
  /** Built when a worker is free, so inputs (file bytes) are only read then. */
  build: () => Job<T> | Promise<Job<T>>;
  resolve: (r: R) => void;
  reject: (e: unknown) => void;
}

export type Priority = 'high' | 'normal';

export class WorkerPool<T, R> {
  private readonly idle: WorkerLike[] = [];
  private readonly all: WorkerLike[] = [];
  private readonly queues: Record<Priority, Queued<T, R>[]> = { high: [], normal: [] };
  private nextTask = 1;
  private running = 0;
  private closed = false;
  /** The most tasks that ever ran at once (instrumentation for PRF-04). */
  peak = 0;

  private readonly create: () => WorkerLike;
  readonly size: number;

  constructor(create: () => WorkerLike, size: number) {
    this.create = create;
    this.size = size;
  }

  get active(): number {
    return this.running;
  }

  run(build: Queued<T, R>['build'], priority: Priority = 'normal'): Promise<R> {
    if (this.closed) return Promise.reject(new Error('worker pool is closed'));
    return new Promise<R>((resolve, reject) => {
      this.queues[priority].push({ build, resolve, reject });
      this.pump();
    });
  }

  terminate(): void {
    this.closed = true;
    for (const w of this.all) w.terminate();
    for (const q of [...this.queues.high, ...this.queues.normal]) q.reject(new Error('worker pool is closed'));
    this.queues.high.length = 0;
    this.queues.normal.length = 0;
  }

  private pump(): void {
    while (!this.closed && this.running < this.size) {
      const next = this.queues.high.shift() ?? this.queues.normal.shift();
      if (!next) return;
      const worker = this.idle.pop() ?? this.spawn();
      this.running++;
      this.peak = Math.max(this.peak, this.running);
      void this.dispatch(worker, next);
    }
  }

  private spawn(): WorkerLike {
    const w = this.create();
    this.all.push(w);
    return w;
  }

  private async dispatch(worker: WorkerLike, item: Queued<T, R>): Promise<void> {
    const task = this.nextTask++;
    const finish = () => {
      worker.onmessage = null;
      worker.onerror = null;
      this.running--;
      if (!this.closed) this.idle.push(worker);
      this.pump();
    };
    let job: Job<T>;
    try {
      job = await item.build();
    } catch (err) {
      finish();
      item.reject(err);
      return;
    }
    worker.onmessage = (event: MessageEvent) => {
      const reply = event.data as ReplyMessage<R>;
      if (reply.task !== task) return;
      finish();
      if (reply.ok) item.resolve(reply.result);
      else item.reject(new Error(reply.error));
    };
    worker.onerror = (event: ErrorEvent) => {
      finish();
      item.reject(new Error(event.message || 'worker error'));
    };
    const message: TaskMessage<T> = { task, payload: job.payload };
    worker.postMessage(message, job.transfer ?? []);
  }
}

/** Worker side: answer pool tasks with `handle`. */
export function serveTasks<T, R>(
  scope: { onmessage: ((e: MessageEvent) => void) | null; postMessage(m: unknown, t: Transferable[]): void },
  handle: (payload: T) => Promise<{ result: R; transfer?: Transferable[] }>,
): void {
  scope.onmessage = (event: MessageEvent) => {
    const { task, payload } = event.data as TaskMessage<T>;
    handle(payload).then(
      ({ result, transfer }) => scope.postMessage({ task, ok: true, result } satisfies ReplyMessage<R>, transfer ?? []),
      (err: unknown) =>
        scope.postMessage({ task, ok: false, error: err instanceof Error ? err.message : String(err) } satisfies ReplyMessage<R>, []),
    );
  };
}
