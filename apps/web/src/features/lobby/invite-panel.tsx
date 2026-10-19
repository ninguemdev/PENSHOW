import { useRef, useState } from 'react';
import { copyInvite, inviteUrl } from '../../lib/invite';
import { strings } from '../../strings/pt-BR';
import { Button } from '../../ui/button';

export function InvitePanel({ code }: { code: string }) {
  const [result, setResult] = useState<'copied' | 'fallback' | null>(null);
  const [copying, setCopying] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const url = inviteUrl(code);
  return (
    <section className="invite-panel" aria-labelledby="invite-title">
      <h2 id="invite-title">{strings.room.invite}</h2>
      <p>{strings.room.inviteHelp}</p>
      <label htmlFor="invite-link">{strings.room.inviteLabel}</label>
      <div className="invite-actions">
        <input
          ref={ref}
          id="invite-link"
          value={url}
          readOnly
          onFocus={(event) => event.target.select()}
        />
        <Button
          disabled={copying}
          onClick={async () => {
            setCopying(true);
            const copied = await copyInvite(url);
            setResult(copied ? 'copied' : 'fallback');
            setCopying(false);
            if (!copied) {
              ref.current?.focus();
              ref.current?.select();
            }
          }}
        >
          {strings.room.copy}
        </Button>
      </div>
      {result && (
        <p role="status">{result === 'copied' ? strings.room.copied : strings.room.copyFallback}</p>
      )}
    </section>
  );
}
