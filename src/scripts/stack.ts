// 往右展開的堆疊閱讀。
// 伺服器輸出的每個文章頁本身就是「第一欄」；這支腳本只負責：
//   點站內文章連結 → fetch 那一頁 → 取出它的欄位 → 接在右邊。
// 沒有 JS 或螢幕太窄時，連結照常跳頁。
import { SITE_TITLE } from '../consts';

const DESKTOP = window.matchMedia('(min-width: 900px)');

const stack = document.querySelector<HTMLElement>('[data-stack]');
const track = stack?.querySelector<HTMLElement>('.stack-track');

if (stack && track) {
  const cache = new Map<string, Promise<HTMLElement | null>>();
  let restoreToken = 0;

  const panes = () => [...track.querySelectorAll<HTMLElement>('[data-pane]')];
  const cssPx = (name: string) => parseFloat(getComputedStyle(stack).getPropertyValue(name)) || 0;

  // 橫向捲軸會吃掉堆疊底部的高度；量出它的高度交給 CSS（--stack-sb），讓左邊導覽列和右邊每一頁的底邊對齊
  const syncScrollbar = () => {
    const sb = stack.offsetHeight - stack.clientHeight;
    document.documentElement.style.setProperty('--stack-sb', `${sb}px`);
  };
  new ResizeObserver(syncScrollbar).observe(stack);
  new ResizeObserver(syncScrollbar).observe(track);
  syncScrollbar();

  /** 連結網址 → 頁面識別（about、colophon、blog、notes、blog/檔名、notes/檔名）；其他連結回傳 null。 */
  const slugOf = (href: string) => {
    const url = new URL(href, location.href);
    if (url.origin !== location.origin) return null;
    const path = url.pathname.replace(/\/$/, '');
    if (path === '') return 'about'; // 網站第一頁＝關於我
    if (path === '/notes' || path === '/blog') return path.slice(1); // 筆記目錄、日記列表本身也是一頁
    if (path === '/colophon') return 'colophon'; // 這個網站是怎麼做的（src/pages/colophon.astro）
    const match = path.match(/^\/(blog|notes)\/(.+)$/);
    return match ? `${match[1]}/${decodeURIComponent(match[2])}` : null;
  };

  /** 所有頁面都關掉之後的網址（src/pages/blank.astro）。 */
  const BLANK = '/blank/';

  /** 頁面識別 → 網址路徑。 */
  const pathOf = (slug: string) => (slug === 'about' ? '/' : `/${slug}/`);

  const load = (slug: string) => {
    if (!cache.has(slug)) {
      cache.set(
        slug,
        fetch(pathOf(slug))
          .then((res) => (res.ok ? res.text() : Promise.reject(res.status)))
          .then((html) => new DOMParser().parseFromString(html, 'text/html').querySelector<HTMLElement>('[data-pane]'))
          .catch(() => null),
      );
    }
    return cache.get(slug)!.then((pane) => (pane ? (document.importNode(pane, true) as HTMLElement) : null));
  };

  const renumber = () => panes().forEach((pane, i) => pane.style.setProperty('--i', String(i)));

  /** 把目前開啟的欄位寫進網址：/notes/第一篇/?stack=notes/第二篇&stack=blog/第三篇 */
  const syncUrl = () => {
    const [first, ...rest] = panes();
    const url = new URL(location.href);
    // 第一頁決定網址路徑（關掉原本的第一頁時，下一頁會遞補上來）；全部關掉時是 /blank/，只剩導覽列
    url.pathname = first ? pathOf(first.dataset.slug!) : BLANK;
    url.searchParams.delete('stack');
    rest.forEach((pane) => url.searchParams.append('stack', pane.dataset.slug!));
    history.pushState(null, '', url);
    document.title = first?.dataset.title ? `${first.dataset.title}｜${SITE_TITLE}` : SITE_TITLE;
  };

  /** 依捲動位置決定每一頁的狀態（重疊／收成書脊），並標出已經開啟的連結。 */
  const update = () => {
    const list = panes();
    const spine = cssPx('--spine');
    list.forEach((pane, i) => {
      const rect = pane.getBoundingClientRect();
      const prev = list[i - 1]?.getBoundingClientRect();
      const next = list[i + 1]?.getBoundingClientRect();
      // 被下一頁蓋到只剩書脊寬：換成直排標題。只蓋到一部分時內文照常顯示。
      pane.classList.toggle('is-collapsed', !!next && next.left <= rect.left + spine + 12);
      // 壓在前一頁上面：加陰影
      pane.classList.toggle('is-overlapping', !!prev && rect.left < prev.right - 2);
    });
    const open = new Set(list.map((pane) => pane.dataset.slug));
    track.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
      const slug = slugOf(a.href);
      a.classList.toggle('is-open', !!slug && open.has(slug));
    });
  };

  /** 捲到第 i 欄。'end'：靠右完整露出（開新頁時用，保留左邊的上下文）；'start'：緊接在左邊的書脊後面展開；
      'center'：放到畫面正中央（點某一頁或某條書脊時用）。都只移動畫面，不關任何頁。 */
  const focus = (i: number, reveal: 'start' | 'end' | 'center', smooth = true) => {
    const list = panes();
    const pane = list[i];
    if (!pane) return;
    const pad = cssPx('--stack-pad');
    // 每一頁的寬度不一定相同（目錄是窄欄），所以把前面各頁的寬度加起來
    const gap = cssPx('--pane-gap');
    const natural = pad + list.slice(0, i).reduce((sum, before) => sum + before.offsetWidth + gap, 0);
    const start = natural - pad - i * cssPx('--spine');
    // 置中：如果左邊的書脊太多、擠不出正中央的位置，就退而求其次用 'start'（再往右捲它會被下一頁蓋住）
    const center = Math.min(natural - (stack.clientWidth - pane.offsetWidth) / 2, start);
    const left = reveal === 'end' ? natural + pane.offsetWidth + pad - stack.clientWidth : reveal === 'center' ? center : start;
    stack.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' });
  };

  const append = async (slug: string, animate = true) => {
    const pane = await load(slug);
    if (!pane) return false;
    if (animate) {
      // 進場動畫會位移，結束後要重算一次重疊狀態
      pane.classList.add('is-entering');
      pane.addEventListener('animationend', () => (pane.classList.remove('is-entering'), update()), { once: true });
    }
    track.append(pane);
    renumber();
    return true;
  };

  /** 從某一欄點開連結：關掉它右邊的欄位，再把新文章接上去。 */
  const open = async (slug: string, from: HTMLElement, href: string) => {
    const list = panes();
    const fromIndex = list.indexOf(from);
    const existing = list.findIndex((pane) => pane.dataset.slug === slug);
    if (existing !== -1 && existing <= fromIndex) return focus(existing, 'center');
    if (list[fromIndex + 1]?.dataset.slug === slug) return focus(fromIndex + 1, 'end');
    restoreToken++;
    list.slice(fromIndex + 1).forEach((pane) => pane.remove());
    if (!(await append(slug))) return void (location.href = href);
    syncUrl();
    update();
    focus(panes().length - 1, 'end');
  };

  /** 讓畫面符合網址（重新整理、上一頁／下一頁、別人分享的連結）。 */
  /** 關掉某一頁：只移除那一頁，其他頁留著並往左靠。最後一頁也可以關，關完只剩導覽列。 */
  const close = (pane: HTMLElement) => {
    if (pane.classList.contains('is-closing')) return;
    const i = panes().indexOf(pane);
    restoreToken++;
    const finish = () => {
      if (!pane.isConnected) return;
      pane.remove();
      renumber();
      syncUrl();
      update();
      focus(Math.min(i, panes().length - 1), 'end');
    };
    if (!DESKTOP.matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return finish();

    // 往左縮的動畫：先把寬度固定成目前的像素值（內文也固定，縮的時候才不會重新換行），再讓寬度過渡到 0
    const width = pane.offsetWidth;
    const body = pane.querySelector<HTMLElement>('.pane-body');
    pane.style.width = `${width}px`;
    if (body) body.style.width = `${width}px`;
    void pane.offsetWidth; // 強制瀏覽器先套用上面的寬度，過渡才有起點
    pane.classList.add('is-closing');
    pane.addEventListener('transitionend', (event) => event.propertyName === 'width' && finish());
    window.setTimeout(finish, 450); // 保險：萬一過渡事件沒觸發，還是會關掉
  };

  /** 某一頁目前有多少寬度看不到（被右邊的頁蓋住，或被畫面右緣切掉）。完整可見時是 0。 */
  const hiddenWidth = (pane: HTMLElement) => {
    const list = panes();
    const rect = pane.getBoundingClientRect();
    const next = list[list.indexOf(pane) + 1]?.getBoundingClientRect();
    const visibleRight = Math.min(next ? next.left : Infinity, stack.getBoundingClientRect().right);
    return Math.max(0, rect.right - visibleRight);
  };

  /** 點了某一頁：把它移到畫面正中央。只移動畫面，不關任何頁，它左右的頁全部留著。 */
  const reveal = (pane: HTMLElement) => focus(panes().indexOf(pane), 'center');

  const restore = async () => {
    // 上一頁／下一頁換到「第一頁不同」的紀錄時，直接讓瀏覽器重新載入那個網址
    if ((panes()[0]?.dataset.slug ?? null) !== slugOf(location.href)) return location.reload();
    const token = ++restoreToken;
    const wanted = DESKTOP.matches ? new URLSearchParams(location.search).getAll('stack') : [];
    const current = panes().slice(1);
    let keep = 0;
    while (keep < wanted.length && current[keep]?.dataset.slug === wanted[keep]) keep++;
    current.slice(keep).forEach((pane) => pane.remove());
    for (const slug of wanted.slice(keep)) {
      const ok = await append(slug, false);
      if (token !== restoreToken) return;
      if (!ok) break;
    }
    renumber();
    update();
    // 還原之後，把含有「已開啟文章」的類別展開，目錄才看得出現在讀的是哪一篇
    track.querySelectorAll<HTMLDetailsElement>('details').forEach((group) => {
      if (group.querySelector('a.is-open')) group.open = true;
    });
    focus(panes().length - 1, 'end', false);
  };

  track.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    // 每一頁右上角的 ×：關掉這一頁
    const closer = target.closest<HTMLElement>('.pane-close');
    if (closer) return close(closer.closest<HTMLElement>('[data-pane]')!);
    const spine = target.closest<HTMLElement>('.pane-spine');
    if (spine) return focus(panes().indexOf(spine.closest<HTMLElement>('[data-pane]')!), 'center');

    if (!DESKTOP.matches || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = target.closest<HTMLAnchorElement>('a[href]');
    const from = target.closest<HTMLElement>('[data-pane]');
    if (!from) return;
    // 這一頁有一大段看不到（超過四分之一）：不管點到的是空白、文字、連結還是類別，
    // 這一下都只用來把它移到正中央。不然點到露出來那一小條裡的連結，會開新頁並關掉右邊所有的頁。
    if (hiddenWidth(from) > from.offsetWidth * 0.25) {
      if (window.getSelection()?.toString()) return;
      event.preventDefault();
      return reveal(from);
    }
    if (!link) {
      // 點在某一頁的空白或文字上（不是連結、按鈕、可展開的類別，也不是在選取文字）：把那一頁移到畫面正中央
      if (target.closest('summary, button, input, textarea, select, label')) return;
      if (window.getSelection()?.toString()) return;
      return reveal(from);
    }
    if (link.target === '_blank') return;
    const slug = slugOf(link.href);
    if (!slug || (slug === from.dataset.slug && link.hash)) return;
    event.preventDefault();
    open(slug, from, link.href);
  });

  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  };
  stack.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('popstate', restore);

  renumber();
  restore();
}
