import type { PlayerId, RoomId } from '@penshow/shared';
import { PublicCommandError } from '../../command-error.js';
import type { Room } from './room.js';

export class RoomRegistry {
  private readonly ids = new Map<RoomId, Room>();
  private readonly codes = new Map<string, Room>();
  private readonly membership = new Map<PlayerId, RoomId>();
  byId(id: RoomId) {
    return this.ids.get(id);
  }
  byCode(code: string) {
    return this.codes.get(code);
  }
  roomOf(playerId: PlayerId) {
    return this.membership.get(playerId);
  }
  all() {
    return [...this.ids.values()];
  }

  add(room: Room) {
    if (this.ids.has(room.id) || this.codes.has(room.code))
      throw new Error('Identidade de sala em uso.');
    this.ids.set(room.id, room);
    this.codes.set(room.code, room);
  }
  reserve(playerId: PlayerId, roomId: RoomId) {
    const previous = this.membership.get(playerId);
    if (previous && previous !== roomId) throw new PublicCommandError('INVALID_PHASE');
    this.membership.set(playerId, roomId);
  }
  release(playerId: PlayerId, roomId: RoomId) {
    if (this.membership.get(playerId) === roomId) this.membership.delete(playerId);
  }
  remove(room: Room) {
    if (this.ids.get(room.id) !== room) return;
    this.ids.delete(room.id);
    this.codes.delete(room.code);
    for (const [playerId, roomId] of this.membership)
      if (roomId === room.id) this.membership.delete(playerId);
  }
}
