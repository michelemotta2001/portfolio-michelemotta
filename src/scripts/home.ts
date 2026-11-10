/**
 * Comportamenti della homepage:
 *  - lettere di MOTTA che salgono in sequenza (quando il font Anton è pronto)
 *  - entrata dei volumi della mensola quando entra nello schermo
 *  - didascalia e progetto in evidenza che seguono il volume/riga sotto il puntatore o il focus
 *    (su telefono/iPad: il volume a inizio fila mentre si scorre)
 *  - filtri per categoria: attenuano volumi e righe senza il tag, riga di stato bilingue
 *  - aria-label dei volumi nella lingua attiva
 * Senza JS la pagina resta completa: link navigabili, contenuti visibili, filtri nascosti.
 */

import { ui } from '../lib/i18n';

type Lang = 'it' | 'en';

const lang = (): Lang => (document.documentElement.lang === 'en' ? 'en' : 'it');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const desktop = matchMedia('(min-width: 1024px)');

/** Testo generato via JS: tiene entrambe le lingue nei data-attribute, così site.ts le scambia. */
function setBi(el: HTMLElement, it: string, en: string) {
  el.dataset.it = it;
  el.dataset.en = en;
  el.textContent = lang() === 'en' ? en : it;
}

const vols = [...document.querySelectorAll<HTMLAnchorElement>('.vol[data-work]')];
const rows = [...document.querySelectorAll<HTMLAnchorElement>('.row[data-work]')];
const stage = document.querySelector<HTMLElement>('[data-shelf-stage]');

/* --- 1. lettere dell'hero ------------------------------------------------- */

function initHero() {
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  if (!hero) return;
  const show = () => requestAnimationFrame(() => hero.classList.add('is-in'));
  if (reducedMotion.matches || !document.fonts) {
    show();
    return;
  }
  // aspetta Anton (al massimo 900 ms) per non animare il carattere di riserva
  const timeout = new Promise((resolve) => setTimeout(resolve, 900));
  Promise.race([document.fonts.load('400 1em Anton'), timeout]).then(show, show);
}

/* --- 2. entrata della mensola ---------------------------------------------- */

function initShelfEntry() {
  const shelf = document.querySelector<HTMLElement>('[data-shelf]');
  if (!shelf) return;
  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    shelf.classList.add('is-in');
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        shelf.classList.add('is-in');
        io.disconnect();
      }
    },
    { threshold: 0.12 },
  );
  io.observe(stage ?? shelf);
}

/* --- 3. lavoro attivo: didascalia + progetto in evidenza ------------------ */

function initActive() {
  const panels = [...document.querySelectorAll<HTMLElement>('[data-feat-panel]')];
  const capNum = document.querySelector<HTMLElement>('[data-cap-num]');
  const capTitle = document.querySelector<HTMLElement>('[data-cap-title]');
  const capKind = document.querySelector<HTMLElement>('[data-cap-kind]');
  let current = 0;

  const setActive = (i: number) => {
    const vol = vols[i];
    if (i === current || !vol) return;
    current = i;
    const d = vol.dataset;
    if (capNum) capNum.textContent = d.num ?? '';
    if (capTitle) capTitle.textContent = d.title ?? '';
    if (capKind) setBi(capKind, d.kindIt ?? '', d.kindEn ?? d.kindIt ?? '');
    panels.forEach((panel) => {
      const on = Number(panel.dataset.featPanel) === i;
      panel.classList.toggle('is-active', on);
      panel.inert = !on;
    });
  };

  // puntatore (non il tocco, che apre direttamente il lavoro) e focus da tastiera
  [...vols, ...rows].forEach((el) => {
    const i = Number(el.dataset.work);
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'touch') setActive(i);
    });
    el.addEventListener('focus', () => setActive(i));
  });

  // telefono/iPad: la didascalia segue il volume a inizio fila mentre si scorre
  if (stage && vols.length) {
    let raf = 0;
    const update = () => {
      raf = 0;
      if (desktop.matches) return;
      const x = stage.scrollLeft;
      const max = stage.scrollWidth - stage.clientWidth;
      if (max > 0 && x >= max - 4) {
        setActive(vols.length - 1); // fine corsa: gli ultimi non arrivano mai a inizio fila
        return;
      }
      const origin = vols[0].offsetLeft;
      let best = 0;
      let dist = Infinity;
      vols.forEach((v, i) => {
        const d = Math.abs(v.offsetLeft - origin - x);
        if (d < dist) {
          dist = d;
          best = i;
        }
      });
      setActive(best);
    };
    stage.addEventListener(
      'scroll',
      () => {
        if (!raf) raf = requestAnimationFrame(update);
      },
      { passive: true },
    );
  }

  return setActive;
}

/* --- 4. filtri per categoria ----------------------------------------------- */

function initFilters(setActive: (i: number) => void) {
  const root = document.querySelector<HTMLElement>('[data-filters]');
  if (!root) return;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  const status = root.querySelector<HTMLElement>('[data-filter-status]');
  const items = [...vols, ...rows];
  const total = vols.length;
  let active: string | null = null;

  const render = () => {
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === active)));

    let first = -1;
    items.forEach((el) => {
      const match = !active || (el.dataset.tags ?? '').split('|').includes(active);
      el.classList.toggle('is-dim', !match);
      if (match && first < 0) first = Number(el.dataset.work);
    });

    if (status) {
      const btn = buttons.find((b) => b.dataset.filter === active);
      if (!active || !btn) {
        setBi(status, `${ui.allWorks.it}: ${total}`, `${ui.allWorks.en}: ${total}`);
      } else {
        const n = Number(btn.dataset.count);
        setBi(
          status,
          `${btn.dataset.labelIt}: ${n} ${n === 1 ? 'lavoro' : 'lavori'} — clicca di nuovo per vederli tutti`,
          `${btn.dataset.labelEn}: ${n} ${n === 1 ? 'work' : 'works'} — click again to see them all`,
        );
      }
    }

    if (!active || first < 0) return;
    // il primo lavoro del filtro diventa quello attivo; su telefono/iPad la fila ci scorre sopra
    setActive(first);
    if (stage && !desktop.matches && vols[first]) {
      stage.scrollTo({
        left: vols[first].offsetLeft - vols[0].offsetLeft,
        behavior: reducedMotion.matches ? 'auto' : 'smooth',
      });
    }
  };

  buttons.forEach((b) =>
    b.addEventListener('click', () => {
      const tag = b.dataset.filter ?? null;
      active = active === tag ? null : tag; // secondo clic: di nuovo tutti
      render();
    }),
  );
}

/* --- 5. aria-label dei volumi nella lingua attiva --------------------------- */

function initAriaLang() {
  const apply = (l: Lang) => {
    document.querySelectorAll<HTMLElement>('[data-aria-it][data-aria-en]').forEach((el) => {
      const label = l === 'en' ? el.dataset.ariaEn : el.dataset.ariaIt;
      if (label) el.setAttribute('aria-label', label);
    });
  };
  document.addEventListener('mm:lang', (e) => apply((e as CustomEvent<Lang>).detail));
  if (lang() === 'en') apply('en');
}

initHero();
initShelfEntry();
initFilters(initActive());
initAriaLang();
