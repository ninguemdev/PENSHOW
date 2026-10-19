import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import { closeConnections, TRANSPORT_CLOSE_GRACE_MS } from './close-connections.js';
afterEach(() => vi.useRealTimers());
class Connection extends EventEmitter {
  readyState = 'open';
  close = vi.fn(() => {
    this.readyState = 'closed';
    this.emit('close');
  });
}
it('aguarda o transporte e remove seu listener/timer após o fechamento', async () => {
  vi.useFakeTimers();
  const conn = new Connection();
  const disconnect = vi.fn();
  const closing = closeConnections([{ conn, disconnect }]);
  expect(disconnect).toHaveBeenCalledWith(true);
  expect(conn.listenerCount('close')).toBe(1);
  conn.emit('close');
  await closing;
  expect(conn.listenerCount('close')).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
  expect(conn.close).not.toHaveBeenCalled();
});
it('limita o fechamento de conexão que não responde sem abandonar recursos', async () => {
  vi.useFakeTimers();
  const conn = new Connection();
  const closing = closeConnections([{ conn, disconnect: vi.fn() }]);
  await vi.advanceTimersByTimeAsync(TRANSPORT_CLOSE_GRACE_MS);
  await closing;
  expect(conn.close).toHaveBeenCalledWith(true);
  expect(conn.listenerCount('close')).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});
