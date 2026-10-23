import type { ClientStores } from '../../stores/client-stores';

/** Delegate once for mouse, touch and native keyboard clicks; never bind a sound to rendering. */
export function watchInterfaceSounds(store: ClientStores['sound'], page: Document = document) {
  const click = (event: MouseEvent) => {
    if (
      !event.isTrusted ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey ||
      page.visibilityState === 'hidden'
    )
      return;
    const target = event.target instanceof Element ? event.target : null;
    const control = target?.closest<HTMLElement>(
      'button, a[href], input[type="button"], input[type="submit"], input[type="reset"], input[type="checkbox"], input[type="radio"], summary, [role="button"]',
    );
    if (
      !control ||
      control.closest('[data-sound="none"], [inert]') ||
      control.matches(':disabled, [aria-disabled="true"]')
    )
      return;
    store.getState().interact(control.matches('a[href]') ? 'navigate' : 'click');
  };
  page.addEventListener('click', click, true);
  return () => page.removeEventListener('click', click, true);
}
