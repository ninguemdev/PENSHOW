import type { CommandHandler, CommandHandlers } from '../../platform/realtime/dispatcher.js';
import { PublicCommandError } from '../../command-error.js';
import type { RoomService } from '../rooms/room.service.js';
import type { MatchService } from './match.service.js';

export function createMatchHandlers(
  rooms: RoomService,
  matches: MatchService,
  connectionId: string,
): CommandHandlers {
  const handle: CommandHandler = async (playerId, command) => {
    const actor = { playerId, connectionId };
    switch (command.event) {
      case 'match:start':
        return rooms.start(actor, command.payload.roomId, command.payload.mode);
      case 'match:returnToLobby':
        return rooms.returnToLobby(actor, command.payload.roomId, command.payload.matchId, {
          requireFinished: true,
        });
      case 'final:start': {
        const room = rooms.registry.byId(command.payload.roomId);
        if (!room) throw new PublicCommandError('ROOM_NOT_FOUND');
        return matches.startFinal(room, actor, command.payload.matchId);
      }
      case 'round:ready':
      case 'category:choose':
      case 'wager:submit':
      case 'target:choose':
      case 'answer:submit': {
        const room = rooms.registry.byId(command.payload.roomId);
        if (!room) throw new PublicCommandError('ROOM_NOT_FOUND');
        const context = {
          matchId: command.payload.matchId,
          roundId: command.payload.roundId,
        };
        if (command.event === 'round:ready')
          return matches.execute(room, actor, { kind: 'ready', ...context });
        if (command.event === 'category:choose')
          return matches.execute(room, actor, {
            kind: 'choose-category',
            ...context,
            category: command.payload.category,
          });
        if (command.event === 'wager:submit')
          return matches.execute(room, actor, {
            kind: 'wager',
            ...context,
            questionId: command.payload.questionId,
            amount: command.payload.amount,
          });
        if (command.event === 'target:choose')
          return matches.execute(room, actor, {
            kind: 'target',
            ...context,
            questionId: command.payload.questionId,
            targetPlayerId: command.payload.targetPlayerId,
          });
        const result = await matches.execute(room, actor, {
          kind: 'answer',
          ...context,
          questionId: command.payload.questionId,
          optionId: command.payload.optionId,
        });
        const phase = room.snapshot().phase;
        return {
          ...result,
          acceptance:
            phase.status === 'match' && phase.game?.state.final
              ? ('first-valid' as const)
              : ('recorded' as const),
        };
      }
      default:
        throw new PublicCommandError('INVALID_PHASE');
    }
  };
  return {
    'match:start': handle,
    'final:start': handle,
    'round:ready': handle,
    'category:choose': handle,
    'answer:submit': handle,
    'wager:submit': handle,
    'target:choose': handle,
    'match:returnToLobby': handle,
  };
}
