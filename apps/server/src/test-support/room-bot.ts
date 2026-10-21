import { io } from 'socket.io-client';
import {
  acknowledgementSchema,
  defaultAvatar,
  issuedGuestSessionSchema,
  type ClientEvent,
} from '@penshow/shared';
import { SOCKET_PATH } from '../platform/config.js';

/** A real guest and socket for browser capacity checks; it has no access to room aggregates. */
export async function connectRoomBot(address: string, code: string, nickname: string) {
  const response = await fetch(`${address}/guest-sessions`, { method: 'POST' });
  if (!response.ok) throw new Error('Não foi possível criar a sessão de teste.');
  const session = issuedGuestSessionSchema.parse(await response.json());
  const socket = io(address, {
    path: SOCKET_PATH,
    transports: ['websocket'],
    auth: { token: session.token },
    autoConnect: false,
    reconnection: false,
    timeout: 3000,
  });
  const command = async (event: ClientEvent, payload: unknown) =>
    acknowledgementSchema.parse(
      await socket
        .timeout(3000)
        .emitWithAck(event, { protocolVersion: 1, actionId: crypto.randomUUID(), event, payload }),
    );
  try {
    const connected = new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    socket.connect();
    await connected;
    const joined = await command('room:join', {
      code,
      profile: { nickname, avatar: defaultAvatar() },
    });
    if (joined.status !== 'ok') throw new Error('Não foi possível entrar na sala de teste.');
    return { playerId: session.playerId, command, close: () => socket.disconnect() };
  } catch (error) {
    socket.disconnect();
    throw error;
  }
}
