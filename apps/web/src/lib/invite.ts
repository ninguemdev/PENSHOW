import { routeHref } from './navigation';

export function inviteUrl(code: string, origin = window.location.origin) {
  return new URL(routeHref(`sala/${code}`), origin).href;
}
export async function copyInvite(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
