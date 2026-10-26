// Adapted from Comicle, MIT. See THIRD_PARTY_NOTICES.md.
import type { Avatar } from '@penshow/shared';
import { avatarLayers } from './avatar-layers';

export function AvatarRenderer({
  avatar,
  size = 64,
  label,
}: {
  avatar: Avatar;
  size?: 32 | 64 | 160 | 256;
  label?: string;
}) {
  return (
    <span
      className="avatar"
      style={{ width: size, maxWidth: '100%', aspectRatio: 1 }}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {avatarLayers(avatar).map((layer) => (
        <img
          key={layer.category}
          src={layer.src}
          alt=""
          width={size}
          height={size}
          draggable={false}
          data-avatar-part={layer.category}
          style={{
            left: `${layer.rect.x * 100}%`,
            top: `${layer.rect.y * 100}%`,
            width: `${layer.rect.width * 100}%`,
            height: `${layer.rect.height * 100}%`,
          }}
        />
      ))}
    </span>
  );
}
