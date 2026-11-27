/**
 * Computes case envelopes off the main thread: the page keeps responding while a
 * slider moves or the grid thumbnails are rebuilt. The arrays are transferred, not
 * copied; this worker keeps no cache (the main thread does).
 */
import type { WatchConfig } from '../core/config/types';
import { watchDimensions } from '../core/geometry/dimensions';
import { computeEnvelope, envelopeTransfer } from './parts/case-envelope';

export interface EnvelopeRequest {
  id: number;
  config: WatchConfig;
}

const scope = self as unknown as {
  addEventListener(type: 'message', listener: (event: MessageEvent<EnvelopeRequest>) => void): void;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

scope.addEventListener('message', ({ data: { id, config } }) => {
  try {
    const data = computeEnvelope(config, watchDimensions(config));
    scope.postMessage({ id, data }, envelopeTransfer(data));
  } catch (error) {
    scope.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
});
