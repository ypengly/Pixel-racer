// ============================================================
// POWERUP.JS
// Power-up *data* lives directly on each track (plain objects,
// see track.js) - this module only knows how to apply an effect
// once one is collected, and how to draw its little icon.
// ============================================================
const PowerUp = {
  TYPES: ['nitro', 'shield', 'repair', 'coin'],

  apply(car, type, audio, isPlayer) {
    switch (type) {
      case 'nitro':
        car.nitro = Math.min(car.stats.nitroCapacity, car.nitro + 45);
        break;
      case 'shield':
        car.grantShield(8);
        break;
      case 'repair':
        // in this simplified model "durability" just clears any active slide/penalty
        car.slideTimer = 0;
        car.collisionCooldown = 0;
        break;
      case 'coin':
        car.coins = (car.coins || 0) + 1;
        break;
    }
    if (isPlayer && audio) {
      if (type === 'coin') audio.coin(); else audio.powerup();
    }
  },

  drawIcon(ctx, pu, t) {
    const bob = Math.sin(t * 3 + pu.x) * 1.5;
    const x = pu.x, y = pu.y + bob;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(0, 0, pu.radius, 0, Math.PI * 2); ctx.fill();
    let inner = '#fff';
    if (pu.type === 'nitro') inner = '#5ec6ff';
    if (pu.type === 'shield') inner = '#7CFC7C';
    if (pu.type === 'repair') inner = '#ff9f43';
    if (pu.type === 'coin') inner = '#ffdd55';
    ctx.fillStyle = inner;
    ctx.beginPath(); ctx.arc(0, 0, pu.radius - 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const glyph = { nitro: 'N', shield: 'S', repair: 'R', coin: '$' }[pu.type] || '?';
    ctx.fillText(glyph, 0, 1);
    ctx.restore();
  },

  drawObstacle(ctx, ob) {
    ctx.save();
    ctx.translate(ob.x, ob.y);
    if (ob.type === 'oil') {
      ctx.fillStyle = 'rgba(20,20,20,0.75)';
      ctx.beginPath(); ctx.ellipse(0, 0, ob.radius, ob.radius * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    } else if (ob.type === 'cone') {
      ctx.fillStyle = '#ff7a1a';
      ctx.fillRect(-3, -6, 6, 6);
      ctx.fillStyle = '#111';
      ctx.fillRect(-4, -1, 8, 2);
    } else if (ob.type === 'tire') {
      ctx.fillStyle = '#181818';
      ctx.beginPath(); ctx.arc(0, 0, ob.radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a3a3a';
      ctx.beginPath(); ctx.arc(0, 0, ob.radius - 3, 0, Math.PI * 2); ctx.fill();
    } else if (ob.type === 'rock') {
      ctx.fillStyle = '#6b5d4f';
      ctx.beginPath();
      ctx.moveTo(-ob.radius, 3); ctx.lineTo(-3, -ob.radius); ctx.lineTo(4, -ob.radius + 1);
      ctx.lineTo(ob.radius, 2); ctx.lineTo(2, ob.radius); ctx.closePath(); ctx.fill();
    } else if (ob.type === 'barrel') {
      ctx.fillStyle = '#c73a3a';
      ctx.fillRect(-ob.radius + 1, -ob.radius, (ob.radius - 1) * 2, ob.radius * 2);
      ctx.fillStyle = '#8f1f1f';
      ctx.fillRect(-ob.radius + 1, -2, (ob.radius - 1) * 2, 2);
    } else if (ob.type === 'roadblock') {
      ctx.fillStyle = '#e0c23a';
      ctx.fillRect(-ob.radius, -3, ob.radius * 2, 6);
    }
    ctx.restore();
  },
};
