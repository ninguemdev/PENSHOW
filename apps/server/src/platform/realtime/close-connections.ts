interface ClosingSocket {
  conn: {
    readyState: string;
    once(event: 'close', listener: () => void): unknown;
    off(event: 'close', listener: () => void): unknown;
    close(discard: boolean): unknown;
  };
  disconnect(close: boolean): unknown;
}
export const TRANSPORT_CLOSE_GRACE_MS = 1000;

/** Let Engine.IO drain queued terminal events before the server forces its transports closed. */
export async function closeConnections(sockets: Iterable<ClosingSocket>) {
  await Promise.all(
    Array.from(
      sockets,
      (socket) =>
        new Promise<void>((resolve) => {
          const connection = socket.conn;
          if (connection.readyState === 'closed') {
            resolve();
            return;
          }
          const finish = () => {
            clearTimeout(timer);
            connection.off('close', finish);
            resolve();
          };
          const timer = setTimeout(() => {
            connection.close(true);
            finish();
          }, TRANSPORT_CLOSE_GRACE_MS);
          connection.once('close', finish);
          socket.disconnect(true);
        }),
    ),
  );
}
