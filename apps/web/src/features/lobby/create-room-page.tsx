import { useStore } from 'zustand';
import { ROOM_LIMITS, type RoomSettings } from '@penshow/shared';
import type { ClientStores } from '../../stores/client-stores';
import { strings } from '../../strings/pt-BR';
import { NavLink } from '../../ui/nav-link';
import { Admission } from './admission';
import { SettingsForm } from './settings-form';

const initialSettings: RoomSettings = {
  format: 'prototype-v1',
  maxPlayers: ROOM_LIMITS.maxPlayers,
  enabledCategories: Object.keys(strings.room.themeNames),
};

export function CreateRoomPage({ stores }: { stores: ClientStores }) {
  const profile = useStore(stores.profile, (state) => state.profile);
  const view = useStore(stores.room, (state) => state.view);
  const { busy, error, create } = useStore(stores.lobby);
  const { status, connection } = useStore(stores.session);
  return (
    <section className="page-card">
      <p className="eyebrow">{strings.title}</p>
      <h1 tabIndex={-1}>{strings.room.createTitle}</h1>
      {view ? (
        <>
          <p>{strings.room.alreadyMember}</p>
          <NavLink className="button" path={`sala/${view.code}`}>
            {strings.room.return}
          </NavLink>
        </>
      ) : (
        <>
          <p>{strings.room.createDescription}</p>
          <Admission stores={stores} next="criar" />
          <p className="help-text">{strings.room.sessionHint}</p>
          <SettingsForm
            settings={initialSettings}
            busy={busy}
            disabled={
              !profile ||
              status === 'loading' ||
              status === 'offline' ||
              (status === 'active' && connection !== 'online')
            }
            submitLabel={strings.homePage.create}
            onSave={create}
          />
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
      <NavLink>{strings.error.back}</NavLink>
    </section>
  );
}
