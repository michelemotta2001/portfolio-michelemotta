/**
 * Sitemap statica (generata al build in dist/sitemap.xml): homepage + tutti i lavori.
 * URL assoluti senza .html, come li serve Vercel con cleanUrls.
 */
import type { APIRoute } from 'astro';
import { projects, workHref } from '../lib/data';

const FALLBACK_SITE = 'https://www.michlemotta.com';

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL(FALLBACK_SITE);
  const paths = ['/', ...[...projects].sort((a, b) => a.order - b.order).map((p) => workHref(p.slug))];

  const urls = paths
    .map((path) => `  <url>\n    <loc>${new URL(path, base).href}</loc>\n  </url>`)
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
