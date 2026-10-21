import { useId } from 'react';
import { useStore } from 'zustand';
import type { ClientStores } from '../../stores/client-stores';
import { strings } from '../../strings/pt-BR';
import { Button } from '../../ui/button';

export function SoundControls({ store }: { store: ClientStores['sound'] }) {
  const sound = useStore(store),
    id = useId();
  const enabled = !sound.muted && sound.status === 'ready';
  return (
    <section className="sound-controls" aria-label={strings.sound.title}>
      <div className="sound-actions">
        <Button
          className="secondary"
          disabled={sound.status === 'unlocking'}
          aria-pressed={enabled}
          onClick={() => (enabled ? sound.mute() : void sound.activate())}
        >
          {sound.status === 'unlocking'
            ? strings.sound.activating
            : enabled
              ? strings.sound.mute
              : strings.sound.activate}
        </Button>
        {!sound.muted && !enabled && (
          <Button className="secondary" onClick={sound.mute}>
            {strings.sound.mute}
          </Button>
        )}
        <Button
          className="secondary"
          disabled={!enabled || sound.volume === 0}
          onClick={sound.preview}
        >
          {strings.sound.preview}
        </Button>
      </div>
      <label htmlFor={id}>
        {strings.sound.volume}: {Math.round(sound.volume * 100)}%
      </label>
      <input
        id={id}
        type="range"
        min="0"
        max="100"
        step="1"
        value={Math.round(sound.volume * 100)}
        onChange={(event) => sound.setVolume(Number(event.target.value) / 100)}
      />
      <span className="help-text">
        {sound.muted
          ? strings.sound.off
          : sound.status === 'locked'
            ? strings.sound.locked
            : strings.sound.help}
      </span>
      {sound.status === 'unavailable' && <p role="status">{strings.sound.unavailable}</p>}
      {sound.storageIssue && <p role="status">{strings.sound.storage[sound.storageIssue]}</p>}
    </section>
  );
}
