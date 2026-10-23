try {
  const response = await fetch(`http://127.0.0.1:${process.env.PORT ?? 3000}/api/health`, {
    signal: AbortSignal.timeout(2000),
  });
  const body = await response.json();
  if (!response.ok || body.service !== 'penshow' || body.status !== 'ok') process.exitCode = 1;
} catch {
  process.exitCode = 1;
}
