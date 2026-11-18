// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, game over and win.
//
// ?seed=N fixes the random pattern. ?shot=start|play|boss|win (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.
import { BEST_KEY, START, STEP, TOWERS } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import {
  createWorld,
  EVENT_KILL,
  EVENT_LEAK,
  EVENT_OVER,
  EVENT_SHOT,
  EVENT_WAVE_CLEAR,
  EVENT_WAVE_START,
  EVENT_WIN,
  upgradeCost,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_SPEED, ACTION_START, createInput } from './input.js';
import { SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN, UI, createRenderer } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const TOWER_KEYS = ['ember', 'frost', 'cannon', 'arc'];

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, {
      best: scene.best,
      selectedType: '',
      selectedTower: null,
      mouse: { x: -1, y: -1, inside: false },
      canAfford: false,
      speed: 1,
      muted: false,
    });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (x, y) => renderer.toLogical(x, y));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let selectedType = '';
  let selectedTower = null;
  let speed = 1;
  let muted = false;
  let lastCoinAt = 0;
  let lastShotAt = 0;

  function announce(message) {
    status.textContent = message;
  }

  /** The title screen's living backdrop: a few towers and wave 1 on a loop. */
  function resetAttract() {
    world.reset();
    const plots = world.state.plots;
    world.placeTower(plots[7], 'ember');
    world.placeTower(plots[8], 'frost');
    world.placeTower(plots[12], 'ember');
    world.startWave();
  }

  function startGame() {
    world.reset();
    selectedType = '';
    selectedTower = null;
    speed = 1;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Build towers, then start wave 1.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won ? `Victory. Score ${world.state.score}.` : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function playEvents(events, now) {
    if (events & EVENT_SHOT && now - lastShotAt > 90) {
      lastShotAt = now;
      audio.shoot(world.state.lastShotKind);
    }
    if (events & EVENT_KILL && now - lastCoinAt > 100) {
      lastCoinAt = now;
      audio.coin();
    }
    if (events & EVENT_LEAK) audio.leak();
    if (events & EVENT_WAVE_CLEAR) audio.horn();
    if (events & EVENT_WAVE_START) audio.horn();
    if (events & EVENT_WIN) audio.win();
    if (events & EVENT_OVER) audio.lose();
  }

  function inside(rect, point) {
    return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
  }

  function plotAt(point) {
    for (const plot of world.state.plots) {
      if (Math.abs(point.x - plot.x) <= 28 && Math.abs(point.y - plot.y) <= 28) return plot;
    }
    return null;
  }

  function handleClick(point) {
    audio.unlock();
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      startGame();
      return;
    }
    if (screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
      return;
    }
    if (inside(UI.speedButton, point)) {
      speed = speed === 1 ? 2 : 1;
      return;
    }
    if (inside(UI.pauseButton, point)) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    if (inside(UI.muteButton, point)) {
      muted = audio.toggleMute();
      return;
    }
    // Tower cards.
    for (let index = 0; index < TOWER_KEYS.length; index += 1) {
      const card = { x: 16 + index * (UI.cardWidth + UI.cardGap), y: UI.cardY, width: UI.cardWidth, height: UI.cardHeight };
      if (inside(card, point)) {
        const key = TOWER_KEYS[index];
        selectedType = selectedType === key ? '' : key;
        selectedTower = null;
        return;
      }
    }
    // Wave button.
    if (inside(UI.waveButton, point)) {
      if (world.startWave()) {
        announce(`Wave ${world.state.wave} begins.`);
      }
      return;
    }
    // Selected tower panel.
    if (selectedTower !== null) {
      if (inside(UI.upgradeButton, point)) {
        if (world.upgradeTower(selectedTower)) audio.build();
        return;
      }
      if (inside(UI.sellButton, point)) {
        world.sellTower(selectedTower);
        selectedTower = null;
        audio.build();
        return;
      }
    }
    // Build plots.
    const plot = plotAt(point);
    if (plot !== null) {
      if (plot.tower !== null) {
        selectedTower = plot.tower;
        selectedType = '';
      } else if (selectedType !== '') {
        if (world.placeTower(plot, selectedType)) {
          audio.build();
        }
      } else {
        selectedTower = null;
      }
      return;
    }
    selectedTower = null;
  }

  function handleActions() {
    const actions = input.takeActions();
    const pick = input.takeTowerPick();
    if (pick !== '') {
      const index = Number.parseInt(pick, 10) - 1;
      if (index >= 0 && index < TOWER_KEYS.length) {
        selectedType = selectedType === TOWER_KEYS[index] ? '' : TOWER_KEYS[index];
        selectedTower = null;
      }
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) startGame();
    else if (actions & ACTION_START && screen === SCREEN_PLAY) {
      if (world.state.phase === 'build') {
        if (world.startWave()) announce(`Wave ${world.state.wave} begins.`);
      } else {
        speed = speed === 1 ? 2 : 1;
      }
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (actions & ACTION_MUTE) muted = audio.toggleMute();
    if (actions & ACTION_SPEED && screen === SCREEN_PLAY) speed = speed === 1 ? 2 : 1;
    for (const click of input.takeClicks()) handleClick(click);
  }

  function step(now) {
    if (screen === SCREEN_TITLE) {
      const events = world.step(STEP);
      if (world.state.phase === 'build' && world.state.wave >= 1) world.startWave();
      if (world.state.lives <= 0 || world.state.wave > 3) resetAttract();
      return events;
    }
    const events = world.step(STEP);
    playEvents(events, now);
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
    return events;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME) * speed;
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(now);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const mouse = input.mouse;
    const hoveredPlot = plotAt(mouse);
    renderer.draw(world.state, screen, {
      best,
      selectedType,
      selectedTower,
      mouse,
      canAfford: selectedType !== '' && world.state.gold >= TOWERS[selectedType].cost,
      speed,
      muted,
      hoveredPlot,
    });
  }

  // Leaving the tab pauses a running game rather than letting shadows walk unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // Test hooks: the play-tester reads the live state through window.__game.
  window.__game = {
    state: world.state,
    world,
    get screen() {
      return screen;
    },
    startGame,
  };

  resetAttract();
  announce('Lumen Keep. Press Enter or click to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
