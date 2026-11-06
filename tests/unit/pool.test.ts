// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { poolSize, WorkerPool, type TaskMessage, type WorkerLike } from '../../src/shared/decode/pool.ts';

/** A fake worker that answers each task after `delay` ms with payload × 10. */
function fakeWorker(delay: number, log: number[]): WorkerLike {
  const w: WorkerLike = {
    onmessage: null,
    onerror: null,
    terminate() {},
    postMessage(message: unknown) {
      const { task, payload } = message as TaskMessage<number>;
      log.push(payload);
      setTimeout(() => {
        const reply = payload < 0 ? { task, ok: false, error: 'boom' } : { task, ok: true, result: payload * 10 };
        w.onmessage?.({ data: reply } as MessageEvent);
      }, delay);
    },
  };
  return w;
}

describe('PRF-04 pool size', () => {
  it('is hardwareConcurrency − 1, at least 1, at most 4', () => {
    expect(poolSize(1)).toBe(1);
    expect(poolSize(2)).toBe(1);
    expect(poolSize(4)).toBe(3);
    expect(poolSize(16)).toBe(4);
    expect(poolSize(undefined)).toBe(1);
  });
  it('on a 4-core machine, 4 decodes run 3 at a time', async () => {
    const log: number[] = [];
    const pool = new WorkerPool<number, number>(() => fakeWorker(20, log), poolSize(4));
    const results = await Promise.all([1, 2, 3, 4].map((n) => pool.run(() => ({ payload: n }))));
    expect(results).toEqual([10, 20, 30, 40]);
    expect(pool.peak).toBe(3);
  });
});

describe('WorkerPool', () => {
  it('runs high-priority tasks before queued normal ones', async () => {
    const log: number[] = [];
    const pool = new WorkerPool<number, number>(() => fakeWorker(5, log), 1);
    const all = [pool.run(() => ({ payload: 1 })), pool.run(() => ({ payload: 2 })), pool.run(() => ({ payload: 3 }), 'high')];
    await Promise.all(all);
    expect(log).toEqual([1, 3, 2]);
  });
  it('builds a task only when a worker is free', async () => {
    const log: number[] = [];
    let built = 0;
    const pool = new WorkerPool<number, number>(() => fakeWorker(10, log), 1);
    const a = pool.run(() => ({ payload: ++built }));
    const b = pool.run(() => ({ payload: ++built }));
    await Promise.resolve();
    expect(built).toBe(1);
    await Promise.all([a, b]);
    expect(built).toBe(2);
  });
  it('passes worker errors on and keeps going', async () => {
    const pool = new WorkerPool<number, number>(() => fakeWorker(1, []), 1);
    await expect(pool.run(() => ({ payload: -1 }))).rejects.toThrow('boom');
    await expect(pool.run(() => ({ payload: 2 }))).resolves.toBe(20);
  });
  it('rejects queued work when terminated', async () => {
    const pool = new WorkerPool<number, number>(() => fakeWorker(50, []), 1);
    void pool.run(() => ({ payload: 1 })).catch(() => {});
    const queued = pool.run(() => ({ payload: 2 }));
    pool.terminate();
    await expect(queued).rejects.toThrow('closed');
  });
});
