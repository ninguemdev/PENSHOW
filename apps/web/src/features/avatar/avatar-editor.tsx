// Adapted from Comicle, MIT. See THIRD_PARTY_NOTICES.md.
import { useId, useRef, useState } from 'react';
import { useStore } from 'zustand';
import {
  activeOptions,
  avatarCatalog,
  OPTIONAL_AVATAR_CATEGORIES,
  type AvatarCategory,
  EDITABLE_AVATAR_CATEGORIES,
  AVATAR_LAYOUT_LIMITS,
  avatarTransform,
  type EditableAvatarCategory,
  type AvatarTransform,
} from '@penshow/shared';
import type { ClientStores } from '../../stores/client-stores';
import { strings } from '../../strings/pt-BR';
import { Button } from '../../ui/button';
import { AvatarRenderer } from './avatar-renderer';

const TABS = EDITABLE_AVATAR_CATEGORIES;

export function AvatarEditor({ store }: { store: ClientStores['profile'] }) {
  const { draft, selectPart, randomize, transformPart, resetPart } = useStore(store);
  const avatar = draft.avatar;
  const [active, setActive] = useState<EditableAvatarCategory>('eyes');
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    width: number;
    category: EditableAvatarCategory;
    transform: AvatarTransform;
  } | null>(null);
  const transform = avatarTransform(avatar, active);
  const hasPart = !!avatar[active];
  const clamp = (value: number) =>
    Math.max(AVATAR_LAYOUT_LIMITS.minOffset, Math.min(AVATAR_LAYOUT_LIMITS.maxOffset, value));
  const tabs = useRef(new Map<AvatarCategory, HTMLButtonElement>());
  const prefix = useId();
  return (
    <div className="avatar-editor">
      <div className="avatar-preview">
        <div className="avatar-frame">
          <div
            className="avatar-drag-surface"
            onPointerDown={(event) => {
              if (!hasPart || !event.isPrimary || event.button !== 0) return;
              const width = event.currentTarget.getBoundingClientRect().width;
              if (!width) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                width,
                category: active,
                transform,
              };
            }}
            onPointerMove={(event) => {
              const start = drag.current;
              if (!start || start.pointerId !== event.pointerId) return;
              transformPart(start.category, {
                ...start.transform,
                x: clamp(start.transform.x + (event.clientX - start.x) / start.width),
                y: clamp(start.transform.y + (event.clientY - start.y) / start.width),
              });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onLostPointerCapture={() => {
              drag.current = null;
            }}
          >
            <AvatarRenderer avatar={avatar} size={256} label={strings.avatar.preview} />
          </div>
        </div>
        <p className="avatar-editor-hint">A cabeça tem formato, posição e tamanho fixos.</p>
        <p className="avatar-editor-hint">
          Selecione uma peça e arraste na prévia, ou use os controles de posição e tamanho.
        </p>
        <Button className="secondary" onClick={randomize}>
          {strings.avatar.random}
        </Button>
      </div>
      <div className="avatar-picker">
        <div
          className="avatar-tabs"
          role="tablist"
          aria-label={strings.avatar.parts}
          onKeyDown={(event) => {
            const current = TABS.indexOf(active);
            const next =
              event.key === 'ArrowRight'
                ? (current + 1) % TABS.length
                : event.key === 'ArrowLeft'
                  ? (current + TABS.length - 1) % TABS.length
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? TABS.length - 1
                      : null;
            const category = next === null ? undefined : TABS[next];
            if (!category) return;
            event.preventDefault();
            setActive(category);
            tabs.current.get(category)?.focus();
          }}
        >
          {TABS.map((category) => (
            <button
              type="button"
              role="tab"
              key={category}
              ref={(element) => {
                if (element) tabs.current.set(category, element);
                else tabs.current.delete(category);
              }}
              id={`${prefix}-tab-${category}`}
              aria-controls={`${prefix}-panel-${category}`}
              aria-selected={category === active}
              tabIndex={category === active ? 0 : -1}
              onClick={() => setActive(category)}
            >
              {avatarCatalog.categories[category].label}
            </button>
          ))}
        </div>
        <fieldset className="avatar-adjustments" disabled={!hasPart}>
          <legend>
            Ajustar {avatarCatalog.categories[active].label.toLocaleLowerCase('pt-BR')}
          </legend>
          {(
            [
              [
                'x',
                'Posição horizontal',
                AVATAR_LAYOUT_LIMITS.minOffset * 100,
                AVATAR_LAYOUT_LIMITS.maxOffset * 100,
              ],
              [
                'y',
                'Posição vertical',
                AVATAR_LAYOUT_LIMITS.minOffset * 100,
                AVATAR_LAYOUT_LIMITS.maxOffset * 100,
              ],
              [
                'scale',
                'Tamanho',
                AVATAR_LAYOUT_LIMITS.minScale * 100,
                AVATAR_LAYOUT_LIMITS.maxScale * 100,
              ],
            ] as const
          ).map(([key, label, min, max]) => (
            <label key={key}>
              <span>{label}</span>
              <output>{Math.round(transform[key] * 100)}%</output>
              <input
                type="range"
                aria-label={label}
                aria-valuetext={`${Math.round(transform[key] * 100)}%`}
                min={min}
                max={max}
                step={1}
                value={Math.round(transform[key] * 100)}
                onChange={(event) =>
                  transformPart(active, { ...transform, [key]: Number(event.target.value) / 100 })
                }
              />
            </label>
          ))}
          <Button className="secondary" onClick={() => resetPart(active)}>
            Restaurar peça
          </Button>
        </fieldset>
        {!hasPart && (
          <p className="avatar-editor-hint">Escolha uma peça para ajustar sua posição e tamanho.</p>
        )}
        {TABS.map((category) => {
          const options: { id: string | null; label: string }[] = activeOptions(category);
          const choices = OPTIONAL_AVATAR_CATEGORIES.some((optional) => optional === category)
            ? [{ id: null, label: strings.avatar.none }, ...options]
            : options;
          return (
            <div
              key={category}
              className="avatar-options"
              role="tabpanel"
              id={`${prefix}-panel-${category}`}
              aria-labelledby={`${prefix}-tab-${category}`}
              hidden={category !== active}
            >
              {choices.map((option) => {
                const previewAvatar = { ...avatar, [category]: option.id };
                if (avatar[category] !== option.id && avatar.layout) {
                  const parts = { ...avatar.layout.parts };
                  delete parts[category];
                  previewAvatar.layout = { version: 1, parts };
                }
                return (
                  <button
                    type="button"
                    key={option.id ?? 'none'}
                    aria-pressed={(avatar[category] ?? null) === option.id}
                    onClick={() => selectPart(category, option.id)}
                  >
                    <AvatarRenderer avatar={previewAvatar} />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
