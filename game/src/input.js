// Mouse and keyboard input for a tower defense. Pointer moves track the hovered cell
// in logical coordinates; clicks and one-shot key presses are queued and taken once
// by the loop, so a press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_START = 4;
export const ACTION_MUTE = 8;
export const ACTION_SPEED = 16;

const TOWER_KEYS = new Set(['Digit1', 'Digit2', 'Digit3', 'Digit4']);
const CONFIRM = new Set(['Enter']);
const START = new Set(['Space']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const SPEED = new Set(['KeyF']);

export function createInput(canvas, toLogical) {
  const mouse = { x: -1, y: -1, inside: false };
  const clicks = [];
  let actions = 0;
  let towerPick = '';

  function updateMouse(event) {
    const point = toLogical(event.clientX, event.clientY);
    mouse.x = point.x;
    mouse.y = point.y;
    mouse.inside = point.x >= 0 && point.x <= 1280 && point.y >= 0 && point.y <= 720;
  }

  canvas.addEventListener('pointermove', updateMouse);
  canvas.addEventListener('pointerdown', (event) => {
    updateMouse(event);
    clicks.push({ x: mouse.x, y: mouse.y });
  });
  canvas.addEventListener('pointerleave', () => {
    mouse.inside = false;
  });

  window.addEventListener('keydown', (event) => {
    if (TOWER_KEYS.has(event.code)) {
      towerPick = event.code.slice(-1);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (START.has(event.code)) {
      if (!event.repeat) actions |= ACTION_START;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (SPEED.has(event.code)) {
      if (!event.repeat) actions |= ACTION_SPEED;
    } else {
      return;
    }
    event.preventDefault();
  });

  return {
    mouse,
    /** Clicks since the last call, in logical coordinates. */
    takeClicks() {
      const taken = clicks.slice();
      clicks.length = 0;
      return taken;
    },
    /** One-shot action flags since the last call. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The tower hotkey pressed since the last call ('1'..'4' or ''). */
    takeTowerPick() {
      const taken = towerPick;
      towerPick = '';
      return taken;
    },
  };
}
