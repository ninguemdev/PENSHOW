import { useStore } from 'zustand';
import type { ClientStores } from '../../stores/client-stores';
import { routeHref } from '../../lib/navigation';
import { strings } from '../../strings/pt-BR';
import { NavLink } from '../../ui/nav-link';
import { AvatarRenderer } from '../avatar/avatar-renderer';

export function Admission({ stores, next }: { stores: ClientStores; next: string }) {
  const profile = useStore(stores.profile, (state) => state.profile);
  return profile ? (
    <div className="admission-profile">
      <AvatarRenderer avatar={profile.avatar} size={64} />
      <p>
        {strings.room.profileReady(profile.nickname)}
        <br />
        <NavLink path={`perfil?next=${encodeURIComponent(routeHref(next))}`}>
          {strings.profile.edit}
        </NavLink>
      </p>
    </div>
  ) : (
    <div className="storage-notice">
      <p>{strings.room.profileRequired}</p>
      <NavLink className="button" path={`perfil?next=${encodeURIComponent(routeHref(next))}`}>
        {strings.homePage.prepare}
      </NavLink>
    </div>
  );
}
