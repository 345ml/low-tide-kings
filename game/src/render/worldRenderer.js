// Draws one frame of the world in order: sea, ground, stains, shadows, low props, people and
// vehicles, effects, the night's darkness, then everything tall (buildings, palms, lamps) sorted
// from the edge of the view inward, and last the lights, the helicopter and the markers.
import { ROAD_HALF } from '../core/config.js';
import { SIGNAL_GREEN, SIGNAL_YELLOW, signalState } from '../city/roadGraph.js';
import { skyState } from '../world/dayNight.js';
import { applyCamera, viewBounds } from './camera.js';
import { drawBuilding, drawBuildingShadow } from './buildingRenderer.js';
import { drawAirEffects, drawFloatingTexts, drawGroundEffects } from './effects.js';
import { createGroundRenderer } from './groundRenderer.js';
import { createLighting, drawDarkness, drawGlows } from './lighting.js';
import { drawPerson, drawPersonShadow } from './peopleRenderer.js';
import { drawLowProp, drawPropShadow, drawTallProp, isTallProp } from './propRenderer.js';
import { drawVehicle, drawVehicleShadow } from './vehicleRenderer.js';

const SIGNAL_COLORS = ['#3dff7a', '#ffd23d', '#ff4040'];

function collectProps(city, bounds, low, tall, lamps) {
  const size = city.propChunkSize;
  const cx0 = Math.max(0, Math.floor((bounds.x0 - 40) / size));
  const cy0 = Math.max(0, Math.floor((bounds.y0 - 40) / size));
  const cx1 = Math.min(city.chunkColumns - 1, Math.floor((bounds.x1 + 40) / size));
  const cy1 = Math.min(city.chunkRows - 1, Math.floor((bounds.y1 + 40) / size));
  for (let cy = cy0; cy <= cy1; cy += 1) {
    for (let cx = cx0; cx <= cx1; cx += 1) {
      for (const prop of city.propChunks[cy * city.chunkColumns + cx]) {
        if (prop.x < bounds.x0 - 150 || prop.x > bounds.x1 + 150 || prop.y < bounds.y0 - 150 || prop.y > bounds.y1 + 150) continue;
        if (isTallProp(prop.type)) tall.push(prop);
        else low.push(prop);
        if (prop.type === 'lamp') lamps.push(prop);
      }
    }
  }
}

function drawPickup(ctx, pickup, clock) {
  const bob = Math.sin(clock * 4 + pickup.x) * 1.5;
  const pulse = 0.5 + 0.5 * Math.sin(clock * 5 + pickup.y);
  ctx.save();
  ctx.translate(pickup.x, pickup.y + bob);
  if (pickup.type === 'cash') {
    ctx.fillStyle = '#2fbf71';
    ctx.fillRect(-7, -4, 14, 8);
    ctx.fillStyle = '#d8ffe4';
    ctx.fillRect(-2, -2.5, 4, 5);
  } else if (pickup.type === 'health') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff3b4e';
    ctx.fillRect(-2, -6, 4, 12);
    ctx.fillRect(-6, -2, 12, 4);
  } else if (pickup.type === 'armor') {
    ctx.fillStyle = '#3aa0ff';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(8, -5);
    ctx.lineTo(6, 6);
    ctx.lineTo(0, 10);
    ctx.lineTo(-6, 6);
    ctx.lineTo(-8, -5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d6ecff';
    ctx.fillRect(-1.5, -5, 3, 10);
  } else if (pickup.type === 'ammo') {
    ctx.fillStyle = '#6b5a2e';
    ctx.fillRect(-7, -5, 14, 10);
    ctx.fillStyle = '#ffd166';
    for (let n = 0; n < 3; n += 1) ctx.fillRect(-5 + n * 4, -3, 2.5, 6);
  } else if (pickup.type === 'conch') {
    ctx.fillStyle = `rgba(255,210,90,${0.25 + pulse * 0.3})`;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffc94a';
    ctx.beginPath();
    ctx.moveTo(-9, 2);
    ctx.quadraticCurveTo(-4, -10, 6, -6);
    ctx.quadraticCurveTo(12, 0, 5, 7);
    ctx.quadraticCurveTo(-3, 9, -9, 2);
    ctx.fill();
    ctx.strokeStyle = '#a8741a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(2, 0, 4, 0.5, 5);
    ctx.stroke();
  } else {
    ctx.fillStyle = `rgba(125,255,155,${0.25 + pulse * 0.3})`;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5ecd2';
    ctx.fillRect(-9, -6, 18, 12);
    ctx.strokeStyle = '#b9975b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-9, -6);
    ctx.lineTo(0, 1);
    ctx.lineTo(9, -6);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGroundMarker(ctx, marker, clock) {
  if (marker.radius <= 0) return;
  const pulse = 0.5 + 0.5 * Math.sin(clock * 4);
  ctx.strokeStyle = marker.color;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, marker.radius - 4 + pulse * 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.16 + pulse * 0.1;
  ctx.fillStyle = marker.color;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, marker.radius - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawBeacon(ctx, marker, clock) {
  const bob = Math.sin(clock * 5 + marker.x * 0.01) * 4;
  const y = marker.y - (marker.radius > 0 ? 34 : 30) + bob;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.moveTo(marker.x, y + 13);
  ctx.lineTo(marker.x - 9, y - 1);
  ctx.lineTo(marker.x + 9, y - 1);
  ctx.fill();
  ctx.fillStyle = marker.color;
  ctx.beginPath();
  ctx.moveTo(marker.x, y + 10);
  ctx.lineTo(marker.x - 7, y - 3);
  ctx.lineTo(marker.x + 7, y - 3);
  ctx.fill();
  if (marker.label) {
    ctx.beginPath();
    ctx.arc(marker.x, y - 14, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10131c';
    ctx.font = '800 14px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(marker.label, marker.x, y - 9);
  }
  if (marker.title) {
    ctx.font = '700 11px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(16,19,28,0.85)';
    ctx.strokeText(marker.title, marker.x, y - 30);
    ctx.fillStyle = '#fff4d6';
    ctx.fillText(marker.title, marker.x, y - 30);
  }
}

function drawSignals(ctx, city, bounds, clock) {
  for (const node of city.graph.nodes) {
    if (!node.signal || node.x < bounds.x0 - 90 || node.x > bounds.x1 + 90 || node.y < bounds.y0 - 90 || node.y > bounds.y1 + 90) continue;
    const reach = ROAD_HALF + 9;
    for (const [dx, dy, horizontal] of [[-1, -1, false], [1, 1, false], [1, -1, true], [-1, 1, true]]) {
      const state = signalState(node, clock, horizontal);
      const x = node.x + dx * reach;
      const y = node.y + dy * reach;
      ctx.fillStyle = '#20242b';
      ctx.fillRect(x - 5, y - 5, 10, 10);
      ctx.fillStyle = SIGNAL_COLORS[state === SIGNAL_GREEN ? 0 : state === SIGNAL_YELLOW ? 1 : 2];
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawHelicopter(ctx, heli, sky) {
  ctx.fillStyle = `rgba(10,15,40,${sky.shadowAlpha})`;
  ctx.beginPath();
  ctx.ellipse(heli.x + 50, heli.y + 70, 34, 13, heli.angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(heli.x, heli.y);
  ctx.rotate(heli.angle);
  ctx.fillStyle = '#1f3b73';
  ctx.fillRect(-52, -3, 34, 6);
  ctx.fillRect(-56, -11, 6, 22);
  ctx.fillStyle = '#f2f5f8';
  ctx.beginPath();
  ctx.ellipse(0, 0, 27, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1f3b73';
  ctx.beginPath();
  ctx.ellipse(-4, 0, 20, 13, 0, Math.PI * 0.5, Math.PI * 1.5);
  ctx.fill();
  ctx.fillStyle = '#16202e';
  ctx.beginPath();
  ctx.ellipse(13, 0, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(heli.rotor);
  ctx.fillStyle = 'rgba(210,220,230,0.2)';
  ctx.beginPath();
  ctx.arc(0, 0, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(30,34,40,0.75)';
  ctx.fillRect(-46, -2, 92, 4);
  ctx.fillRect(-2, -46, 4, 92);
  ctx.restore();
}

export function createWorldRenderer(city) {
  const ground = createGroundRenderer(city);
  const lighting = createLighting();
  const low = [];
  const tall = [];
  const lamps = [];
  const sorted = [];

  return {
    draw(ctx, world) {
      const camera = world.camera;
      const sky = skyState(world.dayTime);
      const bounds = viewBounds(camera, 30);
      const camX = camera.x + camera.shakeX + camera.kickX;
      const camY = camera.y + camera.shakeY + camera.kickY;
      const clock = world.clock;
      const inView = (x, y, margin) => x > bounds.x0 - margin && x < bounds.x1 + margin && y > bounds.y0 - margin && y < bounds.y1 + margin;
      low.length = 0;
      tall.length = 0;
      lamps.length = 0;
      sorted.length = 0;
      collectProps(city, bounds, low, tall, lamps);
      const vehicles = world.vehicles.filter((vehicle) => inView(vehicle.x, vehicle.y, 200));
      const people = world.people.filter((person) => !person.vehicle && inView(person.x, person.y, 40));
      const buildings = city.buildings.filter((b) => b.x < bounds.x1 && b.x + b.w > bounds.x0 && b.y < bounds.y1 && b.y + b.h > bounds.y0);

      applyCamera(ctx, camera);
      ground.drawSea(ctx, bounds, clock, sky);
      ground.drawGround(ctx, bounds);
      drawGroundEffects(ctx, world.fx, bounds);
      for (const marker of world.markers) if (inView(marker.x, marker.y, 60)) drawGroundMarker(ctx, marker, clock);
      drawSignals(ctx, city, bounds, clock);

      ctx.fillStyle = `rgba(12,18,48,${sky.shadowAlpha})`;
      for (const building of city.buildings) {
        if (building.x > bounds.x1 + 260 || building.x + building.w < bounds.x0 - 260 || building.y > bounds.y1 + 60 || building.y + building.h < bounds.y0 - 260) continue;
        drawBuildingShadow(ctx, building, sky);
      }
      for (const prop of tall) drawPropShadow(ctx, prop, sky);
      for (const vehicle of vehicles) drawVehicleShadow(ctx, vehicle, sky);
      for (const person of people) if (person.alive) drawPersonShadow(ctx, person, sky);

      for (const prop of low) drawLowProp(ctx, prop, sky, clock);
      for (const pickup of world.pickups) if (pickup.hidden <= 0 && inView(pickup.x, pickup.y, 30)) drawPickup(ctx, pickup, clock);
      for (const person of people) if (!person.alive) drawPerson(ctx, person, false);
      for (const vehicle of vehicles) drawVehicle(ctx, vehicle, clock, sky.lampsOn);
      for (const person of people) if (person.alive) drawPerson(ctx, person, person === world.player);
      drawAirEffects(ctx, world.fx, bounds);

      drawDarkness(ctx, lighting, world, sky, lamps, vehicles);
      applyCamera(ctx, camera);

      for (const building of buildings) {
        const dx = Math.max(building.x - camX, 0, camX - building.x - building.w);
        const dy = Math.max(building.y - camY, 0, camY - building.y - building.h);
        sorted.push({ key: dx * dx + dy * dy, building, prop: null });
      }
      for (const prop of tall) sorted.push({ key: (prop.x - camX) * (prop.x - camX) + (prop.y - camY) * (prop.y - camY), building: null, prop });
      sorted.sort((a, b) => b.key - a.key);
      for (const item of sorted) {
        if (item.building) drawBuilding(ctx, item.building, camX, camY, sky);
        else drawTallProp(ctx, item.prop, camX, camY, sky, clock);
      }

      drawGlows(ctx, world, sky, lamps, vehicles);
      if (world.police.heli) drawHelicopter(ctx, world.police.heli, sky);
      for (const marker of world.markers) if (inView(marker.x, marker.y, 60) && (marker.kind !== 'service' || inView(marker.x, marker.y, -60))) drawBeacon(ctx, marker, clock);
      drawFloatingTexts(ctx, world.fx);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      return sky;
    },
  };
}
