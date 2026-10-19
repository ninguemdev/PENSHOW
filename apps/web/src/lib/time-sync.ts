export function clockOffset(
  clientSentAt: number,
  clientReceivedAt: number,
  serverReceivedAt: number,
  serverSentAt: number,
) {
  return (serverReceivedAt - clientSentAt + (serverSentAt - clientReceivedAt)) / 2;
}

export function remainingSeconds(deadline: number, now: number, offset = 0) {
  return Math.max(0, Math.ceil((deadline - (now + offset)) / 1000));
}
