// 游標的蒲公英拖尾：滑鼠移動時，沿著游標走過的路徑一路留下蒲公英種子，像流星的尾巴。
// 游標怎麼走，尾巴就怎麼排：直直劃過是一條線，繞圓圈就排成一圈。
// 剛留下的種子很小、貼著路徑；越舊的越大，也被風吹得越開，所以尾巴越後面越寬，最後淡掉。
// 預設關閉，要按導覽列上的蒲公英按鈕才會打開（記在這台瀏覽器裡，下次來還是同樣的設定）。
// 只在有滑鼠的裝置啟用；系統開了「減少動態效果」就不顯示，連按鈕也藏起來。

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

const seedButtons = document.querySelectorAll<HTMLButtonElement>('[data-seed-toggle]');
if (reducedMotion.matches || !finePointer.matches) seedButtons.forEach((button) => { button.hidden = true; });

if (!reducedMotion.matches && finePointer.matches) {
  const STORAGE_KEY = 'blog-dandelion';
  let enabled = false; // 預設沒有特效
  try { enabled = localStorage.getItem(STORAGE_KEY) === 'on'; } catch {}

  // ── 可以調整的數值 ─────────────────────────────
  const SPACING = 14;          // 滑鼠每移動幾像素放出一顆種子（越小越密）
  const MAX_SEEDS = 110;       // 畫面上最多同時幾顆
  const LIFE = [2.6, 3.4];     // 每顆種子存在幾秒（隨機）
  const SIZE = [0.12, 0.7];    // 大小倍率：剛吹出來（靠近游標）最小，越舊（越往尾巴）越大
  const GROW_TIME = 2.2;       // 幾秒長到最大
  const TILT = 1.25;           // 每顆種子的傾斜角度範圍（弧度，約 ±70°）
  const OFFSET = { x: 12, y: 18 }; // 種子從游標尖端右下方多遠的地方放出來
  const WIND = { x: 14, y: 22 };   // 整條尾巴被風往右下吹的速度（像素／秒）
  const SCATTER = 26;          // 種子往四周散開的最大速度（像素／秒），越大尾巴後段越寬

  const canvas = document.createElement('canvas');
  canvas.className = 'dandelion-trail';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const ctx = canvas.getContext('2d')!;
  let dpr = 1;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
  };
  resize();
  window.addEventListener('resize', resize);

  // ── 先把幾種造型的種子畫成小圖，動畫時直接貼上，比較省效能 ──
  // 一顆種子（照寫實的蒲公英種子畫）：底下一粒褐色、細長的瘦果，往上一根細長的喙（梗），
  // 頂端散開成一大把極細的冠毛，幾十根細絲往上、往兩側放射，每根細絲還帶著更細的羽毛狀分枝
  // 小圖的邏輯尺寸（CSS 像素）
  const PAPPUS = 26;               // 冠毛的半徑
  const APEX_Y = 4 + PAPPUS;       // 冠毛散開的那一點
  const BOTTOM = PAPPUS * 2.0;     // 下段：梗加種子的長度
  const SEED_W = 2 * PAPPUS + 6, SEED_H = APEX_Y + BOTTOM + 3;
  const makeSprite = (color: string, core: string, variant: number) => {
    const rand = mulberry32(variant * 97 + 13);
    const w = SEED_W, h = SEED_H, s = dpr * 2; // 畫兩倍解析度，縮小時比較清楚
    const c = document.createElement('canvas');
    c.width = w * s; c.height = h * s;
    const g = c.getContext('2d')!;
    g.scale(s, s);
    g.lineCap = 'round';
    const cx = w / 2, apexY = APEX_Y;
    const seedTop = apexY + BOTTOM * .66, seedEnd = apexY + BOTTOM; // 梗佔下段的 2/3，種子佔 1/3
    const bend = (rand() - .5) * 4;
    const stalkX = (t: number) => cx + bend * 4 * t * (1 - t); // 梗微微彎
    // 梗（喙）：細細一根，往下稍微變粗
    g.strokeStyle = color;
    for (let k = 0; k < 2; k++) {
      g.lineWidth = k ? .45 : .7;
      g.globalAlpha = k ? 1 : .55;
      g.beginPath(); g.moveTo(cx, apexY);
      g.quadraticCurveTo(cx + bend, (apexY + seedTop) / 2, cx, seedTop); g.stroke();
    }
    // 瘦果：褐色、細長的紡錘形，上下都尖，表面有幾道淡淡的縱紋
    const sl = seedEnd - seedTop, sw = 1.7;
    g.globalAlpha = 1; g.fillStyle = core;
    g.beginPath();
    g.moveTo(cx, seedTop - 1);
    g.bezierCurveTo(cx + sw, seedTop + sl * .2, cx + sw * .9, seedTop + sl * .65, cx, seedEnd);
    g.bezierCurveTo(cx - sw * .9, seedTop + sl * .65, cx - sw, seedTop + sl * .2, cx, seedTop - 1);
    g.fill();
    g.strokeStyle = color; g.globalAlpha = .35; g.lineWidth = .3;
    for (const dx of [-.6, .6]) {
      g.beginPath(); g.moveTo(cx + dx * .5, seedTop + sl * .12); g.lineTo(cx + dx, seedTop + sl * .5); g.lineTo(cx + dx * .3, seedTop + sl * .88); g.stroke();
    }
    // 冠毛：幾十根極細的絲，從頂點往上、往兩側放射成一把撐開的傘，
    // 兩側的稍微往下垂；每根絲長短、彎度、深淺都不同
    g.strokeStyle = color;
    const n = 38 + Math.floor(rand() * 14);
    const spread = 3.9 + rand() * .4; // 弧度，約 225～245°，兩側略低於水平
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (rand() - .5) * spread;
      const side = Math.abs(Math.cos(a));                     // 越靠兩側越大
      const len = PAPPUS * (.72 + rand() * .28) * (1 - .1 * side);
      const droop = side * len * (.12 + rand() * .1);         // 兩側的絲末端往下垂
      const ex = cx + Math.cos(a) * len, ey = apexY + Math.sin(a) * len + droop;
      const mx = cx + Math.cos(a) * len * .5 + (rand() - .5) * 1.5;
      const my = apexY + Math.sin(a) * len * .5 - side * len * .06;
      g.globalAlpha = .55 + rand() * .45;
      g.lineWidth = .32 + rand() * .18;
      g.beginPath(); g.moveTo(cx, apexY); g.quadraticCurveTo(mx, my, ex, ey); g.stroke();
      // 羽毛狀的細分枝：外側一半，往外斜出幾根更細更淡的短毛
      const barbs = 2 + Math.floor(rand() * 3);
      g.globalAlpha *= .55; g.lineWidth = .22;
      for (let b = 0; b < barbs; b++) {
        const t = .5 + rand() * .45;
        // 主絲上 t 處的位置與方向
        const px = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * mx + t * t * ex;
        const py = (1 - t) * (1 - t) * apexY + 2 * (1 - t) * t * my + t * t * ey;
        const dirA = Math.atan2(ey - my, ex - mx) + (rand() < .5 ? -.45 : .45);
        const bl = len * (.1 + rand() * .1);
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(dirA) * bl, py + Math.sin(dirA) * bl); g.stroke();
      }
    }
    // 冠毛中心一點點較密的亮處
    g.globalAlpha = .7; g.fillStyle = color;
    g.beginPath(); g.arc(cx, apexY, .9, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    return c;
  };

  let sprites: HTMLCanvasElement[] = [];
  const buildSprites = () => {
    const css = getComputedStyle(document.documentElement);
    const color = css.getPropertyValue('--seed-tone').trim() || '#c2b192';
    const core = css.getPropertyValue('--seed-core').trim() || '#a07a4c';
    sprites = Array.from({ length: 8 }, (_, i) => makeSprite(color, core, i));
  };
  buildSprites();
  // 切換日夜間模式時，種子的顏色跟著換
  new MutationObserver(buildSprites).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // ── 粒子 ─────────────────────────────────
  // x0, y0 是這顆種子被留下的位置（游標走過的路徑上），之後順風飄、同時往四周散開
  type Seed = { x0: number; y0: number; vx: number; vy: number; age: number; life: number; size: number; rot: number; spin: number; phase: number; sprite: number };
  const seeds: Seed[] = [];
  let lastX: number | null = null, lastY: number | null = null, carry = 0;

  const spawn = (x: number, y: number) => {
    if (seeds.length >= MAX_SEEDS) seeds.shift();
    const a = Math.random() * Math.PI * 2, v = Math.sqrt(Math.random()) * SCATTER;
    seeds.push({
      x0: x, y0: y,
      vx: WIND.x + Math.cos(a) * v,
      vy: WIND.y + Math.sin(a) * v,
      age: 0,
      life: LIFE[0] + Math.random() * (LIFE[1] - LIFE[0]),
      size: .8 + Math.random() * .4, // 同樣年紀的種子，大小再隨機差一點
      rot: (Math.random() - .5) * 2 * TILT,
      spin: (Math.random() - .5) * .9,
      phase: Math.random() * Math.PI * 2,
      sprite: Math.floor(Math.random() * sprites.length),
    });
  };

  window.addEventListener('pointermove', (event) => {
    if (!enabled || event.pointerType === 'touch') return;
    const x = event.clientX + OFFSET.x, y = event.clientY + OFFSET.y;
    if (lastX === null || lastY === null) { lastX = x; lastY = y; return; }
    const dx = x - lastX, dy = y - lastY;
    const dist = Math.hypot(dx, dy);
    // 沿著這段移動的路徑，每隔 SPACING 放一顆，快速移動時也不會斷掉
    carry += dist;
    let placed = 0;
    while (carry >= SPACING && placed < 6) {
      carry -= SPACING;
      const t = dist ? 1 - carry / dist : 1;
      spawn(lastX + dx * t, lastY + dy * t);
      placed++;
    }
    lastX = x; lastY = y;
    start();
  }, { passive: true });
  document.addEventListener('pointerleave', () => { lastX = lastY = null; });

  // ── 導覽列上的開關 ──────────────────────────
  const applyEnabled = (on: boolean) => {
    enabled = on;
    try { localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off'); } catch {}
    seedButtons.forEach((button) => {
      const label = on ? '關閉蒲公英游標特效' : '開啟蒲公英游標特效';
      button.setAttribute('aria-pressed', String(on));
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
    });
    if (!on) { // 關掉時，畫面上的種子立刻收起來
      seeds.length = 0;
      lastX = lastY = null;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
  applyEnabled(enabled);
  seedButtons.forEach((button) => button.addEventListener('click', () => applyEnabled(!enabled)));

  // ── 動畫：只有畫面上還有種子時才跑，閒置時不耗資源 ──
  let running = false, prev = 0;
  const start = () => { if (!running) { running = true; prev = performance.now(); requestAnimationFrame(tick); } };
  const tick = (now: number) => {
    const dt = Math.min((now - prev) / 1000, .05); prev = now;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = seeds.length - 1; i >= 0; i--) {
      const s = seeds[i];
      s.age += dt;
      if (s.age >= s.life) { seeds.splice(i, 1); continue; }
      const p = s.age / s.life;
      // 從留下的位置順風飄、往四周散開；越舊的飄得越遠，尾巴後段因此越寬
      const x = s.x0 + s.vx * s.age + Math.sin(s.age * 1.6 + s.phase) * 3;
      const y = s.y0 + s.vy * s.age;
      // 一出現就淡入，後段慢慢淡出
      const alpha = Math.min(1, p / .08) * (p < .75 ? 1 : 1 - (p - .75) / .25);
      const grown = Math.min(1, s.age / GROW_TIME);
      const scale = s.size * (SIZE[0] + (SIZE[1] - SIZE[0]) * grown); // 剛放出來最小，越舊（越往尾巴）越大
      const img = sprites[s.sprite];
      const w = SEED_W * scale, h = SEED_H * scale;
      ctx.globalAlpha = alpha * .9;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(x, y);
      // 各自的傾斜角度，加上一點隨風轉動和擺動
      ctx.rotate(s.rot + s.spin * s.age + Math.sin(s.age * 1.8 + s.phase) * .15);
      ctx.drawImage(img, -w / 2, -h * (APEX_Y / SEED_H), w, h); // 以冠毛散開的那一點為轉動中心
    }
    ctx.globalAlpha = 1;
    if (seeds.length) requestAnimationFrame(tick); else running = false;
  };
}

// 固定種子的亂數，讓每一種造型每次長得都一樣
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
