import type { RoomMember } from '@penshow/shared';
import { strings } from '../strings/pt-BR';
import { AvatarRenderer } from '../features/avatar/avatar-renderer';
export function PlayerChip({ member }: { member: RoomMember }) {
  return (
    <div className="player-chip">
      <AvatarRenderer
        avatar={member.profile.avatar}
        size={32}
        label={strings.avatar.player(member.profile.nickname)}
      />
      <span>
        <strong>{member.profile.nickname}</strong>
        <span className="player-detail">
          {member.isHost
            ? strings.player.host
            : member.role === 'spectator'
              ? strings.player.spectator
              : ''}
        </span>
        <span className="player-detail">{strings.player[member.connection.status]}</span>
      </span>
    </div>
  );
}
