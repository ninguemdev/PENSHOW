// Adapted from Comicle, MIT. See THIRD_PARTY_NOTICES.md.
import { resolveRoute } from '../../lib/navigation';

// Return app-relative routes only: no external origins or return to the profile itself.
export function safeNextPath(raw: string | null, base = import.meta.env.BASE_URL): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || /[\\\p{Cc}\p{Cf}]/u.test(raw))
    return '';
  const route = resolveRoute(raw, base);
  if (route.page === 'create') return 'criar';
  return route.page === 'room' ? `sala/${route.code}` : '';
}
