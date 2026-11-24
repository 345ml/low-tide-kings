// Draws people from above: legs that stride, shoulders, swinging or aiming arms, a head with
// hair or a cap, and whatever they are holding. The dead lie where they fell.
const GUN_LENGTH = { pistol: 7, smg: 10, shotgun: 15, rifle: 16 };

export function drawPersonShadow(ctx, person, sky) {
  ctx.beginPath();
  ctx.ellipse(person.x + sky.shadowX * 5, person.y + sky.shadowY * 6, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawPerson(ctx, person, isPlayer) {
  const look = person.look;
  ctx.save();
  ctx.translate(person.x, person.y);
  if (!person.alive) {
    ctx.rotate(person.angle + 1.2);
    ctx.globalAlpha = Math.max(0, Math.min(1, (30 - person.deadAge) / 4));
    ctx.fillStyle = look.pants;
    ctx.fillRect(-13, -5, 9, 4);
    ctx.fillRect(-13, 1, 9, 4);
    ctx.fillStyle = look.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = look.skin;
    ctx.fillRect(-2, -12, 4, 7);
    ctx.fillRect(1, 6, 4, 7);
    ctx.beginPath();
    ctx.arc(9, 0, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.arc(10, 0, 4.2, -1.3, 1.3);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (isPlayer) {
    ctx.strokeStyle = 'rgba(39,211,195,0.75)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, 13.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.rotate(person.angle);
  const speed = Math.hypot(person.vx, person.vy);
  const stride = speed > 8 ? Math.sin(person.walkCycle) : 0;
  const armed = person.weapon !== 'fists';
  // Legs.
  ctx.fillStyle = look.pants;
  ctx.beginPath();
  ctx.ellipse(stride * 5, -3.4, 4.6, 2.7, 0, 0, Math.PI * 2);
  ctx.ellipse(-stride * 5, 3.4, 4.6, 2.7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Arms and hands.
  ctx.fillStyle = look.skin;
  if (armed) {
    ctx.fillRect(3, -5.5, 7, 3);
    ctx.fillRect(3, 2.5, 7, 3);
    ctx.fillStyle = '#17181c';
    ctx.fillRect(8, -1.4, GUN_LENGTH[person.weapon], 2.8);
    if (person.weapon !== 'pistol') ctx.fillRect(6, -2.2, 6, 4.4);
  } else if (person.punch > 0) {
    ctx.fillRect(2, 3, 13, 3.4);
    ctx.fillRect(-2, -8.5, 5, 3);
  } else {
    ctx.beginPath();
    ctx.arc(-stride * 4, -8, 2.5, 0, Math.PI * 2);
    ctx.arc(stride * 4, 8, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Shoulders.
  ctx.fillStyle = look.shirt;
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, 8.6, 0, 0, Math.PI * 2);
  ctx.fill();
  if (isPlayer) {
    ctx.fillStyle = '#fff4d6';
    ctx.fillRect(-1.5, -3, 4, 6);
  } else if (person.role === 'cop') {
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(1, 2.5, 2.5, 2.5);
  }
  // Head.
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.arc(1.2, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.hat ?? look.hair;
  ctx.beginPath();
  ctx.arc(0.2, 0, 4.5, 0.9, Math.PI * 2 - 0.9);
  ctx.fill();
  if (look.hat) {
    ctx.beginPath();
    ctx.arc(0.6, 0, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(3, -3.4, 3.4, 6.8);
  }
  ctx.restore();
}
