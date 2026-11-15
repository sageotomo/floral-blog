import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { wikilinkPlugin } from './src/lib/wikilinks.mjs';

export default defineConfig({
  site: 'https://example.com',
  markdown: {
    processor: satteri({
      features: { wikilinks: true },
      mdastPlugins: [wikilinkPlugin],
    }),
  },
});
