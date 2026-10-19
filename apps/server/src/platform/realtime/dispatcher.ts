import {
  actionIdSchema,
  clientCommandSchema,
  commandSuccessSchema,
  createDomainError,
  playerIdSchema,
  PROTOCOL_VERSION,
} from '@penshow/shared';
import type {
  Acknowledgement,
  ClientCommand,
  ClientEvent,
  CommandSuccess,
  PlayerId,
} from '@penshow/shared';
import { PublicCommandError } from '../../command-error.js';
import type { Clock } from '../../ports.js';

export type IdentifyActor = (credentials: unknown) => PlayerId | null | Promise<PlayerId | null>;
export type CommandHandler = (
  actor: PlayerId,
  command: ClientCommand,
) => CommandSuccess['result'] | Promise<CommandSuccess['result']>;
export type CommandHandlers = Partial<Record<Exclude<ClientEvent, 'time:sync'>, CommandHandler>>;

interface DispatcherDependencies {
  clock: Clock;
  maxBytes: number;
  handlers: CommandHandlers;
  onInternalError: () => void;
}

export function createDispatcher(deps: DispatcherDependencies) {
  const events = new Set<string>(
    clientCommandSchema.options.map((schema) => schema.shape.event.value),
  );
  return async (
    event: unknown,
    raw: unknown,
    identifyActor: () => ReturnType<IdentifyActor>,
  ): Promise<Acknowledgement> => {
    let actionId: Acknowledgement['actionId'] = null;
    if (raw && typeof raw === 'object' && 'actionId' in raw) {
      const parsed = actionIdSchema.safeParse(raw.actionId);
      if (parsed.success) actionId = parsed.data;
    }
    const failure = (code: Parameters<typeof createDomainError>[0]): Acknowledgement => ({
      protocolVersion: PROTOCOL_VERSION,
      actionId,
      status: 'error',
      error: createDomainError(code),
    });
    const receivedAt = deps.clock.now();
    try {
      if (typeof event !== 'string' || !events.has(event)) return failure('UNKNOWN_EVENT');
      let serialized: string | undefined;
      try {
        serialized = JSON.stringify(raw);
      } catch {
        return failure('INVALID_PAYLOAD');
      }
      if (!serialized || Buffer.byteLength(serialized, 'utf8') > deps.maxBytes)
        return failure('INVALID_PAYLOAD');
      const parsed = clientCommandSchema.safeParse(raw);
      if (!parsed.success || parsed.data.event !== event) return failure('INVALID_PAYLOAD');
      const command = parsed.data;
      let result: CommandSuccess['result'];
      if (command.event === 'time:sync') {
        result = {
          clientSentAt: command.payload.clientSentAt,
          serverReceivedAt: receivedAt,
          serverSentAt: Math.max(receivedAt, deps.clock.now()),
        };
      } else {
        const actor = playerIdSchema.safeParse(await identifyActor());
        if (!actor.success) return failure('UNAUTHENTICATED');
        const handler = deps.handlers[command.event];
        if (!handler) return failure('INVALID_PHASE');
        result = await handler(actor.data, command);
      }
      const success = commandSuccessSchema.safeParse({
        protocolVersion: PROTOCOL_VERSION,
        actionId,
        status: 'ok',
        event: command.event,
        result,
      });
      if (!success.success) {
        deps.onInternalError();
        return failure('INTERNAL_ERROR');
      }
      return success.data;
    } catch (error) {
      if (error instanceof PublicCommandError) return failure(error.code);
      deps.onInternalError();
      return failure('INTERNAL_ERROR');
    }
  };
}
