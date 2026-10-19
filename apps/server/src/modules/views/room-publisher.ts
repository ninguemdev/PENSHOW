import { PROTOCOL_VERSION, serverEventSchema, type ServerEvent } from '@penshow/shared';
import type { Clock } from '../../ports.js';
import type { RoomActor } from '../rooms/room.service.js';
import type { Member, RoomState } from '../rooms/room.js';
import { buildPlayerView } from './build-player-view.js';

interface Dependencies {
  clock: Clock;
  isCurrent: (actor: RoomActor) => boolean;
  send: (actor: RoomActor, event: ServerEvent) => void;
  onError: () => void;
}
export function createRoomPublisher(deps: Dependencies) {
  function send(member: Member, event: ServerEvent) {
    if (member.connection.status !== 'connected') return;
    const actor = { playerId: member.playerId, connectionId: member.connection.connectionId };
    if (deps.isCurrent(actor)) deps.send(actor, serverEventSchema.parse(event));
  }
  return (after: RoomState, before: RoomState) => {
    const serverNow = deps.clock.now();
    // Removal is the sole terminal message; it must not sit behind a redundant final snapshot.
    for (const member of after.phase.status === 'closed' ? [] : after.members) {
      try {
        const view = buildPlayerView(after, member.playerId, serverNow);
        if (view)
          send(member, { protocolVersion: PROTOCOL_VERSION, event: 'room:view', payload: view });
      } catch {
        deps.onError();
      }
    }
    for (const member of before.members) {
      const remains = after.members.some((current) => current.playerId === member.playerId);
      if (remains && after.phase.status !== 'closed') continue;
      try {
        send(member, {
          protocolVersion: PROTOCOL_VERSION,
          event: 'room:removed',
          payload: {
            roomId: after.roomId,
            stateVersion: after.stateVersion,
            reason: remains
              ? 'closed'
              : after.bannedPlayerIds.includes(member.playerId)
                ? 'kicked'
                : 'left',
          },
        });
      } catch {
        deps.onError();
      }
    }
  };
}
