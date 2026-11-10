// @ts-check
import { defineConfig } from 'astro/config';

// Gli URL restano quelli del vecchio sito (/titina.html → /titina con cleanUrls su Vercel).
export default defineConfig({
  site: 'https://www.michlemotta.com',
  build: { format: 'file' },
  trailingSlash: 'never',
});
