import { useState } from 'react';
import { useStore } from 'zustand';
import { AVATAR_CATEGORIES, type RoomMember } from '@penshow/shared';
import type { ClientStores } from '../../stores/client-stores';
import { routeHref } from '../../lib/navigation';
import { strings } from '../../strings/pt-BR';
import { PlayerChip } from '../../ui/player-chip';
import { Button } from '../../ui/button';
import { Dialog } from '../../ui/dialog';
import { NavLink } from '../../ui/nav-link';
import { Admission } from './admission';
import { InvitePanel } from './invite-panel';
import { SettingsForm } from './settings-form';
import { MatchPanel } from '../match/match-panel';
import { useMatchControls } from '../match/match-controls';

export function RoomPage({ code, stores }: { code: string; stores: ClientStores }) {
  const { view: currentView, removed, removedCode, expectedCode } = useStore(stores.room);
  const view = currentView?.code === code ? currentView : null;
  const profile = useStore(stores.profile, (state) => state.profile);
  const { busy, error, join, leave, kick, updateProfile, updateSettings } = useStore(stores.lobby);
  const { status, connection } = useStore(stores.session);
  const matchControls = useMatchControls(stores);
  const [confirmation, setConfirmation] = useState<{
    action: 'leave' | RoomMember;
    version: number;
  } | null>(null);
  const confirm = confirmation?.action ?? null;
  const setConfirm = (action: 'leave' | RoomMember | null) =>
    setConfirmation(action && view ? { action, version: view.stateVersion } : null);
  const [profileUpdated, setProfileUpdated] = useState(false);
  const online = status === 'active' && connection === 'online';
  const me = view?.members.find((member) => member.playerId === view.viewerId);
  const host = me?.isHost === true && view?.state.status === 'lobby';
  const blocked = busy || !online;
  const profileDiffers =
    me &&
    profile &&
    (me.profile.nickname !== profile.nickname ||
      AVATAR_CATEGORIES.some((part) => me.profile.avatar[part] !== profile.avatar[part]));
  const removal = removed && removedCode === code && !currentView;
  return (
    <section
      className={`page-card lobby-page${view?.state.status === 'match' ? ' room-state-match' : ''}`}
    >
      <p className="eyebrow">{strings.title}</p>
      <h1 tabIndex={-1}>
        {strings.room.title} <span className="room-code">{code}</span>
      </h1>
      {!view ? (
        <>
          {currentView ? (
            <>
              <p>{strings.room.alreadyMember}</p>
              <NavLink className="button" path={`sala/${currentView.code}`}>
                {strings.room.return}
              </NavLink>
            </>
          ) : removal ? (
            <>
              <p role="status" className="storage-notice">
                {strings.room.removed[removed.reason]}
              </p>
              {removed.reason === 'left' && (
                <Button disabled={blocked || !profile} onClick={() => void join(code)}>
                  {strings.room.enter}
                </Button>
              )}
            </>
          ) : (
            <>
              <h2>{strings.room.empty}</h2>
              <p>{strings.room.description}</p>
              <Admission stores={stores} next={`sala/${code}`} />
              <p className="help-text">{strings.room.sessionHint}</p>
              <Button
                disabled={
                  !profile ||
                  busy ||
                  status === 'loading' ||
                  status === 'offline' ||
                  (status === 'active' && connection !== 'online')
                }
                onClick={() => void join(code)}
              >
                {busy ? strings.room.joining : strings.room.enter}
              </Button>
              {expectedCode === code && !busy && !error && (
                <p role="status">{strings.room.waitingView}</p>
              )}
            </>
          )}
          <p>
            <NavLink>{strings.error.back}</NavLink>
          </p>
        </>
      ) : (
        <>
          <div className="lobby-heading">
            <p role="status">
              {view.state.status === 'closed'
                ? strings.room.closed
                : view.state.status === 'match'
                  ? strings.room.match
                  : strings.room.lobby}
            </p>
            <Button className="secondary" disabled={blocked} onClick={() => setConfirm('leave')}>
              {strings.room.leave}
            </Button>
          </div>
          {view.state.status === 'match' && (
            <MatchPanel view={view} match={view.state.match} stores={stores} />
          )}
          {me?.role === 'spectator' && view.state.status !== 'match' && (
            <p className="storage-notice">{strings.room.spectator}</p>
          )}
          <InvitePanel code={view.code} />
          <section aria-labelledby="members-title">
            <h2 id="members-title">{strings.room.members}</h2>
            {view.state.status === 'lobby' && (
              <p>
                {strings.room.players(
                  view.members.filter((member) => member.role === 'player').length,
                  view.state.settings.maxPlayers,
                )}
              </p>
            )}
            <ul className="members">
              {view.members.map((member) => (
                <li key={member.playerId}>
                  <PlayerChip member={member} />
                  {member.playerId === view.viewerId && (
                    <span className="member-you">{strings.room.you}</span>
                  )}
                  {host && member.playerId !== view.viewerId && (
                    <Button
                      className="secondary"
                      disabled={blocked}
                      aria-label={strings.room.kick(member.profile.nickname)}
                      onClick={() => setConfirm(member)}
                    >
                      {strings.room.kick(member.profile.nickname)}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {view.state.status === 'lobby' && (
              <div className="actions">
                <NavLink path={`perfil?next=${encodeURIComponent(routeHref(`sala/${code}`))}`}>
                  {strings.profile.edit}
                </NavLink>
                {profileDiffers && (
                  <Button
                    className="secondary"
                    disabled={blocked}
                    onClick={async () => setProfileUpdated(await updateProfile())}
                  >
                    {strings.room.updateProfile}
                  </Button>
                )}
                {profileUpdated && <p role="status">{strings.room.profileUpdated}</p>}
              </div>
            )}
          </section>
          {view.state.status === 'lobby' && (
            <section className="quiz-panel">
              <p className="eyebrow">{strings.room.format}</p>
              {host ? (
                <SettingsForm
                  key={JSON.stringify(view.state.settings)}
                  settings={view.state.settings}
                  disabled={!online}
                  busy={busy}
                  submitLabel={strings.room.saveSettings}
                  onSave={updateSettings}
                />
              ) : (
                <>
                  <h2>{strings.room.settings}</h2>
                  <p>
                    {strings.room.players(
                      view.members.filter((member) => member.role === 'player').length,
                      view.state.settings.maxPlayers,
                    )}
                  </p>
                  <p>
                    {strings.room.themes}:{' '}
                    {view.state.settings.enabledCategories
                      .map((theme) => strings.room.themeNames[theme] ?? theme)
                      .join(', ')}
                  </p>
                  <p className="help-text">{strings.room.readonlySettings}</p>
                </>
              )}
              <h2>{strings.room.prototype}</h2>
              <p id="start-help">{strings.room.prototypeDetail}</p>
              {host && (
                <>
                  <Button
                    disabled={
                      blocked ||
                      matchControls.blocked ||
                      view.members.filter(
                        (member) =>
                          member.role === 'player' && member.connection.status === 'connected',
                      ).length < 2
                    }
                    onClick={() => void matchControls.start()}
                    aria-describedby="start-help"
                  >
                    {strings.room.start}
                  </Button>
                  {view.members.filter(
                    (member) =>
                      member.role === 'player' && member.connection.status === 'connected',
                  ).length < 2 && <p className="help-text">{strings.room.needPlayers}</p>}
                </>
              )}
            </section>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {view?.state.status === 'lobby' && matchControls.error && (
        <p role="alert" className="field-error">
          {matchControls.error}
        </p>
      )}
      <Dialog
        open={confirm !== null && !!view && confirmation?.version === view.stateVersion}
        title={confirm === 'leave' ? strings.room.leaveTitle : strings.room.kickTitle}
        onClose={() => setConfirm(null)}
      >
        <p>
          {confirm === 'leave'
            ? view?.state.status === 'match'
              ? strings.room.leaveMatchDetail
              : strings.room.leaveDetail
            : confirm
              ? strings.room.kickDetail(confirm.profile.nickname)
              : ''}
        </p>
        <div className="actions">
          <Button className="secondary" autoFocus onClick={() => setConfirm(null)}>
            {confirm === 'leave' ? strings.room.stay : strings.room.cancel}
          </Button>
          <Button
            disabled={blocked}
            onClick={async () => {
              if (!confirm) return;
              const done = confirm === 'leave' ? await leave() : await kick(confirm.playerId);
              if (done) setConfirm(null);
            }}
          >
            {confirm === 'leave' ? strings.room.leave : strings.room.confirmKick}
          </Button>
        </div>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </Dialog>
    </section>
  );
}
