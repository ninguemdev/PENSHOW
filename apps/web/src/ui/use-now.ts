import { useEffect, useState } from 'react';

export function useNow(enabled = true) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return now;
}
