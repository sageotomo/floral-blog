// 紙角捲起：每張紙（.pane）的右下角都微微翹起一點，像一張放了一陣子的紙；
// 滑鼠靠近右下角時，紙角會跟著捲得更高，滑鼠離開後又慢慢放回去。新打開的一頁會先翹一下再落定。
//
// 做法：頁面還是真的 HTML。紙角「被捲起來」的那一塊用 clip-path 切掉（後面露出背景），
// 切口是一條平滑的曲線；再沿著曲線疊一層 SVG 的陰影和高光，看起來就像紙的邊緣捲起來、接住光。
// 只在有滑鼠的寬螢幕疊紙版面啟用；系統開了「減少動態效果」就不做。

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

if (!reducedMotion.matches && finePointer.matches && document.body.classList.contains('has-stack')) {
  // ── 可以調整的數值 ─────────────────────────────
  const REST = 0.16;               // 平常紙角翹起的程度（0 = 完全平，1 = 捲到最高）
  const CURL = { x: 150, y: 210 }; // 捲到最高時，切口沿著底邊、右邊各吃進去多少像素
  const REACH = 260;               // 滑鼠離右下角多近開始讓紙角捲起來（像素）
  const INTRO = 0.62;              // 新打開的一頁，先翹到多高再落定
  const STIFF = 90, DAMP = 13;     // 彈簧：越硬越快到位、阻尼越大越不會晃

  const NS = 'http://www.w3.org/2000/svg';
  const OUT = 80; // clip-path 往外多留的空間，讓紙原本的陰影不會被切掉

  type Curl = { pane: HTMLElement; c: number; v: number; born: number; svg: SVGSVGElement; shade: SVGPathElement; light: SVGPathElement; shown: boolean };
  const curls = new Map<HTMLElement, Curl>();
  let mx = -1e5, my = -1e5;
  let seq = 0;

  const attach = (pane: HTMLElement) => {
    if (curls.has(pane)) return;
    const id = `curl-blur-${seq++}`;
    const svg = document.createElementNS(NS, 'svg');
    svg.classList.add('pane-curl');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `
      <defs><filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9" /></filter></defs>
      <path class="pane-curl-shade" filter="url(#${id})" fill="none" stroke-linecap="round" />
      <path class="pane-curl-light" fill="none" stroke-linecap="round" />`;
    pane.append(svg);
    curls.set(pane, {
      pane, c: 0, v: 0, born: performance.now() + curls.size * 120, svg,
      shade: svg.querySelector('.pane-curl-shade')!, light: svg.querySelector('.pane-curl-light')!, shown: false,
    });
    start();
  };

  // 紙角的切口：從右邊往下，平滑地彎到底邊（往右下角鼓起來，像紙角捲起時看到的輪廓）
  const curve = (W: number, H: number, a: number, b: number) =>
    `M ${W} ${H - a} C ${W - b * 0.06} ${H - a * 0.42}, ${W - b * 0.48} ${H - a * 0.04}, ${W - b} ${H}`;

  const draw = (k: Curl) => {
    const W = k.pane.offsetWidth, H = k.pane.offsetHeight;
    const a = CURL.y * k.c, b = CURL.x * k.c;
    if (a < 0.5) {
      if (k.shown) { k.pane.style.clipPath = ''; k.svg.style.display = 'none'; k.shown = false; }
      return;
    }
    const edge = curve(W, H, a, b);
    k.pane.style.clipPath = `path('M ${-OUT} ${-OUT} H ${W + OUT} V ${H - a} H ${W} ${edge.slice(edge.indexOf('C'))} V ${H + OUT} H ${-OUT} Z')`;
    k.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    k.svg.style.display = '';
    // 陰影：沿著切口一道模糊的暗帶，切口外那一半會被切掉，只留下紙面上「快要捲起來」的那一圈暗
    k.shade.setAttribute('d', edge);
    k.shade.setAttribute('stroke-width', String(10 + 22 * k.c));
    // 高光：切口邊緣一條細細的亮線，像捲起來的紙緣接住了光
    k.light.setAttribute('d', edge);
    k.light.setAttribute('stroke-width', String(1 + 1.2 * k.c));
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
