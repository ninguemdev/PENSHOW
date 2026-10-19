// Adapted from Comicle, MIT. See THIRD_PARTY_NOTICES.md.
import { ROOM_LIMITS, type PlayerId } from '@penshow/shared';
import { PublicCommandError } from '../../command-error.js';
import type { RoomState } from './room.js';

export function assertHost(state: RoomState, actor: PlayerId) {
  if (state.hostPlayerId !== actor) throw new PublicCommandError('FORBIDDEN');
}
export function assertLobby(state: RoomState) {
  if (state.phase.status !== 'lobby') throw new PublicCommandError('INVALID_PHASE');
}
export function assertCanStart(state: RoomState, actor: PlayerId) {
  assertHost(state, actor);
  assertLobby(state);
  if (
    state.members.filter(
      (member) => member.role === 'player' && member.connection.status === 'connected',
    ).length < ROOM_LIMITS.minPlayers
  )
    throw new PublicCommandError('NOT_ENOUGH_PLAYERS');
}
export function handOverHost(state: RoomState) {
  const players = state.members.filter((member) => member.role === 'player');
  const connected = players.find((member) => member.connection.status === 'connected');
  const choice =
    connected ?? players.find((member) => member.playerId === state.hostPlayerId) ?? players[0];
  if (choice) {
    state.hostPlayerId = choice.playerId;
    state.hostTransferPending = !connected;
  }
}
export function fillPlayerSlots(state: RoomState) {
  if (state.phase.status !== 'lobby') return;
  let count = state.members.filter((member) => member.role === 'player').length;
  for (const member of state.members) {
    if (count >= state.settings.maxPlayers) break;
    if (member.role === 'spectator') {
      member.role = 'player';
      count++;
    }
  }
}
