/**
 * Prepares case envelopes in workers, most urgent first, and keeps them in the
 * envelope cache. Building a watch afterwards only assembles meshes: the main
 * thread no longer freezes for half a second per envelope.
 *
 * Without workers (tests, an old browser, a worker that fails to load), every
 * request resolves to null and the envelope is computed on the calling thread,
 * exactly as before.
 */
import type { WatchConfig } from '../core/config/types';
import { watchDimensions } from '../core/geometry/dimensions';
import {
  cachedEnvelope,
  envelopeKey,
  storeEnvelope,
  type EnvelopeData,
} from './parts/case-envelope';

/** Two workers: a slider preview is not stuck behind a thumbnail already started. */
const POOL_SIZE = 2;

type Waiter = (data: EnvelopeData | null) => void;

interface Request {
  key: string;
  config: WatchConfig;
  /** Smaller = more urgent, as for the thumbnails. */
  priority: number;
  waiters: Set<Waiter>;
}

interface Slot {
  worker: Worker;
  request: Request | null;
  id: number;
}

let slots: Slot[] | null = null;
let unavailable = typeof Worker === 'undefined';
let nextId = 0;
const queue: Request[] = [];
const requests = new Map<string, Request>();

function settle(request: Request, data: EnvelopeData | null) {
  requests.delete(request.key);
  for (const waiter of request.waiters) waiter(data);
  request.waiters.clear();
}

/** A worker that cannot run (blocked or failed module): fall back for good. */
function disable() {
  unavailable = true;
  for (const slot of slots ?? []) slot.worker.terminate();
  slots = null;
  queue.length = 0;
  for (const request of [...requests.values()]) settle(request, null);
}

function pool(): Slot[] | null {
  if (slots || unavailable) return slots;
  try {
    const count = Math.max(1, Math.min(POOL_SIZE, (navigator.hardwareConcurrency || 2) - 1));
    slots = Array.from({ length: count }, () => {
      const slot: Slot = {
        worker: new Worker(new URL('./envelope.worker.ts', import.meta.url), { type: 'module' }),
        request: null,
        id: 0,
      };
      slot.worker.addEventListener(
        'message',
        ({ data }: MessageEvent<{ id: number; data?: EnvelopeData; error?: string }>) => {
          const request = slot.request;
          if (!request || data.id !== slot.id) return;
          slot.request = null;
          if (data.data) storeEnvelope(data.data);
          // On an error, the build computes the envelope itself and reports it.
          settle(request, data.data ?? null);
          pump();
        },
      );
      slot.worker.addEventListener('error', disable);
      return slot;
    });
  } catch {
    disable();
  }
  return slots;
}

function pump() {
  for (const slot of pool() ?? []) {
    if (slot.request || !queue.length) continue;
    let best = 0;
    for (let i = 1; i < queue.length; i++) if (queue[i]!.priority < queue[best]!.priority) best = i;
    const request = queue.splice(best, 1)[0]!;
    slot.request = request;
    slot.id = ++nextId;
    try {
      // Plain data only: reactive proxies cannot be cloned into a worker.
      slot.worker.postMessage({ id: slot.id, config: JSON.parse(JSON.stringify(request.config)) });
    } catch {
      slot.request = null;
      settle(request, null);
    }
  }
}

/**
 * Resolves once the envelope of this configuration is ready in the cache, or with
 * null when it must be computed by the build itself (no worker, error, or aborted).
 */
export function prepareEnvelope(
  config: WatchConfig,
  priority = 0,
  signal?: AbortSignal,
): Promise<EnvelopeData | null> {
  if (signal?.aborted) return Promise.resolve(null);
  const key = envelopeKey(config, watchDimensions(config));
  const cached = cachedEnvelope(key);
  if (cached) return Promise.resolve(cached);
  if (!pool()) return Promise.resolve(null);
  let request = requests.get(key);
  if (request) request.priority = Math.min(request.priority, priority);
  else {
    request = { key, config, priority, waiters: new Set() };
    requests.set(key, request);
    queue.push(request);
  }
  const current = request;
  return new Promise((resolve) => {
    const abort = () => {
      current.waiters.delete(waiter);
      resolve(null);
      // Nobody waits any more: drop it unless a worker already started on it.
      const queued = queue.indexOf(current);
      if (!current.waiters.size && queued >= 0) {
        queue.splice(queued, 1);
        requests.delete(current.key);
      }
    };
    const waiter: Waiter = (data) => {
      signal?.removeEventListener('abort', abort);
      resolve(data);
    };
    current.waiters.add(waiter);
    signal?.addEventListener('abort', abort, { once: true });
    pump();
  });
}
