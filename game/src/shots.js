// The screenshot scenes behind ?shot=start|play|boss|win. Each one plays the real
// rules forward from a fresh world, steered by a simple autopilot builder that spends
// its gold between waves, so the frame is what a real game looks like and the same
// seed always gives the same frame.
import { STEP, TOWERS } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 8;
const PLAY_WAVES = 3;
const STEP_LIMIT = 240000;

/** Plot coverage: how much road a tower on this plot can shoot at. */
function plotCoverage(world, plot) {
  let covered = 0;
  for (let distance = 0; distance < world.roadTotal; distance += 20) {
    const point = world.roadPoint(distance);
    if (Math.hypot(point.x - plot.x, point.y - plot.y) <= 140) covered += 1;
  }
  return covered;
}

function bestEmptyPlot(world) {
  let best = null;
  let bestScore = -1;
  for (const plot of world.state.plots) {
    if (plot.tower !== null) continue;
    const score = plotCoverage(world, plot);
    if (score > bestScore) {
      bestScore = score;
      best = plot;
    }
  }
  return best;
}

/**
 * Spend the build phase's gold: fill the best plots first, then upgrade the
 * cheapest tower, cycling types so the defence mixes damage, slow and splash.
 */
function autoBuild(world) {
  const types = ['ember', 'ember', 'frost', 'cannon', 'arc', 'ember', 'frost', 'cannon', 'arc', 'ember'];
  let guard = 0;
  while (guard < 40) {
    guard += 1;
    const plot = bestEmptyPlot(world);
    if (plot === null) break;
    const wave = world.state.wave;
    const type = types[Math.min(world.state.towers.length, types.length - 1)];
    if (world.state.gold < TOWERS[type].cost) break;
    if (wave < 2 && type !== 'ember') {
      if (!world.placeTower(plot, 'ember')) break;
    } else if (!world.placeTower(plot, type)) break;
  }
  // Upgrades while gold remains.
  let upgraded = true;
  while (upgraded) {
    upgraded = false;
    for (const tower of world.state.towers) {
      if (tower.level < 3 && world.upgradeTower(tower)) {
        upgraded = true;
        break;
      }
    }
  }
}

function runWave(world, limitSeconds) {
  world.startWave();
  const steps = Math.floor(limitSeconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    const events = world.step(STEP);
    if (events & (EVENT_OVER | EVENT_WIN)) return events;
    if (world.state.phase === 'build') return events;
  }
  return 0;
}

/** Play whole waves with the autopilot building between them. Returns the last events. */
function autoPlay(world, waves) {
  for (let wave = 0; wave < waves; wave += 1) {
    autoBuild(world);
    const events = runWave(world, 240);
    if (events & (EVENT_OVER | EVENT_WIN)) return events;
  }
  return 0;
}

function placeMany(world, placements) {
  for (const [plotIndex, type] of placements) {
    const plot = world.state.plots[plotIndex];
    if (plot !== undefined) world.placeTower(plot, type);
  }
}

/**
 * Set `world` to the named scene (start, play, boss or win; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    autoPlay(world, PLAY_WAVES);
    world.startWave();
    for (let index = 0; index < 25 / STEP; index += 1) {
      const events = world.step(STEP);
      if (events & (EVENT_OVER | EVENT_WIN)) break;
      if (world.state.phase === 'build') break;
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'boss') {
    world.state.gold = 1400;
    placeMany(world, [
      [7, 'ember'], [8, 'ember'], [12, 'frost'], [13, 'cannon'], [5, 'ember'], [9, 'arc'],
      [2, 'cannon'], [3, 'arc'], [17, 'frost'], [18, 'cannon'], [6, 'ember'], [16, 'arc'],
    ]);
    for (const tower of world.state.towers) {
      world.upgradeTower(tower);
      world.upgradeTower(tower);
    }
    world.state.wave = 11;
    world.startWave();
    for (let index = 0; index < 60 / STEP; index += 1) {
      const events = world.step(STEP);
      if (events & (EVENT_OVER | EVENT_WIN)) break;
      const boss = world.state.enemies.find((enemy) => enemy.active && enemy.type === 'boss');
      if (boss !== undefined && boss.distance > 900) break;
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'win') {
    let events = autoPlay(world, 12);
    if (!(events & EVENT_WIN)) {
      // The autopilot fell short: finish the fight with the towers it built.
      for (let index = 0; index < STEP_LIMIT && !(events & (EVENT_OVER | EVENT_WIN)); index += 1) {
        events = world.step(STEP);
        if (world.state.phase === 'build' && world.state.wave < 12) {
          autoBuild(world);
          events = runWave(world, 240);
        }
      }
    }
    const won = world.state.phase === 'won';
    return { screen: won ? SCREEN_WIN : SCREEN_OVER, best: world.state.score };
  }
  // start: a few towers and the first wave rolling behind the title panel.
  placeMany(world, [[7, 'ember'], [8, 'frost'], [12, 'ember']]);
  world.startWave();
  for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP);
  return { screen: SCREEN_TITLE, best: 0 };
}
