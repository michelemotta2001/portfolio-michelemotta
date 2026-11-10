/**
 * Pagine progetto:
 *  - intro: il testo sticky deve stare nello schermo; se non entra si ferma col fondo
 *  - line up: la pista a scorrimento cambia il modello sul palco (rAF, listener passivo)
 *  - archivio: tab ARIA (frecce, Home/End), sfumatura sulla barra, ingresso del pannello
 */

type Lang = 'it' | 'en';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const EASE_OUT_QUART = 'cubic-bezier(0.25, 1, 0.5, 1)';
const EASE_OUT_EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';

const pad2 = (n: number) => String(n).padStart(2, '0');
const lang = (): Lang => (document.documentElement.lang === 'en' ? 'en' : 'it');
const headerH = () =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 64;

/* --- Intro ------------------------------------------------------------------ */

function initIntro(root: HTMLElement) {
  if (root.dataset.mode !== 'sticky') return;
  const text = root.querySelector<HTMLElement>('[data-intro-text]');
  if (!text) return;
  const wide = matchMedia('(min-width: 900px)');
  const MARGIN = 24;

  // La tipografia è calibrata via CSS; questo è il paracadute per schermi molto bassi:
  // se il testo è più alto dello spazio, top negativo = scorre e poi si ferma col fondo.
  const fit = () => {
    if (!wide.matches) {
      text.style.removeProperty('--pj-stick');
      return;
    }
    const room = innerHeight - headerH() - MARGIN * 2;
    const h = text.offsetHeight;
    if (h > room) text.style.setProperty('--pj-stick', `${Math.round(innerHeight - h - MARGIN)}px`);
    else text.style.removeProperty('--pj-stick');
  };

  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(text);
  addEventListener('resize', fit, { passive: true });
  wide.addEventListener('change', fit);
  fit();
}

/* --- Line up: sequenza a scorrimento ---------------------------------------- */

function initLineup(root: HTMLElement) {
  const track = root.querySelector<HTMLElement>('[data-lu-track]');
  const stage = root.querySelector<HTMLElement>('[data-lu-stage]');
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-lu-item]'));
  if (!track || !stage || !items.length) return;

  const num = root.querySelector<HTMLElement>('[data-lu-num]');
  const side = root.querySelector<HTMLElement>('[data-lu-side]');
  const index = root.querySelector<HTMLElement>('[data-lu-index]');
  const ticks = Array.from(root.querySelectorAll<HTMLElement>('[data-lu-tick]'));
  const n = items.length;

  let active = 0;
  let range = 1;
  let frame = 0;
  let listening = false;
  let preloaded = false;

  const sideText = (el: HTMLElement) => (lang() === 'en' ? el.dataset.sideEn : el.dataset.sideIt) ?? '';

  const render = (i: number) => {
    const prev = active;
    active = i;
    items.forEach((el, k) => el.classList.toggle('is-active', k === i));
    ticks.forEach((el, k) => el.classList.toggle('is-done', k <= i));
    const item = items[i];
    if (index) index.textContent = pad2(i + 1);
    if (side) side.textContent = sideText(item);
    const look = item.dataset.look ?? '';
    if (num && num.textContent !== look) {
      num.textContent = look;
      if (!reduceMotion.matches && prev !== i && num.animate) {
        const from = i > prev ? '22%' : '-22%';
        num.animate(
          [
            { transform: `translateY(${from})`, opacity: 0 },
            { transform: 'none', opacity: 1 },
          ],
          { duration: 460, easing: EASE_OUT_EXPO },
        );
      }
    }
  };

  // distanza in cui il palco resta fermo = pista − palco
  const measure = () => {
    range = Math.max(1, track.offsetHeight - stage.offsetHeight);
  };

  const update = () => {
    frame = 0;
    if (reduceMotion.matches) return;
    const progress = Math.min(1, Math.max(0, -track.getBoundingClientRect().top / range));
    const i = Math.min(n - 1, Math.floor(progress * n));
    if (i !== active) render(i);
  };

  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  // tutti i modelli caricati e decodificati prima di arrivare al palco: niente lampi
  const preload = () => {
    if (preloaded) return;
    preloaded = true;
    items.forEach((el) => {
      const img = el.querySelector('img');
      if (!img) return;
      img.loading = 'eager';
      img.decode?.().catch(() => {});
    });
  };

  const start = () => {
    if (listening) return;
    listening = true;
    measure();
    addEventListener('scroll', onScroll, { passive: true });
    update();
  };
  const stop = () => {
    if (!listening) return;
    listening = false;
    removeEventListener('scroll', onScroll);
    update(); // allinea lo stato finale (primo o ultimo modello) dopo uno scroll veloce
  };

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          preload();
          start();
        } else stop();
      },
      { rootMargin: '100% 0px' },
    ).observe(track);
  } else {
    preload();
    start();
  }

  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      measure();
      update();
    }).observe(track);
  }
  reduceMotion.addEventListener('change', () => {
    measure();
    update();
  });
  document.addEventListener('mm:lang', () => {
    if (side) side.textContent = sideText(items[active]);
  });

  measure();
  update();
}

/* --- Archivio a tab ------------------------------------------------------------ */

function initTabs(root: HTMLElement) {
  const list = root.querySelector<HTMLElement>('[role="tablist"]');
  if (!list) return;
  const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls') ?? ''));
  if (!tabs.length || panels.some((x) => !x)) return;
  const bar = root.querySelector<HTMLElement>('[data-tabs-bar]');
  const panelsWrap = root.querySelector<HTMLElement>('[data-panels]');
  let current = Math.max(0, tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'));

  // tiene la tab attiva visibile nella barra scorrevole
  const reveal = (tab: HTMLElement) => {
    const lr = list.getBoundingClientRect();
    const tr = tab.getBoundingClientRect();
    const pad = 48;
    const behavior: ScrollBehavior = reduceMotion.matches ? 'auto' : 'smooth';
    if (tr.left < lr.left + pad) list.scrollBy({ left: tr.left - lr.left - pad, behavior });
    else if (tr.right > lr.right - pad) list.scrollBy({ left: tr.right - lr.right + pad, behavior });
  };

  const select = (i: number, focus = false) => {
    const tab = tabs[i];
    if (focus) tab.focus({ preventScroll: true });
    reveal(tab);
    if (i === current) return;

    tabs.forEach((t, k) => {
      const on = k === i;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panels[current]!.hidden = true;
    const panel = panels[i]!;
    panel.hidden = false;
    current = i;

    // se si era scesi dentro un pannello lungo, si riparte dall'inizio del nuovo
    if (panelsWrap) {
      const target = panelsWrap.getBoundingClientRect().top + scrollY - headerH() - (bar?.offsetHeight ?? 0);
      if (scrollY > target + 1) scrollTo({ top: target, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }

    if (!reduceMotion.matches && panel.animate) {
      panel.animate(
        [
          { opacity: 0, transform: 'translateY(14px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 280, easing: EASE_OUT_QUART },
      );
    }
  };

  tabs.forEach((t, i) => t.addEventListener('click', () => select(i)));

  list.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const last = tabs.length - 1;
    let j: number;
    switch (e.key) {
      case 'ArrowRight':
        j = i === last ? 0 : i + 1;
        break;
      case 'ArrowLeft':
        j = i === 0 ? last : i - 1;
        break;
      case 'Home':
        j = 0;
        break;
      case 'End':
        j = last;
        break;
      default:
        return;
    }
    e.preventDefault();
    select(j, true);
  });

  // sfumatura ai bordi della barra quando le tab continuano fuori vista
  const fade = () => {
    const max = list.scrollWidth - list.clientWidth;
    const s = list.scrollLeft > 2;
    const e = list.scrollLeft < max - 2;
    list.dataset.fade = s && e ? 'both' : s ? 'start' : e ? 'end' : 'none';
  };
  list.addEventListener('scroll', fade, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(fade).observe(list);
  document.addEventListener('mm:lang', fade);
  fade();
}

/* --- avvio -------------------------------------------------------------------- */

document.querySelectorAll<HTMLElement>('[data-intro]').forEach(initIntro);
document.querySelectorAll<HTMLElement>('[data-lineup]').forEach(initLineup);
document.querySelectorAll<HTMLElement>('[data-archive]').forEach(initTabs);
