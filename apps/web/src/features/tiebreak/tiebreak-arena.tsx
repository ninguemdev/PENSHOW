import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { TIEBREAK_OBSTACLES, TIEBREAK_RULES, type TiebreakFrame } from '@penshow/shared';
import type { RoundProps } from '../match/round-props';
import { avatarLayers } from '../avatar/avatar-layers';
import { Button } from '../../ui/button';
import { Timer } from '../../ui/timer';
import { AnswerOptions } from '../match/answer-options';
import { QuestionText } from '../match/question';

const labels = {
  instructions: 'Prepare-se para o combate',
  countdown: 'O combate vai começar',
  combat: 'Combate em andamento',
  questions: 'Pergunta de sobrevivência',
  reveal: 'Resultado da pergunta',
  result: 'Desempate resolvido',
};
type Intent = { moveX: number; moveY: number; aimX: number; aimY: number; shooting: boolean };
const neutral = (): Intent => ({ moveX: 0, moveY: 0, aimX: 0, aimY: 0, shooting: false });
export function TiebreakArena({ view, match, stores, controls, now }: RoundProps) {
  const stage = match.stage;
  if (stage.phase !== 'final-tiebreak') throw new Error('Arena fora do desempate.');
  const tie = stage.tiebreak,
    own = tie.ownQuestion;
  const canvas = useRef<HTMLCanvasElement>(null),
    intent = useRef(neutral()),
    keys = useRef(new Set<string>());
  const sequence = useRef(0);
  const current = useRef({ view, tie });
  const [stale, setStale] = useState(false);
  const questionPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    current.current = { view, tie };
  }, [view, tie]);
  const fighter = tie.frame.fighters.find((f) => f.playerId === view.viewerId);
  const participating = tie.participants.includes(view.viewerId);
  const canControl =
    tie.phase === 'combat' &&
    fighter?.status === 'fighting' &&
    !controls.blocked &&
    !match.waitingForPlayers;
  const name = (id: string) =>
    view.members.find((m) => m.playerId === id)?.profile.nickname ?? 'Jogador';
  const ownQuestionId = 'question' in own ? own.question.questionId : '';
  useEffect(() => {
    if (document.querySelector('dialog[open]')) return;
    if (ownQuestionId) {
      questionPanel.current?.querySelector<HTMLElement>('h3')?.focus();
      questionPanel.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [ownQuestionId]);

  useEffect(() => {
    intent.current = neutral();
    keys.current.clear();
    if (!canControl) return;
    sequence.current = Math.max(sequence.current, Date.now() * 1000);
    let pending = false;
    const updateMovement = () => {
      const k = keys.current;
      intent.current.moveX =
        Number(k.has('d') || k.has('arrowright')) - Number(k.has('a') || k.has('arrowleft'));
      intent.current.moveY =
        Number(k.has('s') || k.has('arrowdown')) - Number(k.has('w') || k.has('arrowup'));
      if (['i', 'j', 'k', 'l'].some((key) => k.has(key))) {
        intent.current.aimX = Number(k.has('l')) - Number(k.has('j'));
        intent.current.aimY = Number(k.has('k')) - Number(k.has('i'));
      }
      intent.current.shooting = k.has(' ') || intent.current.shooting;
    };
    const keyboard = (event: KeyboardEvent) => {
      if (
        event.target !== canvas.current ||
        document.querySelector('dialog[open]') ||
        (event.type === 'keydown' &&
          (event.defaultPrevented ||
            event.isComposing ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey))
      )
        return;
      const key = event.key.toLowerCase();
      if (
        ![
          'w',
          'a',
          's',
          'd',
          'arrowup',
          'arrowdown',
          'arrowleft',
          'arrowright',
          'i',
          'j',
          'k',
          'l',
          ' ',
        ].includes(key)
      )
        return;
      event.preventDefault();
      if (event.type === 'keydown') keys.current.add(key);
      else keys.current.delete(key);
      if (key === ' ' && event.type === 'keyup') intent.current.shooting = false;
      updateMovement();
    };
    const stop = () => {
      keys.current.clear();
      intent.current = neutral();
    };
    const visibility = () => {
      if (document.hidden) stop();
    };
    window.addEventListener('keydown', keyboard);
    window.addEventListener('keyup', keyboard);
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', visibility);
    const arena = canvas.current;
    arena?.addEventListener('blur', stop);
    const timer = window.setInterval(() => {
      if (pending || document.hidden) return;
      pending = true;
      const frame = current.current.tie.frame;
      void stores.match
        .getState()
        .tiebreakInput({
          tiebreakId: frame.tiebreakId,
          bout: frame.bout,
          generation: frame.generation,
          sequence: sequence.current++,
          ...intent.current,
        })
        .finally(() => {
          pending = false;
        });
    }, 50);
    return () => {
      stop();
      clearInterval(timer);
      window.removeEventListener('keydown', keyboard);
      window.removeEventListener('keyup', keyboard);
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', visibility);
      arena?.removeEventListener('blur', stop);
    };
  }, [canControl, tie.frame.tiebreakId, tie.frame.bout, tie.frame.generation, stores]);

  useEffect(() => {
    const node = canvas.current,
      ctx = node?.getContext('2d');
    if (!node || !ctx) return;
    const images = new Map<string, HTMLImageElement>();
    for (const member of view.members)
      for (const layer of avatarLayers(member.profile.avatar)) {
        if (!images.has(layer.src)) {
          const image = new Image();
          image.src = layer.src;
          images.set(layer.src, image);
        }
      }
    let last: TiebreakFrame = current.current.tie.frame,
      previous = last,
      receivedAt = performance.now(),
      animation = 0;
    let lastShotAt = -Infinity;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const draw = (time: number) => {
      const latest = stores.room.getState().combatFrame ?? current.current.tie.frame;
      if (latest !== last) {
        previous = last;
        last = latest;
        receivedAt = time;
        if (
          !document.hidden &&
          current.current.tie.phase === 'combat' &&
          time - lastShotAt > 180 &&
          last.projectiles.some((p) => !previous.projectiles.some((old) => old.id === p.id))
        ) {
          stores.sound.getState().shot();
          lastShotAt = time;
        }
      }
      const alpha =
        reduced || last.bout !== previous.bout || last.generation !== previous.generation
          ? 1
          : Math.min(1, (time - receivedAt) / 100);
      ctx.fillStyle = '#17263c';
      ctx.fillRect(0, 0, 1200, 800);
      ctx.strokeStyle = '#253850';
      ctx.lineWidth = 1;
      for (let x = 0; x < 1200; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 800);
        ctx.stroke();
      }
      for (let y = 0; y < 800; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1200, y);
        ctx.stroke();
      }
      ctx.strokeStyle = '#fbc65b';
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, 1192, 792);
      for (const o of TIEBREAK_OBSTACLES) {
        ctx.fillStyle = '#415775';
        ctx.fillRect(o.x, o.y, o.width, o.height);
        ctx.strokeStyle = '#8295ae';
        ctx.lineWidth = 3;
        ctx.strokeRect(o.x, o.y, o.width, o.height);
      }
      for (const bullet of last.projectiles) {
        ctx.fillStyle = '#ffdd7b';
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const f of last.fighters) {
        if (f.status === 'eliminated') continue;
        const old = previous.fighters.find((p) => p.playerId === f.playerId);
        const x =
          old && Math.hypot(old.x - f.x, old.y - f.y) < 100 ? old.x + (f.x - old.x) * alpha : f.x;
        const y =
          old && Math.hypot(old.x - f.x, old.y - f.y) < 100 ? old.y + (f.y - old.y) * alpha : f.y;
        ctx.strokeStyle = f.playerId === view.viewerId ? '#ffdd7b' : '#d1e4fb';
        ctx.lineWidth = f.protected ? 5 : 3;
        ctx.fillStyle = f.status === 'question' ? '#576271' : '#fffdf7';
        ctx.beginPath();
        ctx.arc(x, y, 22, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        const member = view.members.find((m) => m.playerId === f.playerId);
        if (member)
          for (const layer of avatarLayers(member.profile.avatar)) {
            const image = images.get(layer.src);
            if (image?.complete && image.naturalWidth) ctx.drawImage(image, x - 22, y - 22, 44, 44);
          }
        ctx.beginPath();
        ctx.moveTo(x + f.aimX * 22, y + f.aimY * 22);
        ctx.lineTo(x + f.aimX * 39, y + f.aimY * 39);
        ctx.stroke();
        ctx.font = 'bold 17px system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fffdf7';
        ctx.fillText(
          member?.profile.nickname ?? 'Jogador',
          Math.max(65, Math.min(1135, x)),
          y - 35,
        );
        ctx.font = '16px system-ui';
        ctx.fillText(`${f.lives} ${f.lives === 1 ? 'vida' : 'vidas'}`, x, y + 43);
      }
      animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    const statusTimer = setInterval(
      () =>
        setStale(
          current.current.tie.phase === 'combat' &&
            Date.now() + stores.session.getState().offset - last.serverNow > 1500,
        ),
      500,
    );
    return () => {
      cancelAnimationFrame(animation);
      clearInterval(statusTimer);
    };
  }, [stores, view.viewerId, view.members, tie.frame.tiebreakId]);

  const aim = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canControl) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const frame = stores.room.getState().combatFrame ?? tie.frame;
    const ownFighter = frame.fighters.find((f) => f.playerId === view.viewerId);
    if (!ownFighter) return;
    const x = ((event.clientX - bounds.left) / bounds.width) * TIEBREAK_RULES.width - ownFighter.x;
    const y = ((event.clientY - bounds.top) / bounds.height) * TIEBREAK_RULES.height - ownFighter.y;
    const size = Math.hypot(x, y) || 1;
    intent.current.aimX = x / size;
    intent.current.aimY = y / size;
  };
  const pad = (event: ReactPointerEvent<HTMLDivElement>, type: 'move' | 'aim') => {
    if (!canControl) return;
    const target = event.currentTarget,
      bounds = target.getBoundingClientRect();
    if (event.type === 'pointerdown') target.setPointerCapture(event.pointerId);
    const released =
      event.type === 'pointerup' ||
      event.type === 'pointercancel' ||
      event.type === 'lostpointercapture';
    if (type === 'move') {
      intent.current.moveX = released
        ? 0
        : Math.max(
            -1,
            Math.min(1, (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2)),
          );
      intent.current.moveY = released
        ? 0
        : Math.max(
            -1,
            Math.min(1, (event.clientY - bounds.top - bounds.height / 2) / (bounds.height / 2)),
          );
    } else {
      const x = event.clientX - bounds.left - bounds.width / 2,
        y = event.clientY - bounds.top - bounds.height / 2,
        size = Math.hypot(x, y) || 1;
      intent.current.aimX = x / size;
      intent.current.aimY = y / size;
      intent.current.shooting = !released;
    }
    if (released && target.hasPointerCapture(event.pointerId))
      target.releasePointerCapture(event.pointerId);
  };
  return (
    <section className="tiebreak-arena" aria-label="Desempate de tiro">
      <p className="eyebrow">Desempate · tiro 2D</p>
      <h2 tabIndex={-1}>{labels[tie.phase]}</h2>
      <p>
        Você começa com 3 vidas. Ao chegar a zero, responda: acertar devolve 1 vida; errar elimina.
      </p>
      {!participating && <p role="status">Você está assistindo ao desempate.</p>}
      {stale && <p role="status">Aguardando atualização da arena…</p>}
      <ul className="tiebreak-hud" aria-label="Vidas do combate">
        {tie.frame.fighters.map((f) => (
          <li key={f.playerId}>
            <strong>{name(f.playerId)}</strong> · {f.lives} vidas ·{' '}
            {f.status === 'eliminated'
              ? 'Eliminado'
              : f.status === 'question'
                ? 'Pergunta'
                : 'Em combate'}
          </li>
        ))}
      </ul>
      {tie.phase === 'instructions' && participating && (
        <Button
          disabled={controls.blocked || tie.readyPlayerIds.includes(view.viewerId)}
          onClick={() => void controls.ready()}
        >
          {tie.readyPlayerIds.includes(view.viewerId) ? 'Pronto!' : 'Estou pronto para o combate'}
        </Button>
      )}
      {['instructions', 'countdown', 'reveal', 'result'].includes(tie.phase) && (
        <Timer deadline={tie.deadlineAt} now={now} offset={controls.offset} />
      )}
      <canvas
        ref={canvas}
        width={1200}
        height={800}
        tabIndex={0}
        aria-label="Arena. WASD ou setas para mover. Mouse ou IJKL para mirar. Clique ou Espaço para atirar."
        onPointerMove={aim}
        onPointerDown={(event) => {
          aim(event);
          if (canControl) {
            event.currentTarget.setPointerCapture(event.pointerId);
            intent.current.shooting = true;
          }
        }}
        onPointerUp={(event) => {
          intent.current.shooting = false;
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          intent.current = neutral();
        }}
        onLostPointerCapture={() => {
          intent.current.shooting = false;
        }}
      />
      {canControl && (
        <>
          <p className="tiebreak-help">
            Selecione a arena para usar o teclado. WASD ou setas para mover · mouse ou IJKL para
            mirar · clique ou Espaço para atirar.
          </p>
          <div className="tiebreak-pads">
            {(['move', 'aim'] as const).map((type) => (
              <div
                key={type}
                className="tiebreak-pad"
                role="group"
                aria-label={type === 'move' ? 'Mover personagem' : 'Mirar e atirar'}
                onPointerDown={(e) => pad(e, type)}
                onPointerMove={(e) => {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) pad(e, type);
                }}
                onPointerUp={(e) => pad(e, type)}
                onPointerCancel={(e) => pad(e, type)}
                onLostPointerCapture={(e) => pad(e, type)}
              >
                {type === 'move' ? '✥ Mover' : '⊕ Mirar e atirar'}
              </div>
            ))}
          </div>
        </>
      )}
      {tie.phase === 'questions' && own.status === 'unavailable' && (
        <p role="status">Combate pausado. Aguardando as perguntas de sobrevivência.</p>
      )}
      {(own.status === 'reading' || own.status === 'open') && (
        <div className="tiebreak-question" ref={questionPanel}>
          <h3 tabIndex={-1}>Sua pergunta de sobrevivência</h3>
          <QuestionText question={own.question} />
          <Timer
            deadline={own.status === 'reading' ? own.opensAt : own.deadlineAt}
            now={now}
            offset={controls.offset}
          />
          {own.status === 'reading' ? (
            <p>Leia a pergunta. As alternativas serão liberadas em seguida.</p>
          ) : (
            <AnswerOptions
              helpId="survival-help"
              options={own.question.options}
              selected={controls.attempt?.optionId}
              disabled={
                controls.blocked ||
                own.submitted ||
                !!controls.attempt ||
                now + controls.offset >= own.deadlineAt
              }
              onAnswer={(optionId) => void stores.match.getState().survivalAnswer(optionId)}
            />
          )}
          <p id="survival-help">
            Uma resposta. Acertar devolve uma vida; errar elimina do combate.
          </p>
          {own.status === 'open' && (own.submitted || controls.attempt) && (
            <p role="status">Resposta enviada. Aguardando o resultado do grupo.</p>
          )}
        </div>
      )}
      {own.status === 'resolved' && (
        <div className="tiebreak-question" role="status">
          <p>
            {own.outcome === 'correct'
              ? 'Você acertou e recuperou 1 vida!'
              : own.outcome === 'absent'
                ? 'O prazo terminou. Você foi eliminado do combate.'
                : 'Resposta incorreta. Você foi eliminado do combate.'}
          </p>
          <QuestionText question={own.reveal.question} />
          <p>
            Resposta correta:{' '}
            {
              own.reveal.question.options.find((o) => o.optionId === own.reveal.correctOptionId)
                ?.text
            }
          </p>
          {own.reveal.explanation && <p>{own.reveal.explanation}</p>}
        </div>
      )}
      {tie.phase === 'result' && (
        <ol aria-label="Resultado do desempate">
          {tie.standings.map((id) => (
            <li key={id}>{name(id)}</li>
          ))}
        </ol>
      )}
    </section>
  );
}
