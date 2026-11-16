// 清風拂過：按一下導覽列上的風的按鈕，一陣風就從左邊吹過整個頁面，紙張像布一樣起伏、
// 皺褶帶著光影從左往右推過去，風過之後紙又變回平的。
//
// 做法：頁面維持真正的 HTML（字可以選、連結可以點），只在風吹的那兩秒多，
// 把一個 SVG 濾鏡套到 .site-frame 上：
//   1. 先用 JS 畫一張「皺褶地形圖」（很寬的一條，只有中間一段有皺褶，兩邊是平的）
//   2. feDisplacementMap 依地形把畫面推歪一點 → 紙的起伏
//   3. 同一張地形先用 JS 算好打光（亮面、暗面、布的反光），做成兩張明暗圖，疊在畫面上
//   4. 地形圖每一格往右挪 → 皺褶那一段從左邊掃到右邊，掃過去之後畫面就是原本平的樣子
// 系統開了「減少動態效果」就不吹，風的按鈕也藏起來。

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const windButtons = document.querySelectorAll<HTMLButtonElement>('[data-wind-button]');
if (reducedMotion.matches) windButtons.forEach((button) => { button.hidden = true; });

if (!reducedMotion.matches) {
  // ── 可以調整的數值 ─────────────────────────────
  const DURATION = 4.4;            // 一陣風從左吹到右要幾秒
  const DISPLACE = 22;             // 紙被推歪的程度（像素），越大起伏越明顯、字也越歪
  const SHADE = 0.45;              // 皺褶明暗的強度（0～1.5）
  const SHEEN = 0.09;              // 布面光澤的強度（0 就是沒有反光）
  const DAY_SHADOW = 0.33;         // 白天模式：皺褶暗面的深淺（1 = 跟 SHADE 一樣，越小暗面越淡）
  const NIGHT_LIGHT = 0.12;        // 夜間模式：皺褶亮面和光澤的亮度（1 = 跟 SHADE、SHEEN 一樣，越小越暗）
  const NIGHT_SHADOW = 0.65;       // 夜間模式：皺褶暗面的深淺（1 = 跟 SHADE 一樣，越小越淡）
  const NIGHT_BAND = 1.5;          // 夜間模式：一陣風掃過的範圍（皺褶那一段的寬度）是白天的幾倍
  const NIGHT_FOLD = 1.56;         // 夜間模式：皺褶的間距是白天的幾倍（越大波紋越寬、越疏）
  const BAND = 0.36;               // 皺褶那一段有多寬（頁面寬度的幾倍）
  const FOLD = [190, 520];         // 皺褶的間距（像素），小 = 細碎的波紋，大 = 大片的起伏
  const SLANT = 0.12;              // 風的前緣斜多少（頁面寬度的幾倍），0 就是一條直的線

  const RES = 1 / 3;               // 地形圖的解析度（越小越省，皺褶本來就很平滑，不需要高解析）
  const RELIEF = 30;               // 皺褶的高低落差（像素），越大陰影越深、越立體
  const LIGHT = { azimuth: 210, elevation: 52 }; // 光從哪個方向、多高的角度照過來（度）
  const SPEC_EXP = 16;             // 反光的集中程度，越大越像緞面、越小越像棉布

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
      <feImage id="wind-shade-map" preserveAspectRatio="none" result="shade" />
      <feImage id="wind-spec-map" preserveAspectRatio="none" result="spec" />
      <feDisplacementMap in="SourceGraphic" in2="disp" scale="${DISPLACE}" xChannelSelector="R" yChannelSelector="G" result="moved" />
      <feComposite id="wind-shade" in="moved" in2="shade" operator="arithmetic" k1="0" k2="1" k3="0" k4="0" result="shaded" />
      <feComposite in="spec" in2="moved" operator="in" result="specIn" />
      <feComposite id="wind-sheen" in="shaded" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="0" k4="0" />
    </filter>`;
  document.body.append(svg);
  const maps = ['#wind-disp-map', '#wind-shade-map', '#wind-spec-map'].map((id) => svg.querySelector(id)!);
  const shade = svg.querySelector('#wind-shade')!;
  const sheen = svg.querySelector('#wind-sheen')!;

  // ── 皺褶地形圖 ───────────────────────────────
  // 寬 5 倍頁面寬、高 1.1 倍頁面高。只有中間（2.5 倍處）一段有皺褶，往兩邊漸漸變平。
  // 地形 = 幾道不同間距的波疊在一起，每道波沿著直向再微微扭動，像布被風吹出來的皺褶。
  const SPAN = 5, CENTER = 2.5;
  let cachedKey = '';
  const buildMaps = (W: number, H: number, dark: boolean) => {
    const key = `${Math.round(W)}x${Math.round(H)}-${dark ? 'dark' : 'light'}`;
    // 白天只把暗面調淡、夜間只把亮面調暗
    const darkSide = dark ? NIGHT_SHADOW : DAY_SHADOW, lightSide = dark ? NIGHT_LIGHT : 1;
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
    // 先算每一格的高度（-1～1），再由高度算出推歪量和打光
    const hgtGrid = new Float32Array(w * h), hgt2Grid = new Float32Array(w * h);
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
      }
    }
    // 光的方向、反光的半程向量（光和視線的中間）
    const az = (LIGHT.azimuth * Math.PI) / 180, el = (LIGHT.elevation * Math.PI) / 180;
    const L = [Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el)];
    const hl = Math.hypot(L[0], L[1], L[2] + 1);
    const Hv = [L[0] / hl, L[1] / hl, (L[2] + 1) / hl];
    const flatDiffuse = L[2], flatSpec = Math.pow(Hv[2], SPEC_EXP);
    const step = 1 / RES;                                  // 一格是幾像素
    const canvases = [0, 1, 2].map(() => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });
    const datas = canvases.map((c) => c.getContext('2d')!.createImageData(w, h));
    const [dd, sd, pd] = datas.map((d) => d.data);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const k = y * w + x, i = k * 4;
        const hg = hgtGrid[k];
        // 推歪用的圖：R = 左右推、G = 上下推（上下推得比較少，像紙被掀起一點點）
        dd[i] = 128 + 127 * hg;
        dd[i + 1] = 128 + 127 * hgt2Grid[k] * 0.45;
        dd[i + 2] = 128; dd[i + 3] = 255;
        // 打光：用左右、上下相鄰格子的高度差算出這一點的斜面方向
        const xl = hgtGrid[y * w + Math.max(0, x - 1)], xr = hgtGrid[y * w + Math.min(w - 1, x + 1)];
        const yu = hgtGrid[Math.max(0, y - 1) * w + x], yd = hgtGrid[Math.min(h - 1, y + 1) * w + x];
        const nx = -((xr - xl) * RELIEF) / (2 * step), ny = -((yd - yu) * RELIEF) / (2 * step);
        const nl = Math.hypot(nx, ny, 1);
        const diffuse = (nx * L[0] + ny * L[1] + L[2]) / nl;
        const spec = Math.pow(Math.max(0, (nx * Hv[0] + ny * Hv[1] + Hv[2]) / nl), SPEC_EXP);
        // 明暗圖：128 = 跟平的時候一樣亮；比 128 亮是迎光面、暗是背光面
        const lit = (diffuse - flatDiffuse) * 1.6;
        const sv = 128 + 127 * Math.max(-1, Math.min(1, lit * (lit < 0 ? darkSide : lightSide)));
        sd[i] = sd[i + 1] = sd[i + 2] = sv; sd[i + 3] = 255;
        // 反光圖：只留下比平面更亮的那一點點光澤
        const pv = 255 * Math.max(0, Math.min(1, (spec - flatSpec) * 2));
        pd[i] = pd[i + 1] = pd[i + 2] = pv; pd[i + 3] = 255;
      }
    }
    canvases.forEach((c, n) => c.getContext('2d')!.putImageData(datas[n], 0, 0));
    maps.forEach((el, n) => {
      el.setAttribute('href', canvases[n].toDataURL('image/png'));
      el.setAttribute('width', String(W * SPAN));
      el.setAttribute('height', String(H * 1.1));
      el.setAttribute('y', String(-H * 0.05));
    });
  };

  // ── 一陣風 ───────────────────────────────────
  let blowing = false;
  const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const gust = () => {
    const frame = document.querySelector<HTMLElement>('.site-frame');
    if (!frame || blowing) return;
    const rect = frame.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    if (W < 10 || H < 10) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    buildMaps(W, H, dark);
    blowing = true;
    // 地形圖的 x：一開始皺褶在頁面左邊外面，結束時已經吹出右邊外面
    const band = BAND * (dark ? NIGHT_BAND : 1);
    const startX = -(CENTER + band * 1.8) * W, endX = -(CENTER - 1 - band * 1.8) * W;
    const setX = (x: number) => maps.forEach((el) => el.setAttribute('x', String(x)));
    setX(startX);
    // 明暗：原圖 × (1 + SHADE × (明暗圖 − 0.5) × 2)，明暗圖是 0.5 的地方就跟原本一樣
    shade.setAttribute('k1', String(2 * SHADE));
    shade.setAttribute('k2', String(1 - SHADE));
    // 光澤：再加上一點反光
    sheen.setAttribute('k3', String(SHEEN * (dark ? NIGHT_LIGHT : 1)));
    frame.classList.add('is-windy');
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 1000 / DURATION);
      setX(startX + (endX - startX) * ease(p));
      if (p < 1) requestAnimationFrame(step);
      else { frame.classList.remove('is-windy'); blowing = false; }
    };
    requestAnimationFrame(step);
  };

  // ── 按鈕 ─────────────────────────────────────
  windButtons.forEach((button) => button.addEventListener('click', gust));
  // 方便測試：在瀏覽器的 console 打 blowWind() 也會吹一陣
  (window as unknown as { blowWind: () => void }).blowWind = gust;
}
