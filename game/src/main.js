// Low Tide Kings: boot and the main loop. Builds Marazul Bay, shows the title screen over a
// living city, then runs the game: fixed 1/60 s simulation steps, one drawn frame per display
// frame, and the screens around play (pause, map, controls, shop, dialogue).
//
// ?shot=start|drive|chase|shootout (with &seed=N) stages that scene instead, paints it and sets
// window.__shotReady for a screenshot.
import { STEP } from './core/config.js';
import { createIdleInput, createInput } from './core/input.js';
import { generateCity } from './city/cityGenerator.js';
import { resizeCamera } from './render/camera.js';
import { createWorldRenderer } from './render/worldRenderer.js';
import { createWorld, stepWorld } from './world/gameWorld.js';
import { SHOP_ITEMS, buyShopItem } from './world/services.js';
import { eraseSave, hasSave, readSave, writeSave } from './save/saveGame.js';
import { createAudio, createSilentAudio } from './audio/soundEffects.js';
import { createRadio } from './audio/radio.js';
import { drawHud } from './ui/hud.js';
import { createCityMap, drawFullMap } from './ui/minimap.js';
import { PAUSE_ITEMS, TITLE_ITEMS, drawControls, drawPause, drawShop, drawTitle } from './ui/menus.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.1;
const UP = ['KeyW', 'ArrowUp'];
const DOWN = ['KeyS', 'ArrowDown'];
const CONFIRM = ['Enter', 'NumpadEnter', 'Space'];
const BACK = ['Escape', 'KeyP'];

const params = new URLSearchParams(window.location.search);
const canvas = document.getElementById('game');
const status = document.getElementById('status');
const ctx = canvas.getContext('2d');
const city = generateCity();
const renderer = createWorldRenderer(city);
const cityMap = createCityMap(city);

function fitCanvas(camera) {
  const width = Math.max(640, window.innerWidth);
  const height = Math.max(360, window.innerHeight);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  if (camera) resizeCamera(camera, width, height);
}

function announce(message) {
  if (status.textContent !== message) status.textContent = message;
}

function runShot(name) {
  const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;
  fitCanvas(null);
  const scene = stageShot(name, city, seed, canvas.width, canvas.height);
  let painted = 0;
  function paint() {
    fitCanvas(scene.world.camera);
    renderer.draw(ctx, scene.world);
    if (scene.title) drawTitle(ctx, canvas.width, canvas.height, 0, false, 1);
    else drawHud(ctx, scene.world, cityMap, canvas.width, canvas.height);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const idle = createIdleInput();
  const audio = createAudio();
  const radio = createRadio(audio);
  const backdrop = createWorld(city, { mode: 'attract', audio: createSilentAudio() });
  let world = null;
  /** 'title', 'play', 'pause', 'map' or 'controls'. */
  let screen = 'title';
  let returnTo = 'title';
  let menuIndex = hasSave() ? 1 : 0;
  let accumulator = 0;
  let last = performance.now();
  let pointerX = 0;
  let pointerY = 0;

  function startGame(save) {
    world = createWorld(city, { mode: 'play', audio, save });
    fitCanvas(world.camera);
    screen = 'play';
    accumulator = 0;
    if (save) world.toast('Welcome back to Marazul Bay.');
    announce('Playing Low Tide Kings.');
  }

  function saveNow(message) {
    if (world.mission || world.wanted.stars > 0) {
      world.toast('You can only save with no mission running and no wanted level.');
      return;
    }
    world.toast(writeSave(world) ? message : 'Saving is not available in this browser window.');
  }

  function moveMenu(count, skip) {
    const keys = input.frame;
    let move = 0;
    if (keys.pressed(...UP)) move = -1;
    if (keys.pressed(...DOWN)) move = 1;
    if (!move) return;
    do menuIndex = (menuIndex + move + count) % count;
    while (skip && skip(menuIndex));
    audio.play('click');
  }

  function handleTitle() {
    const keys = input.frame;
    const saved = hasSave();
    moveMenu(TITLE_ITEMS.length, (n) => n === 1 && !saved);
    // The mouse works too: point at an item, click to choose it.
    const u = canvas.height / 720;
    const row = Math.floor((keys.mouse.y / u - 425) / 50);
    const over = keys.mouse.x > 60 * u && keys.mouse.x < 420 * u && row >= 0 && row < TITLE_ITEMS.length && !(row === 1 && !saved);
    if (over && (keys.mouse.clicked || keys.mouse.x !== pointerX || keys.mouse.y !== pointerY)) menuIndex = row;
    pointerX = keys.mouse.x;
    pointerY = keys.mouse.y;
    if (!keys.pressed(...CONFIRM) && !(over && keys.mouse.clicked)) return;
    audio.play('buy');
    if (menuIndex === 0) {
      eraseSave();
      startGame(null);
    } else if (menuIndex === 1) startGame(readSave());
    else {
      returnTo = 'title';
      screen = 'controls';
    }
  }

  function handlePause() {
    const keys = input.frame;
    moveMenu(PAUSE_ITEMS.length, null);
    if (keys.pressed(...BACK)) {
      screen = 'play';
      return;
    }
    if (!keys.pressed(...CONFIRM)) return;
    audio.play('buy');
    if (menuIndex === 0) screen = 'play';
    else if (menuIndex === 1) {
      returnTo = 'pause';
      screen = 'map';
    } else if (menuIndex === 2) {
      returnTo = 'pause';
      screen = 'controls';
    } else if (menuIndex === 3) {
      saveNow('Game saved.');
      screen = 'play';
    } else {
      world = null;
      screen = 'title';
      menuIndex = hasSave() ? 1 : 0;
      announce('Low Tide Kings. Press Enter to start.');
    }
  }

  function handleShop() {
    const keys = input.frame;
    const shop = world.shop;
    if (keys.pressed(...UP)) shop.index = (shop.index + SHOP_ITEMS.length - 1) % SHOP_ITEMS.length;
    if (keys.pressed(...DOWN)) shop.index = (shop.index + 1) % SHOP_ITEMS.length;
    if (keys.pressed('Enter', 'NumpadEnter')) buyShopItem(world, SHOP_ITEMS[shop.index]);
    if (keys.pressed('Escape', 'KeyP', 'KeyF', 'KeyE')) world.shop = null;
    input.endStep();
  }

  function handleDialogue() {
    const keys = input.frame;
    if (!keys.pressed(...CONFIRM) && !keys.mouse.clicked) return;
    const dialogue = world.dialogue;
    input.endStep();
    dialogue.index += 1;
    audio.play('click');
    if (dialogue.index >= dialogue.lines.length) world.dialogue = null;
  }

  /** Keys that work during play but are not part of the simulation. Returns false when play is held up. */
  function handlePlay() {
    const keys = input.frame;
    if (world.shop) {
      handleShop();
      return false;
    }
    if (world.dialogue) {
      handleDialogue();
      return world.dialogue === null;
    }
    if (keys.pressed(...BACK)) {
      screen = 'pause';
      menuIndex = 0;
      return false;
    }
    if (keys.pressed('KeyM')) {
      returnTo = 'play';
      screen = 'map';
      return false;
    }
    if (keys.pressed('F5')) saveNow('Quick save done.');
    if (keys.pressed('KeyR') && world.player.vehicle) world.toast(`Radio: ${radio.next()}`);
    return true;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (input.touched()) audio.unlock();
    fitCanvas(world ? world.camera : backdrop.camera);

    let running = false;
    if (screen === 'title') handleTitle();
    else if (screen === 'pause') handlePause();
    else if (screen === 'map' || screen === 'controls') {
      if (input.frame.pressed(...BACK, ...CONFIRM, 'KeyM')) screen = returnTo;
    } else running = handlePlay();

    if (screen === 'title' || (screen === 'controls' && !world)) {
      accumulator = Math.min(accumulator + elapsed, 0.1);
      while (accumulator >= STEP) {
        stepWorld(backdrop, idle, STEP);
        accumulator -= STEP;
      }
    } else if (running && screen === 'play') {
      accumulator += elapsed;
      while (accumulator >= STEP && !world.dialogue && !world.shop) {
        stepWorld(world, input.step, STEP);
        input.endStep();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      input.endStep();
      // A mission title should not sit on screen for the whole of a conversation.
      if (world && world.banner && world.dialogue) {
        world.banner.time -= elapsed;
        if (world.banner.time <= 0) world.banner = null;
      }
    }

    const shown = world ?? backdrop;
    renderer.draw(ctx, shown);
    const width = canvas.width;
    const height = canvas.height;
    if (world) {
      drawHud(ctx, world, cityMap, width, height);
      if (world.shop) drawShop(ctx, width, height, world);
      if (screen === 'pause') drawPause(ctx, width, height, menuIndex, world);
      else if (screen === 'map') drawFullMap(ctx, cityMap, world, width, height);
    } else if (screen === 'title') drawTitle(ctx, width, height, menuIndex, hasSave(), now / 1000);
    if (screen === 'controls') drawControls(ctx, width, height);

    audio.setListener(shown.focus.x, shown.focus.y);
    audio.update(world && screen === 'play' ? world : null);
    radio.update(Boolean(world && screen === 'play' && world.player.vehicle && !world.respawn));
    input.endFrame();
  }

  // Leaving the tab pauses the game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'pause';
      menuIndex = 0;
    }
  });
  window.addEventListener('resize', () => fitCanvas(world ? world.camera : backdrop.camera));
  // A small handle for automated play-testing from the browser console.
  window.lowTideKings = { get world() { return world; }, get screen() { return screen; } };

  announce('Low Tide Kings. Press Enter to start.');
  requestAnimationFrame(frame);
}

const shot = params.get('shot');
if (shot) runShot(shot);
else runGame();
