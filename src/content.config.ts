import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 日記：有日期，照時間排
const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    category: z.string().optional(),
  }),
});

// 筆記：知識性的短文，可標日期，靠連結彼此相連
const notes = defineCollection({
  loader: glob({ base: './src/content/notes', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    category: z.string().optional(),
    pubDate: z.coerce.date().optional(),
  }),
});

// 單頁：目前只有「關於我」
const pages = defineCollection({
  loader: glob({ base: './src/content/pages', pattern: '**/*.md' }),
  schema: z.object({ title: z.string(), description: z.string().optional() }),
});

export const collections = { blog, notes, pages };
