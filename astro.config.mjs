import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { wikilinkPlugin } from './src/lib/wikilinks.mjs';
import { externalLinksPlugin } from './src/lib/external-links.mjs';

const site = 'https://example.com';

export default defineConfig({
  site,
  markdown: {
    processor: satteri({
      features: { wikilinks: true },
      mdastPlugins: [wikilinkPlugin],
      hastPlugins: [externalLinksPlugin({ site })],
    }),
  },
});
