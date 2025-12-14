const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

const ui = {
  hp: document.getElementById('uiHp'),
  bomb: document.getElementById('uiBomb'),
  power: document.getElementById('uiPower'),
  score: document.getElementById('uiScore'),
  fps: document.getElementById('uiFps'),
  ship: document.getElementById('uiShip'),
  difficulty: document.getElementById('uiDifficulty'),
  difficultyScale: document.getElementById('uiDifficultyScale'),
  difficultyScaleValue: document.getElementById('uiDifficultyScaleValue'),
  str: document.getElementById('uiStr'),
  agi: document.getElementById('uiAgi'),
  vit: document.getElementById('uiVit'),
  int: document.getElementById('uiInt'),
  luk: document.getElementById('uiLuk'),
  charApply: document.getElementById('uiCharApply'),
  charReset: document.getElementById('uiCharReset'),
  charSummary: document.getElementById('uiCharSummary'),
};

const W = canvas.width;
const H = canvas.height;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

const assets = {
  falcon: {
    img: new Image(),
    ready: false,
  },
};

assets.falcon.img.onload = () => {
  assets.falcon.ready = true;
};

assets.falcon.img.onerror = () => {
  assets.falcon.ready = false;
};

assets.falcon.img.src = './test.png';

function drawImageCentered(img, x, y, w, h, alpha = 1) {
  if (!img || !img.complete) return false;

  ctx.save();
  ctx.globalAlpha *= alpha;
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
  ctx.imageSmoothingEnabled = prev;
  ctx.restore();
  return true;
}

function drawFloatText(ft) {
  const t = clamp(ft.ttl / (ft.maxTtl || 1), 0, 1);
  const alpha = 0.25 + 0.75 * t;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = ft.crit ? '900 18px ui-sans-serif, system-ui' : '800 14px ui-sans-serif, system-ui';

  const text = ft.crit ? `CRIT ${ft.dmg}` : String(ft.dmg);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.strokeText(text, ft.x, ft.y);
  ctx.fillStyle = ft.crit ? 'rgba(255,209,102,0.95)' : 'rgba(255,255,255,0.88)';
  ctx.fillText(text, ft.x, ft.y);
  ctx.restore();
}

function shootBoss(e) {
  const dp = difficultyParams(game.difficulty.scalePct);
  const level = game.stage.level;
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h;
  const px = game.player.x;
  const py = game.player.y;
  const dx = px - cx;
  const dy = py - cy;
  const mag = Math.hypot(dx, dy) || 1;
  const ux = dx / mag;
  const uy = dy / mag;

  const speed = (240 + level * 12) * dp.enemyBulletSpeedMult;
  const size = 8;
  const spread = level >= 2 ? 3 : 2;
  const step = 0.10 * clamp(dp.scalePct / 100, 0.8, 1.25);

  for (let i = -spread; i <= spread; i++) {
    const a = i * step;
    const vx = (ux * Math.cos(a) - uy * Math.sin(a)) * speed;
    const vy = (ux * Math.sin(a) + uy * Math.cos(a)) * speed;
    game.ebullets.push({ x: cx - size / 2, y: cy, w: size, h: size, vx, vy, r: size * 0.55 });
  }
}

function drawHud() {
  const pad = 12;

  ctx.save();
  ctx.font = '12px ui-sans-serif, system-ui';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.fillText(`Score ${game.score}`, pad, 18);

  const phase = game.stage?.phase || 'wave';
  const lvl = game.stage?.level || 1;
  const time = game.stage?.time || 0;
  const duration = game.stage?.duration || 30000;
  const remaining = phase === 'wave' ? Math.max(0, Math.ceil((duration - time) / 1000)) : null;

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillText(phase === 'wave' ? `STAGE ${lvl}  ${remaining}s` : `STAGE ${lvl}  BOSS`, W / 2, 18);
  ctx.textAlign = 'left';

  const sk = game.skill;
  if (sk) {
    const bw = 180;
    const bh = 8;
    const bx = pad;
    const by = 28;
    const prog = sk.maxCharges > 0 && sk.charges >= sk.maxCharges ? 1 : clamp(sk.chargeT / sk.chargeTMax, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(bx, by, bw, bh, 6);
    ctx.fill();
    ctx.fillStyle = sk.activeT > 0 ? 'rgba(255,209,102,0.92)' : 'rgba(116,143,252,0.88)';
    roundRect(bx, by, bw * prog, bh, 6);
    ctx.fill();

    const pip = 6;
    const gap = 5;
    const px0 = bx + bw + 10;
    const py0 = by + bh / 2;
    for (let i = 0; i < sk.maxCharges; i++) {
      const on = i < sk.charges;
      ctx.fillStyle = on ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.arc(px0 + i * (pip * 2 + gap), py0, pip, 0, Math.PI * 2);
      ctx.fill();
    }

    if (sk.activeT > 0) {
      ctx.fillStyle = 'rgba(255,209,102,0.70)';
      ctx.textAlign = 'right';
      ctx.fillText(`子彈時間 ${Math.ceil(sk.activeT / 1000)}s`, W - pad, 34);
      ctx.textAlign = 'left';
    }
  }

  const hp = Math.max(0, Math.min(9, game.player.hp));
  const heart = 14;
  const gap = 4;
  const totalW = hp > 0 ? (hp * heart + (hp - 1) * gap) : 0;
  let x = W - pad - totalW;
  const y = pad + 6;
  for (let i = 0; i < hp; i++) {
    drawHeart(x + heart / 2, y + heart / 2, heart / 2, 'rgba(255,107,107,0.92)', 'rgba(0,0,0,0.35)');
    x += heart + gap;
  }

  const bombY = H - pad;
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  drawBombIcon(pad + 10, bombY - 10, 10, 'rgba(116,143,252,0.92)');
  ctx.fillText(`x${game.player.bomb}`, pad + 26, bombY - 2);

  const txt = `PWR ${game.player.power}`;
  const tw = ctx.measureText(txt).width;
  const px = W - pad;
  drawPowerIcon(px - tw - 22, bombY - 10, 10, 'rgba(99,230,190,0.92)');
  ctx.fillText(txt, px - tw, bombY - 2);

  const boss = game.enemies.find((e) => e.type === 'boss' && e.hp > 0);
  if (boss) {
    const bw = Math.min(520, W - pad * 2);
    const bx = (W - bw) / 2;
    const by = 34;
    const hpPct = clamp(boss.hp / boss.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(bx, by, bw, 10, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,107,107,0.92)';
    roundRect(bx, by, bw * hpPct, 10, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('BOSS', W / 2, by + 12);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  if (game.stage?.bannerT > 0 && game.stage?.banner) {
    const t = clamp(game.stage.bannerT / 1800, 0, 1);
    ctx.fillStyle = `rgba(255,255,255,${0.18 + 0.35 * t})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 54px ui-sans-serif, system-ui';
    ctx.fillText(game.stage.banner, W / 2, H * 0.36);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '12px ui-sans-serif, system-ui';
  }

  ctx.restore();
}

function drawHeart(x, y, r, fill, stroke) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  const s = r / 8;
  ctx.moveTo(0, 6 * s);
  ctx.bezierCurveTo(-8 * s, 0, -10 * s, -6 * s, -4 * s, -8 * s);
  ctx.bezierCurveTo(-1 * s, -9 * s, 0, -7 * s, 0, -5 * s);
  ctx.bezierCurveTo(0, -7 * s, 1 * s, -9 * s, 4 * s, -8 * s);
  ctx.bezierCurveTo(10 * s, -6 * s, 8 * s, 0, 0, 6 * s);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawBombIcon(x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(r * 0.1, -r * 1.05, r * 0.85, r * 0.35);
  ctx.restore();
}

function drawPowerIcon(x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.2);
  ctx.lineTo(r * 1.0, 0);
  ctx.lineTo(0, r * 1.2);
  ctx.lineTo(-r * 1.0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.stroke();
  ctx.restore();
}

const DifficultyPresets = {
  easy: 70,
  normal: 100,
  hard: 125,
  custom: 100,
};

function difficultyParams(scalePct) {
  const s = clamp(scalePct, 60, 160) / 100;
  return {
    scalePct: Math.round(s * 100),
    spawnIntervalMult: clamp(1 / s, 0.5, 2.2),
    enemyHpMult: clamp(s, 0.55, 2.0),
    enemySpeedMult: clamp(s, 0.7, 1.7),
    enemyFireCdMult: clamp(1 / Math.pow(s, 1.2), 0.55, 2.6),
    enemyBulletSpeedMult: clamp(s, 0.65, 1.8),
    enemyShootChanceMult: clamp(s, 0.35, 1.35),
    enemySpreadDelta: s <= 0.85 ? -1 : 0,
    enemySpreadExtra: s >= 1.35 ? 1 : 0,
    dropChanceMult: clamp(1 / s, 0.5, 1.75),
    intensityGrowthMult: clamp(s, 0.55, 1.8),
    startHp: s <= 0.9 ? 4 : (s <= 1.12 ? 3 : 2),
  };
}

function aabb(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function circleHit(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const rr = ar + br;
  return dx * dx + dy * dy <= rr * rr;
}

const Ships = [
  {
    id: 'falcon',
    name: 'Falcon',
    desc: '均衡型\n單發、穩定射速\nBomb: 全屏清彈',
    speed: 260,
    slowSpeed: 140,
    fireInterval: 120,
    shot: (game, pwr) => {
      const lvl = clamp(pwr, 1, 6);
      const bw = 6;
      const bh = 14;
      const base = 520 + lvl * 20;
      game.bullets.push({ x: game.player.x - bw / 2, y: game.player.y - 14, w: bw, h: bh, vx: 0, vy: -base, dmg: 1, kind: 'p', pierce: 0 });
      if (lvl >= 3) game.bullets.push({ x: game.player.x - 18 - bw / 2, y: game.player.y - 8, w: bw, h: bh, vx: -40, vy: -base, dmg: 1, kind: 'p', pierce: 0 });
      if (lvl >= 3) game.bullets.push({ x: game.player.x + 18 - bw / 2, y: game.player.y - 8, w: bw, h: bh, vx: 40, vy: -base, dmg: 1, kind: 'p', pierce: 0 });
      if (lvl >= 5) game.bullets.push({ x: game.player.x - 34 - bw / 2, y: game.player.y - 2, w: bw, h: bh, vx: -80, vy: -base, dmg: 1, kind: 'p', pierce: 0 });
      if (lvl >= 5) game.bullets.push({ x: game.player.x + 34 - bw / 2, y: game.player.y - 2, w: bw, h: bh, vx: 80, vy: -base, dmg: 1, kind: 'p', pierce: 0 });
    },
  },
  {
    id: 'viper',
    name: 'Viper',
    desc: '擴散型\n三向散射、近距離強\nBomb: 大範圍爆風',
    speed: 300,
    slowSpeed: 165,
    fireInterval: 150,
    shot: (game, pwr) => {
      const lvl = clamp(pwr, 1, 6);
      const bw = 6;
      const bh = 12;
      const base = 500 + lvl * 18;
      const angles = lvl >= 4 ? [-0.28, -0.14, 0, 0.14, 0.28] : [-0.22, 0, 0.22];
      for (const a of angles) {
        const vx = Math.sin(a) * 160;
        const vy = -Math.cos(a) * base;
        game.bullets.push({ x: game.player.x - bw / 2, y: game.player.y - 12, w: bw, h: bh, vx, vy, dmg: 1, kind: 'p', pierce: 0 });
      }
    },
  },
  {
    id: 'ion',
    name: 'ION',
    desc: '貫穿型\n細雷射、可貫穿\nBomb: 雷擊鎖定',
    speed: 240,
    slowSpeed: 130,
    fireInterval: 110,
    shot: (game, pwr) => {
      const lvl = clamp(pwr, 1, 6);
      const bw = 4;
      const bh = 22;
      const base = 620 + lvl * 30;
      const pierce = lvl >= 4 ? 3 : (lvl >= 2 ? 1 : 0);
      game.bullets.push({ x: game.player.x - bw / 2, y: game.player.y - 18, w: bw, h: bh, vx: 0, vy: -base, dmg: 1, kind: 'laser', pierce });
      if (lvl >= 5) {
        game.bullets.push({ x: game.player.x - 16 - bw / 2, y: game.player.y - 14, w: bw, h: bh, vx: -20, vy: -base, dmg: 1, kind: 'laser', pierce });
        game.bullets.push({ x: game.player.x + 16 - bw / 2, y: game.player.y - 14, w: bw, h: bh, vx: 20, vy: -base, dmg: 1, kind: 'laser', pierce });
      }
    },
  },
];

const Input = (() => {
  const keys = new Map();
  let pointer = { active: false, x: 0, y: 0, dx: 0, dy: 0, wasActive: false };

  window.addEventListener('keydown', (e) => {
    keys.set(e.code, true);
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  }, { passive: false });

  window.addEventListener('keyup', (e) => {
    keys.set(e.code, false);
  });

  const setPointer = (clientX, clientY, active) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    const y = ((clientY - rect.top) / rect.height) * H;
    pointer.dx = x - pointer.x;
    pointer.dy = y - pointer.y;
    pointer.x = x;
    pointer.y = y;
    pointer.active = active;
  };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    setPointer(e.clientX, e.clientY, true);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointer.active) return;
    setPointer(e.clientX, e.clientY, true);
  });

  canvas.addEventListener('pointerup', (e) => {
    setPointer(e.clientX, e.clientY, false);
  });

  return {
    isDown: (code) => keys.get(code) === true,
    pointer: () => pointer,
    step: () => {
      pointer.dx = 0;
      pointer.dy = 0;
      pointer.wasActive = pointer.active;
    },
  };
})();

function createGame() {
  return {
    state: 'select',
    t: 0,
    dt: 16.67,
    shipIndex: 0,
    ship: Ships[0],
    difficulty: {
      preset: 'normal',
      scalePct: 100,
    },
    character: {
      str: 4,
      agi: 4,
      vit: 4,
      int: 4,
      luk: 4,
    },
    charMods: {
      dmgMult: 1,
      moveMult: 1,
      fireRateMult: 1,
      hpBonus: 0,
      invBonus: 0,
      dropMult: 1,
      critChance: 0.02,
      critDmgMult: 1.5,
      powerExtraChance: 0,
      bombExtraChance: 0,
    },
    score: 0,
    fps: 0,
    shake: 0,

    stars: Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: rand(0.5, 2.4), v: rand(20, 110) })),

    player: {
      x: W / 2,
      y: H - 80,
      r: 10,
      hp: 3,
      maxHp: 3,
      inv: 0,
      bomb: 2,
      power: 1,
      fireCd: 0,
      bombCd: 0,
      dead: false,
    },

    stage: {
      level: 1,
      phase: 'wave',
      time: 0,
      duration: 30000,
      banner: '',
      bannerT: 0,
    },

    skill: {
      maxCharges: 1,
      charges: 1,
      chargeT: 0,
      chargeTMax: 20000,
      activeT: 0,
      enemyTimeScale: 1,
    },

    bullets: [],
    ebullets: [],
    enemies: [],
    drops: [],
    floatTexts: [],

    spawn: {
      cd: 0,
      wave: 0,
      intensity: 1,
      progress: 0,
    },

    flash: 0,
    overlayText: '',
  };
}

const game = createGame();

function statNorm(v, base = 4, k = 12) {
  const vv = clamp(Number(v) || base, base, 60);
  const b = base / (base + k);
  const a = vv / (vv + k);
  return clamp((a - b) / (1 - b), 0, 1);
}

function computeCharMods(c) {
  const s = statNorm(c.str, 4, 12);
  const a = statNorm(c.agi, 4, 12);
  const v = statNorm(c.vit, 4, 12);
  const i = statNorm(c.int, 4, 12);
  const l = statNorm(c.luk, 4, 12);

  const dmgMult = 1 + 0.80 * s;
  const moveMult = 1 + 0.28 * a;
  const fireRateMult = 1 + 0.45 * a;

  const hpBonus = Math.round(2.2 * v);
  const invBonus = Math.round(160 * v);

  const dropMult = 1 + 0.75 * l;
  const critChance = 0.02 + 0.10 * l;
  const critDmgMult = 1.5;

  const powerExtraChance = 0.12 * i;
  const bombExtraChance = 0.10 * i;

  const skillChargeRateMult = 1 + 0.45 * i;
  const skillMaxCharges = clamp(1 + Math.floor(clamp(Number(c.int) || 4, 4, 60) / 15), 1, 3);

  return {
    dmgMult,
    moveMult,
    fireRateMult,
    hpBonus,
    invBonus,
    dropMult,
    critChance,
    critDmgMult,
    powerExtraChance,
    bombExtraChance,
    skillChargeRateMult,
    skillMaxCharges,
  };
}

function applyCharacter(resetHp) {
  game.charMods = computeCharMods(game.character);

  const baseHp = difficultyParams(game.difficulty.scalePct).startHp;
  const maxHp = clamp(baseHp + (game.charMods.hpBonus || 0), 1, 9);
  game.player.maxHp = maxHp;
  if (resetHp) game.player.hp = maxHp;
  else game.player.hp = clamp(game.player.hp, 0, maxHp);

  if (game.skill) {
    game.skill.maxCharges = game.charMods.skillMaxCharges || 1;
    game.skill.chargeTMax = Math.max(6000, Math.round(20000 / (game.charMods.skillChargeRateMult || 1)));
    game.skill.charges = clamp(game.skill.charges, 0, game.skill.maxCharges);
  }

  updateShipUI();
  updateCharacterUI();
}

function updateCharacterUI() {
  if (ui.str) ui.str.value = String(clamp(Math.round(game.character.str), 4, 30));
  if (ui.agi) ui.agi.value = String(clamp(Math.round(game.character.agi), 4, 30));
  if (ui.vit) ui.vit.value = String(clamp(Math.round(game.character.vit), 4, 30));
  if (ui.int) ui.int.value = String(clamp(Math.round(game.character.int), 4, 30));
  if (ui.luk) ui.luk.value = String(clamp(Math.round(game.character.luk), 4, 30));

  if (!ui.charSummary) return;
  const m = game.charMods;
  const lines = [
    `STR ${game.character.str}  AGI ${game.character.agi}  VIT ${game.character.vit}`,
    `INT ${game.character.int}  LUK ${game.character.luk}`,
    '',
    `傷害 x${(m.dmgMult || 1).toFixed(2)}  爆擊 ${(100 * (m.critChance || 0)).toFixed(0)}%`,
    `移速 x${(m.moveMult || 1).toFixed(2)}  射速 x${(m.fireRateMult || 1).toFixed(2)}`,
    `最大HP +${m.hpBonus || 0}  受傷無敵 +${m.invBonus || 0}ms`,
    `掉落 x${(m.dropMult || 1).toFixed(2)}  P額外 ${(100 * (m.powerExtraChance || 0)).toFixed(0)}%  B額外 ${(100 * (m.bombExtraChance || 0)).toFixed(0)}%`,
    `技能充能 ${m.skillMaxCharges || 1} 格  充能速度 x${(m.skillChargeRateMult || 1).toFixed(2)}`,
  ];
  ui.charSummary.textContent = lines.join('\n');
}

function readCharacterFromUI() {
  const c = {
    str: clamp(Number(ui.str?.value ?? 4) || 4, 4, 30),
    agi: clamp(Number(ui.agi?.value ?? 4) || 4, 4, 30),
    vit: clamp(Number(ui.vit?.value ?? 4) || 4, 4, 30),
    int: clamp(Number(ui.int?.value ?? 4) || 4, 4, 30),
    luk: clamp(Number(ui.luk?.value ?? 4) || 4, 4, 30),
  };
  return c;
}

function loadCharacter() {
  try {
    const injected = window.raidenCharacter;
    if (injected && typeof injected === 'object') {
      game.character = {
        str: Number(injected.str ?? injected.STR ?? injected.Str ?? 4),
        agi: Number(injected.agi ?? injected.AGI ?? injected.Agi ?? 4),
        vit: Number(injected.vit ?? injected.VIT ?? injected.Vit ?? 4),
        int: Number(injected.int ?? injected.INT ?? injected.Int ?? 4),
        luk: Number(injected.luk ?? injected.LUK ?? injected.Luk ?? 4),
      };
      return;
    }

    const raw = localStorage.getItem('raidenMini.character');
    if (!raw) return;
    const c = JSON.parse(raw);
    if (!c || typeof c !== 'object') return;
    game.character = {
      str: Number(c.str ?? 4),
      agi: Number(c.agi ?? 4),
      vit: Number(c.vit ?? 4),
      int: Number(c.int ?? 4),
      luk: Number(c.luk ?? 4),
    };
  } catch {
  }
}

function saveCharacter() {
  try {
    localStorage.setItem('raidenMini.character', JSON.stringify(game.character));
  } catch {
  }
}

function loadDifficulty() {
  try {
    const raw = localStorage.getItem('raidenMini.difficulty');
    if (!raw) return;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object') return;
    if (typeof d.preset === 'string' && d.preset in DifficultyPresets) game.difficulty.preset = d.preset;
    if (typeof d.scalePct === 'number') game.difficulty.scalePct = clamp(Math.round(d.scalePct), 60, 160);
  } catch {
  }
}

function saveDifficulty() {
  try {
    localStorage.setItem('raidenMini.difficulty', JSON.stringify(game.difficulty));
  } catch {
  }
}

function syncDifficultyUI() {
  if (!ui.difficulty || !ui.difficultyScale) return;

  const preset = game.difficulty.preset;
  ui.difficulty.value = preset;
  ui.difficultyScale.value = String(game.difficulty.scalePct);
  ui.difficultyScale.disabled = preset !== 'custom';
  if (ui.difficultyScaleValue) ui.difficultyScaleValue.textContent = `${game.difficulty.scalePct}%`;
}

function setDifficultyPreset(preset) {
  if (!(preset in DifficultyPresets)) return;
  game.difficulty.preset = preset;
  if (preset !== 'custom') {
    game.difficulty.scalePct = DifficultyPresets[preset];
  }
  syncDifficultyUI();
  saveDifficulty();
}

function setDifficultyScalePct(scalePct) {
  const v = clamp(Math.round(scalePct), 60, 160);
  game.difficulty.scalePct = v;
  if (game.difficulty.preset !== 'custom') game.difficulty.preset = 'custom';
  syncDifficultyUI();
  saveDifficulty();
}

function resetToSelect() {
  game.state = 'select';
  game.t = 0;
  game.score = 0;
  game.bullets.length = 0;
  game.ebullets.length = 0;
  game.enemies.length = 0;
  game.drops.length = 0;
  game.floatTexts.length = 0;
  game.skill.charges = game.charMods.skillMaxCharges || 1;
  game.skill.chargeT = 0;
  game.skill.activeT = 0;
  game.skill.enemyTimeScale = 1;
  game.player.x = W / 2;
  game.player.y = H - 80;
  game.player.hp = difficultyParams(game.difficulty.scalePct).startHp;
  game.player.inv = 0;
  game.player.bomb = 2;
  game.player.power = 1;
  game.player.fireCd = 0;
  game.player.bombCd = 0;
  game.player.dead = false;
  game.spawn.cd = 0;
  game.spawn.wave = 0;
  game.spawn.intensity = 1;
  game.spawn.progress = 0;
  game.stage.level = 1;
  game.stage.phase = 'wave';
  game.stage.time = 0;
  game.stage.duration = 30000;
  game.stage.banner = '';
  game.stage.bannerT = 0;
  game.flash = 0;
  game.overlayText = '';
  game.shake = 0;
  applyCharacter(true);
  updateShipUI();
}

function startPlay() {
  game.state = 'play';
  game.score = 0;
  game.bullets.length = 0;
  game.ebullets.length = 0;
  game.enemies.length = 0;
  game.drops.length = 0;
  game.floatTexts.length = 0;
  game.skill.charges = game.charMods.skillMaxCharges || 1;
  game.skill.chargeT = 0;
  game.skill.activeT = 0;
  game.skill.enemyTimeScale = 1;
  game.player.x = W / 2;
  game.player.y = H - 90;
  game.player.hp = difficultyParams(game.difficulty.scalePct).startHp;
  applyCharacter(true);
  game.player.inv = 80 + (game.charMods.invBonus || 0) * 0.35;
  game.player.bomb = 2;
  game.player.power = 1;
  game.player.fireCd = 0;
  game.player.bombCd = 0;
  game.player.dead = false;
  game.spawn.cd = 0;
  game.spawn.wave = 0;
  game.spawn.intensity = 1;
  game.spawn.progress = 0;
  game.stage.level = 1;
  game.stage.phase = 'wave';
  game.stage.time = 0;
  game.stage.duration = 30000;
  game.stage.banner = 'STAGE 1';
  game.stage.bannerT = 1800;
  game.flash = 0;
  game.overlayText = '';
  game.shake = 0;
}

function startStage(level) {
  game.stage.level = level;
  game.stage.phase = 'wave';
  game.stage.time = 0;
  game.stage.duration = 30000;
  game.stage.banner = `STAGE ${level}`;
  game.stage.bannerT = 1800;
  game.spawn.cd = 0;
  game.spawn.intensity = 1;
  game.spawn.progress = 0;
  game.enemies.length = 0;
  game.bullets.length = 0;
  game.ebullets.length = 0;
  game.drops.length = 0;
  game.floatTexts.length = 0;
  game.skill.activeT = 0;
  game.skill.enemyTimeScale = 1;
  game.player.inv = Math.max(game.player.inv, 140);
}

function tryUseSkill() {
  const sk = game.skill;
  if (!sk) return;
  if (sk.activeT > 0) return;
  if (sk.charges <= 0) return;
  sk.charges -= 1;
  sk.activeT = 5000;
  sk.enemyTimeScale = 0.25;
  game.flash = Math.max(game.flash, 0.10);
}

function addDamageText(x, y, amount, crit) {
  const dmg = Math.max(1, Math.round(amount));
  const ttl = crit ? 820 : 650;
  game.floatTexts.push({
    x: x + rand(-10, 10),
    y: y + rand(-6, 6),
    vy: crit ? -78 : -64,
    ttl,
    maxTtl: ttl,
    crit: !!crit,
    dmg,
  });
}

function spawnBoss() {
  const dp = difficultyParams(game.difficulty.scalePct);
  const level = game.stage.level;
  const w = 180;
  const h = 90;
  const hp = Math.round((220 + level * 90) * dp.enemyHpMult);
  const e = {
    x: (W - w) / 2,
    y: 70,
    w,
    h,
    r: Math.min(w, h) * 0.48,
    hp,
    maxHp: hp,
    vx: 120 + level * 12,
    vy: 0,
    type: 'boss',
    shootCd: 700 * dp.enemyFireCdMult,
    t: 0,
    _defeated: false,
  };
  game.enemies.push(e);
}

function setShip(index) {
  game.shipIndex = (index + Ships.length) % Ships.length;
  game.ship = Ships[game.shipIndex];
  updateShipUI();
}

function updateShipUI() {
  const s = game.ship;
  const m = game.charMods || { moveMult: 1, fireRateMult: 1 };
  const speed = Math.round(s.speed * (m.moveMult || 1));
  const fire = Math.round((1000 * (m.fireRateMult || 1)) / s.fireInterval);
  ui.ship.textContent = `${s.name}\n${s.desc}\n\n移速: ${speed}\n射速: ${fire} 發/秒`;
}

updateShipUI();

loadDifficulty();
syncDifficultyUI();
loadCharacter();
applyCharacter(true);

updateCharacterUI();

if (ui.charApply) {
  ui.charApply.addEventListener('click', () => {
    game.character = readCharacterFromUI();
    saveCharacter();
    applyCharacter(game.state !== 'play');
  });
}

if (ui.charReset) {
  ui.charReset.addEventListener('click', () => {
    game.character = { str: 4, agi: 4, vit: 4, int: 4, luk: 4 };
    saveCharacter();
    applyCharacter(game.state !== 'play');
  });
}

if (ui.difficulty) {
  ui.difficulty.addEventListener('change', () => {
    setDifficultyPreset(ui.difficulty.value);
    if (game.state === 'select') resetToSelect();
  });
}

if (ui.difficultyScale) {
  ui.difficultyScale.addEventListener('input', () => {
    setDifficultyScalePct(Number(ui.difficultyScale.value));
    if (game.state === 'select') resetToSelect();
  });
}

function spawnEnemy() {
  const dp = difficultyParams(game.difficulty.scalePct);
  const w = rand(24, 46);
  const h = rand(24, 50);
  const x = rand(20, W - 20 - w);
  const y = -h - rand(0, 40);
  const tier = Math.random();
  const p = clamp(game.spawn.progress || 0, 0, 1);
  const gruntCut = lerp(0.82, 0.55, p);
  const toughCut = lerp(0.97, 0.88, p);
  const type = tier < gruntCut ? 'grunt' : (tier < toughCut ? 'tough' : 'ace');

  const baseHp = type === 'grunt' ? 2 : (type === 'tough' ? 6 : 14);
  const rawHp = baseHp + Math.floor(game.spawn.intensity * (type === 'ace' ? 1.4 : 0.6));
  const hp = Math.max(1, Math.round(rawHp * dp.enemyHpMult));
  const baseSpeed = type === 'grunt' ? rand(70, 120) : (type === 'tough' ? rand(55, 95) : rand(50, 80));
  const speed = baseSpeed * dp.enemySpeedMult;

  const e = {
    x,
    y,
    w,
    h,
    r: Math.min(w, h) * 0.45,
    hp,
    maxHp: hp,
    vx: rand(-35, 35),
    vy: speed,
    type,
    shootCd: (type === 'ace' ? rand(380, 680) : rand(650, 1200)) * dp.enemyFireCdMult,
    t: 0,
  };

  game.enemies.push(e);
}

function dropAt(x, y) {
  const roll = Math.random();
  let kind = null;
  if (roll < 0.55) kind = 'P';
  else if (roll < 0.80) kind = 'B';
  else kind = 'H';

  const d = {
    x,
    y,
    r: 10,
    kind,
    vy: rand(70, 130),
    t: 0,
  };

  game.drops.push(d);
}

function bombEffect() {
  if (game.player.bombCd > 0) return;
  if (game.player.bomb <= 0) return;
  const m = game.charMods || { dmgMult: 1 };
  const mult = m.dmgMult || 1;
  game.player.bomb -= 1;
  game.player.bombCd = 50;
  game.flash = 1;
  game.shake = 14;

  if (game.ship.id === 'viper') {
    for (const e of game.enemies) e.hp -= 5 * mult;
  } else if (game.ship.id === 'ion') {
    for (const e of game.enemies) e.hp -= Math.max(6 * mult, Math.floor(e.maxHp * 0.35 * mult));
  } else {
    for (const e of game.enemies) e.hp -= 4 * mult;
  }

  game.ebullets.length = 0;
}

function onPlayerHit() {
  if (game.player.inv > 0) return;
  const m = game.charMods || { invBonus: 0 };
  game.player.hp -= 1;
  game.player.inv = 95 + (m.invBonus || 0);
  game.shake = 10;
  game.flash = 0.35;
  if (game.player.hp <= 0) {
    game.player.dead = true;
    game.state = 'gameover';
    game.overlayText = 'GAME OVER';
  }
}

function update(dt) {
  game.dt = dt;
  game.t += dt;

  for (const s of game.stars) {
    s.y += s.v * (dt / 1000);
    if (s.y > H + 2) {
      s.y = -2;
      s.x = Math.random() * W;
      s.s = rand(0.5, 2.4);
      s.v = rand(20, 110);
    }
  }

  game.flash = Math.max(0, game.flash - dt / 280);
  game.shake = Math.max(0, game.shake - dt / 55);

  if (game.state === 'select') {
    updateSelect(dt);
    return;
  }

  if (game.state === 'play') {
    updatePlay(dt);
    return;
  }

  if (game.state === 'gameover') {
    updateGameOver(dt);
    return;
  }
}

let edge = new Map();
function pressed(code) {
  const now = Input.isDown(code);
  const prev = edge.get(code) === true;
  edge.set(code, now);
  return now && !prev;
}

function updateSelect(dt) {
  if (pressed('ArrowLeft') || pressed('KeyA')) setShip(game.shipIndex - 1);
  if (pressed('ArrowRight') || pressed('KeyD')) setShip(game.shipIndex + 1);
  if (pressed('Enter')) startPlay();

  const p = Input.pointer();
  if (p.active && !p.wasActive) {
    const x = p.x;
    if (x < W * 0.35) setShip(game.shipIndex - 1);
    else if (x > W * 0.65) setShip(game.shipIndex + 1);
    else startPlay();
  }
}

function updateGameOver(dt) {
  if (pressed('Enter')) startPlay();
  if (pressed('Escape')) resetToSelect();
}

function updatePlay(dt) {
  const dp = difficultyParams(game.difficulty.scalePct);
  const p = game.player;
  const m = game.charMods || { moveMult: 1, fireRateMult: 1, dmgMult: 1, critChance: 0.02, critDmgMult: 1.5 };
  const sk = game.skill;
  const baseSpd = (Input.isDown('ShiftLeft') || Input.isDown('ShiftRight')) ? game.ship.slowSpeed : game.ship.speed;
  const spd = baseSpd * (m.moveMult || 1);

  let mx = 0;
  let my = 0;

  if (Input.isDown('ArrowLeft') || Input.isDown('KeyA')) mx -= 1;
  if (Input.isDown('ArrowRight') || Input.isDown('KeyD')) mx += 1;
  if (Input.isDown('ArrowUp') || Input.isDown('KeyW')) my -= 1;
  if (Input.isDown('ArrowDown') || Input.isDown('KeyS')) my += 1;

  const mag = Math.hypot(mx, my) || 1;
  mx /= mag;
  my /= mag;

  p.x += mx * spd * (dt / 1000);
  p.y += my * spd * (dt / 1000);

  const ptr = Input.pointer();
  if (ptr.active) {
    p.x = lerp(p.x, ptr.x, 0.22);
    p.y = lerp(p.y, ptr.y, 0.22);
  }

  p.x = clamp(p.x, 22, W - 22);
  p.y = clamp(p.y, 30, H - 26);

  p.inv = Math.max(0, p.inv - dt);
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.bombCd = Math.max(0, p.bombCd - dt);

  const firing = Input.isDown('Space') || ptr.active;
  if (firing && p.fireCd <= 0) {
    const before = game.bullets.length;
    game.ship.shot(game, p.power);
    const after = game.bullets.length;
    for (let i = before; i < after; i++) {
      const b = game.bullets[i];
      const baseDmg = typeof b.dmg === 'number' ? b.dmg : 1;
      b.dmg = baseDmg * (m.dmgMult || 1);
      if (Math.random() < (m.critChance || 0)) {
        b.dmg *= (m.critDmgMult || 1.5);
        b._crit = true;
      }
    }

    p.fireCd = game.ship.fireInterval / (m.fireRateMult || 1);
  }

  if (pressed('KeyX')) bombEffect();
  if (pressed('KeyC')) tryUseSkill();
  if (pressed('Escape')) resetToSelect();

  game.stage.time += dt;
  game.stage.bannerT = Math.max(0, game.stage.bannerT - dt);

  const hasBoss = game.enemies.some((e) => e.type === 'boss' && e.hp > 0);
  if (game.stage.phase === 'wave') {
    const progress = clamp(game.stage.time / game.stage.duration, 0, 1);
    game.spawn.progress = progress;
    const levelScale = 1 + (game.stage.level - 1) * 0.35;
    const intensity = lerp(0.8, 7.2, progress) * levelScale;
    game.spawn.intensity = intensity;

    const maxEnemies = clamp(4 + game.stage.level, 4, 9);
    const live = game.enemies.filter((e) => e.type !== 'boss' && e.hp > 0).length;
    game.spawn.cd -= dt;
    if (!hasBoss && live < maxEnemies && game.spawn.cd <= 0) {
      const base = 860;
      const density = clamp(1 + intensity * 0.08, 1, 2.2);
      const jitter = rand(0.85, 1.25);
      game.spawn.cd = ((base * dp.spawnIntervalMult) / density) * jitter;
      spawnEnemy();
    }

    if (game.stage.time >= game.stage.duration) {
      game.stage.phase = 'boss';
      game.stage.time = 0;
      spawnBoss();
      game.stage.banner = 'BOSS';
      game.stage.bannerT = 1800;
    }
  }

  for (const b of game.bullets) {
    b.x += b.vx * (dt / 1000);
    b.y += b.vy * (dt / 1000);
  }

  const enemyDt = sk && sk.activeT > 0 ? dt * (sk.enemyTimeScale || 0.25) : dt;

  for (const b of game.ebullets) {
    b.x += b.vx * (enemyDt / 1000);
    b.y += b.vy * (enemyDt / 1000);
  }

  for (const e of game.enemies) {
    e.t += enemyDt;
    if (e.type === 'boss') {
      e.x += e.vx * (enemyDt / 1000);
      if (e.x < 40 || e.x + e.w > W - 40) e.vx *= -1;
      e.shootCd -= enemyDt;
      if (e.shootCd <= 0) {
        e.shootCd = rand(420, 650) * dp.enemyFireCdMult;
        shootBoss(e);
      }
    } else {
      e.x += e.vx * (enemyDt / 1000);
      e.y += e.vy * (enemyDt / 1000);

      if (e.x < 10 || e.x + e.w > W - 10) e.vx *= -1;

      e.shootCd -= enemyDt;
      const canShoot = e.y > 90 && e.y < H * 0.66;
      if (canShoot && e.shootCd <= 0) {
        e.shootCd = (e.type === 'ace' ? rand(520, 860) : rand(980, 1700)) * dp.enemyFireCdMult;
        const baseChance = e.type === 'ace' ? 1 : (e.type === 'tough' ? 0.55 : 0.25);
        if (Math.random() < clamp(baseChance * dp.enemyShootChanceMult, 0.03, 1)) shootEnemy(e);
      }
    }
  }

  if (sk) {
    if (sk.activeT > 0) {
      sk.activeT = Math.max(0, sk.activeT - dt);
      if (sk.activeT <= 0) sk.enemyTimeScale = 1;
    }

    if (sk.charges < sk.maxCharges) {
      sk.chargeT += dt;
      while (sk.chargeT >= sk.chargeTMax && sk.charges < sk.maxCharges) {
        sk.chargeT -= sk.chargeTMax;
        sk.charges += 1;
      }
    } else {
      sk.chargeT = 0;
    }
  }

  for (const d of game.drops) {
    d.t += dt;
    d.y += d.vy * (dt / 1000);
    d.x += Math.sin(d.t / 260) * 20 * (dt / 1000);
  }

  for (const ft of game.floatTexts) {
    ft.y += ft.vy * (dt / 1000);
    ft.ttl -= dt;
  }

  game.floatTexts = game.floatTexts.filter((ft) => ft.ttl > 0);

  handleCollisions();

  if (game.stage.phase === 'boss') {
    const bossAlive = game.enemies.some((e) => e.type === 'boss' && e.hp > 0);
    if (!bossAlive) {
      const next = game.stage.level + 1;
      startStage(next);
    }
  }

  game.bullets = game.bullets.filter((b) => b.y + b.h > -30 && b.y < H + 30 && b.x + b.w > -30 && b.x < W + 30);
  game.ebullets = game.ebullets.filter((b) => b.y + b.h > -50 && b.y < H + 50 && b.x + b.w > -50 && b.x < W + 50);
  game.enemies = game.enemies.filter((e) => e.y < H + 80 && e.hp > 0);
  game.drops = game.drops.filter((d) => d.y < H + 40);
}

function shootEnemy(e) {
  const dp = difficultyParams(game.difficulty.scalePct);
  const px = game.player.x;
  const py = game.player.y;
  const ex = e.x + e.w / 2;
  const ey = e.y + e.h;
  const dx = px - ex;
  const dy = py - ey;
  const mag = Math.hypot(dx, dy) || 1;
  const ux = dx / mag;
  const uy = dy / mag;

  const speed = (e.type === 'ace' ? 220 : 175) * dp.enemyBulletSpeedMult;
  const size = e.type === 'ace' ? 7 : 6;
  const baseSpread = e.type === 'ace' ? 2 : (e.type === 'tough' ? 1 : 0);
  const spread = clamp(baseSpread + dp.enemySpreadDelta + dp.enemySpreadExtra, 0, 3);
  const s = dp.scalePct / 100;
  const angleMult = clamp(s, 0.75, 1.25);
  const baseStep = e.type === 'ace' ? 0.12 : 0.16;
  const step = baseStep * angleMult;

  for (let i = -spread; i <= spread; i++) {
    const a = i * step;
    const vx = (ux * Math.cos(a) - uy * Math.sin(a)) * speed;
    const vy = (ux * Math.sin(a) + uy * Math.cos(a)) * speed;
    game.ebullets.push({ x: ex - size / 2, y: ey, w: size, h: size, vx, vy, r: size * 0.55 });
  }
}

function handleCollisions() {
  const p = game.player;
  const dp = difficultyParams(game.difficulty.scalePct);
  const m = game.charMods || { dropMult: 1 };

  for (const e of game.enemies) {
    if (circleHit(p.x, p.y, p.r, e.x + e.w / 2, e.y + e.h / 2, e.r)) {
      onPlayerHit();
      e.hp -= 2;
    }
  }

  for (const b of game.ebullets) {
    if (circleHit(p.x, p.y, p.r * 0.85, b.x + b.w / 2, b.y + b.h / 2, b.r || 3.5)) {
      onPlayerHit();
      b.y = H + 999;
    }
  }

  for (const d of game.drops) {
    if (circleHit(p.x, p.y, p.r * 1.15, d.x, d.y, d.r)) {
      pickup(d.kind);
      d.y = H + 999;
    }
  }

  for (const b of game.bullets) {
    if (b._dead) continue;

    for (const e of game.enemies) {
      if (e.hp <= 0) continue;

      if (aabb({ x: b.x, y: b.y, w: b.w, h: b.h }, e)) {
        const beforeHp = e.hp;
        e.hp -= b.dmg;
        addDamageText(e.x + e.w / 2, e.y + e.h * 0.45, Math.min(beforeHp, b.dmg), !!b._crit);
        if (e.hp <= 0) {
          game.score += e.type === 'ace' ? 120 : (e.type === 'tough' ? 60 : 25);
          const baseChance = e.type === 'ace' ? 0.85 : 0.35;
          if (Math.random() < clamp(baseChance * dp.dropChanceMult * (m.dropMult || 1), 0.05, 0.95)) dropAt(e.x + e.w / 2, e.y + e.h / 2);
          game.shake = Math.max(game.shake, e.type === 'ace' ? 10 : 4);
        } else {
          game.score += 2;
        }

        if (b.pierce > 0) {
          b.pierce -= 1;
        } else {
          b._dead = true;
        }

        break;
      }
    }
  }

  for (const e of game.enemies) {
    if (e.hp <= 0) e.y = H + 999;
  }

  game.bullets = game.bullets.filter((b) => !b._dead);
}

function pickup(kind) {
  const m = game.charMods || { powerExtraChance: 0, bombExtraChance: 0 };
  if (kind === 'P') {
    const extra = Math.random() < (m.powerExtraChance || 0) ? 1 : 0;
    game.player.power = clamp(game.player.power + 1 + extra, 1, 6);
    game.score += 30;
    game.flash = Math.max(game.flash, 0.12);
    return;
  }

  if (kind === 'B') {
    const extra = Math.random() < (m.bombExtraChance || 0) ? 1 : 0;
    game.player.bomb = clamp(game.player.bomb + 1 + extra, 0, 5);
    game.score += 40;
    game.flash = Math.max(game.flash, 0.12);
    return;
  }

  if (kind === 'H') {
    const capHp = typeof game.player.maxHp === 'number' ? game.player.maxHp : 6;
    game.player.hp = clamp(game.player.hp + 1, 0, capHp);
    game.score += 40;
    game.flash = Math.max(game.flash, 0.12);
  }
}

function render() {
  const shakeX = (Math.random() - 0.5) * game.shake;
  const shakeY = (Math.random() - 0.5) * game.shake;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  ctx.fillStyle = '#050816';
  ctx.fillRect(0, 0, W, H);

  for (const s of game.stars) {
    const a = clamp((s.v - 20) / 90, 0.05, 0.8);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }

  if (game.state === 'select') {
    drawSelect();
  } else {
    drawPlay();
  }

  if (game.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${game.flash})`;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore();
}

function drawSelect() {
  const s = game.ship;

  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = '700 22px ui-sans-serif, system-ui';
  ctx.fillText('選擇戰機', 18, 42);

  ctx.fillStyle = 'rgba(255,255,255,0.60)';
  ctx.font = '13px ui-sans-serif, system-ui';
  ctx.fillText('←/→ 切換, Enter 開始, 或點擊畫面左/右/中', 18, 66);

  const cardX = 50;
  const cardY = 110;
  const cardW = W - 100;
  const cardH = 320;

  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  roundRect(cardX, cardY, cardW, cardH, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '700 26px ui-sans-serif, system-ui';
  ctx.fillText(s.name, cardX + 18, cardY + 46);

  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = '14px ui-sans-serif, system-ui';
  const lines = s.desc.split('\n');
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], cardX + 18, cardY + 86 + i * 22);
  }

  drawShipPreview(W / 2, cardY + 230, s.id);

  ctx.fillStyle = 'rgba(255,255,255,0.70)';
  ctx.font = '12px ui-sans-serif, system-ui';
  ctx.fillText(`${game.shipIndex + 1} / ${Ships.length}`, W - 74, cardY + cardH - 16);

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '700 18px ui-sans-serif, system-ui';
  ctx.fillText('Enter 開始', W / 2 - 48, cardY + cardH + 70);

  ctx.fillStyle = 'rgba(99,230,190,0.12)';
  roundRect(50, cardY + cardH + 40, W - 100, 52, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(99,230,190,0.25)';
  ctx.stroke();
}

function drawPlay() {
  for (const d of game.drops) drawDrop(d);
  for (const e of game.enemies) drawEnemy(e);
  for (const b of game.ebullets) drawEnemyBullet(b);
  for (const b of game.bullets) drawBullet(b);
  for (const ft of game.floatTexts) drawFloatText(ft);
  drawPlayer(game.player);

  drawHud();

  if (game.state === 'gameover') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = '800 40px ui-sans-serif, system-ui';
    ctx.fillText(game.overlayText || 'GAME OVER', 96, 320);

    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = '14px ui-sans-serif, system-ui';
    ctx.fillText('Enter 重開 / Esc 返回選機', 140, 352);
  }
}

function drawShipPreview(x, y, id) {
  ctx.save();
  ctx.translate(x, y);

  if (id === 'falcon' && assets.falcon.ready) {
    drawImageCentered(assets.falcon.img, 0, 2, 56, 56, 1);
  } else if (id === 'viper') {
    ctx.fillStyle = 'rgba(99,230,190,0.95)';
    tri(0, -18, -18, 16, 18, 16);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    tri(0, -10, -10, 12, 10, 12);
    ctx.fill();
  } else if (id === 'ion') {
    ctx.fillStyle = 'rgba(116,143,252,0.92)';
    roundRect(-12, -18, 24, 40, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(-5, -8, 10, 20, 6);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(255,209,102,0.95)';
    tri(0, -18, -14, 16, 14, 16);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.24)';
    tri(0, -8, -8, 12, 8, 12);
    ctx.fill();
  }

  ctx.restore();
}

function drawPlayer(p) {
  ctx.save();
  ctx.translate(p.x, p.y);

  const blink = p.inv > 0 ? (Math.floor(p.inv / 60) % 2 === 0) : true;
  const alpha = blink ? 1 : 0.35;

  if (game.ship.id === 'falcon' && assets.falcon.ready) {
    drawImageCentered(assets.falcon.img, 0, 2, 46, 46, alpha);
  } else if (game.ship.id === 'viper') {
    ctx.fillStyle = `rgba(99,230,190,${alpha})`;
    tri(0, -18, -15, 16, 15, 16);
    ctx.fill();
  } else if (game.ship.id === 'ion') {
    ctx.fillStyle = `rgba(116,143,252,${alpha})`;
    roundRect(-11, -18, 22, 36, 8);
    ctx.fill();
  } else {
    ctx.fillStyle = `rgba(255,209,102,${alpha})`;
    tri(0, -18, -13, 16, 13, 16);
    ctx.fill();
  }

  if (Input.isDown('ShiftLeft') || Input.isDown('ShiftRight')) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBullet(b) {
  if (b.kind === 'laser') {
    ctx.fillStyle = 'rgba(116,143,252,0.95)';
    roundRect(b.x, b.y, b.w, b.h, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    roundRect(b.x + 1, b.y + 5, Math.max(1, b.w - 2), Math.max(1, b.h - 10), 2);
    ctx.fill();
    return;
  }

  ctx.fillStyle = 'rgba(255,209,102,0.92)';
  roundRect(b.x, b.y, b.w, b.h, 3);
  ctx.fill();
}

function drawEnemyBullet(b) {
  ctx.fillStyle = 'rgba(255,107,107,0.92)';
  ctx.beginPath();
  ctx.arc(b.x + b.w / 2, b.y + b.h / 2, (b.r || 3.5), 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemy(e) {
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;

  if (e.type === 'boss') {
    ctx.fillStyle = 'rgba(255,107,107,0.18)';
    roundRect(e.x - 6, e.y - 6, e.w + 12, e.h + 12, 16);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,107,107,0.90)';
    roundRect(e.x, e.y, e.w, e.h, 16);
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    roundRect(e.x + 16, e.y + 18, e.w - 32, e.h - 36, 14);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(e.w, e.h) * 0.18, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const base = e.type === 'ace' ? 'rgba(255,107,107,0.95)' : (e.type === 'tough' ? 'rgba(255,160,122,0.92)' : 'rgba(255,255,255,0.75)');
  ctx.fillStyle = base;
  roundRect(e.x, e.y, e.w, e.h, 8);
  ctx.fill();

  const hpPct = clamp(e.hp / e.maxHp, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(e.x, e.y - 8, e.w, 5, 3);
  ctx.fill();
  ctx.fillStyle = `rgba(99,230,190,${e.type === 'ace' ? 0.95 : 0.8})`;
  roundRect(e.x, e.y - 8, e.w * hpPct, 5, 3);
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.arc(cx, cy, e.r * 0.33, 0, Math.PI * 2);
  ctx.fill();
}

function drawDrop(d) {
  const color = d.kind === 'P' ? 'rgba(99,230,190,0.95)' : (d.kind === 'B' ? 'rgba(116,143,252,0.95)' : 'rgba(255,209,102,0.95)');
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.font = '700 12px ui-sans-serif, system-ui';
  ctx.fillText(d.kind, d.x - 4, d.y + 4);
}

function roundRect(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function tri(x1, y1, x2, y2, x3, y3) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
}

let last = performance.now();
let fpsAcc = 0;
let fpsN = 0;

function loop(now) {
  const rawDt = now - last;
  last = now;
  const dt = clamp(rawDt, 0, 34);

  fpsAcc += rawDt;
  fpsN += 1;
  if (fpsAcc >= 500) {
    game.fps = Math.round((fpsN * 1000) / fpsAcc);
    fpsAcc = 0;
    fpsN = 0;
  }

  update(dt);
  render();
  updateUI();
  Input.step();

  requestAnimationFrame(loop);
}

function updateUI() {
  ui.hp.textContent = String(game.player.hp);
  ui.bomb.textContent = String(game.player.bomb);
  ui.power.textContent = String(game.player.power);
  ui.score.textContent = String(game.score);
  ui.fps.textContent = String(game.fps);
}

resetToSelect();
requestAnimationFrame(loop);
