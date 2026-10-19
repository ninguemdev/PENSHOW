import { useEffect, useRef, type ComponentType } from 'react';
import type { MatchView, RoomView, ScoringMode } from '@penshow/shared';
import type { ClientStores } from '../../stores/client-stores';
import { strings } from '../../strings/pt-BR';
import { Button } from '../../ui/button';
import { useNow } from '../../ui/use-now';
import { useMatchControls } from './match-controls';
import { ClassicRound } from './classic-round';
import { Scoreboard } from './scoreboard';
import type { RoundProps } from './round-props';

const renderers: Partial<Record<ScoringMode, ComponentType<RoundProps>>> = {
  classic: ClassicRound,
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
  const focusKey = `${match.matchId}:${stage.phase}:${match.progress.questionNumber}`;
  useEffect(() => {
    content.current?.querySelector<HTMLElement>('h2')?.focus();
  }, [focusKey]);
  const spectator =
    view.members.find((member) => member.playerId === view.viewerId)?.role === 'spectator';
  const terminal = stage.phase === 'prototype-complete' || stage.phase === 'interrupted';
  const Renderer =
    'round' in stage && stage.round.mode !== 'final' ? renderers[stage.round.mode] : undefined;
  return (
    <section className="match-panel" aria-label={strings.match.title}>
      <p className="eyebrow">{strings.room.prototype}</p>
      <p className="match-progress" role="status">
        {strings.match.progress(
          match.progress.roundNumber,
          match.progress.roundCount,
          match.progress.questionNumber,
          match.progress.questionCount,
        )}
      </p>
      {spectator && <p className="storage-notice">{strings.match.spectator}</p>}
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
        {terminal ? (
          <>
            <h2 tabIndex={-1}>
              {stage.phase === 'prototype-complete'
                ? strings.match.complete
                : strings.match.interrupted}
            </h2>
            <p>
              {stage.phase === 'prototype-complete'
                ? strings.match.completeHelp
                : strings.match.reasons[stage.reason]}
            </p>
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
        view={view}
        scores={match.scoreboard}
        effects={stage.phase === 'reveal' ? stage.effects : []}
      />
    </section>
  );
}
