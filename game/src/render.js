// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the
// backdrop colour. Glow comes from layered alpha shapes, never from images.
import { FIELD, FONT, LIGHTHOUSE, PALETTE, PATH, PLOT, TOWERS, UPGRADE } from './config.js';
import { towerDamage, towerRange, upgradeCost } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** The build bar at the bottom and the top bar: where every clickable control lives. */
export const UI = {
  topBar: { x: 0, y: 0, width: 1280, height: 44 },
  bottomBar: { x: 0, y: 636, width: 1280, height: 84 },
  cardWidth: 150,
  cardHeight: 68,
  cardGap: 8,
  cardY: 644,
  waveButton: { x: 700, y: 644, width: 220, height: 68 },
  speedButton: { x: 1130, y: 6, width: 44, height: 32 },
  pauseButton: { x: 1180, y: 6, width: 44, height: 32 },
  muteButton: { x: 1230, y: 6, width: 44, height: 32 },
  towerPanel: { x: 940, y: 508, width: 324, height: 120 },
  upgradeButton: { x: 956, y: 580, width: 140, height: 36 },
  sellButton: { x: 1108, y: 580, width: 140, height: 36 },
};

const TOWER_KEYS = ['ember', 'frost', 'cannon', 'arc'];

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const cssX = clientX - rect.left;
    const cssY = clientY - rect.top;
    const scale = view.scale / (window.devicePixelRatio || 1);
    return { x: (cssX - view.x / (window.devicePixelRatio || 1)) / scale, y: (cssY - view.y / (window.devicePixelRatio || 1)) / scale };
  }

  function text(value, x, y, size, color, align, weight) {
    const key = `${weight || ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function drawSky(state) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(1, PALETTE.skyBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const star of state.stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(state.time * 2 + star.twinkle);
      context.globalAlpha = 0.3 + 0.5 * twinkle;
      context.fillStyle = '#dbe4ff';
      context.fillRect(star.x, star.y, star.size, star.size);
    }
    context.globalAlpha = 1;
    // Moon.
    context.fillStyle = '#f4f1de';
    context.beginPath();
    context.arc(1120, 70, 26, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#d9d4b8';
    context.beginPath();
    context.arc(1112, 64, 6, 0, Math.PI * 2);
    context.arc(1128, 78, 4, 0, Math.PI * 2);
    context.fill();
    // Distant hills.
    context.fillStyle = '#131c33';
    context.beginPath();
    context.moveTo(0, 620);
    context.quadraticCurveTo(300, 560, 640, 610);
    context.quadraticCurveTo(960, 650, 1280, 590);
    context.lineTo(1280, 720);
    context.lineTo(0, 720);
    context.closePath();
    context.fill();
  }

  function drawPath() {
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = PALETTE.pathEdge;
    context.lineWidth = 56;
    context.beginPath();
    context.moveTo(PATH[0][0], PATH[0][1]);
    for (let index = 1; index < PATH.length; index += 1) context.lineTo(PATH[index][0], PATH[index][1]);
    context.stroke();
    context.strokeStyle = PALETTE.path;
    context.lineWidth = 48;
    context.stroke();
    context.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    context.lineWidth = 2;
    context.setLineDash([14, 18]);
    context.stroke();
    context.setLineDash([]);
  }

  function drawPlots(state, ui) {
    for (const plot of state.plots) {
      const half = PLOT.size / 2;
      const hovered = ui.mouse.inside && Math.abs(ui.mouse.x - plot.x) <= half && Math.abs(ui.mouse.y - plot.y) <= half;
      context.fillStyle = hovered ? PLOT.plotHot : PALETTE.plot;
      roundRect(context, plot.x - half, plot.y - half, PLOT.size, PLOT.size, 8);
      context.fill();
      context.strokeStyle = hovered ? '#8fb4ff' : 'rgba(255, 255, 255, 0.18)';
      context.lineWidth = hovered ? 2 : 1;
      context.setLineDash([5, 4]);
      context.stroke();
      context.setLineDash([]);
      if (hovered && ui.selectedType !== '' && plot.tower === null) {
        const def = TOWERS[ui.selectedType];
        context.globalAlpha = ui.canAfford ? 0.55 : 0.3;
        context.fillStyle = ui.canAfford ? def.color : '#ef4444';
        context.beginPath();
        context.arc(plot.x, plot.y, 16, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
      }
    }
  }

  function drawLighthouse(state) {
    const { x, y, radius } = LIGHTHOUSE;
    // Rotating beam.
    const beamAngle = state.beamAngle;
    context.save();
    context.translate(x, y - 46);
    context.rotate(beamAngle);
    const beam = context.createLinearGradient(0, 0, 260, 0);
    beam.addColorStop(0, 'rgba(255, 233, 168, 0.28)');
    beam.addColorStop(1, 'rgba(255, 233, 168, 0)');
    context.fillStyle = beam;
    context.beginPath();
    context.moveTo(0, -8);
    context.lineTo(260, -34);
    context.lineTo(260, 34);
    context.lineTo(0, 8);
    context.closePath();
    context.fill();
    context.restore();
    // Rocks.
    context.fillStyle = '#232c44';
    context.beginPath();
    context.ellipse(x, y + 34, 58, 16, 0, 0, Math.PI * 2);
    context.fill();
    // Tower body.
    context.fillStyle = '#e8e0c8';
    context.beginPath();
    context.moveTo(x - 20, y + 30);
    context.lineTo(x - 13, y - 52);
    context.lineTo(x + 13, y - 52);
    context.lineTo(x + 20, y + 30);
    context.closePath();
    context.fill();
    context.fillStyle = '#c0392b';
    context.fillRect(x - 17, y + 2, 34, 12);
    context.fillRect(x - 15, y - 26, 30, 10);
    // Lamp room.
    context.fillStyle = '#2c3a55';
    context.fillRect(x - 12, y - 66, 24, 16);
    context.fillStyle = PALETTE.lamp;
    context.beginPath();
    context.arc(x, y - 58, 8, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 0.25 + 0.1 * Math.sin(state.time * 3);
    context.fillStyle = PALETTE.lamp;
    context.beginPath();
    context.arc(x, y - 58, 18, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    // Lighthouse health ring.
    const fraction = state.lives / 20;
    context.strokeStyle = fraction > 0.5 ? '#4ade80' : fraction > 0.25 ? '#f2c94c' : '#f87171';
    context.lineWidth = 4;
    context.beginPath();
    context.arc(x, y, radius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction);
    context.stroke();
  }

  function drawTower(tower, ui) {
    const { x, y } = tower.plot;
    const def = TOWERS[tower.type];
    const selected = ui.selectedTower === tower;
    if (selected) {
      context.strokeStyle = PALETTE.towerRing;
      context.lineWidth = 2;
      context.setLineDash([6, 6]);
      context.beginPath();
      context.arc(x, y, towerRange(tower.type, tower.level), 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
    }
    // Stone base.
    context.fillStyle = '#2c3a55';
    context.beginPath();
    context.arc(x, y, 20, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#3d4f73';
    context.beginPath();
    context.arc(x, y, 15, 0, Math.PI * 2);
    context.fill();
    // Type top.
    if (tower.type === 'ember') {
      context.fillStyle = def.color;
      context.beginPath();
      context.moveTo(x, y - 14);
      context.quadraticCurveTo(x + 10, y + 2, x + 5, y + 10);
      context.quadraticCurveTo(x, y + 5, x - 5, y + 10);
      context.quadraticCurveTo(x - 10, y + 2, x, y - 14);
      context.fill();
    } else if (tower.type === 'frost') {
      context.strokeStyle = def.color;
      context.lineWidth = 2;
      for (let arm = 0; arm < 3; arm += 1) {
        const angle = (arm * Math.PI) / 3;
        context.beginPath();
        context.moveTo(x - Math.cos(angle) * 11, y - Math.sin(angle) * 11);
        context.lineTo(x + Math.cos(angle) * 11, y + Math.sin(angle) * 11);
        context.stroke();
      }
      context.fillStyle = def.color;
      context.beginPath();
      context.arc(x, y, 4, 0, Math.PI * 2);
      context.fill();
    } else if (tower.type === 'cannon') {
      context.save();
      context.translate(x, y);
      context.rotate(tower.angle);
      context.fillStyle = '#1f2937';
      context.fillRect(0, -5, 24, 10);
      context.restore();
      context.fillStyle = def.color;
      context.beginPath();
      context.arc(x, y, 8, 0, Math.PI * 2);
      context.fill();
    } else {
      context.strokeStyle = def.color;
      context.lineWidth = 2;
      for (let ring = 0; ring < 3; ring += 1) {
        context.beginPath();
        context.arc(x, y, 5 + ring * 4, 0, Math.PI * 2);
        context.stroke();
      }
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(x, y, 3, 0, Math.PI * 2);
      context.fill();
    }
    if (tower.flash > 0) {
      context.globalAlpha = tower.flash / 0.12;
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(x, y, 12, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
    // Level pips.
    for (let level = 0; level < tower.level; level += 1) {
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(x - 8 + level * 8, y + 24, 2.5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawEnemy(enemy, state) {
    const wobble = Math.sin(state.time * 3 + enemy.wobble) * 2;
    context.fillStyle = enemy.color;
    context.globalAlpha = 0.9;
    context.beginPath();
    context.arc(enemy.x, enemy.y + wobble, enemy.radius, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    if (enemy.type === 'bat') {
      context.fillStyle = enemy.color;
      context.beginPath();
      context.ellipse(enemy.x - enemy.radius - 4, enemy.y - 6, 9, 4, -0.5, 0, Math.PI * 2);
      context.ellipse(enemy.x + enemy.radius + 4, enemy.y - 6, 9, 4, 0.5, 0, Math.PI * 2);
      context.fill();
    } else if (enemy.type === 'boss') {
      context.fillStyle = '#f5d0fe';
      for (let spike = 0; spike < 5; spike += 1) {
        const angle = -Math.PI / 2 + (spike - 2) * 0.35;
        context.beginPath();
        context.moveTo(enemy.x + Math.cos(angle) * enemy.radius, enemy.y + Math.sin(angle) * enemy.radius);
        context.lineTo(enemy.x + Math.cos(angle) * (enemy.radius + 10), enemy.y + Math.sin(angle) * (enemy.radius + 10));
        context.lineTo(enemy.x + Math.cos(angle + 0.3) * enemy.radius, enemy.y + Math.sin(angle + 0.3) * enemy.radius);
        context.fill();
      }
    }
    // Glowing eyes.
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(enemy.x - 4, enemy.y - 2 + wobble, 2.2, 0, Math.PI * 2);
    context.arc(enemy.x + 4, enemy.y - 2 + wobble, 2.2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#1f2937';
    context.beginPath();
    context.arc(enemy.x - 4, enemy.y - 2 + wobble, 1, 0, Math.PI * 2);
    context.arc(enemy.x + 4, enemy.y - 2 + wobble, 1, 0, Math.PI * 2);
    context.fill();
    if (enemy.slowTimer > 0) {
      context.strokeStyle = 'rgba(125, 211, 252, 0.8)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(enemy.x, enemy.y + wobble, enemy.radius + 4, 0, Math.PI * 2);
      context.stroke();
    }
    if (enemy.hp < enemy.maxHp) {
      const width = enemy.radius * 2;
      const fraction = Math.max(0, enemy.hp / enemy.maxHp);
      context.fillStyle = 'rgba(0, 0, 0, 0.55)';
      context.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 10, width, 4);
      context.fillStyle = fraction > 0.5 ? '#4ade80' : fraction > 0.25 ? '#f2c94c' : '#f87171';
      context.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 10, width * fraction, 4);
    }
  }

  function drawProjectiles(state) {
    for (const projectile of state.projectiles) {
      if (!projectile.active) continue;
      context.fillStyle = projectile.color;
      context.beginPath();
      context.arc(projectile.x, projectile.y, projectile.kind === 'cannon' ? 7 : 5, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 0.4;
      context.beginPath();
      context.arc(projectile.x, projectile.y, projectile.kind === 'cannon' ? 11 : 8, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
    for (const bolt of state.bolts) {
      if (!bolt.active) continue;
      context.globalAlpha = bolt.ttl / 0.14;
      context.strokeStyle = bolt.color;
      context.lineWidth = 3;
      context.beginPath();
      for (let index = 0; index < bolt.points.length; index += 1) {
        const point = bolt.points[index];
        if (index === 0) context.moveTo(point.x, point.y);
        else {
          const previous = bolt.points[index - 1];
          const midX = (previous.x + point.x) / 2 + (index % 2 === 0 ? 6 : -6);
          const midY = (previous.y + point.y) / 2 + (index % 2 === 0 ? -6 : 6);
          context.lineTo(midX, midY);
          context.lineTo(point.x, point.y);
        }
      }
      context.stroke();
      context.globalAlpha = 1;
    }
    for (const particle of state.particles) {
      if (!particle.active) continue;
      context.globalAlpha = Math.max(0, particle.ttl / particle.maxTtl);
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    for (const floater of state.floaters) {
      if (!floater.active) continue;
      context.globalAlpha = Math.min(1, floater.ttl / 0.5);
      text(floater.text, floater.x, floater.y, 16, floater.color, 'center', 'bold ');
      context.globalAlpha = 1;
    }
  }

  function drawTopBar(state, ui) {
    context.fillStyle = 'rgba(16, 24, 39, 0.92)';
    context.fillRect(0, 0, FIELD.width, UI.topBar.height);
    text(`● ${state.gold}g`, 20, 30, 22, PALETTE.gold, 'left', 'bold ');
    text(`♥ ${state.lives}`, 150, 30, 22, PALETTE.heart, 'left', 'bold ');
    text(`Wave ${state.wave}/${12}`, 270, 30, 22, PALETTE.text, 'left', 'bold ');
    text(`Score ${state.score}`, 420, 30, 22, PALETTE.text, 'left');
    text(state.phase === 'wave' ? `Shadows left: ${state.enemiesLeft}` : state.phase === 'won' ? 'All waves cleared!' : state.phase === 'lost' ? 'The light has fallen' : state.wave === 0 ? 'Build, then start wave 1' : 'Build phase — place towers', 560, 30, 20, PALETTE.muted, 'left');
    // Speed, pause, mute buttons.
    const buttons = [
      [UI.speedButton, ui.speed === 2 ? '2×' : '1×'],
      [UI.pauseButton, 'II'],
      [UI.muteButton, ui.muted ? '✕' : '♪'],
    ];
    for (const [rect, label] of buttons) {
      context.fillStyle = PALETTE.panelEdge;
      roundRect(context, rect.x, rect.y, rect.width, rect.height, 6);
      context.fill();
      text(label, rect.x + rect.width / 2, rect.y + 23, 18, PALETTE.text, 'center', 'bold ');
    }
  }

  function drawBuildBar(state, ui) {
    context.fillStyle = 'rgba(16, 24, 39, 0.92)';
    context.fillRect(0, UI.bottomBar.y, FIELD.width, UI.bottomBar.height);
    TOWER_KEYS.forEach((key, index) => {
      const def = TOWERS[key];
      const x = 16 + index * (UI.cardWidth + UI.cardGap);
      const y = UI.cardY;
      const selected = ui.selectedType === key;
      const afford = state.gold >= def.cost;
      context.fillStyle = selected ? '#2e4066' : PALETTE.panel;
      roundRect(context, x, y, UI.cardWidth, UI.cardHeight, 8);
      context.fill();
      context.strokeStyle = selected ? def.color : PALETTE.panelEdge;
      context.lineWidth = selected ? 2 : 1;
      context.stroke();
      context.fillStyle = def.color;
      context.beginPath();
      context.arc(x + 18, y + 20, 9, 0, Math.PI * 2);
      context.fill();
      text(def.name, x + 34, y + 24, 15, PALETTE.text, 'left', 'bold ');
      text(`${def.cost}g  [${index + 1}]`, x + 34, y + 44, 14, afford ? PALETTE.gold : '#f87171', 'left');
      text(def.blurb, x + 10, y + 61, 12, PALETTE.muted, 'left');
    });
    // Wave button.
    const wave = UI.waveButton;
    const canStart = state.phase === 'build' && state.wave < 12;
    context.fillStyle = canStart ? '#166534' : PALETTE.panelEdge;
    roundRect(context, wave.x, wave.y, wave.width, wave.height, 8);
    context.fill();
    text(canStart ? `▶ Start Wave ${state.wave + 1}` : state.phase === 'wave' ? `Wave ${state.wave} — hold the light!` : 'All waves cleared!', wave.x + wave.width / 2, wave.y + 30, 20, PALETTE.text, 'center', 'bold ');
    text(canStart ? `Next: ${wavePreview(state.wave + 1)}` : state.phase === 'wave' ? `${state.enemiesLeft} shadows remain` : '', wave.x + wave.width / 2, wave.y + 54, 13, PALETTE.muted, 'center');
    // Selected tower panel.
    if (ui.selectedTower !== null) {
      const tower = ui.selectedTower;
      const def = TOWERS[tower.type];
      const panel = UI.towerPanel;
      context.fillStyle = PALETTE.panel;
      roundRect(context, panel.x, panel.y, panel.width, panel.height, 8);
      context.fill();
      context.strokeStyle = PALETTE.panelEdge;
      context.stroke();
      text(`${def.name}  Lv ${tower.level}`, panel.x + 16, panel.y + 26, 17, PALETTE.text, 'left', 'bold ');
      text(`Damage ${Math.round(towerDamage(tower.type, tower.level))}  ·  Range ${towerRange(tower.type, tower.level)}`, panel.x + 16, panel.y + 50, 14, PALETTE.muted, 'left');
      const upgrade = UI.upgradeButton;
      const canUpgrade = tower.level < UPGRADE.maxLevel && state.gold >= upgradeCost(tower.type, tower.level);
      context.fillStyle = canUpgrade ? '#166534' : PALETTE.panelEdge;
      roundRect(context, upgrade.x, upgrade.y, upgrade.width, upgrade.height, 6);
      context.fill();
      text(tower.level < UPGRADE.maxLevel ? `Upgrade ${upgradeCost(tower.type, tower.level)}g` : 'Max level', upgrade.x + upgrade.width / 2, upgrade.y + 24, 14, PALETTE.text, 'center', 'bold ');
      const sell = UI.sellButton;
      context.fillStyle = '#7f1d1d';
      roundRect(context, sell.x, sell.y, sell.width, sell.height, 6);
      context.fill();
      text(`Sell +${Math.floor(tower.invested * 0.7)}g`, sell.x + sell.width / 2, sell.y + 24, 14, PALETTE.text, 'center', 'bold ');
    }
  }

  function wavePreview(n) {
    if (n > 12) return '—';
    const parts = [];
    parts.push(`${6 + 2 * n} wisps`);
    if (n >= 2) parts.push(`${2 + n} crawlers`);
    if (n >= 3) parts.push(`${1 + n} bats`);
    if (n >= 5) parts.push(`${1 + Math.floor(n / 2)} brutes`);
    if (n === 12) parts.push('THE GLOOMLORD');
    return parts.join(', ');
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 32;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(8, 12, 24, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    roundRect(context, x, y, width, height, 12);
    context.fill();
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 2;
    context.stroke();
    text(title, FIELD.width / 2, y + 64, 42, PALETTE.text, 'center', 'bold ');
    lines.forEach((line, index) => {
      text(line, FIELD.width / 2, y + 108 + index * 32, 20, PALETTE.muted, 'center');
    });
    text(prompt, FIELD.width / 2, y + height - 30, 22, PALETTE.gold, 'center', 'bold ');
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, ui) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0b1026';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawSky(state);
    drawPath();
    drawPlots(state, ui);
    drawLighthouse(state);
    for (const tower of state.towers) drawTower(tower, ui);
    for (const enemy of state.enemies) if (enemy.active) drawEnemy(enemy, state);
    drawProjectiles(state);
    if (screen === SCREEN_TITLE) {
      drawPanel(
        'LUMEN KEEP',
        ['The shadows march on the last lighthouse. Hold the light.', 'Click a tower card, then click a plot to build it.', 'Start each wave when you are ready — survive all 12 waves.', `Best score: ${ui.best}`],
        'Click or press Enter to play',
        '#f2c94c',
      );
      return;
    }
    drawTopBar(state, ui);
    drawBuildBar(state, ui);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The shadows wait for no one — except now.'], 'Press P or click to resume', '#7dd3fc');
    } else if (screen === SCREEN_OVER) {
      drawPanel(
        'The light has fallen',
        [`The shadows reached the lighthouse on wave ${state.wave}.`, `Score ${state.score}  ·  Best ${ui.best}`],
        'Click or press Enter to try again',
        '#f87171',
      );
    } else if (screen === SCREEN_WIN) {
      drawPanel(
        'The dawn breaks!',
        [`All 12 waves held. The lighthouse stands.`, `Score ${state.score} (kills ${state.kills} · lives bonus ${state.winBonus})  ·  Best ${ui.best}`],
        'Click or press Enter to play again',
        '#4ade80',
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toLogical };
}
