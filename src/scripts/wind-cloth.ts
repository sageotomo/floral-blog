// 清風拂過：按一下導覽列上的風的按鈕，一陣風就從左邊吹過整個頁面，紙張像布一樣起伏、
// 皺褶從左往右推過去，風過之後紙又變回平的。
//
// 做法：頁面維持真正的 HTML（字可以選、連結可以點），只在風吹的那兩秒多，
// 把 SVG 濾鏡套到文字內容上，避免扭動半透明紙張和底圖：
//   1. 先用 JS 畫一張「皺褶地形圖」（很寬的一條，只有中間一段有皺褶，兩邊是平的）
//   2. feDisplacementMap 依地形把畫面推歪一點 → 紙的起伏
//   3. 地形圖每一格往右挪 → 皺褶那一段從左邊掃到右邊，掃過去之後畫面就是原本平的樣子
// 系統開了「減少動態效果」就不吹，風的按鈕也藏起來。

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const windButtons = document.querySelectorAll<HTMLButtonElement>('[data-wind-button]');
if (reducedMotion.matches) windButtons.forEach((button) => { button.hidden = true; });

if (!reducedMotion.matches) {
  // ── 可以調整的數值 ─────────────────────────────
  const DURATION = 8.8;            // 一陣風從左吹到右要幾秒
  const DISPLACE = 36;             // 紙被推歪的程度（像素），越大起伏越明顯、字也越歪
  const RIPPLE = { len: 260, amp: 0.6 }; // 只推歪、不打光的細波紋：間距（像素）和強度，讓字和線條像布一樣彎來彎去
  const NIGHT_BAND = 1.5;          // 夜間模式：一陣風掃過的範圍（皺褶那一段的寬度）是白天的幾倍
  const NIGHT_FOLD = 1.56;         // 夜間模式：皺褶的間距是白天的幾倍（越大波紋越寬、越疏）
  const BAND = 0.36;               // 皺褶那一段有多寬（頁面寬度的幾倍）
  const FOLD = [380, 1040];         // 皺褶的間距（像素），小 = 細碎的波紋，大 = 大片的起伏
  const SLANT = 0.12;              // 風的前緣斜多少（頁面寬度的幾倍），0 就是一條直的線

  const RES = 1 / 3;               // 地形圖的解析度（越小越省，皺褶本來就很平滑，不需要高解析）

  // ── SVG 濾鏡 ─────────────────────────────────
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.innerHTML = `
    <filter id="wind-cloth" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB" primitiveUnits="userSpaceOnUse">
      <feImage id="wind-disp-map" preserveAspectRatio="none" result="dispRaw" />
      <feGaussianBlur in="dispRaw" stdDeviation="2" result="disp" />
      <feDisplacementMap in="SourceGraphic" in2="disp" scale="${DISPLACE}" xChannelSelector="R" yChannelSelector="G" />
    </filter>`;
  document.body.append(svg);
  const dispMap = svg.querySelector('#wind-disp-map')!;

  // ── 皺褶地形圖 ───────────────────────────────
  // 寬 5 倍頁面寬、高 1.1 倍頁面高。只有中間（2.5 倍處）一段有皺褶，往兩邊漸漸變平。
  // 地形 = 幾道不同間距的波疊在一起，每道波沿著直向再微微扭動，像布被風吹出來的皺褶。
  const SPAN = 5, CENTER = 2.5;
  let cachedKey = '';
  const buildMaps = (W: number, H: number, dark: boolean) => {
    const key = `${Math.round(W)}x${Math.round(H)}-${dark ? 'dark' : 'light'}`;
    if (key === cachedKey) return;
    cachedKey = key;
    const w = Math.max(8, Math.round(W * SPAN * RES)), h = Math.max(8, Math.round(H * 1.1 * RES));
    const waves = Array.from({ length: 3 }, (_, i) => ({
      len: (FOLD[1] - (FOLD[1] - FOLD[0]) * (i / 2) * (0.8 + Math.random() * 0.4)) * (dark ? NIGHT_FOLD : 1),
      phase: Math.random() * Math.PI * 2,
      amp: 1 - i * 0.3,
      wobble: 0.5 + Math.random() * 0.8,
      wobbleLen: 600 + Math.random() * 700,
      wobblePhase: Math.random() * Math.PI * 2,
    }));
    const ampSum = waves.reduce((s, v) => s + v.amp, 0);
    // 先算每一格的高度（-1～1），再由高度算出推歪量
    const hgtGrid = new Float32Array(w * h), hgt2Grid = new Float32Array(w * h), ripGrid = new Float32Array(w * h);
    const bandHalf = BAND * (dark ? NIGHT_BAND : 1) * W;
    for (let y = 0; y < h; y++) {
      const py = y / RES - H * 0.05;                      // 這一列在頁面上的 y（像素）
      const center = CENTER * W + SLANT * W * (py / H - 0.5); // 風的前緣斜斜的
      for (let x = 0; x < w; x++) {
        const px = x / RES;                                // 這一格在地形圖上的 x（像素）
        const t = (px - center) / bandHalf;
        // 皺褶只在這一段，兩邊平滑地變平；上下也有強有弱，不會整片一樣
        const env = Math.exp(-t * t) * (0.55 + 0.45 * Math.sin((2 * Math.PI * py) / (H * 0.9) + px / 900));
        if (Math.abs(env) < 0.002) continue;
        let hgt = 0, hgt2 = 0;
        for (const v of waves) {
          const bend = v.wobble * Math.sin((2 * Math.PI * py) / v.wobbleLen + v.wobblePhase);
          const a = (2 * Math.PI * px) / v.len + v.phase + bend;
          hgt += v.amp * Math.sin(a);
          hgt2 += v.amp * Math.cos(a * 0.7 + 1.3);
        }
        hgtGrid[y * w + x] = (hgt / ampSum) * env;
        hgt2Grid[y * w + x] = (hgt2 / ampSum) * env;
        // 細波紋：沿著橫向一上一下，讓一行行的字和橫線彎成波浪
        ripGrid[y * w + x] = Math.sin((2 * Math.PI * px) / RIPPLE.len + 1.4 * Math.sin((2 * Math.PI * py) / 420)) * env;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const data = ctx.createImageData(w, h);
    const dd = data.data;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    for (let k = 0; k < w * h; k++) {
      const i = k * 4;
      // 推歪用的圖：R = 左右推、G = 上下推（上下推得比較少，像紙被掀起一點點）
      dd[i] = 128 + 127 * clamp(hgtGrid[k] * 0.8 + ripGrid[k] * RIPPLE.amp * 0.35);
      dd[i + 1] = 128 + 127 * clamp(hgt2Grid[k] * 0.35 + ripGrid[k] * RIPPLE.amp);
      dd[i + 2] = 128; dd[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    dispMap.setAttribute('href', canvas.toDataURL('image/png'));
    dispMap.setAttribute('width', String(W * SPAN));
    dispMap.setAttribute('height', String(H * 1.1));
    dispMap.setAttribute('y', String(-H * 0.05));
  };

  // 先備好第一次點擊會用到的地形圖，避免按下按鈕後才同步計算造成停頓。
  const initialFrame = document.querySelector<HTMLElement>('.site-frame');
  if (initialFrame) {
    const initialRect = initialFrame.getBoundingClientRect();
    if (initialRect.width >= 10 && initialRect.height >= 10) {
      buildMaps(initialRect.width, initialRect.height, document.documentElement.dataset.theme === 'dark');
    }
  }

  // ── 一陣風 ───────────────────────────────────
  let blowing = false;
  const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const gust = () => {
    const frame = document.querySelector<HTMLElement>('.site-frame');
    if (!frame || blowing) return;
    const rect = frame.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    if (W < 10 || H < 10) return;
    const targets = Array.from(frame.querySelectorAll<HTMLElement>('.pane-body, .site-header > *, .home, .archive'));
    const articleShell = frame.querySelector<HTMLElement>('.article-shell');
    if (articleShell && !articleShell.querySelector('.pane')) targets.push(articleShell);
    if (!targets.length) targets.push(frame);
    const dark = document.documentElement.dataset.theme === 'dark';
    buildMaps(W, H, dark);
    blowing = true;
    // 地形圖的 x：一開始皺褶在頁面左邊外面，結束時已經吹出右邊外面
    const band = BAND * (dark ? NIGHT_BAND : 1);
    const startX = -(CENTER + band * 1.8) * W, endX = -(CENTER - 1 - band * 1.8) * W;
    const setX = (x: number) => dispMap.setAttribute('x', String(x));
    setX(startX);
    targets.forEach((target) => target.classList.add('is-windy'));
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 1000 / DURATION);
      setX(startX + (endX - startX) * ease(p));
      if (p < 1) requestAnimationFrame(step);
      else { targets.forEach((target) => target.classList.remove('is-windy')); blowing = false; }
    };
    requestAnimationFrame(step);
  };

  // ── 按鈕 ─────────────────────────────────────
  windButtons.forEach((button) => button.addEventListener('click', gust));
  // 方便測試：在瀏覽器的 console 打 blowWind() 也會吹一陣
  (window as unknown as { blowWind: () => void }).blowWind = gust;
}
