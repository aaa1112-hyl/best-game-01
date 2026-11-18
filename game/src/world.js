// The game's rules and state, with no drawing and no browser in it: the shadow road,
// build plots, towers, enemies, waves, gold, lives and score. step() advances one
// fixed step and returns what happened as bit flags, so the caller can react without
// the world knowing about screens or sound. Nothing here allocates after createWorld
// returns, except the small spawn queue rebuilt once per wave.
import { ENEMIES, FIELD, LIGHTHOUSE, PATH, START, TOWERS, UPGRADE, WAVE } from './config.js';

export const EVENT_KILL = 1;
export const EVENT_LEAK = 2;
export const EVENT_WAVE_CLEAR = 4;
export const EVENT_WIN = 8;
export const EVENT_OVER = 16;
export const EVENT_WAVE_START = 32;
export const EVENT_SHOT = 64;

/** Hand-placed build plots, clear of the road and the lighthouse. */
const PLOT_SPOTS = [
  [120, 52], [320, 52], [520, 52], [720, 52], [1000, 52],
  [120, 190], [320, 190], [520, 190], [720, 190], [1000, 190],
  [60, 400], [120, 400], [520, 400], [720, 400],
  [60, 600], [120, 600], [320, 600], [520, 600], [720, 600], [1000, 600],
];

/** Precomputed road segments: length, unit direction and running distance. */
function buildRoad() {
  const segments = [];
  let total = 0;
  for (let index = 0; index < PATH.length - 1; index += 1) {
    const [x1, y1] = PATH[index];
    const [x2, y2] = PATH[index + 1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    segments.push({ x1, y1, dx: dx / length, dy: dy / length, length, start: total });
    total += length;
  }
  return { segments, total };
}

const ROAD = buildRoad();

function roadPoint(distance) {
  const clamped = Math.min(distance, ROAD.total);
  for (const segment of ROAD.segments) {
    if (clamped <= segment.start + segment.length || segment === ROAD.segments[ROAD.segments.length - 1]) {
      const along = Math.max(0, clamped - segment.start);
      return { x: segment.x1 + segment.dx * along, y: segment.y1 + segment.dy * along, angle: Math.atan2(segment.dy, segment.dx) };
    }
  }
  const last = ROAD.segments[ROAD.segments.length - 1];
  return { x: last.x1 + last.dx * last.length, y: last.y1 + last.dy * last.length, angle: Math.atan2(last.dy, last.dx) };
}

export function towerDamage(type, level) {
  return TOWERS[type].damage * UPGRADE.damageGrowth ** (level - 1);
}

export function towerRange(type, level) {
  return TOWERS[type].range + UPGRADE.rangeGrowth * (level - 1);
}

export function upgradeCost(type, level) {
  return Math.round(TOWERS[type].cost * UPGRADE.levelCost[level]);
}

export function waveComposition(n) {
  const list = [];
  const wisps = 6 + 2 * n;
  const crawlers = n >= 2 ? 2 + n : 0;
  const bats = n >= 3 ? 1 + n : 0;
  const brutes = n >= 5 ? 1 + Math.floor(n / 2) : 0;
  for (let i = 0; i < wisps; i += 1) list.push('wisp');
  for (let i = 0; i < crawlers; i += 1) list.push('crawler');
  for (let i = 0; i < bats; i += 1) list.push('bat');
  for (let i = 0; i < brutes; i += 1) list.push('brute');
  if (n === START.maxWave) list.push('boss');
  return list;
}

export function createWorld(random) {
  const plots = PLOT_SPOTS.map(([x, y]) => ({ x, y, tower: null }));
  const towers = [];
  const enemies = [];
  for (let index = 0; index < 160; index += 1) {
    enemies.push({ active: false, type: 'wisp', x: 0, y: 0, hp: 0, maxHp: 0, speed: 0, bounty: 0, damage: 0, radius: 0, color: '', distance: 0, slowTimer: 0, wobble: 0 });
  }
  const projectiles = [];
  for (let index = 0; index < 128; index += 1) {
    projectiles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, target: null, damage: 0, splash: 0, color: '', kind: '' });
  }
  const bolts = [];
  for (let index = 0; index < 24; index += 1) {
    bolts.push({ active: false, points: [], ttl: 0, color: '#c084fc' });
  }
  const particles = [];
  for (let index = 0; index < 256; index += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, ttl: 0, maxTtl: 1, color: '#ffffff', size: 3 });
  }
  const floaters = [];
  for (let index = 0; index < 32; index += 1) {
    floaters.push({ active: false, x: 0, y: 0, text: '', ttl: 0, color: '#f2c94c' });
  }
  const stars = [];
  for (let index = 0; index < 90; index += 1) {
    stars.push({ x: random() * FIELD.width, y: random() * FIELD.height * 0.55, size: 0.6 + random() * 1.6, twinkle: random() * Math.PI * 2 });
  }

  const state = {
    plots,
    towers,
    enemies,
    projectiles,
    bolts,
    particles,
    floaters,
    stars,
    gold: START.gold,
    lives: START.lives,
    wave: 0,
    phase: 'build',
    score: 0,
    kills: 0,
    goldEarned: 0,
    winBonus: 0,
    time: 0,
    beamAngle: 0,
    spawnQueue: [],
    spawnTimer: 0,
    enemiesLeft: 0,
    lastShotKind: '',
    waveClearAt: 0,
  };

  function reset() {
    for (const plot of plots) plot.tower = null;
    towers.length = 0;
    for (const enemy of enemies) enemy.active = false;
    for (const projectile of projectiles) projectile.active = false;
    for (const bolt of bolts) bolt.active = false;
    for (const particle of particles) particle.active = false;
    for (const floater of floaters) floater.active = false;
    state.gold = START.gold;
    state.lives = START.lives;
    state.wave = 0;
    state.phase = 'build';
    state.score = 0;
    state.kills = 0;
    state.goldEarned = 0;
    state.winBonus = 0;
    state.time = 0;
    state.beamAngle = 0;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.enemiesLeft = 0;
    state.lastShotKind = '';
  }

  function freeEnemy() {
    for (const enemy of enemies) if (!enemy.active) return enemy;
    return null;
  }

  function freeProjectile() {
    for (const projectile of projectiles) if (!projectile.active) return projectile;
    return null;
  }

  function freeBolt() {
    for (const bolt of bolts) if (!bolt.active) return bolt;
    return null;
  }

  function burst(x, y, color, count, speed) {
    let made = 0;
    for (const particle of particles) {
      if (made >= count) break;
      if (particle.active) continue;
      particle.active = true;
      particle.x = x;
      particle.y = y;
      const angle = random() * Math.PI * 2;
      const power = speed * (0.4 + random() * 0.6);
      particle.vx = Math.cos(angle) * power;
      particle.vy = Math.sin(angle) * power;
      particle.maxTtl = 0.35 + random() * 0.35;
      particle.ttl = particle.maxTtl;
      particle.color = color;
      particle.size = 2 + random() * 3;
      made += 1;
    }
  }

  function floatText(x, y, text, color) {
    for (const floater of floaters) {
      if (floater.active) continue;
      floater.active = true;
      floater.x = x;
      floater.y = y;
      floater.text = text;
      floater.ttl = 0.9;
      floater.color = color;
      return;
    }
  }

  function spawnEnemy(typeKey) {
    const enemy = freeEnemy();
    if (enemy === null) return;
    const def = ENEMIES[typeKey];
    // The boss's HP is already its final number; the wave growth applies to the rabble.
    const hpScale = typeKey === 'boss' ? 1 : 1 + WAVE.hpGrowth * (state.wave - 1);
    const speedScale = 1 + WAVE.speedGrowth * (state.wave - 1);
    enemy.active = true;
    enemy.type = typeKey;
    enemy.distance = 0;
    enemy.hp = Math.round(def.hp * hpScale);
    enemy.maxHp = enemy.hp;
    enemy.speed = def.speed * speedScale;
    enemy.bounty = def.bounty;
    enemy.damage = def.damage;
    enemy.radius = def.radius;
    enemy.color = def.color;
    enemy.slowTimer = 0;
    enemy.wobble = random() * Math.PI * 2;
    const point = roadPoint(0);
    enemy.x = point.x;
    enemy.y = point.y;
  }

  function startWave() {
    if (state.phase !== 'build' || state.wave >= START.maxWave) return false;
    state.wave += 1;
    state.spawnQueue = waveComposition(state.wave);
    // Shuffle the queue (boss stays last) so waves never feel like a parade.
    for (let i = state.spawnQueue.length - 2; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const swap = state.spawnQueue[i];
      state.spawnQueue[i] = state.spawnQueue[j];
      state.spawnQueue[j] = swap;
    }
    state.enemiesLeft = state.spawnQueue.length;
    state.spawnTimer = 0.6;
    state.phase = 'wave';
    return true;
  }

  function placeTower(plot, typeKey) {
    const def = TOWERS[typeKey];
    if (plot.tower !== null || state.gold < def.cost || state.phase === 'won' || state.phase === 'lost') return false;
    state.gold -= def.cost;
    const tower = { plot, type: typeKey, level: 1, invested: def.cost, cooldown: 0, angle: -Math.PI / 2, flash: 0 };
    plot.tower = tower;
    towers.push(tower);
    return true;
  }

  function upgradeTower(tower) {
    if (tower.level >= UPGRADE.maxLevel) return false;
    const cost = upgradeCost(tower.type, tower.level);
    if (state.gold < cost) return false;
    state.gold -= cost;
    tower.invested += cost;
    tower.level += 1;
    burst(tower.plot.x, tower.plot.y, '#f2c94c', 14, 90);
    return true;
  }

  function sellTower(tower) {
    const refund = Math.floor(tower.invested * 0.7);
    state.gold += refund;
    tower.plot.tower = null;
    const index = towers.indexOf(tower);
    if (index !== -1) towers.splice(index, 1);
    return refund;
  }

/** The gold colour for floaters. */
const PALETTE_GOLD = '#f2c94c';

function damageEnemy(enemy, amount) {
    if (!enemy.active) return false;
    enemy.hp -= amount;
    if (enemy.hp > 0) return false;
    enemy.active = false;
    state.kills += 1;
    state.gold += enemy.bounty;
    state.goldEarned += enemy.bounty;
    state.score = state.kills * 10 + state.goldEarned;
    state.enemiesLeft -= 1;
    burst(enemy.x, enemy.y, enemy.color, enemy.type === 'boss' ? 40 : 12, 130);
    floatText(enemy.x, enemy.y - enemy.radius - 6, `+${enemy.bounty}g`, PALETTE_GOLD);
    return true;
  }

  function fireArc(tower, target) {
    const def = TOWERS.arc;
    let current = target;
    let hits = 0;
    const points = [{ x: tower.plot.x, y: tower.plot.y }];
    const struck = new Set();
    while (current !== null && hits < def.chain) {
      points.push({ x: current.x, y: current.y });
      struck.add(current);
      damageEnemy(current, towerDamage('arc', tower.level));
      hits += 1;
      let next = null;
      let best = 100;
      for (const enemy of enemies) {
        if (!enemy.active || struck.has(enemy)) continue;
        const d = Math.hypot(enemy.x - current.x, enemy.y - current.y);
        if (d < best) {
          best = d;
          next = enemy;
        }
      }
      current = next;
    }
    const bolt = freeBolt();
    if (bolt !== null) {
      bolt.active = true;
      bolt.points = points;
      bolt.ttl = 0.14;
      bolt.color = def.color;
    }
    state.lastShotKind = 'arc';
  }

  function fireTower(tower) {
    const def = TOWERS[tower.type];
    const range = towerRange(tower.type, tower.level);
    let target = null;
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      const d = Math.hypot(enemy.x - tower.plot.x, enemy.y - tower.plot.y);
      if (d <= range && (target === null || enemy.distance > target.distance)) target = enemy;
    }
    if (target === null) return;
    tower.angle = Math.atan2(target.y - tower.plot.y, target.x - tower.plot.x);
    tower.flash = 0.12;
    tower.cooldown = 1 / def.rate;
    if (tower.type === 'arc') {
      fireArc(tower, target);
      return;
    }
    const projectile = freeProjectile();
    if (projectile === null) return;
    projectile.active = true;
    projectile.x = tower.plot.x + Math.cos(tower.angle) * 20;
    projectile.y = tower.plot.y + Math.sin(tower.angle) * 20;
    projectile.vx = Math.cos(tower.angle) * def.projectileSpeed;
    projectile.vy = Math.sin(tower.angle) * def.projectileSpeed;
    projectile.target = target;
    projectile.damage = towerDamage(tower.type, tower.level);
    projectile.splash = def.splash;
    projectile.color = def.color;
    projectile.kind = tower.type;
    if (tower.type === 'frost') projectile.slow = def.slow;
    state.lastShotKind = tower.type;
  }

  function hitEnemy(enemy, damage, splash, x, y, kind, slow) {
    if (splash > 0) {
      for (const other of enemies) {
        if (!other.active) continue;
        if (Math.hypot(other.x - x, other.y - y) <= splash) damageEnemy(other, damage);
      }
      burst(x, y, '#f472b6', 16, 150);
    } else {
      if (slow !== undefined && enemy.active) enemy.slowTimer = Math.max(enemy.slowTimer, 1.6);
      damageEnemy(enemy, damage);
    }
    if (kind === 'cannon') burst(x, y, '#fda4af', 8, 100);
  }

  function stepProjectiles(dt) {
    for (const projectile of projectiles) {
      if (!projectile.active) continue;
      const target = projectile.target;
      if (target !== null && target.active) {
        const angle = Math.atan2(target.y - projectile.y, target.x - projectile.x);
        const speed = Math.hypot(projectile.vx, projectile.vy);
        projectile.vx = Math.cos(angle) * speed;
        projectile.vy = Math.sin(angle) * speed;
      }
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      let hit = null;
      if (target !== null && target.active) {
        if (Math.hypot(target.x - projectile.x, target.y - projectile.y) <= target.radius + 6) hit = target;
      } else if (projectile.x < -20 || projectile.x > FIELD.width + 20 || projectile.y < -20 || projectile.y > FIELD.height + 20) {
        projectile.active = false;
        continue;
      }
      if (hit !== null) {
        projectile.active = false;
        hitEnemy(hit, projectile.damage, projectile.splash, projectile.x, projectile.y, projectile.kind, projectile.slow);
      }
    }
  }

  /** One fixed step. Returns event flags for sounds and screen changes. */
  function step(dt) {
    let events = 0;
    state.time += dt;
    state.beamAngle += dt * 0.45;
    state.lastShotKind = '';
    if (state.phase === 'won' || state.phase === 'lost') return events;

    // Spawning.
    if (state.phase === 'wave' && state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        const interval = Math.max(WAVE.spawnIntervalMin, WAVE.spawnInterval * (1 - 0.03 * (state.wave - 1)));
        spawnEnemy(state.spawnQueue.shift());
        state.spawnTimer += interval;
      }
    }

    // Towers acquire and fire.
    for (const tower of towers) {
      if (tower.cooldown > 0) tower.cooldown -= dt;
      if (tower.flash > 0) tower.flash -= dt;
      if (tower.cooldown <= 0) fireTower(tower);
    }
    if (state.lastShotKind !== '') events |= EVENT_SHOT;
    stepProjectiles(dt);

    // Enemies walk the road.
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      if (enemy.slowTimer > 0) enemy.slowTimer -= dt;
      const speed = enemy.speed * (enemy.slowTimer > 0 ? 0.45 : 1);
      enemy.distance += speed * dt;
      const point = roadPoint(enemy.distance);
      enemy.x = point.x + Math.sin(state.time * 3 + enemy.wobble) * 3;
      enemy.y = point.y + Math.cos(state.time * 2.4 + enemy.wobble) * 3;
      if (enemy.distance >= ROAD.total) {
        enemy.active = false;
        state.enemiesLeft -= 1;
        state.lives -= enemy.damage;
        events |= EVENT_LEAK;
        burst(LIGHTHOUSE.x - 30, LIGHTHOUSE.y, '#f87171', 18, 140);
        if (state.lives <= 0) {
          state.lives = 0;
          state.phase = 'lost';
          events |= EVENT_OVER;
          return events;
        }
      }
    }

    // Wave cleared?
    if (state.phase === 'wave' && state.spawnQueue.length === 0 && state.enemiesLeft <= 0) {
      const bonus = WAVE.clearBonus(state.wave);
      state.gold += bonus;
      state.goldEarned += bonus;
      state.score = state.kills * 10 + state.goldEarned;
      floatText(LIGHTHOUSE.x - 60, LIGHTHOUSE.y - 70, `Wave clear +${bonus}g`, PALETTE_GOLD);
      events |= EVENT_WAVE_CLEAR;
      if (state.wave >= START.maxWave) {
        state.winBonus = state.lives * 150;
        state.score += state.winBonus;
        state.phase = 'won';
        events |= EVENT_WIN;
      } else {
        state.phase = 'build';
      }
    }

    // Particles, bolts, floaters.
    for (const particle of particles) {
      if (!particle.active) continue;
      particle.ttl -= dt;
      if (particle.ttl <= 0) {
        particle.active = false;
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.92;
      particle.vy *= 0.92;
    }
    for (const bolt of bolts) {
      if (!bolt.active) continue;
      bolt.ttl -= dt;
      if (bolt.ttl <= 0) bolt.active = false;
    }
    for (const floater of floaters) {
      if (!floater.active) continue;
      floater.ttl -= dt;
      floater.y -= 24 * dt;
      if (floater.ttl <= 0) floater.active = false;
    }
    return events;
  }

  reset();
  return { state, reset, step, startWave, placeTower, upgradeTower, sellTower, roadPoint, roadTotal: ROAD.total };
}
