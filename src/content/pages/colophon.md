---
title: 這個網站是怎麼做的
description: 這個網站用到的工具、字型和特效，以及它們的靈感來源。
---

## 寫作與框架

- 文章都是 Markdown 檔，用 [Astro](https://astro.build/) 建成靜態網站。

## 字型

- 全站文字主要使用台灣開發者 Max 的 [獅尾四季春（Swei Spring）](https://github.com/max32002/swei-spring)， 他把思源宋體橫筆末端的三角形拿掉，讀起來比傳統宋體乾淨、現代。

## 版面

- 點開站內連結時，新的一頁會往右邊展開，並把舊頁面往左堆疊，像一頁頁紙，這靈感來自 Andy Matuschak 的 [working notes](https://notes.andymatuschak.org/)。

## 小特效

- 蒲公英是用瀏覽器的 [Canvas 2D](https://developer.mozilla.org/zh-TW/docs/Web/API/Canvas_API) 畫的粒子拖尾，蒲公英種子的一根根冠毛和瘦果是用程式畫出來的，沒有用圖片。
- 風是用 SVG 濾鏡 [`feDisplacementMap`](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feDisplacementMap) 把頁面推出像布一樣的波紋。會想做這個效果，是因為看到 wtc-gl 的 [Verlet Cloth](https://wethegit.github.io/wtc-gl/demos/scroll-image-cloth/)。

## AI
- 以上的版面特效，都是請 AI（Claude、Codex）來來回回改出來的，而想法和靈感素材是我找的。
- 全站文章是我自己寫的，不是 AI。
