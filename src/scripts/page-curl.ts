// 紙角被風掀起：每張紙（.pane）的右下角和右上角，一直被一陣陣微風輕輕掀起、又落下，
// 像放在窗邊的紙。按導覽列的風按鈕吹一陣大風時，紙角會被掀得更高；新打開的一頁會先翻一下再落定。
//
// 做法（經典的「捲頁角」，兩個角各做一次）：
//   1. 沿著一條斜斜的摺線，用 clip-path 把角落那一塊三角形切掉（後面露出背景）
//   2. 把切掉的那一塊對摺線「翻」過來，畫在紙面上當作翻起來的紙背；
//      紙背因為是捲起來的圓筒，所以畫得比真正對摺短一點、邊緣是彎的，再用漸層畫出圓筒的明暗
//   3. 翻起來的紙背底下，畫一層模糊的影子投在紙面上
//   4. 翻起多少由幾道不同快慢的波疊出來的「微風」決定，所以會一直輕輕地、不規則地動
// 頁面還是真的 HTML。只在有滑鼠的寬螢幕疊紙版面啟用；系統開了「減少動態效果」就不做。

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

if (!reducedMotion.matches && finePointer.matches && document.body.classList.contains('has-stack')) {
  document.body.classList.add('has-paper-curl'); // 讓關閉按鈕往左挪，避開右上角翻起來的紙角
  // ── 可以調整的數值 ─────────────────────────────
  // 每個角：摺線離角落最遠能到多少像素（x 沿著上／下邊、y 沿著右邊），以及微風吹動時翻起的範圍（0～1 是上面那個最大值的幾成）
  const CORNERS = {
    bottom: { x: 480, y: 800, breeze: [0.06, 0.32] as const, lag: 0 },
    top:    { x: 220, y: 300, breeze: [0.04, 0.22] as const, lag: 0.9 }, // 右上角稍晚一點才被吹到；翻得比較小，免得蓋住關閉按鈕
  };
  const BREEZE_SPEED = 1;          // 微風的快慢（越大紙角動得越快）
  const GUST = 0.32;               // 按風按鈕時，紙角額外被掀起多少
  const INTRO = 0.4;               // 新打開的一頁，先翻起多少再落定
  const ROLL = 0.78;               // 紙背翻過來的長度（1 = 像摺紙一樣整塊攤平，越小越像捲成圓筒）

  const NS = 'http://www.w3.org/2000/svg';
  const OUT = 80; // clip-path 往外多留的空間，讓紙原本的陰影不會被切掉
  type CornerKey = keyof typeof CORNERS;
  type Part = { flap: SVGPathElement; shadow: SVGPathElement; grad: SVGLinearGradientElement; blur: SVGElement };
  type Curl = { pane: HTMLElement; born: number; seed: number; svg: SVGSVGElement; parts: Record<CornerKey, Part>; shown: boolean };
  const curls = new Map<HTMLElement, Curl>();
  let seq = 0;
  let gustAt = -1e9;

  const attach = (pane: HTMLElement) => {
    if (curls.has(pane)) return;
    const id = `curl-${seq++}`;
    const svg = document.createElementNS(NS, 'svg');
    svg.classList.add('pane-curl');
    svg.setAttribute('aria-hidden', 'true');
    // 紙背的明暗：摺線處（圓筒背光的那一側）略暗 → 圓筒頂端最亮 → 往紙角漸漸轉暗
    const part = (key: CornerKey) => `
      <filter id="${id}-${key}-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
      <linearGradient id="${id}-${key}-grad" gradientUnits="userSpaceOnUse">
        <stop offset="0" class="pane-curl-stop-fold" />
        <stop offset="0.38" class="pane-curl-stop-top" />
        <stop offset="1" class="pane-curl-stop-tip" />
      </linearGradient>
      <path class="pane-curl-shadow" data-corner="${key}" filter="url(#${id}-${key}-blur)" />
      <path class="pane-curl-flap" data-corner="${key}" fill="url(#${id}-${key}-grad)" />`;
    svg.innerHTML = part('bottom') + part('top');
    pane.append(svg);
    const get = (key: CornerKey): Part => ({
      flap: svg.querySelector(`.pane-curl-flap[data-corner="${key}"]`)!,
      shadow: svg.querySelector(`.pane-curl-shadow[data-corner="${key}"]`)!,
      grad: svg.querySelector(`#${id}-${key}-grad`)!,
      blur: svg.querySelector(`#${id}-${key}-blur feGaussianBlur`)!,
    });
    curls.set(pane, {
      pane, born: performance.now() / 1000 + curls.size * 0.12, seed: Math.random() * 100, svg,
      parts: { bottom: get('bottom'), top: get('top') }, shown: false,
    });
    start();
  };

  // 一個角的摺線、翻過來的紙背；C 是紙角，P 在上／下邊，Q 在右邊
  const corner = (part: Part, W: number, H: number, top: boolean, a: number, b: number) => {
    const C = top ? [W, 0] : [W, H];
    const P = top ? [W - b, 0] : [W - b, H];
    const Q = top ? [W, a] : [W, H - a];
    const len = Math.hypot(Q[0] - P[0], Q[1] - P[1]) || 1;
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
    part.flap.setAttribute('d', flap);
    // 影子：同樣的形狀往紙角那一側推一點，模糊後投在紙面上；翻得越大影子越柔
    part.shadow.setAttribute('d', flap);
    part.shadow.setAttribute('transform', `translate(${(T[0] - F[0]) * 0.12} ${(T[1] - F[1]) * 0.12})`);
    part.blur.setAttribute('stdDeviation', String(3 + 0.035 * Math.max(a, b)));
    part.grad.setAttribute('x1', String(F[0])); part.grad.setAttribute('y1', String(F[1]));
    part.grad.setAttribute('x2', String(T[0])); part.grad.setAttribute('y2', String(T[1]));
    return { P, Q };
  };

  // 微風：三道快慢不同的波疊在一起，再乘上一道很慢的起伏（有時候風大一點、有時候幾乎停），所以不會規律地擺
  const breeze = (t: number, seed: number) => {
    const s = t * BREEZE_SPEED + seed;
    const wave = 0.55 * Math.sin(s * 0.9) + 0.3 * Math.sin(s * 1.73 + 1.1) + 0.15 * Math.sin(s * 3.1 + 2.3);
    const swell = 0.6 + 0.4 * Math.sin(s * 0.21 + 0.7);
    return Math.max(0, Math.min(1, (0.5 + 0.5 * wave) * swell));
  };

  const amount = (k: Curl, key: CornerKey, now: number) => {
    const cfg = CORNERS[key];
    const age = now - k.born - cfg.lag * 0.3;
    if (age < 0) return 0;                                   // 還沒輪到它出場
    let c = cfg.breeze[0] + (cfg.breeze[1] - cfg.breeze[0]) * breeze(now - cfg.lag, k.seed);
    c *= Math.min(1, age / 0.6);                             // 剛出現時慢慢加入微風
    c += INTRO * (age < 0.35 ? age / 0.35 : Math.exp(-(age - 0.35) * 2.5)); // 新打開：先翻一下再落定
    const g = now - gustAt - 1.2 - cfg.lag * 0.25;           // 大風從左邊吹過來，大約 1 秒多後吹到紙的右邊
    if (g > 0 && g < 2.2) c += GUST * Math.pow(Math.sin((Math.PI * g) / 2.2), 2);
    return Math.min(1, c);
  };

  const draw = (k: Curl, now: number) => {
    const W = k.pane.offsetWidth, H = k.pane.offsetHeight;
    k.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const cb = amount(k, 'bottom', now), ct = amount(k, 'top', now);
    const bb = Math.min(CORNERS.bottom.x, W * 0.9) * cb, ab = Math.min(CORNERS.bottom.y, H * 0.6) * cb;
    const bt = Math.min(CORNERS.top.x, W * 0.9) * ct, at = Math.min(CORNERS.top.y, H * 0.35) * ct;
    const B = corner(k.parts.bottom, W, H, false, Math.max(ab, 0.01), Math.max(bb, 0.01));
    const T = corner(k.parts.top, W, H, true, Math.max(at, 0.01), Math.max(bt, 0.01));
    k.pane.style.clipPath = `path('M ${-OUT} ${-OUT} H ${T.P[0]} V 0 L ${T.Q[0]} ${T.Q[1]} H ${W + OUT} V ${B.Q[1]} H ${W} L ${B.P[0]} ${B.P[1]} V ${H + OUT} H ${-OUT} Z')`;
    if (!k.shown) { k.svg.style.display = ''; k.shown = true; }
  };

  // ── 動畫：一直輕輕地動。被右邊的紙蓋住的紙角看不到，就先不畫，省一點力 ──
  let running = false;
  const start = () => { if (!running) { running = true; requestAnimationFrame(tick); } };
  const tick = () => {
    const now = performance.now() / 1000;
    const panes = Array.from(curls.keys()).filter((p) => p.isConnected);
    curls.forEach((_, p) => { if (!p.isConnected) curls.delete(p); });
    const rects = panes.map((p) => p.getBoundingClientRect());
    panes.forEach((pane, i) => {
      const covered = rects.some((r, j) => j !== i && r.left > rects[i].left && r.left < rects[i].right - 4);
      if (!covered) draw(curls.get(pane)!, now);
    });
    if (curls.size) requestAnimationFrame(tick); else running = false;
  };

  // 按導覽列的風按鈕（src/scripts/wind-cloth.ts）時，紙角也一起被吹得更高
  window.addEventListener('wind-gust', () => { gustAt = performance.now() / 1000; start(); });

  // 一開始就在畫面上的紙，加上之後才打開的紙
  document.querySelectorAll<HTMLElement>('.pane').forEach(attach);
  new MutationObserver((records) => {
    for (const rec of records) rec.addedNodes.forEach((n) => {
      if (n instanceof HTMLElement) (n.matches('.pane') ? [n] : Array.from(n.querySelectorAll<HTMLElement>('.pane'))).forEach(attach);
    });
  }).observe(document.body, { childList: true, subtree: true });
}
