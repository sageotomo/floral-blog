// 對外連結一律開新分頁：Markdown 裡指向別的網站的 <a>，加上 target="_blank" 和 rel="noopener noreferrer"。
// Sätteri（Astro 7 預設的 Markdown 處理器）的 hast 外掛：在 HTML 樹上找 <a>，只改 http(s):// 或 // 開頭、且不是本站網域的連結。
// 站內連結（/blog/…、/notes/…、#…）和 wikilink 不受影響，照樣在右邊展開成新的一頁。

/** @param {{ site?: string }} [options] site：本站網址（astro.config 的 site），同網域的完整網址視為站內連結 */
export function externalLinksPlugin({ site } = {}) {
  const ownHost = site ? new URL(site).host : null;
  return {
    name: 'floral-external-links',
    element: {
      filter: ['a'],
      visit(node, ctx) {
        const href = String(node.properties?.href ?? '');
        if (!/^(https?:)?\/\//i.test(href)) return;
        let host;
        try { host = new URL(href, 'https://placeholder.invalid').host; } catch { return; }
        if (ownHost && host === ownHost) return;
        ctx.setProperty(node, 'target', '_blank');
        ctx.setProperty(node, 'rel', ['noopener', 'noreferrer']);
      },
    },
  };
}
