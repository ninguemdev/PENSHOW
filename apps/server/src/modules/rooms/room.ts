// Queue and aggregate adapted from Comicle, MIT. See THIRD_PARTY_NOTICES.md.
import {
  ROOM_LIMITS,
  type MatchId,
  type PlayerId,
  type PlayerProfile,
  type RoomId,
  type RoomSettings,
} from '@penshow/shared';
import type { MatchSession } from '../matches/match.domain.js';
import type { ThemeChoiceQueue } from '../questions/theme-queue.domain.js';

export interface Member {
  playerId: PlayerId;
  profile: PlayerProfile;
  role: 'player' | 'spectator';
  joinedAt: number;
  /** Explicit departure releases this reserved match seat when returning to the lobby. */
  leftMatch?: true;
  connection:
    { status: 'connected'; connectionId: string } | { status: 'disconnected'; since: number };
}
export interface QuizRoster {
  prototypeMode?: 'classic' | 'speed' | 'wager' | 'theft' | 'pressure';
  matchId: MatchId;
  startedAt: number;
  settings: RoomSettings;
  players: { playerId: PlayerId; profile: PlayerProfile }[];
}
export type RoomPhase =
  | { status: 'lobby' }
  | { status: 'match'; roster: QuizRoster; game?: MatchSession }
  | { status: 'closed'; reason: 'expired' | 'no-players' | 'server-shutdown' };
export interface RoomState {
  roomId: RoomId;
  code: string;
  createdAt: number;
  lobbySince: number;
  stateVersion: number;
  phaseEpoch: number;
  settings: RoomSettings;
  members: Member[];
  hostPlayerId: PlayerId;
  hostTransferPending: boolean;
  bannedPlayerIds: PlayerId[];
  emptySince: number | null;
  phase: RoomPhase;
  themeChoiceQueue?: ThemeChoiceQueue;
}
export interface RoomTransaction {
  state: RoomState;
  /** Stage one new version. A rejected task never commits its draft. */
  touch(): number;
}

function assertRoomState(state: RoomState) {
  if (
    new Set(state.members.map((member) => member.playerId)).size !== state.members.length ||
    state.members.length > ROOM_LIMITS.maxMembers
  )
    throw new Error('Membros inválidos na sala.');
  if (state.phase.status === 'closed') return;
  const players = state.members.filter((member) => member.role === 'player');
  if (
    players.length === 0 ||
    players.length > state.settings.maxPlayers ||
    !players.some((member) => member.playerId === state.hostPlayerId)
  )
    throw new Error('Capacidade ou anfitrião inválido.');
  if (state.phase.status === 'match') {
    const roster = state.phase.roster;
    if (
      state.phase.game &&
      JSON.stringify(state.phase.game.state.roster) !== JSON.stringify(roster)
    )
      throw new Error('O motor precisa manter o elenco e a configuração congelados.');
    if (
      new Set(roster.players.map((player) => player.playerId)).size !== players.length ||
      roster.players.length !== players.length ||
      roster.players.some(
        (player) => !players.some((member) => member.playerId === player.playerId),
      )
    )
      throw new Error('Participantes da partida precisam manter suas vagas.');
  }
}

export class Room {
  private state: RoomState;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    state: RoomState,
    private readonly onCommit: (before: RoomState, after: RoomState) => void,
  ) {
    assertRoomState(state);
    this.state = structuredClone(state);
  }
  get id() {
    return this.state.roomId;
  }
  get code() {
    return this.state.code;
  }
  snapshot(): RoomState {
    return structuredClone(this.state);
  }

  runExclusive<T>(task: (transaction: RoomTransaction) => T | Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      const before = this.state;
      const draft = structuredClone(before);
      let active = true,
        changed = false;
      try {
        const value = await task({
          state: draft,
          touch() {
            if (!active) throw new Error('A transação da sala já terminou.');
            changed = true;
            draft.stateVersion = before.stateVersion + 1;
            return draft.stateVersion;
          },
        });
        if (changed) {
          if (
            draft.roomId !== before.roomId ||
            draft.code !== before.code ||
            !Number.isSafeInteger(draft.stateVersion) ||
            draft.stateVersion !== before.stateVersion + 1
          )
            throw new Error('Identidade ou versão inválida da sala.');
          assertRoomState(draft);
          if (
            before.phase.status === 'match' &&
            draft.phase.status === 'match' &&
            before.phase.roster.matchId === draft.phase.roster.matchId
          ) {
            if (
              JSON.stringify(before.phase.roster) !== JSON.stringify(draft.phase.roster) ||
              JSON.stringify(before.phase.game?.state.rules) !==
                JSON.stringify(draft.phase.game?.state.rules) ||
              JSON.stringify(before.phase.game?.state.rounds) !==
                JSON.stringify(draft.phase.game?.state.rounds) ||
              JSON.stringify(before.phase.game?.state.finalRound) !==
                JSON.stringify(draft.phase.game?.state.finalRound)
            )
              throw new Error('Elenco, configuração e plano da partida são imutáveis.');
            const entry = before.phase.game?.state.finalEntry;
            if (
              entry?.status === 'ready' &&
              JSON.stringify(entry) !== JSON.stringify(draft.phase.game?.state.finalEntry)
            )
              throw new Error(
                'A classificação e as vidas de entrada são imutáveis após a conversão.',
              );
          }
          this.state = structuredClone(draft);
          this.onCommit(structuredClone(before), this.snapshot());
        }
        return value;
      } finally {
        active = false;
      }
    });
    this.queue = result.catch(() => undefined);
    return result;
  }
}
