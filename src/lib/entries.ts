// 日記（blog）與筆記（notes）共用的查詢：全部文章、以及每一篇的反向連結。
import { getCollection } from 'astro:content';
import { extractTargets, loadIndex, resolveTarget } from './wikilinks.mjs';

export const KINDS = {
  blog: { label: '日誌', back: '← 所有日誌' },
  notes: { label: '筆記', back: '← 所有筆記' },
} as const;
export type Kind = keyof typeof KINDS;

const wrap = (kind: Kind, entry: any) => ({
  kind,
  entry,
  key: `${kind}/${entry.id}`, // 例：notes/evergreen-notes，同時也是網址路徑
  url: `/${kind}/${entry.id}/`,
  title: entry.data.title as string,
  description: (entry.data.description ?? '') as string,
});
export type Item = ReturnType<typeof wrap>;

export async function getAllItems(): Promise<Item[]> {
  const [blog, notes] = await Promise.all([getCollection('blog'), getCollection('notes')]);
  return [...blog.map((e) => wrap('blog', e)), ...notes.map((e) => wrap('notes', e))];
}

/** 給 [...slug].astro 的 getStaticPaths 用：某一類的所有頁面＋各自的反向連結。 */
export async function getPathsFor(kind: Kind) {
  const all = await getAllItems();
  const index = loadIndex();
  return all
    .filter((item) => item.kind === kind)
    .map((item) => ({
      params: { slug: item.entry.id },
      props: {
        item,
        backlinks: all
          .filter((other) => other.key !== item.key && extractTargets(other.entry.body).some((target) => resolveTarget(target, index) === item.key))
          .sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant')),
      },
    }));
}
