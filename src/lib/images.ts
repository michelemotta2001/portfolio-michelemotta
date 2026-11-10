import type { ImageMetadata } from 'astro';

/** Tutte le immagini del sito, ottimizzate da astro:assets (WebP, srcset, lazy). */
const files = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/img/**/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG}',
  { eager: true },
);

/** Percorso relativo a src/assets/img, es. "titina/outfit-01.jpg" */
export function img(path: string): ImageMetadata {
  const m = files[`/src/assets/img/${path}`];
  if (!m) throw new Error(`Immagine non trovata: ${path}`);
  return m.default;
}
