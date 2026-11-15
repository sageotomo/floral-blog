export const SITE_TITLE = 'blog';
export const SITE_DESCRIPTION = '在日常裡拾起一點靈感，慢慢寫下來。';

// 筆記的類別：決定目錄裡的順序和圖示。
// 文章的 frontmatter 寫 category: 類別名稱 就會歸到那一類；這裡沒列到的類別會自動排在後面。
export const NOTE_CATEGORIES = [
  { name: '寫作方法', icon: '✍️' },
  { name: '這個網站', icon: '🌼' },
];
export const UNCATEGORIZED = { name: '未分類', icon: '🗂️' };
