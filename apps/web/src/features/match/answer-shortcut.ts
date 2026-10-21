import type { KeyboardEvent } from 'react';

/** Single-key shortcuts only operate while focus is inside the current stage. */
export function answerShortcut(event: KeyboardEvent<HTMLDivElement>) {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.nativeEvent.isComposing ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    !/^[1-4]$/.test(event.key) ||
    document.querySelector('dialog[open]') ||
    !(event.target instanceof Element) ||
    event.target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
    )
  )
    return;
  const button = event.currentTarget.querySelector<HTMLButtonElement>(
    `button[data-answer-key="${event.key}"]:not(:disabled)`,
  );
  if (button) {
    event.preventDefault();
    button.click();
  }
}
