/**
 * Comportamenti comuni a tutte le pagine:
 *  - lingua IT/EN (scambia gli elementi con data-it / data-en, ricorda la scelta)
 *  - menu a tutto schermo su telefono / iPad verticale
 *  - comparsa morbida degli elementi .reveal quando entrano nello schermo
 *  - bordo dell'header quando la pagina scorre
 */

type Lang = 'it' | 'en';
const KEY = 'mm-lang';

function readLang(): Lang {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'it';
  } catch {
    return 'it';
  }
}

export function applyLang(lang: Lang) {
  document.documentElement.lang = lang;
  document.querySelectorAll<HTMLElement>('[data-it][data-en]').forEach((el) => {
    const value = lang === 'en' ? el.dataset.en! : el.dataset.it!;
    if (el.hasAttribute('data-html')) el.innerHTML = value;
    else el.textContent = value;
  });
  document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  });
  // link con versione per lingua (es. la mail precompilata di "Collaboriamo")
  document.querySelectorAll<HTMLAnchorElement>('a[data-href-it][data-href-en]').forEach((a) => {
    a.href = lang === 'en' ? a.dataset.hrefEn! : a.dataset.hrefIt!;
  });
  document.dispatchEvent(new CustomEvent('mm:lang', { detail: lang }));
}

function setLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* navigazione privata: la scelta vale solo per questa pagina */
  }
  applyLang(lang);
}

function initLang() {
  const lang = readLang();
  if (lang !== 'it') applyLang(lang);
  document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => {
    b.addEventListener('click', () => setLang(b.dataset.lang as Lang));
  });
}

function initMenu() {
  const btn = document.querySelector<HTMLButtonElement>('[data-menu-btn]');
  const menu = document.querySelector<HTMLElement>('[data-menu]');
  if (!btn || !menu) return;
  const close = () => {
    btn.setAttribute('aria-expanded', 'false');
    menu.classList.remove('is-open');
    document.documentElement.style.overflow = '';
  };
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
    document.documentElement.style.overflow = open ? 'hidden' : '';
  });
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
      close();
      btn.focus();
    }
  });
  matchMedia('(min-width: 861px)').addEventListener('change', (e) => e.matches && close());
}

function initReveal() {
  const els = document.querySelectorAll<HTMLElement>('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  els.forEach((el) => io.observe(el));
}

function initHeader() {
  const onScroll = () => document.documentElement.classList.toggle('is-scrolled', scrollY > 8);
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });
}

initLang();
initMenu();
initReveal();
initHeader();
