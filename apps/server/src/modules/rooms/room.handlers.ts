import type { CommandHandler, CommandHandlers } from '../../platform/realtime/dispatcher.js';
import { PublicCommandError } from '../../command-error.js';
import type { RoomService } from './room.service.js';

export function createRoomHandlers(rooms: RoomService, connectionId: string): CommandHandlers {
  const handle: CommandHandler = (playerId, command) => {
    const actor = { playerId, connectionId };
    switch (command.event) {
      case 'room:sync':
        return rooms.sync(actor);
      case 'room:create':
        return rooms.create(actor, command.payload.profile, command.payload.settings);
      case 'room:join':
        return rooms.join(actor, command.payload.code, command.payload.profile);
      case 'room:leave':
        return rooms.leave(actor, command.payload.roomId);
      case 'room:updateProfile':
        return rooms.updateProfile(actor, command.payload.roomId, command.payload.profile);
      case 'room:updateSettings':
        return rooms.updateSettings(actor, command.payload.roomId, command.payload.settings);
      case 'room:kick':
        return rooms.kick(actor, command.payload.roomId, command.payload.targetPlayerId);
      default:
        throw new PublicCommandError('INVALID_PHASE');
    }
  };
  return {
    'room:sync': handle,
    'room:create': handle,
    'room:join': handle,
    'room:leave': handle,
    'room:updateProfile': handle,
    'room:updateSettings': handle,
    'room:kick': handle,
  };
}
