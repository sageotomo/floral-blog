---
title: 這個網站是怎麼做的
description: 這個網站用到的工具、字型和特效，以及它們的靈感來源。
---

這一頁記錄這個網站是用什麼做出來的，也謝謝那些給我靈感的人和作品。版面和特效都是自己寫的程式，沒有複製下面這些網站的程式碼或圖像；列在這裡，是為了把想法的來處說清楚。

## 寫作與建置

- 文章都是 Markdown 檔，用 [Astro](https://astro.build/) 建成靜態網站。
- 頁面之間的 `[[雙中括號]]` 連結，由 Astro 的 Markdown 處理器 [`@astrojs/markdown-satteri`](https://www.npmjs.com/package/@astrojs/markdown-satteri) 的 wikilinks 功能處理。
- RSS 由 [`@astrojs/rss`](https://www.npmjs.com/package/@astrojs/rss) 產生。

## 字型

- 中文：[Noto Serif TC](https://fonts.google.com/specimen/Noto+Serif+TC)，由 Google Fonts 提供，採用 SIL Open Font License 1.1。
- 英數：[Roboto](https://fonts.google.com/specimen/Roboto)，透過 [Fontsource](https://fontsource.org/) 載入，開源字型授權。
- 標題的英文：系統內建的 Georgia。

## 版面

- 點開連結時，新的一頁在右邊展開、讀過的頁收成一條書脊，這種讀法的靈感來自 Andy Matuschak 的[工作筆記](https://notes.andymatuschak.org/)。
- 文字排版和 Markdown 的呈現方式，參考了 [wiwi.blog](https://wiwi.blog/) 的閱讀感。

## 小小的特效

- **蒲公英游標**（導覽列的蒲公英按鈕）：用瀏覽器的 [Canvas 2D](https://developer.mozilla.org/zh-TW/docs/Web/API/Canvas_API) 畫的粒子拖尾，蒲公英種子的造型也是用程式畫出來的。
- **清風拂過**（導覽列的風按鈕）：用 SVG 濾鏡 [`feDisplacementMap`](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feDisplacementMap) 把頁面推出像布一樣的波紋。會想做這個效果，是因為看到 [wtc-gl 的布料示範](https://wethegit.github.io/wtc-gl/demos/scroll-image-cloth/)。
- 導覽列上的圖示都是自己畫的 SVG。
