---
title: 這個網站是怎麼做的
description: 這個網站用到的工具、字型和特效，以及它們的靈感來源。
---

## 寫作與框架

- 文章都是 Markdown 檔，用 [Astro](https://astro.build/) 建成靜態網站。

## 字型

- 全站文字：[Noto Serif TC](https://fonts.google.com/specimen/Noto+Serif+TC)，由 Google Fonts 提供，使用 SIL Open Font License 1.1。

## 版面

- 點開站內連結時，新的一頁會右邊展開，並把舊頁面往左堆疊，這種靈感來自 Andy Matuschak 的 [working notes](https://notes.andymatuschak.org/)。

## 小小的特效

- 蒲公英：用瀏覽器的 [Canvas 2D](https://developer.mozilla.org/zh-TW/docs/Web/API/Canvas_API) 畫的粒子拖尾，蒲公英種子的一根根冠毛和瘦果是用程式畫出來的，沒有用圖片。
- 風按鈕：用 SVG 濾鏡 [`feDisplacementMap`](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feDisplacementMap) 把頁面推出像布一樣的波紋。會想做這個效果，是因為看到 wtc-gl 的 [Verlet Cloth](https://wethegit.github.io/wtc-gl/demos/scroll-image-cloth/)。

## AI
- 以上的版面特效，都是請 AI（Claude）來來回回幫我改出來的，但素材和想法是我找的。
- 全站文章每個字都是我自己寫的，不是 AI。
