import { useId } from 'react';
import { useStore } from 'zustand';
import type { ClientStores } from '../../stores/client-stores';
import { strings } from '../../strings/pt-BR';
import { Button } from '../../ui/button';

export function NarratorControls({ store }: { store: ClientStores['narrator'] }) {
  const narrator = useStore(store),
    id = useId();
  const enabled =
    narrator.enabled && narrator.status !== 'locked' && narrator.status !== 'unavailable';
  return (
    <section className="sound-controls" aria-label={strings.narrator.title}>
      <div className="sound-actions">
        <Button
          className="secondary"
          disabled={narrator.status === 'unlocking'}
          aria-pressed={enabled}
          onClick={() => (enabled ? narrator.disable() : void narrator.activate())}
        >
          {enabled ? strings.narrator.disable : strings.narrator.activate}
        </Button>
        <Button
          className="secondary"
          disabled={!enabled || narrator.status !== 'ready' || !narrator.volume}
          onClick={() => void narrator.preview()}
        >
          {strings.narrator.preview}
        </Button>
      </div>
      <label htmlFor={id}>
        {strings.narrator.volume}: {Math.round(narrator.volume * 100)}%
      </label>
      <input
        id={id}
        type="range"
        min="0"
        max="100"
        step="1"
        value={Math.round(narrator.volume * 100)}
        onChange={(event) => narrator.setVolume(Number(event.target.value) / 100)}
      />
      <span className="help-text">{strings.narrator.help}</span>
      {(narrator.status === 'unavailable' ||
        narrator.status === 'loading' ||
        narrator.status === 'speaking') && (
        <span role="status">
          {narrator.status === 'unavailable'
            ? strings.narrator.unavailable
            : narrator.status === 'loading'
              ? strings.narrator.loading
              : narrator.status === 'speaking'
                ? strings.narrator.speaking
                : ''}
        </span>
      )}
      {narrator.storageIssue && <p role="status">{strings.narrator.storage}</p>}
    </section>
  );
}
