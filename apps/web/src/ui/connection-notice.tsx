import { useStore } from 'zustand';
import type { ClientStores } from '../stores/client-stores';
import { strings } from '../strings/pt-BR';
import { Button } from './button';
export function ConnectionNotice({ store }: { store: ClientStores['session'] }) {
  const { status, connection, message, initialize } = useStore(store);
  const text =
    status === 'loading'
      ? strings.connection.loading
      : status === 'idle'
        ? strings.connection.idle
        : status === 'active' && connection === 'online'
          ? strings.connection.online
          : status === 'active' && connection === 'connecting'
            ? strings.connection.reconnecting
            : strings.connection.offline;
  return (
    <aside className="connection-notice" aria-label={strings.connection.label}>
      <p role="status">
        <span
          className={`connection-dot ${status === 'idle' || connection === 'online' ? 'online' : ''}`}
          aria-hidden="true"
        />
        {status === 'ended' ? message : text}
      </p>
      {message && status !== 'ended' && <p>{message}</p>}
      {(status === 'offline' || (status === 'active' && connection === 'offline')) && (
        <Button className="secondary" onClick={() => void initialize()}>
          {strings.connection.retry}
        </Button>
      )}
    </aside>
  );
}
