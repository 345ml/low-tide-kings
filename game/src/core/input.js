// Keyboard and mouse state. Key presses and clicks are remembered twice over: once for the
// menus, which read them every drawn frame, and once for the simulation, which reads them on its
// own fixed steps, so neither misses a press nor sees one twice.

const BLOCKED_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'F5']);

export function createInput(canvas) {
  const held = new Set();
  const framePressed = new Set();
  const stepPressed = new Set();
  const pointer = { x: 0, y: 0, down: false, frameClick: false, stepClick: false, frameWheel: 0, stepWheel: 0 };
  let touched = false;

  function place(event) {
    const box = canvas.getBoundingClientRect();
    pointer.x = (event.clientX - box.left) * (canvas.width / Math.max(1, box.width));
    pointer.y = (event.clientY - box.top) * (canvas.height / Math.max(1, box.height));
  }

  window.addEventListener('keydown', (event) => {
    if (BLOCKED_KEYS.has(event.code)) event.preventDefault();
    if (!event.repeat) {
      framePressed.add(event.code);
      stepPressed.add(event.code);
      touched = true;
    }
    held.add(event.code);
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => {
    held.clear();
    pointer.down = false;
  });
  canvas.addEventListener('mousemove', place);
  canvas.addEventListener('mousedown', (event) => {
    place(event);
    if (event.button !== 0) return;
    pointer.down = true;
    pointer.frameClick = true;
    pointer.stepClick = true;
    touched = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) pointer.down = false;
  });
  canvas.addEventListener('wheel', (event) => {
    pointer.frameWheel += Math.sign(event.deltaY);
    pointer.stepWheel += Math.sign(event.deltaY);
    event.preventDefault();
  }, { passive: false });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function view(pressedSet, clickKey, wheelKey) {
    return {
      mouse: {
        get x() { return pointer.x; },
        get y() { return pointer.y; },
        get down() { return pointer.down; },
        get clicked() { return pointer[clickKey]; },
        get wheel() { return pointer[wheelKey]; },
      },
      /** True while any of the given key codes is held. */
      down(...codes) {
        for (const code of codes) if (held.has(code)) return true;
        return false;
      },
      /** True when any of the given key codes went down since this view was last cleared. */
      pressed(...codes) {
        for (const code of codes) if (pressedSet.has(code)) return true;
        return false;
      },
      /** -1, 0 or 1 for two opposing groups of keys. */
      axis(negative, positive) {
        let value = 0;
        for (const code of negative) if (held.has(code)) value = -1;
        for (const code of positive) if (held.has(code)) value += 1;
        return Math.max(-1, Math.min(1, value));
      },
    };
  }

  const frame = view(framePressed, 'frameClick', 'frameWheel');
  const step = view(stepPressed, 'stepClick', 'stepWheel');
  return {
    /** What the menus read, once per drawn frame. */
    frame,
    /** What the simulation reads, once per fixed step. */
    step,
    /** True once after any key or click since the last endFrame (unlocks audio). */
    touched: () => touched,
    endFrame() {
      framePressed.clear();
      pointer.frameClick = false;
      pointer.frameWheel = 0;
      touched = false;
    },
    endStep() {
      stepPressed.clear();
      pointer.stepClick = false;
      pointer.stepWheel = 0;
    },
  };
}

/** An input that never presses anything: drives the title backdrop and the screenshot scenes. */
export function createIdleInput() {
  return {
    mouse: { x: 0, y: 0, down: false, clicked: false, wheel: 0 },
    down: () => false,
    pressed: () => false,
    axis: () => 0,
  };
}
