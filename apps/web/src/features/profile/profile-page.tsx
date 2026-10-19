import { useState } from 'react';
import { useStore } from 'zustand';
import type { ClientStores } from '../../stores/client-stores';
import { strings } from '../../strings/pt-BR';
import { Button } from '../../ui/button';
import { Dialog } from '../../ui/dialog';
import { navigate } from '../../lib/navigation';
import { AvatarEditor } from '../avatar/avatar-editor';
import { safeNextPath } from './next-path';
export function ProfilePage({ store }: { store: ClientStores['profile'] }) {
  const { profile, clear, draft, changeNickname, save, error, hydrated, recovered, storageIssue } =
    useStore(store);
  const [confirm, setConfirm] = useState(false);
  return (
    <section className="page-card">
      <p className="eyebrow">{strings.title}</p>
      <h1 tabIndex={-1}>{strings.profile.title}</h1>
      <p>{strings.profile.description}</p>
      {recovered && (
        <p className="storage-notice" role="status">
          {strings.profile.recovered}
        </p>
      )}
      {hydrated && (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (save())
              navigate(safeNextPath(new URLSearchParams(window.location.search).get('next')));
            else document.getElementById('penshow-nickname')?.focus();
          }}
        >
          <div className="nickname-field">
            <label htmlFor="penshow-nickname">{strings.profile.nickname}</label>
            <input
              id="penshow-nickname"
              name="penshow-nickname"
              autoComplete="nickname"
              value={draft.nickname}
              maxLength={256}
              required
              aria-invalid={error === 'nickname'}
              aria-describedby={`nickname-help${error === 'nickname' ? ' nickname-error' : ''}`}
              onChange={(event) => changeNickname(event.target.value)}
            />
            <p id="nickname-help">{strings.profile.nicknameHelp}</p>
            {error && (
              <p id="nickname-error" role="alert" className="field-error">
                {error === 'nickname' ? strings.profile.nicknameError : strings.profile.avatarError}
              </p>
            )}
          </div>
          <AvatarEditor store={store} />
          <div className="profile-save">
            <Button type="submit">{strings.profile.save}</Button>
          </div>
        </form>
      )}
      {profile ? (
        <>
          <p>{storageIssue === 'unavailable' ? strings.profile.inMemory : strings.profile.saved}</p>
          <Button className="secondary" onClick={() => setConfirm(true)}>
            {strings.profile.remove}
          </Button>
        </>
      ) : (
        <>
          <p className="profile-hint">{strings.profile.empty}</p>
        </>
      )}
      <Dialog open={confirm} title={strings.profile.confirm} onClose={() => setConfirm(false)}>
        <p>{strings.profile.detail}</p>
        <div className="actions">
          <Button className="secondary" autoFocus onClick={() => setConfirm(false)}>
            {strings.profile.cancel}
          </Button>
          <Button
            onClick={() => {
              clear();
              setConfirm(false);
            }}
          >
            {strings.profile.remove}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
