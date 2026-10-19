import type { MatchView, RoomView } from '@penshow/shared';
import type { ClientStores } from '../../stores/client-stores';
import type { useMatchControls } from './match-controls';

export interface RoundProps {
  view: RoomView;
  match: MatchView;
  stores: ClientStores;
  controls: ReturnType<typeof useMatchControls>;
  now: number;
}
