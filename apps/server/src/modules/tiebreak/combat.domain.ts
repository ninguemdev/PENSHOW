import {
  TIEBREAK_RULES as rules,
  TIEBREAK_OBSTACLES,
  type PlayerId,
  type TiebreakInput,
} from '@penshow/shared';

export interface Fighter {
  playerId: PlayerId;
  x: number;
  y: number;
  aimX: number;
  aimY: number;
  lives: number;
  status: 'fighting' | 'question' | 'eliminated';
  protectedUntil: number;
  nextShotAt: number;
  input: (TiebreakInput & { receivedAt: number; connectionId?: string }) | null;
  lastSequence: number;
}
export interface Projectile {
  id: number;
  ownerId: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  expiresAt: number;
}
export interface Combat {
  fighters: Fighter[];
  projectiles: Projectile[];
  simulationMs: number;
  tick: number;
  nextProjectileId: number;
}
export function spawnPoint(index: number) {
  const angle = (index * Math.PI * 2) / 12;
  return { x: 600 + Math.cos(angle) * 510, y: 400 + Math.sin(angle) * 340 };
}
export function createCombat(ids: readonly PlayerId[]): Combat {
  return {
    simulationMs: 0,
    tick: 0,
    nextProjectileId: 0,
    projectiles: [],
    fighters: ids.map((playerId, index) => ({
      playerId,
      ...spawnPoint(Math.floor((index * 12) / ids.length)),
      aimX: -Math.cos((index * Math.PI * 2) / ids.length),
      aimY: -Math.sin((index * Math.PI * 2) / ids.length),
      lives: 3,
      status: 'fighting',
      protectedUntil: 0,
      nextShotAt: 0,
      input: null,
      lastSequence: -1,
    })),
  };
}
function free(x: number, y: number, others: readonly Fighter[], own: PlayerId) {
  if (
    x < rules.radius ||
    x > rules.width - rules.radius ||
    y < rules.radius ||
    y > rules.height - rules.radius
  )
    return false;
  if (
    TIEBREAK_OBSTACLES.some((o) => {
      const dx = x - Math.max(o.x, Math.min(x, o.x + o.width));
      const dy = y - Math.max(o.y, Math.min(y, o.y + o.height));
      return dx * dx + dy * dy < rules.radius ** 2;
    })
  )
    return false;
  return !others.some(
    (f) =>
      f.playerId !== own &&
      f.status === 'fighting' &&
      Math.hypot(x - f.x, y - f.y) < rules.radius * 2,
  );
}
/** Earliest segment entry into a rectangle, including boundary intersections. */
function rectangleHit(
  x: number,
  y: number,
  dx: number,
  dy: number,
  left: number,
  top: number,
  width: number,
  height: number,
) {
  let low = 0,
    high = 1;
  for (const [origin, delta, min, max] of [
    [x, dx, left, left + width],
    [y, dy, top, top + height],
  ]) {
    if (Math.abs(delta!) < 1e-9) {
      if (origin! < min! || origin! > max!) return Infinity;
      continue;
    }
    const a = (min! - origin!) / delta!,
      b = (max! - origin!) / delta!;
    low = Math.max(low, Math.min(a, b));
    high = Math.min(high, Math.max(a, b));
    if (low > high) return Infinity;
  }
  return low;
}
function circleHit(x: number, y: number, dx: number, dy: number, fighter: Fighter) {
  const ox = x - fighter.x,
    oy = y - fighter.y,
    r = rules.radius + rules.projectileRadius;
  const a = dx * dx + dy * dy,
    b = 2 * (ox * dx + oy * dy),
    c = ox * ox + oy * oy - r * r;
  if (c <= 0) return 0;
  const d = b * b - 4 * a * c;
  if (d < 0 || !a) return Infinity;
  const t = (-b - Math.sqrt(d)) / (2 * a);
  return t >= 0 && t <= 1 ? t : Infinity;
}
/** One fixed server step. Collect all impacts before applying damage or starting questions. */
export function stepCombat(
  combat: Combat,
  now: number,
  connected: ReadonlySet<PlayerId>,
): PlayerId[] {
  const dt = rules.tickMs / 1000;
  combat.tick++;
  combat.simulationMs += rules.tickMs;
  for (const f of combat.fighters) {
    const input = f.input;
    if (
      f.status !== 'fighting' ||
      !input ||
      !connected.has(f.playerId) ||
      now - input.receivedAt >= rules.inputExpiryMs
    )
      continue;
    const length = Math.max(1, Math.hypot(input.moveX, input.moveY));
    const nx = f.x + (input.moveX / length) * rules.speed * dt,
      ny = f.y + (input.moveY / length) * rules.speed * dt;
    if (free(nx, f.y, combat.fighters, f.playerId)) f.x = nx;
    if (free(f.x, ny, combat.fighters, f.playerId)) f.y = ny;
    const aim = Math.hypot(input.aimX, input.aimY);
    if (aim > 0) {
      f.aimX = input.aimX / aim;
      f.aimY = input.aimY / aim;
    }
    if (
      input.shooting &&
      aim > 0 &&
      combat.simulationMs >= f.protectedUntil &&
      combat.simulationMs >= f.nextShotAt
    ) {
      f.nextShotAt = combat.simulationMs + rules.shotIntervalMs;
      combat.projectiles.push({
        id: combat.nextProjectileId++,
        ownerId: f.playerId,
        x: f.x,
        y: f.y,
        vx: f.aimX * rules.projectileSpeed,
        vy: f.aimY * rules.projectileSpeed,
        expiresAt: combat.simulationMs + rules.projectileLifetimeMs,
      });
    }
  }
  const hit = new Set<PlayerId>();
  combat.projectiles = combat.projectiles.filter((p) => {
    if (p.expiresAt <= combat.simulationMs) return false;
    const dx = p.vx * dt,
      dy = p.vy * dt;
    let obstacle = Infinity;
    for (const o of TIEBREAK_OBSTACLES)
      obstacle = Math.min(
        obstacle,
        rectangleHit(
          p.x,
          p.y,
          dx,
          dy,
          o.x - rules.projectileRadius,
          o.y - rules.projectileRadius,
          o.width + 2 * rules.projectileRadius,
          o.height + 2 * rules.projectileRadius,
        ),
      );
    const targets = combat.fighters
      .filter(
        (f) =>
          f.playerId !== p.ownerId &&
          f.status === 'fighting' &&
          combat.simulationMs >= f.protectedUntil,
      )
      .map((f) => ({ f, t: circleHit(p.x, p.y, dx, dy, f) }))
      .sort((a, b) => a.t - b.t);
    const target = targets[0];
    if (target && target.t < Infinity && target.t < obstacle) {
      hit.add(target.f.playerId);
      return false;
    }
    if (obstacle < Infinity) return false;
    p.x += dx;
    p.y += dy;
    return p.x >= 0 && p.x <= rules.width && p.y >= 0 && p.y <= rules.height;
  });
  const zero: PlayerId[] = [];
  for (const f of combat.fighters)
    if (hit.has(f.playerId)) {
      f.lives = Math.max(0, f.lives - 1);
      if (f.lives === 0) {
        f.status = 'question';
        zero.push(f.playerId);
      }
    }
  return zero;
}
export function respawn(combat: Combat, fighter: Fighter) {
  const point = Array.from({ length: 12 }, (_, i) => spawnPoint(i)).find((p) =>
    free(p.x, p.y, combat.fighters, fighter.playerId),
  );
  if (!point) throw new Error('Arena sem ponto livre de retorno.');
  Object.assign(fighter, point, {
    lives: 1,
    status: 'fighting',
    protectedUntil: combat.simulationMs + rules.protectionMs,
    input: null,
  });
}
