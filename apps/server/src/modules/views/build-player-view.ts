import { roomViewSchema, type PlayerId, type RoomView } from '@penshow/shared';
import type { RoomState } from '../rooms/room.js';
import { buildMatchView } from '../matches/build-match-view.js';

/** Whitelist public fields. Matches without an installed engine still fail closed. */
export function buildPlayerView(
  room: RoomState,
  viewerId: PlayerId,
  serverNow: number,
): RoomView | null {
  if (
    (room.phase.status === 'match' && !room.phase.game) ||
    !room.members.some((member) => member.playerId === viewerId)
  )
    return null;
  return roomViewSchema.parse({
    roomId: room.roomId,
    code: room.code,
    viewerId,
    stateVersion: room.stateVersion,
    serverNow,
    members: room.members.map((member) => ({
      playerId: member.playerId,
      role: member.role,
      isHost: member.role === 'player' && member.playerId === room.hostPlayerId,
      profile: {
        nickname: member.profile.nickname,
        avatar: {
          head: member.profile.avatar.head,
          eyes: member.profile.avatar.eyes,
          mouth: member.profile.avatar.mouth,
          cheeks: member.profile.avatar.cheeks,
          faceAccessory: member.profile.avatar.faceAccessory,
          hat: member.profile.avatar.hat,
        },
      },
      connection:
        member.connection.status === 'connected'
          ? { status: 'connected' }
          : { status: 'disconnected', since: member.connection.since },
    })),
    state:
      room.phase.status === 'closed'
        ? { status: 'closed', reason: room.phase.reason }
        : {
            status: room.phase.status === 'match' ? 'match' : 'lobby',
            ...(room.phase.status === 'match' && room.phase.game
              ? {
                  match: {
                    ...buildMatchView(room.phase.game.state, viewerId, serverNow),
                    ...(room.phase.game.suspended ? { waitingForPlayers: true } : {}),
                  },
                }
              : {}),
            settings: {
              format: room.settings.format,
              maxPlayers: room.settings.maxPlayers,
              enabledCategories: [...room.settings.enabledCategories],
            },
          },
  });
}
