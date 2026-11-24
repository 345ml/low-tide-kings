// Night lighting: a sheet of darkness over the streets with pools of light cut out of it under
// street lamps, headlights, fires and the helicopter's searchlight, then coloured glows on top.
const SCALE = 0.5;

export function createLighting() {
  const canvas = document.createElement('canvas');
  return { canvas, ctx: canvas.getContext('2d') };
}

function pool(ctx, x, y, radius, strength) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, `rgba(0,0,0,${strength})`);
  glow.addColorStop(0.55, `rgba(0,0,0,${strength * 0.55})`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function glowAt(ctx, x, y, radius, color, alpha) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, `rgba(${color},${alpha})`);
  glow.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function litVehicle(vehicle) {
  return !vehicle.wrecked && (vehicle.driver !== null || vehicle.siren);
}

/** Lay the darkness for this hour over what has been drawn so far (the ground and everyone on it). */
export function drawDarkness(mainCtx, lighting, world, sky, lamps, vehicles) {
  if (sky.darkness < 0.03) return;
  const camera = world.camera;
  const { canvas, ctx } = lighting;
  const width = Math.ceil(camera.width * SCALE);
  const height = Math.ceil(camera.height * SCALE);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = `rgba(${sky.red},${sky.green},${sky.blue},${sky.darkness})`;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'destination-out';
  const scale = camera.scale * SCALE;
  ctx.setTransform(scale, 0, 0, scale, width / 2 - (camera.x + camera.shakeX + camera.kickX) * scale, height / 2 - (camera.y + camera.shakeY + camera.kickY) * scale);
  const strength = sky.glow;
  if (sky.lampsOn) for (const lamp of lamps) pool(ctx, lamp.x, lamp.y, 150, 0.8 * strength);
  for (const vehicle of vehicles) {
    if (vehicle.burning > 0) pool(ctx, vehicle.x, vehicle.y, 130, 0.9);
    if (!litVehicle(vehicle)) continue;
    const cos = Math.cos(vehicle.angle);
    const sin = Math.sin(vehicle.angle);
    pool(ctx, vehicle.x + cos * 70, vehicle.y + sin * 70, 80, 0.75 * strength);
    pool(ctx, vehicle.x + cos * 150, vehicle.y + sin * 150, 105, 0.6 * strength);
    if (vehicle.siren) pool(ctx, vehicle.x, vehicle.y, 110, 0.7 * strength);
  }
  for (const flash of world.fx.flashes) pool(ctx, flash.x, flash.y, flash.radius * 2.2, 0.9 * (1 - flash.age / flash.life));
  for (const marker of world.markers) if (marker.radius > 0) pool(ctx, marker.x, marker.y, 70, 0.5 * strength);
  if (world.mode !== 'attract') pool(ctx, world.focus.x, world.focus.y, 95, 0.4 * strength);
  const heli = world.police.heli;
  if (heli) pool(ctx, heli.lightX, heli.lightY, 150, 0.95);
  mainCtx.setTransform(1, 0, 0, 1, 0, 0);
  mainCtx.drawImage(canvas, 0, 0, camera.width, camera.height);
}

/** Coloured light added on top: warm lamps, headlight beams, red and blue police flashes. */
export function drawGlows(ctx, world, sky, lamps, vehicles) {
  const strength = sky.glow;
  ctx.globalCompositeOperation = 'lighter';
  if (sky.lampsOn) for (const lamp of lamps) glowAt(ctx, lamp.x, lamp.y, 70, '255,214,140', 0.3 * strength);
  for (const vehicle of vehicles) {
    if (!litVehicle(vehicle)) continue;
    const cos = Math.cos(vehicle.angle);
    const sin = Math.sin(vehicle.angle);
    if (strength > 0.05) {
      glowAt(ctx, vehicle.x + cos * 62, vehicle.y + sin * 62, 58, '255,240,190', 0.34 * strength);
      glowAt(ctx, vehicle.x - cos * (vehicle.kind.length * 0.5 + 4), vehicle.y - sin * (vehicle.kind.length * 0.5 + 4), 16, '255,40,40', 0.5 * strength);
    }
    if (vehicle.siren) {
      const red = Math.floor(world.clock * 7) % 2 === 0;
      glowAt(ctx, vehicle.x - sin * 10 * (red ? 1 : -1), vehicle.y + cos * 10 * (red ? 1 : -1), 90, red ? '255,50,50' : '70,120,255', 0.28 + 0.3 * strength);
    }
  }
  const heli = world.police.heli;
  if (heli) glowAt(ctx, heli.lightX, heli.lightY, 135, '235,245,255', 0.22 + 0.25 * strength);
  ctx.globalCompositeOperation = 'source-over';
}
