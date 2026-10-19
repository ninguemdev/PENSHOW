import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom has no modal top layer. Browser smoke tests cover native Tab/Escape confinement.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
    this.querySelector<HTMLElement>('[autofocus], button, a[href]')?.focus();
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
