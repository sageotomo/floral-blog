// 紙角捲起：每張紙（.pane）的右下角都微微翻起一點，像一張放了一陣子的紙；
// 滑鼠靠近右下角時，紙角會往左上翻捲得更大，滑鼠離開後又慢慢放回去。新打開的一頁會先翻一下再落定。
//
// 做法（經典的「捲頁角」）：
//   1. 沿著一條斜斜的摺線，用 clip-path 把右下角那一塊三角形切掉（後面露出背景）
//   2. 把切掉的那一塊對摺線「翻」過來，畫在紙面上當作翻起來的紙背；
//      紙背因為是捲起來的圓筒，所以畫得比真正對摺短一點、邊緣是彎的，再用漸層畫出圓筒的明暗
//   3. 翻起來的紙背底下，畫一層模糊的影子投在紙面上
// 頁面還是真的 HTML。只在有滑鼠的寬螢幕疊紙版面啟用；系統開了「減少動態效果」就不做。

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

if (!reducedMotion.matches && finePointer.matches && document.body.classList.contains('has-stack')) {
  // ── 可以調整的數值 ─────────────────────────────
  const REST = 0.16;               // 平常紙角翹起的程度（0 = 完全平，1 = 捲到最高）
  const CURL = { x: 200, y: 280 }; // 翻到最大時，摺線在底邊、右邊各離角落多少像素
  const ROLL = 0.78;               // 紙背翻過來的長度（1 = 像摺紙一樣整塊攤平，越小越像捲成圓筒）
  const REACH = 260;               // 滑鼠離右下角多近開始讓紙角捲起來（像素）
  const INTRO = 0.62;              // 新打開的一頁，先翹到多高再落定
  const STIFF = 90, DAMP = 13;     // 彈簧：越硬越快到位、阻尼越大越不會晃

  const NS = 'http://www.w3.org/2000/svg';
  const OUT = 80; // clip-path 往外多留的空間，讓紙原本的陰影不會被切掉

  type Curl = { pane: HTMLElement; c: number; v: number; born: number; svg: SVGSVGElement; shadow: SVGPathElement; flap: SVGPathElement; grad: SVGLinearGradientElement; shown: boolean };
  const curls = new Map<HTMLElement, Curl>();
  let mx = -1e5, my = -1e5;
  let seq = 0;

  const attach = (pane: HTMLElement) => {
    if (curls.has(pane)) return;
    const id = `curl-${seq++}`;
    const svg = document.createElementNS(NS, 'svg');
    svg.classList.add('pane-curl');
    svg.setAttribute('aria-hidden', 'true');
    // 紙背的明暗：摺線處（圓筒背光的那一側）略暗 → 圓筒頂端最亮 → 往紙角漸漸轉暗
    svg.innerHTML = `
      <defs>
        <filter id="${id}-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" /></filter>
        <linearGradient id="${id}-grad" gradientUnits="userSpaceOnUse">
          <stop offset="0" class="pane-curl-stop-fold" />
          <stop offset="0.38" class="pane-curl-stop-top" />
          <stop offset="1" class="pane-curl-stop-tip" />
        </linearGradient>
      </defs>
      <path class="pane-curl-shadow" filter="url(#${id}-blur)" />
      <path class="pane-curl-flap" fill="url(#${id}-grad)" />`;
    pane.append(svg);
    curls.set(pane, {
      pane, c: 0, v: 0, born: performance.now() + curls.size * 120, svg,
      shadow: svg.querySelector('.pane-curl-shadow')!, flap: svg.querySelector('.pane-curl-flap')!,
      grad: svg.querySelector('linearGradient')!, shown: false,
    });
    start();
  };

  const draw = (k: Curl) => {
    const W = k.pane.offsetWidth, H = k.pane.offsetHeight;
    const b = CURL.x * k.c, a = CURL.y * k.c;
    if (a < 0.5) {
      if (k.shown) { k.pane.style.clipPath = ''; k.svg.style.display = 'none'; k.shown = false; }
      return;
    }
    // 摺線兩端：P 在底邊、Q 在右邊；C 是紙角
    const P = [W - b, H], Q = [W, H - a], C = [W, H];
    const len = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
    const d = [(Q[0] - P[0]) / len, (Q[1] - P[1]) / len];
    const t = (C[0] - P[0]) * d[0] + (C[1] - P[1]) * d[1];
    const F = [P[0] + d[0] * t, P[1] + d[1] * t];          // 紙角到摺線的垂足
    const T = [F[0] + (F[0] - C[0]) * ROLL, F[1] + (F[1] - C[1]) * ROLL]; // 翻過來的紙角（捲起來所以短一點）
    // 紙背的兩條邊從摺線兩端彎向翻過來的紙角，往外鼓一點，像紙捲起來的弧度
    const bulge = (A: number[], B: number[], amt: number) => {
      const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
      const nx = mx - F[0], ny = my - F[1], nl = Math.hypot(nx, ny) || 1;
      return `${mx + (nx / nl) * amt} ${my + (ny / nl) * amt}`;
    };
    const flap = `M ${P[0]} ${P[1]} L ${Q[0]} ${Q[1]} Q ${bulge(Q, T, a * 0.12)} ${T[0]} ${T[1]} Q ${bulge(T, P, b * 0.05)} ${P[0]} ${P[1]} Z`;
    k.pane.style.clipPath = `path('M ${-OUT} ${-OUT} H ${W + OUT} V ${Q[1]} H ${Q[0]} L ${P[0]} ${P[1]} V ${H + OUT} H ${-OUT} Z')`;
    k.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    k.svg.style.display = '';
    k.flap.setAttribute('d', flap);
    // 影子：同樣的形狀往紙角那一側推一點、放大一點，模糊後投在紙面上
    const sx = (T[0] - F[0]) * 0.12, sy = (T[1] - F[1]) * 0.12;
    k.shadow.setAttribute('d', flap);
    k.shadow.setAttribute('transform', `translate(${sx} ${sy})`);
    k.grad.setAttribute('x1', String(F[0])); k.grad.setAttribute('y1', String(F[1]));
    k.grad.setAttribute('x2', String(T[0])); k.grad.setAttribute('y2', String(T[1]));
    k.shown = true;
  };

  // ── 動畫：只有紙角還在動的時候才跑 ──
  let running = false, prev = 0;
  const start = () => { if (!running) { running = true; prev = performance.now(); requestAnimationFrame(tick); } };
  const tick = (now: number) => {
    const dt = Math.min((now - prev) / 1000, 0.05); prev = now;
    let moving = false;
    for (const [pane, k] of curls) {
      if (!pane.isConnected) { curls.delete(pane); continue; }
      const r = pane.getBoundingClientRect();
      const d = Math.hypot(mx - r.right, my - r.bottom);
      const near = Math.max(0, 1 - d / REACH);
      let target = REST + (1 - REST) * Math.pow(near, 1.3);
      const age = (now - k.born) / 1000;
      if (age < 0) target = 0;                         // 還沒輪到它出場
      else if (age < 0.55) target = Math.max(target, INTRO); // 剛打開：先翹起來
      k.v += ((target - k.c) * STIFF - k.v * DAMP) * dt;
      k.c = Math.max(0, k.c + k.v * dt);
      if (Math.abs(target - k.c) > 0.002 || Math.abs(k.v) > 0.002 || age < 0.6) moving = true;
      draw(k);
    }
    if (moving) requestAnimationFrame(tick); else running = false;
  };

  window.addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; start(); }, { passive: true });
  document.addEventListener('pointerleave', () => { mx = my = -1e5; start(); });
  window.addEventListener('resize', start);

  // 一開始就在畫面上的紙，加上之後才打開的紙
  document.querySelectorAll<HTMLElement>('.pane').forEach(attach);
  new MutationObserver((records) => {
    for (const rec of records) rec.addedNodes.forEach((n) => {
      if (n instanceof HTMLElement) (n.matches('.pane') ? [n] : Array.from(n.querySelectorAll<HTMLElement>('.pane'))).forEach(attach);
    });
  }).observe(document.body, { childList: true, subtree: true });
}
