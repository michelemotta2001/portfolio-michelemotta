import type { Bi } from './i18n';
import projectsJson from '../data/projects.json';
import siteJson from '../data/site.json';

export interface Model { src: string; look: number; side: Bi }
export interface Tab { id: string; label: Bi; images: string[]; spread?: boolean }
export interface YarnRow { name: Bi; nm: string; comp: Bi }

export interface Project {
  slug: string;
  order: number;
  type: 'project' | 'editorial';
  title: string;
  subtitle?: string;
  accent: string;
  year: string;
  kind: Bi;
  tags: string[];
  role: Bi;
  excerpt: Bi;
  /** Righe di contesto (HTML con <br>): corso, ateneo, relatore, collaboratori… */
  context: Bi;
  /** Paragrafi (possono contenere <b>/<em>) */
  paragraphs: Bi[];
  article?: { label: string; href: string };
  cover: string;
  next: string;
  // solo progetti
  intro?: string[];
  lineup?: { plates: string[]; models: Model[] };
  tabs?: Tab[];
  filati?: { intro: Bi; rows: YarnRow[] };
  // solo editoriali
  gallery?: string[];
}

export const projects = projectsJson as Project[];
export const site = siteJson as typeof siteJson;

export const bySlug = (slug: string): Project => {
  const p = projects.find((x) => x.slug === slug);
  if (!p) throw new Error(`Progetto non trovato: ${slug}`);
  return p;
};

/** URL pubblico di un lavoro (Vercel cleanUrls: /titina serve titina.html) */
export const workHref = (slug: string) => `/${slug}`;

export const pad2 = (n: number) => String(n).padStart(2, '0');
