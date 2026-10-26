import { io } from 'socket.io-client';
import {
  acknowledgementSchema,
  clientCommandSchema,
  domainErrorSchema,
  serverEventSchema,
  type Acknowledgement,
  type ClientCommand,
  type GuestSessionToken,
  type ServerEvent,
} from '@penshow/shared';
import { strings } from '../strings/pt-BR';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';
export interface RealtimeCallbacks {
  status: (status: ConnectionStatus) => void;
  event: (event: ServerEvent) => void;
  invalid: () => void;
}
export interface RealtimeClient {
  connect: (token: GuestSessionToken, callbacks: RealtimeCallbacks) => void;
  disconnect: () => void;
  command: (command: ClientCommand) => Promise<Acknowledgement>;
}

export function createRealtimeClient(): RealtimeClient {
  // Dedicated PENSHOW transport path is independent of the HTML deployment base.
  const socket = io({ path: '/penshow/socket.io', autoConnect: false, timeout: 8000 });
  return {
    connect(token, callbacks) {
      socket.disconnect().removeAllListeners();
      socket.auth = { token };
      callbacks.status('connecting');
      socket.on('connect', () => callbacks.status('online'));
      socket.on('disconnect', () => callbacks.status('offline'));
      socket.on('connect_error', (error) => {
        callbacks.status('offline');
        const reason = domainErrorSchema.safeParse('data' in error ? error.data : undefined);
        if (reason.success && reason.data.code === 'UNAUTHENTICATED')
          callbacks.event({
            protocolVersion: 1,
            event: 'session:ended',
            payload: { reason: 'expired' },
          });
      });
      for (const name of [
        'room:view',
        'room:removed',
        'session:ended',
        'tiebreak:frame',
      ] as const) {
        socket.on(name, (raw: unknown) => {
          const parsed = serverEventSchema.safeParse(raw);
          if (!parsed.success || parsed.data.event !== name) return callbacks.invalid();
          callbacks.event(parsed.data);
        });
      }
      socket.connect();
    },
    disconnect() {
      socket.removeAllListeners().disconnect();
      socket.auth = {};
    },
    async command(command) {
      if (!socket.connected) throw new Error(strings.errors.offlineAction);
      const validated = clientCommandSchema.parse(command);
      let raw: unknown;
      try {
        // Never queue/retry a mutation silently; actionId remains owned by the caller.
        raw = await socket.timeout(8000).emitWithAck(validated.event, validated);
      } catch {
        throw new Error(strings.errors.unconfirmed);
      }
      const parsed = acknowledgementSchema.safeParse(raw);
      if (
        !parsed.success ||
        parsed.data.actionId !== command.actionId ||
        (parsed.data.status === 'ok' && parsed.data.event !== command.event)
      ) {
        throw new Error(strings.errors.protocol);
      }
      return parsed.data;
    },
  };
}
