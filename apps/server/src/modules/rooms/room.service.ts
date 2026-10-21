// Lifecycle adapted from Comicle, MIT. See THIRD_PARTY_NOTICES.md.
import {
  matchIdSchema,
  playerIdSchema,
  playerProfileSchema,
  roomCodeSchema,
  roomIdSchema,
  roomSettingsSchema,
  ROOM_LIMITS,
  type MatchId,
  type PlayerId,
  type PlayerProfile,
  type RoomId,
  type RoomSettings,
} from '@penshow/shared';
import { PublicCommandError } from '../../command-error.js';
import type { MatchSession } from '../matches/match.domain.js';
import type { ThemeChoiceQueue } from '../questions/theme-queue.domain.js';
import type { CancelTask, Runtime } from '../../ports.js';
import {
  assertCanStart,
  assertHost,
  assertLobby,
  fillPlayerSlots,
  handOverHost,
} from './host-policy.js';
import { generateUniqueRoomCode } from './room-code.js';
import { DEFAULT_ROOM_POLICY, validateRoomPolicy, type RoomPolicy } from './room-policy.js';
import { RoomRegistry } from './room-registry.js';
import {
  Room,
  type Member,
  type QuizRoster,
  type RoomState,
  type RoomTransaction,
} from './room.js';

/** Supplied by trusted authentication, never copied from a business payload. */
export interface RoomActor {
  playerId: PlayerId;
  connectionId: string;
}
export interface QuizLifecycle {
  /** Prepare a private aggregate before committing the start; legacy validators may return void. */
  validateStart(roster: QuizRoster, previousChoiceQueue?: ThemeChoiceQueue): void | MatchSession;
  choiceQueueForRematch?(session: MatchSession): ThemeChoiceQueue;
  committed?(room: Room, after: RoomState): void;
}
interface Dependencies {
  runtime: Runtime;
  policy?: RoomPolicy;
  quiz?: QuizLifecycle;
  isCurrentActor?: (actor: RoomActor) => boolean;
  /** Internal snapshot. Observers must project it before sending anything to a client. */
  onChange?: (state: RoomState, previous: RoomState) => void;
  onError?: () => void;
}
interface ScheduledRoomTask {
  token: object;
  cancel: CancelTask;
}

export class RoomService {
  readonly registry = new RoomRegistry();
  readonly policy: Readonly<RoomPolicy>;
  private readonly timers = new Map<Room, Map<string, ScheduledRoomTask>>();
  private disposed = false;

  constructor(private readonly deps: Dependencies) {
    this.policy = validateRoomPolicy(deps.policy ?? DEFAULT_ROOM_POLICY);
  }

  create(actor: RoomActor, rawProfile: PlayerProfile, rawSettings: RoomSettings) {
    this.assertActor(actor);
    const profile = this.profile(rawProfile),
      settings = this.settings(rawSettings);
    if (this.registry.roomOf(actor.playerId)) throw new PublicCommandError('INVALID_PHASE');
    const roomId = roomIdSchema.parse(this.deps.runtime.ids.next());
    const code = generateUniqueRoomCode(
      this.deps.runtime.random,
      (candidate) => !!this.registry.byCode(candidate),
    );
    const now = this.deps.runtime.clock.now();
    const room = new Room(
      {
        roomId,
        code,
        createdAt: now,
        lobbySince: now,
        stateVersion: 0,
        phaseEpoch: 0,
        settings,
        members: [
          {
            playerId: actor.playerId,
            profile,
            role: 'player',
            joinedAt: now,
            connection: { status: 'connected', connectionId: actor.connectionId },
          },
        ],
        hostPlayerId: actor.playerId,
        hostTransferPending: false,
        bannedPlayerIds: [],
        emptySince: null,
        phase: { status: 'lobby' },
      },
      (before, after) => this.committed(room, before, after),
    );
    // Reserve both code and identity before yielding to a different admission.
    this.registry.add(room);
    this.registry.reserve(actor.playerId, roomId);
    return room
      .runExclusive((tx) => {
        this.assertActor(actor);
        tx.touch();
        return this.entry(tx.state, actor.playerId);
      })
      .catch((error) => {
        this.cancelTimers(room);
        this.registry.remove(room);
        throw error;
      });
  }

  join(actor: RoomActor, code: string, rawProfile: PlayerProfile) {
    this.assertActor(actor);
    const parsedCode = roomCodeSchema.safeParse(code);
    if (!parsedCode.success) throw new PublicCommandError('INVALID_PAYLOAD');
    const profile = this.profile(rawProfile);
    const room = this.registry.byCode(parsedCode.data);
    if (!room) throw new PublicCommandError('ROOM_NOT_FOUND');
    return room
      .runExclusive((tx) => {
        this.assertOpen(room, tx.state);
        this.assertActor(actor);
        if (this.settleLifecycle(tx)) return null;
        if (tx.state.bannedPlayerIds.includes(actor.playerId))
          throw new PublicCommandError('FORBIDDEN');
        this.registry.reserve(actor.playerId, room.id);
        const existing = tx.state.members.find((member) => member.playerId === actor.playerId);
        if (existing) {
          delete existing.leftMatch;
          existing.connection = { status: 'connected', connectionId: actor.connectionId };
          if (tx.state.phase.status === 'lobby') existing.profile = profile;
        } else {
          const players = tx.state.members.filter((member) => member.role === 'player').length;
          if (
            tx.state.members.length >= ROOM_LIMITS.maxMembers ||
            (tx.state.phase.status === 'lobby' && players >= tx.state.settings.maxPlayers)
          )
            throw new PublicCommandError('ROOM_FULL');
          tx.state.members.push({
            playerId: actor.playerId,
            profile,
            joinedAt: this.deps.runtime.clock.now(),
            role: tx.state.phase.status === 'match' ? 'spectator' : 'player',
            connection: { status: 'connected', connectionId: actor.connectionId },
          });
        }
        const member = tx.state.members.find((item) => item.playerId === actor.playerId)!;
        if (tx.state.hostTransferPending && member.role === 'player') {
          tx.state.hostPlayerId = member.playerId;
          tx.state.hostTransferPending = false;
        }
        this.updateEmpty(tx.state);
        tx.touch();
        return this.entry(tx.state, actor.playerId);
      })
      .then((entry) => {
        if (!entry) throw new PublicCommandError('ROOM_NOT_FOUND');
        return entry;
      })
      .catch((error) => {
        if (!room.snapshot().members.some((member) => member.playerId === actor.playerId))
          this.registry.release(actor.playerId, room.id);
        throw error;
      });
  }

  updateProfile(actor: RoomActor, roomId: RoomId, rawProfile: PlayerProfile) {
    const profile = this.profile(rawProfile);
    return this.asMember(actor, roomId, (tx, member) => {
      assertLobby(tx.state);
      member.profile = profile;
      return { stateVersion: tx.touch() };
    });
  }
  updateSettings(actor: RoomActor, roomId: RoomId, rawSettings: RoomSettings) {
    const settings = this.settings(rawSettings);
    return this.asMember(actor, roomId, (tx) => {
      assertHost(tx.state, actor.playerId);
      assertLobby(tx.state);
      if (
        settings.maxPlayers < tx.state.members.filter((member) => member.role === 'player').length
      )
        throw new PublicCommandError('INVALID_SETTINGS');
      tx.state.settings = settings;
      fillPlayerSlots(tx.state);
      return { stateVersion: tx.touch() };
    });
  }
  kick(actor: RoomActor, roomId: RoomId, targetPlayerId: PlayerId) {
    return this.asMember(actor, roomId, (tx) => {
      assertHost(tx.state, actor.playerId);
      assertLobby(tx.state);
      if (
        targetPlayerId === actor.playerId ||
        !tx.state.members.some((member) => member.playerId === targetPlayerId)
      )
        throw new PublicCommandError('INVALID_TARGET');
      tx.state.bannedPlayerIds.push(targetPlayerId);
      this.removeMember(tx.state, targetPlayerId);
      return { stateVersion: tx.touch() };
    });
  }
  leave(actor: RoomActor, roomId: RoomId) {
    return this.asMember(actor, roomId, (tx, member) => {
      if (tx.state.phase.status === 'match' && member.role === 'player') {
        member.leftMatch = true;
        member.connection = { status: 'disconnected', since: this.deps.runtime.clock.now() };
        if (member.playerId === tx.state.hostPlayerId) handOverHost(tx.state);
        this.updateEmpty(tx.state);
      } else this.removeMember(tx.state, actor.playerId);
      tx.touch();
      return {};
    });
  }

  disconnect(actor: RoomActor): Promise<void> {
    const roomId = this.registry.roomOf(actor.playerId);
    const room = roomId && this.registry.byId(roomId);
    if (!room) return Promise.resolve();
    return room.runExclusive((tx) => {
      if (
        this.disposed ||
        this.registry.byId(room.id) !== room ||
        tx.state.phase.status === 'closed'
      )
        return;
      const member = tx.state.members.find((item) => item.playerId === actor.playerId);
      if (
        !member ||
        member.connection.status !== 'connected' ||
        member.connection.connectionId !== actor.connectionId
      )
        return;
      member.connection = { status: 'disconnected', since: this.deps.runtime.clock.now() };
      this.updateEmpty(tx.state);
      tx.touch();
    });
  }

  /** Reattach an authenticated transport without accepting profile/room identity from it. */
  async reconnect(actor: RoomActor): Promise<void> {
    await this.sync(actor);
  }

  /** Authenticated reconciliation also reports absence after expiry, removal or restart. */
  sync(actor: RoomActor) {
    this.assertActor(actor);
    const roomId = this.registry.roomOf(actor.playerId);
    const room = roomId && this.registry.byId(roomId);
    if (!room || room.snapshot().stateVersion === 0)
      return Promise.resolve({ status: 'absent' as const });
    return room.runExclusive((tx) => {
      this.assertActor(actor);
      if (
        this.registry.byId(room.id) !== room ||
        tx.state.phase.status === 'closed' ||
        this.settleLifecycle(tx)
      )
        return { status: 'absent' as const };
      const member = tx.state.members.find((current) => current.playerId === actor.playerId);
      if (!member) return { status: 'absent' as const };
      delete member.leftMatch;
      member.connection = { status: 'connected', connectionId: actor.connectionId };
      if (tx.state.hostTransferPending && member.role === 'player') {
        tx.state.hostPlayerId = member.playerId;
        tx.state.hostTransferPending = false;
      }
      this.updateEmpty(tx.state);
      tx.touch();
      return { status: 'present' as const, roomId: room.id, stateVersion: tx.state.stateVersion };
    });
  }

  start(
    actor: RoomActor,
    roomId: RoomId,
    mode: 'classic' | 'speed' | 'wager' | 'theft' | 'pressure' = 'classic',
  ) {
    return this.asMember(actor, roomId, (tx) => {
      assertCanStart(tx.state, actor.playerId);
      if (!this.deps.quiz) throw new PublicCommandError('INVALID_PHASE');
      const roster: QuizRoster = {
        prototypeMode: mode,
        matchId: matchIdSchema.parse(this.deps.runtime.ids.next()),
        startedAt: this.deps.runtime.clock.now(),
        settings: structuredClone(tx.state.settings),
        players: tx.state.members
          .filter((member) => member.role === 'player')
          .map((member) => ({
            playerId: member.playerId,
            profile: structuredClone(member.profile),
          })),
      };
      const game = tx.state.themeChoiceQueue
        ? this.deps.quiz.validateStart(
            structuredClone(roster),
            structuredClone(tx.state.themeChoiceQueue),
          )
        : this.deps.quiz.validateStart(structuredClone(roster));
      tx.state.phase = { status: 'match', roster, ...(game ? { game } : {}) };
      tx.state.phaseEpoch++;
      return { matchId: roster.matchId, stateVersion: tx.touch() };
    });
  }
  returnToLobby(
    actor: RoomActor,
    roomId: RoomId,
    matchId: MatchId,
    { requireFinished = false }: { requireFinished?: boolean } = {},
  ) {
    return this.asMember(actor, roomId, (tx) => {
      assertHost(tx.state, actor.playerId);
      if (tx.state.phase.status !== 'match' || tx.state.phase.roster.matchId !== matchId)
        throw new PublicCommandError('STALE_CONTEXT');
      if (
        requireFinished &&
        (!tx.state.phase.game ||
          !(tx.state.phase.game.state.final
            ? [
                'podium',
                'interrupted',
                'final-no-answer-pending',
                'final-no-target-pending',
              ].includes(tx.state.phase.game.state.final.stage.phase)
            : ['prototype-complete', 'interrupted'].includes(
                tx.state.phase.game.state.stage.phase,
              )))
      )
        throw new PublicCommandError('INVALID_PHASE');
      const session = tx.state.phase.game;
      const queue = session && this.deps.quiz?.choiceQueueForRematch?.(session);
      if (queue) tx.state.themeChoiceQueue = structuredClone(queue);
      tx.state.members = tx.state.members.filter((member) => !member.leftMatch);
      tx.state.phase = { status: 'lobby' };
      tx.state.lobbySince = this.deps.runtime.clock.now();
      tx.state.phaseEpoch++;
      fillPlayerSlots(tx.state);
      return { stateVersion: tx.touch() };
    });
  }

  close(roomId: RoomId, reason: 'expired' | 'no-players' | 'server-shutdown' = 'expired') {
    const room = this.registry.byId(roomId);
    return room ? this.closeRoom(room, reason) : Promise.resolve();
  }
  async dispose() {
    this.disposed = true;
    await Promise.all(this.registry.all().map((room) => this.closeRoom(room, 'server-shutdown')));
  }

  private asMember<T>(
    actor: RoomActor,
    roomId: RoomId,
    action: (tx: RoomTransaction, member: Member) => T,
  ) {
    const room = this.registry.byId(roomId);
    if (!room) throw new PublicCommandError('ROOM_NOT_FOUND');
    return room
      .runExclusive((tx) => {
        this.assertOpen(room, tx.state);
        this.assertActor(actor);
        if (this.settleLifecycle(tx)) return { expired: true as const };
        const member = tx.state.members.find((item) => item.playerId === actor.playerId);
        if (!member || this.registry.roomOf(actor.playerId) !== room.id)
          throw new PublicCommandError('NOT_A_MEMBER');
        if (
          member.connection.status !== 'connected' ||
          member.connection.connectionId !== actor.connectionId
        )
          throw new PublicCommandError('UNAUTHENTICATED');
        return { expired: false as const, value: action(tx, member) };
      })
      .then((result) => {
        if (result.expired) throw new PublicCommandError('ROOM_NOT_FOUND');
        return result.value;
      });
  }
  /** Deadlines remain authoritative even if their callbacks are delayed in the queue. */
  private settleLifecycle(tx: RoomTransaction): boolean {
    const state = tx.state,
      now = this.deps.runtime.clock.now();
    if (
      now >= state.createdAt + this.policy.maxAgeMs ||
      (state.emptySince !== null && now >= state.emptySince + this.policy.emptyRoomTtlMs)
    ) {
      state.phase = { status: 'closed', reason: 'expired' };
      tx.touch();
      return true;
    }
    const host = state.members.find((member) => member.playerId === state.hostPlayerId);
    if (
      host?.connection.status === 'disconnected' &&
      !state.hostTransferPending &&
      now >= host.connection.since + this.policy.hostTransferGraceMs
    ) {
      handOverHost(state);
      tx.touch();
    }
    return false;
  }
  private assertActor(actor: RoomActor) {
    if (this.disposed) throw new PublicCommandError('INVALID_PHASE');
    if (
      !playerIdSchema.safeParse(actor.playerId).success ||
      typeof actor.connectionId !== 'string' ||
      !actor.connectionId ||
      actor.connectionId.length > 256 ||
      this.deps.isCurrentActor?.(actor) === false
    )
      throw new PublicCommandError('UNAUTHENTICATED');
  }
  private assertOpen(room: Room, state: RoomState) {
    if (this.disposed) throw new PublicCommandError('INVALID_PHASE');
    if (this.registry.byId(room.id) !== room || state.phase.status === 'closed')
      throw new PublicCommandError('ROOM_NOT_FOUND');
  }
  private profile(value: PlayerProfile) {
    const parsed = playerProfileSchema.safeParse(value);
    if (!parsed.success) throw new PublicCommandError('INVALID_PAYLOAD');
    return parsed.data;
  }
  private settings(value: RoomSettings) {
    const parsed = roomSettingsSchema.safeParse(value);
    if (!parsed.success) throw new PublicCommandError('INVALID_SETTINGS');
    return parsed.data;
  }
  private entry(state: RoomState, playerId: PlayerId) {
    return { roomId: state.roomId, code: state.code, playerId, stateVersion: state.stateVersion };
  }
  private updateEmpty(state: RoomState) {
    if (state.members.some((member) => member.connection.status === 'connected'))
      state.emptySince = null;
    else state.emptySince ??= this.deps.runtime.clock.now();
  }
  private removeMember(state: RoomState, playerId: PlayerId) {
    state.members = state.members.filter((member) => member.playerId !== playerId);
    if (state.members.length === 0) state.phase = { status: 'closed', reason: 'no-players' };
    else {
      fillPlayerSlots(state);
      if (state.hostPlayerId === playerId) handOverHost(state);
      this.updateEmpty(state);
    }
  }

  private committed(room: Room, before: RoomState, after: RoomState) {
    for (const member of before.members)
      if (!after.members.some((current) => current.playerId === member.playerId))
        this.registry.release(member.playerId, room.id);
    this.cancelTimers(room);
    if (after.phase.status === 'closed') this.registry.remove(room);
    else this.scheduleLifecycle(room, after);
    try {
      this.deps.quiz?.committed?.(room, structuredClone(after));
      this.deps.onChange?.(structuredClone(after), structuredClone(before));
    } catch {
      try {
        this.deps.onError?.();
      } catch {
        /* Observers never roll back committed state. */
      }
    }
  }
  private cancelTimers(room: Room) {
    const tasks = this.timers.get(room);
    this.timers.delete(room);
    for (const task of tasks?.values() ?? []) task.cancel();
  }
  private scheduleLifecycle(room: Room, state: RoomState) {
    this.schedule(room, state, 'max-age', state.createdAt + this.policy.maxAgeMs, (tx) => {
      tx.state.phase = { status: 'closed', reason: 'expired' };
      tx.touch();
    });
    if (state.emptySince !== null)
      this.schedule(room, state, 'empty', state.emptySince + this.policy.emptyRoomTtlMs, (tx) => {
        if (tx.state.emptySince !== null) {
          tx.state.phase = { status: 'closed', reason: 'expired' };
          tx.touch();
        }
      });
    for (const member of state.members) {
      if (member.connection.status !== 'disconnected') continue;
      if (member.playerId === state.hostPlayerId && !state.hostTransferPending)
        this.schedule(
          room,
          state,
          'host',
          member.connection.since + this.policy.hostTransferGraceMs,
          (tx) => {
            handOverHost(tx.state);
            tx.touch();
          },
        );
      if (state.phase.status === 'lobby')
        this.schedule(
          room,
          state,
          `remove:${member.playerId}`,
          Math.max(member.connection.since, state.lobbySince) + this.policy.lobbyRemovalMs,
          (tx) => {
            const current = tx.state.members.find((item) => item.playerId === member.playerId);
            if (current?.connection.status === 'disconnected') {
              this.removeMember(tx.state, current.playerId);
              tx.touch();
            }
          },
        );
    }
  }
  private schedule(
    room: Room,
    state: RoomState,
    key: string,
    deadline: number,
    action: (tx: RoomTransaction) => void,
  ) {
    let tasks = this.timers.get(room);
    if (!tasks) {
      tasks = new Map();
      this.timers.set(room, tasks);
    }
    const token = {};
    const cancel = this.deps.runtime.scheduler.scheduleAt(deadline, () =>
      room.runExclusive((tx) => {
        if (
          this.disposed ||
          this.registry.byId(room.id) !== room ||
          tx.state.phase.status === 'closed' ||
          tx.state.phaseEpoch !== state.phaseEpoch ||
          this.timers.get(room)?.get(key)?.token !== token
        )
          return;
        action(tx);
      }),
    );
    tasks.set(key, { token, cancel });
  }
  private closeRoom(room: Room, reason: 'expired' | 'no-players' | 'server-shutdown') {
    return room.runExclusive((tx) => {
      if (this.registry.byId(room.id) !== room || tx.state.phase.status === 'closed') return;
      tx.state.phase = { status: 'closed', reason };
      tx.touch();
    });
  }
}
