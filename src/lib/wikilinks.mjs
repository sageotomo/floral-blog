// Wikilink 支援：[[檔名]]、[[檔名|顯示文字]]，也接受 [[文章標題]]。
// 同一套解析邏輯給兩個地方用：
//   1. wikilinkPlugin ＋ resolveWikilinksInHtml —— 把 Markdown 裡的 [[...]] 轉成連結
//   2. extractTargets  —— 文章頁用來計算反向連結
import fs from 'node:fs';
import path from 'node:path';

// 兩類內容各自的資料夾；資料夾名稱同時是網址的第一段（/blog/…、/notes/…）
const KINDS = ['blog', 'notes'];
const dirOf = (kind) => path.resolve('src/content', kind);
const WIKILINK = /\[\[([^\[\]|\n]+)(?:\|([^\[\]\n]+))?\]\]/g;

/** 把檔案路徑轉成 Astro glob loader 產生的 id（小寫、無副檔名）。 */
const toSlug = (file) => file.replace(/\\/g, '/').replace(/\.md$/, '').toLowerCase();
const norm = (s) => s.trim().toLowerCase();

function listMarkdown(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith('.') ? [] : listMarkdown(full, base);
    return entry.name.endsWith('.md') ? [path.relative(base, full)] : [];
  });
}

/** 讀出所有日記與筆記，建立「檔名或標題 → {key, url, title}」的對照表。 */
export function loadIndex() {
  const index = new Map();
  for (const kind of KINDS) {
    for (const file of listMarkdown(dirOf(kind))) {
      const slug = toSlug(file);
      const source = fs.readFileSync(path.join(dirOf(kind), file), 'utf8');
      const match = source.match(/^title:\s*(.+)$/m);
      const title = match ? match[1].trim().replace(/^(['"])(.*)\1$/, '$2') : slug;
      const entry = { key: `${kind}/${slug}`, url: `/${kind}/${slug}/`, title };
      // 檔名或標題重複時，先出現的優先（日記在前）
      for (const name of [slug, title]) if (!index.has(norm(name))) index.set(norm(name), entry);
    }
  }
  return index;
}

/** 從 Markdown 原文找出所有 wikilink 指向的目標（原樣字串）。 */
export function extractTargets(markdown = '') {
  return [...markdown.matchAll(WIKILINK)].map((m) => m[1].trim());
}

/** 目標字串 → key（例：notes/evergreen-notes）；找不到回傳 undefined。 */
export function resolveTarget(target, index = loadIndex()) {
  return index.get(norm(target))?.key;
}

/**
 * Sätteri（Astro 7 預設的 Markdown 處理器）的 mdast 外掛。
 * 開啟 features.wikilinks 之後，[[目標]] 會先被解析成 url 為「目標原文」的 link 節點。
 * 這裡「只做記號、不解析」：把目標寫進 data-wikilink 屬性。
 * 真正換成文章網址的工作留到頁面輸出時（resolveWikilinksInHtml）才做。
 *
 * 為什麼分兩段：Astro 會快取每個 md 檔轉好的 HTML，檔案內容沒變就不重轉。
 * 如果在這裡就決定「目標存不存在」，那麼之後才新增的筆記，舊文章裡指向它的連結會一直停在「待寫」。
 *
 * 判斷 wikilink 的依據：url 沒有協定、也不是 / # . ? 開頭。一般連結請照常寫完整網址或 /路徑。
 */
export const wikilinkPlugin = {
  name: 'floral-wikilinks-v2',
  link(node, ctx) {
    if (node.data?.wikilink || /^([a-z][a-z0-9+.-]*:|[/#.?])/i.test(node.url)) return;
    let target = node.url;
    try { target = decodeURIComponent(node.url); } catch {}
    const written = node.children.map((child) => child.value ?? '').join('');
    const custom = written && written !== target; // 有寫 [[目標|顯示文字]]
    ctx.replaceNode(node, {
      type: 'link',
      url: '#',
      data: { wikilink: true, hProperties: { 'data-wikilink': target, ...(custom ? {} : { 'data-wikilink-auto': 'true' }) } },
      children: [{ type: 'text', value: written || target }],
    });
  },
};

const decodeEntities = (text) =>
  text.replace(/&(amp|lt|gt|quot|#39|#x27|#(\d+)|#x([0-9a-f]+));/gi, (all, name, dec, hex) =>
    dec ? String.fromCodePoint(Number(dec)) : hex ? String.fromCodePoint(parseInt(hex, 16)) : { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#x27': "'" }[name.toLowerCase()] ?? all,
  );
const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * 頁面輸出時呼叫：把帶 data-wikilink 記號的連結換成真正的文章連結；
 * 找不到目標的，換成「待寫」樣式的文字。每次輸出都用當下的文章清單，所以不受快取影響。
 */
export function resolveWikilinksInHtml(html, index = loadIndex()) {
  return html.replace(/<a\b([^>]*\bdata-wikilink="([^"]*)"[^>]*)>([\s\S]*?)<\/a>/g, (all, attrs, rawTarget, inner) => {
    const found = index.get(norm(decodeEntities(rawTarget)));
    if (!found) return `<span class="wikilink-missing" title="這則筆記還沒寫">${inner}</span>`;
    const auto = /\bdata-wikilink-auto\b/.test(attrs); // 沒寫顯示文字：用目標文章的標題
    return `<a href="${found.url}" class="wikilink">${auto ? escapeHtml(found.title) : inner}</a>`;
  });
}
