import { useEffect, useRef, type ComponentType } from 'react';
import type { MatchView, RoomView, ScoringMode } from '@penshow/shared';
import type { ClientStores } from '../../stores/client-stores';
import { strings } from '../../strings/pt-BR';
import { Button } from '../../ui/button';
import { useNow } from '../../ui/use-now';
import { useMatchControls } from './match-controls';
import { CommonRound } from './common-round';
import { Scoreboard } from './scoreboard';
import { SpeedRules } from './speed-rules';
import { FinalRound } from './final-round';
import { FinalEntry } from './final-entry';
import { RoundHistory } from '../results/round-history';
import type { RoundProps } from './round-props';

const renderers: Partial<Record<ScoringMode | 'final', ComponentType<RoundProps>>> = {
  classic: CommonRound,
  speed: CommonRound,
  wager: CommonRound,
  theft: CommonRound,
  pressure: CommonRound,
  final: FinalRound,
};
export function MatchPanel({
  view,
  match,
  stores,
}: {
  view: RoomView;
  match: MatchView;
  stores: ClientStores;
}) {
  const controls = useMatchControls(stores),
    now = useNow(),
    content = useRef<HTMLDivElement>(null);
  const stage = match.stage;
  const mode = match.finalRules
    ? 'final'
    : match.pressureRules
      ? 'pressure'
      : match.theftRules
        ? 'theft'
        : match.wagerRules
          ? 'wager'
          : match.speedRules
            ? 'speed'
            : 'classic';
  const presentation = {
    final: {
      title: strings.final.title,
      prototype: strings.final.prototype,
      complete: strings.final.complete,
    },
    pressure: {
      title: strings.match.pressureTitle,
      prototype: strings.room.pressurePrototype,
      complete: strings.match.pressureComplete,
    },
    classic: {
      title: strings.match.title,
      prototype: strings.room.prototype,
      complete: strings.match.complete,
    },
    speed: {
      title: strings.match.speedTitle,
      prototype: strings.room.speedPrototype,
      complete: strings.match.speedComplete,
    },
    wager: {
      title: strings.match.wagerTitle,
      prototype: strings.room.wagerPrototype,
      complete: strings.match.wagerComplete,
    },
    theft: {
      title: strings.match.theftTitle,
      prototype: strings.room.theftPrototype,
      complete: strings.match.theftComplete,
    },
  }[mode];
  const focusKey = `${match.matchId}:${stage.phase}:${match.progress.questionNumber}`;
  useEffect(() => {
    content.current?.querySelector<HTMLElement>('h2')?.focus();
  }, [focusKey]);
  const spectator =
    view.members.find((member) => member.playerId === view.viewerId)?.role === 'spectator';
  const terminal = stage.phase === 'prototype-complete' || stage.phase === 'interrupted';
  const Renderer = 'round' in stage ? renderers[stage.round.mode] : undefined;
  return (
    <section className="match-panel" aria-label={presentation.title}>
      <p className="eyebrow">{presentation.prototype}</p>
      <p className="match-progress" role="status">
        {strings.match.progress(
          match.progress.roundNumber,
          match.progress.roundCount,
          match.progress.questionNumber,
          match.progress.questionCount,
        )}
      </p>
      {spectator && <p className="storage-notice">{strings.match.spectator}</p>}
      {match.waitingForPlayers && (
        <p role="status" className="storage-notice">
          {strings.match.waitingPlayers}
        </p>
      )}
      {!controls.online ? (
        <p role="status">{strings.match.offline}</p>
      ) : (
        controls.waitingView && <p role="status">{strings.match.waitingView}</p>
      )}
      {controls.online && controls.waitingView && (
        <Button className="secondary" onClick={() => void stores.session.getState().initialize()}>
          {strings.match.recover}
        </Button>
      )}
      <div className="match-stage" ref={content}>
        {match.pressureRules && stage.phase === 'instructions' && (
          <p>
            {strings.match.pressureInstructions(
              match.pressureRules.correctPoints,
              match.pressureRules.wrongPenalty,
              match.pressureRules.responseMs,
              match.pressureRules.turnDifficulties.length,
            )}
          </p>
        )}
        {match.pressureTurn && (
          <aside aria-label={strings.match.pressureTurnTitle}>
            <p>
              {strings.match.pressureOwner(
                view.members.find((member) => member.playerId === match.pressureTurn!.playerId)
                  ?.profile.nickname ?? strings.match.player,
              )}
            </p>
            <p>
              {strings.match.pressureCycle(
                match.pressureTurn.cycle,
                match.pressureTurn.cycleCount,
                match.pressureTurn.turnNumber,
                match.pressureTurn.turnCount,
              )}
            </p>
            {stage.phase === 'question-open' && <p>{strings.match.pressureFuse}</p>}
            {match.pressureTurn.outcome && (
              <p role="status">
                {match.pressureTurn.outcome === 'passed'
                  ? strings.match.pressurePassed
                  : strings.match.pressureExploded}
              </p>
            )}
            <p>
              {match.pressureTurn.nextPlayerId
                ? strings.match.pressureNext(
                    view.members.find(
                      (member) => member.playerId === match.pressureTurn!.nextPlayerId,
                    )?.profile.nickname ?? strings.match.player,
                  )
                : strings.match.pressureLast}
            </p>
          </aside>
        )}
        {match.theftRules && stage.phase === 'instructions' && (
          <p>
            {strings.match.theftInstructions(
              match.theftRules.correctPoints,
              match.theftRules.maximumTransfer,
              match.theftRules.targetSelectionMs,
            )}
          </p>
        )}
        {match.wagerRules && stage.phase === 'instructions' && (
          <p>
            {strings.match.wagerInstructions(
              match.wagerRules.correctPoints,
              match.wagerRules.selectionMs,
            )}
          </p>
        )}
        {match.speedRules && !terminal && <SpeedRules rules={match.speedRules} />}
        {terminal ? (
          <>
            <h2 tabIndex={-1}>
              {stage.phase === 'prototype-complete'
                ? presentation.complete
                : strings.match.interrupted}
            </h2>
            <p>
              {stage.phase === 'prototype-complete'
                ? strings.match.completeHelp
                : strings.match.reasons[stage.reason]}
            </p>
            {stage.phase === 'prototype-complete' && match.finalEntry && (
              <>
                <FinalEntry entry={match.finalEntry} view={view} />
                {match.finalEntry.status === 'ready' &&
                  view.members.some(
                    (member) => member.playerId === view.viewerId && member.isHost,
                  ) && (
                    <Button disabled={controls.blocked} onClick={() => void controls.startFinal()}>
                      {strings.final.start}
                    </Button>
                  )}
              </>
            )}
            {view.members.some((member) => member.playerId === view.viewerId && member.isHost) ? (
              <Button disabled={controls.blocked} onClick={() => void controls.returnToLobby()}>
                {strings.match.return}
              </Button>
            ) : (
              <p role="status">{strings.match.waitHost}</p>
            )}
          </>
        ) : Renderer ? (
          <Renderer view={view} match={match} stores={stores} controls={controls} now={now} />
        ) : (
          <p role="status">{strings.match.unsupported}</p>
        )}
      </div>
      {controls.error && (
        <p role="alert" className="field-error">
          {controls.error}
        </p>
      )}
      <Scoreboard
        title={match.finalRules ? strings.results.historical : strings.match.scoreboard}
        view={view}
        scores={match.scoreboard}
        effects={stage.phase === 'reveal' ? stage.effects : []}
      />
      {match.roundSummaries && <RoundHistory summaries={match.roundSummaries} view={view} />}
    </section>
  );
}
