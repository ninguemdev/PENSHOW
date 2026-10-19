import { roomCodeSchema } from '@penshow/shared';
import { normalizeRoomCode } from './room-code';

export type Route =
  { page: 'home' | 'profile' | 'create' | 'error' } | { page: 'room'; code: string };
export function normalizeBase(base: string) {
  const parts = base.split('/').filter(Boolean);
  return `/${parts.join('/')}${parts.length ? '/' : ''}`;
}
export function resolveRoute(pathname: string, base = import.meta.env.BASE_URL): Route {
  const root = normalizeBase(base);
  if (root !== '/' && pathname === root.slice(0, -1)) return { page: 'home' };
  if (!pathname.startsWith(root)) return { page: 'error' };
  const path = pathname.slice(root.length).replace(/\/$/, '');
  if (!path) return { page: 'home' };
  if (path === 'perfil') return { page: 'profile' };
  if (path === 'criar') return { page: 'create' };
  const match = /^sala\/([^/]+)$/.exec(path);
  const code = roomCodeSchema.safeParse(match ? normalizeRoomCode(match[1]!) : null);
  if (match && code.success) return { page: 'room', code: code.data };
  return { page: 'error' };
}
export function routeHref(path = '', base = import.meta.env.BASE_URL) {
  return `${normalizeBase(base)}${path}`;
}
export function navigate(path: string) {
  window.history.pushState(null, '', routeHref(path));
  window.dispatchEvent(new PopStateEvent('popstate'));
}
export function subscribeNavigation(listener: () => void) {
  window.addEventListener('popstate', listener);
  return () => window.removeEventListener('popstate', listener);
}
