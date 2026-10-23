import { useEffect, useState, useSyncExternalStore } from 'react';
import { useStore } from 'zustand';
import { HomePage } from './features/home/home-page';
import { ProfilePage } from './features/profile/profile-page';
import { RoomPage } from './features/lobby/room-page';
import { CreateRoomPage } from './features/lobby/create-room-page';
import { resolveRoute, subscribeNavigation } from './lib/navigation';
import { createClientStores, type ClientStores } from './stores/client-stores';
import { strings } from './strings/pt-BR';
import { ConnectionNotice } from './ui/connection-notice';
import { NavLink } from './ui/nav-link';
import { SoundControls } from './features/sound/sound-controls';
import { watchGameSounds } from './features/sound/sound-controller';
import { NarratorControls } from './features/sound/narrator-controls';
import { watchNarrator } from './features/sound/narrator-controller';
export function App({ stores: suppliedStores }: { stores?: ClientStores }) {
  const [stores] = useState(() => suppliedStores ?? createClientStores());
  const path = useSyncExternalStore(
    subscribeNavigation,
    () => window.location.pathname + window.location.search,
  );
  const route = resolveRoute(window.location.pathname);
  const sessionIssue = useStore(stores.session, (state) => state.storageIssue);
  const profileIssue = useStore(stores.profile, (state) => state.storageIssue);
  const issue = sessionIssue ?? profileIssue;
  useEffect(() => {
    stores.profile.getState().hydrate();
    stores.sound.getState().hydrate();
    const stopSounds = watchGameSounds(stores);
    stores.narrator.getState().hydrate();
    const stopNarrator = watchNarrator(stores);
    void stores.session.getState().initialize();
    return () => {
      stopSounds();
      stopNarrator();
      stores.narrator.getState().dispose();
      stores.sound.getState().dispose();
      stores.lobby.getState().cancel();
      stores.match.getState().cancel();
      stores.session.getState().dispose();
    };
  }, [stores]);
  useEffect(() => {
    stores.lobby.getState().cancel();
    document.querySelector<HTMLElement>('main h1')?.focus();
  }, [path, stores]);
  return (
    <>
      <a className="skip-link" href="#penshow-content">
        {strings.skip}
      </a>
      <header className="site-header">
        <NavLink className="brand" aria-label={`${strings.title} — ${strings.home}`}>
          {strings.title}
          <span aria-hidden="true">✳</span>
        </NavLink>
        <nav aria-label={strings.navigation}>
          <NavLink aria-current={route.page === 'home' ? 'page' : undefined}>
            {strings.home}
          </NavLink>
          <NavLink path="perfil" aria-current={route.page === 'profile' ? 'page' : undefined}>
            {strings.profile.link}
          </NavLink>
        </nav>
      </header>
      <div className="app-shell">
        <ConnectionNotice store={stores.session} />
        <SoundControls store={stores.sound} />
        <NarratorControls store={stores.narrator} />
        {issue && (
          <p className="storage-notice" role="status">
            {strings.storage[issue]}
          </p>
        )}
        <main id="penshow-content" tabIndex={-1}>
          {route.page === 'home' ? (
            <HomePage stores={stores} />
          ) : route.page === 'profile' ? (
            <ProfilePage store={stores.profile} />
          ) : route.page === 'create' ? (
            <CreateRoomPage stores={stores} />
          ) : route.page === 'room' ? (
            <RoomPage key={route.code} code={route.code} stores={stores} />
          ) : (
            <section className="page-card">
              <p className="eyebrow">404</p>
              <h1 tabIndex={-1}>{strings.error.title}</h1>
              <p>{strings.error.description}</p>
              <NavLink className="button">{strings.error.back}</NavLink>
            </section>
          )}
        </main>
        <footer>
          {strings.title} <span>{strings.footer}</span>
          <a href={`${import.meta.env.BASE_URL}licenses/comicle-LICENSE.txt`}>{strings.licenses}</a>
        </footer>
      </div>
    </>
  );
}
