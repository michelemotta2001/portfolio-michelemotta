/**
 * MOTTA segue il cursore (libreria Motion, API vanilla `animate` con molla).
 * Ogni lettera si sposta e si inclina un poco verso il cursore, con intensità diverse
 * (effetto profondità); quando il cursore esce dall'hero tornano a riposo.
 * - Molla smorzata (bounce 0): niente rimbalzi, solo transform.
 * - Si muove lo strato interno .hero__glyph: l'entrata resta su .hero__letter.
 * - pointermove passivo, un solo calcolo per fotogramma; fuori dall'hero non gira nulla.
 * - Le molle animano MotionValue numerici (partenza immediata, ereditano la velocità
 *   a ogni nuovo obiettivo); styleEffect li scrive come transform sulla lettera.
 * Caricato solo da home.ts con (hover: hover) and (pointer: fine) e senza movimento ridotto.
 */

import { animate, motionValue, styleEffect, type MotionValue, type ValueAnimationTransition } from 'motion';

/** Intensità per lettera M-O-T-T-A: le lettere "più vicine" si muovono di più. */
const DEPTH = [0.7, 1, 0.55, 0.9, 0.65];
const MAX_X = 22; // px
const MAX_Y = 16; // px
const MAX_ROTATE = 3; // gradi

const FOLLOW: ValueAnimationTransition<number> = { type: 'spring', bounce: 0, visualDuration: 0.55 };
const REST: ValueAnimationTransition<number> = { type: 'spring', bounce: 0, visualDuration: 0.9 };

const clamp = (n: number) => Math.max(-1, Math.min(1, n));

type Glyph = { x: MotionValue<number>; y: MotionValue<number>; rotate: MotionValue<number> };

export function initHeroMotion(hero: HTMLElement, finePointer: MediaQueryList, reducedMotion: MediaQueryList) {
  const word = hero.querySelector<HTMLElement>('[data-hero-word]');
  const els = [...hero.querySelectorAll<HTMLElement>('[data-hero-glyph]')];
  if (!word || !els.length) return;

  const glyphs: Glyph[] = els.map((el) => {
    const g = { x: motionValue(0), y: motionValue(0), rotate: motionValue(0) };
    styleEffect(el, g);
    return g;
  });

  const to = (g: Glyph, x: number, y: number, rotate: number, opts: ValueAnimationTransition<number>) => {
    animate(g.x, x, opts);
    animate(g.y, y, opts);
    animate(g.rotate, rotate, opts);
  };

  const listeners = new AbortController();
  const opts = { passive: true, signal: listeners.signal };
  let raf = 0;
  let px = 0;
  let py = 0;

  const frame = () => {
    raf = 0;
    const w = word.getBoundingClientRect();
    const h = hero.getBoundingClientRect();
    // posizione del cursore da -1 a 1: in orizzontale rispetto alla parola, in verticale rispetto all'hero
    const nx = clamp((px - (w.left + w.width / 2)) / (w.width / 2));
    const ny = clamp((py - (w.top + w.height / 2)) / (h.height / 2));
    const last = glyphs.length - 1;
    glyphs.forEach((g, i) => {
      const pos = last ? (i / last) * 2 - 1 : 0; // posizione della lettera nella parola, da -1 a 1
      const near = 1 - 0.3 * Math.min(1, Math.abs(nx - pos)); // la lettera sotto il cursore reagisce di più
      const k = DEPTH[i % DEPTH.length] * near;
      to(g, nx * MAX_X * k, ny * MAX_Y * k, nx * MAX_ROTATE * k, FOLLOW);
    });
  };

  const rest = (instant = false) => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    glyphs.forEach((g) => to(g, 0, 0, 0, instant ? { duration: 0 } : REST));
  };

  hero.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      px = e.clientX;
      py = e.clientY;
      if (!raf) raf = requestAnimationFrame(frame);
    },
    opts,
  );
  hero.addEventListener('pointerleave', () => rest(), opts);

  // se cambia il dispositivo di puntamento o si attiva il movimento ridotto: a riposo e stop
  const stop = () => {
    if (finePointer.matches && !reducedMotion.matches) return;
    listeners.abort();
    rest(reducedMotion.matches);
  };
  finePointer.addEventListener('change', stop, { signal: listeners.signal });
  reducedMotion.addEventListener('change', stop, { signal: listeners.signal });
}
