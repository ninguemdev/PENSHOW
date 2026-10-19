import { useState } from 'react';
import { useStore } from 'zustand';
import { normalizeRoomCode } from '../../lib/room-code';
import { navigate } from '../../lib/navigation';
import type { ClientStores } from '../../stores/client-stores';
import { strings } from '../../strings/pt-BR';
import { Button } from '../../ui/button';
import { NavLink } from '../../ui/nav-link';
import { AvatarRenderer } from '../avatar/avatar-renderer';
export function HomePage({ stores }: { stores: ClientStores }) {
  const { status, session, activate, renew, connection } = useStore(stores.session);
  const { profile, storageIssue } = useStore(stores.profile);
  const view = useStore(stores.room, (state) => state.view);
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">{strings.homePage.eyebrow}</p>
          <h1 id="hero-title" tabIndex={-1}>
            {strings.tagline}
          </h1>
          <p className="lead">{strings.description}</p>
          {profile && (
            <div className="home-profile">
              <AvatarRenderer avatar={profile.avatar} />
              <span>
                <strong>{profile.nickname}</strong>
                <span role="status">
                  {storageIssue === 'unavailable'
                    ? strings.profile.inMemory
                    : strings.profile.saved}
                </span>
              </span>
            </div>
          )}
          <NavLink className="button" path="perfil">
            {profile ? strings.profile.edit : strings.homePage.prepare}{' '}
            <span aria-hidden="true">↗</span>
          </NavLink>
        </div>
        <div className="question-art" aria-hidden="true">
          <span>?</span>
          <i>!</i>
        </div>
      </section>
      <ol className="steps">
        {strings.homePage.steps.map((step, index) => (
          <li key={step}>
            <span aria-hidden="true">0{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      <section className="room-card" aria-labelledby="rooms-title">
        <div>
          <p className="eyebrow">{strings.room.title}</p>
          <h2 id="rooms-title">{strings.homePage.roomTitle}</h2>
          <p>{view ? strings.room.alreadyMember : strings.homePage.roomDescription}</p>
        </div>
        {view ? (
          <NavLink className="button" path={`sala/${view.code}`}>
            {strings.room.return}
          </NavLink>
        ) : (
          <div className="room-entry">
            <NavLink className="button" path="criar">
              {strings.homePage.create}
            </NavLink>
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                const normalized = normalizeRoomCode(code);
                setInvalid(!normalized);
                if (normalized) navigate(`sala/${normalized}`);
                else document.getElementById('room-code')?.focus();
              }}
            >
              <label htmlFor="room-code">{strings.room.codeLabel}</label>
              <input
                id="room-code"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  setInvalid(false);
                }}
                maxLength={64}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={invalid}
                aria-describedby={`code-help${invalid ? ' code-error' : ''}`}
              />
              <p id="code-help" className="help-text">
                {strings.room.codeHelp}
              </p>
              {invalid && (
                <p id="code-error" className="field-error" role="alert">
                  {strings.room.codeError}
                </p>
              )}
              <Button className="secondary" type="submit">
                {strings.room.open}
              </Button>
            </form>
          </div>
        )}
      </section>
      <section className="session-panel">
        {session ? (
          <>
            {status === 'active' && connection === 'online' && <p>{strings.session.active}</p>}
            <Button
              className="secondary"
              disabled={status === 'loading' || connection !== 'online'}
              onClick={() => void renew()}
            >
              {strings.session.renew}
            </Button>
          </>
        ) : (
          <Button
            className="secondary"
            disabled={status === 'loading' || status === 'offline'}
            onClick={() => void activate()}
          >
            {strings.session.activate}
          </Button>
        )}
      </section>
    </>
  );
}
