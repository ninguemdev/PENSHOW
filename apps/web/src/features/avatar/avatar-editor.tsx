// Adapted from Comicle, MIT. See THIRD_PARTY_NOTICES.md.
import { useId, useRef, useState } from 'react';
import { useStore } from 'zustand';
import {
  activeOptions,
  avatarCatalog,
  OPTIONAL_AVATAR_CATEGORIES,
  type AvatarCategory,
} from '@penshow/shared';
import type { ClientStores } from '../../stores/client-stores';
import { strings } from '../../strings/pt-BR';
import { Button } from '../../ui/button';
import { AvatarRenderer } from './avatar-renderer';

const TABS: readonly AvatarCategory[] = ['head', 'eyes', 'mouth', 'cheeks', 'faceAccessory', 'hat'];

export function AvatarEditor({ store }: { store: ClientStores['profile'] }) {
  const { draft, selectPart, randomize } = useStore(store);
  const avatar = draft.avatar;
  const [active, setActive] = useState<AvatarCategory>('head');
  const tabs = useRef(new Map<AvatarCategory, HTMLButtonElement>());
  const prefix = useId();
  return (
    <div className="avatar-editor">
      <div className="avatar-preview">
        <div className="avatar-frame">
          <AvatarRenderer avatar={avatar} size={256} label={strings.avatar.preview} />
        </div>
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
              {choices.map((option) => (
                <button
                  type="button"
                  key={option.id ?? 'none'}
                  aria-pressed={avatar[category] === option.id}
                  onClick={() => selectPart(category, option.id)}
                >
                  <AvatarRenderer avatar={{ ...avatar, [category]: option.id }} />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
