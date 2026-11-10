/**
 * Lightbox condiviso (nessuna libreria). Apre qualunque elemento con data-lb-item:
 *   data-lb-group   gruppo: precedente/successivo restano nel gruppo, in ordine di DOM
 *   data-lb-src     URL dell'immagine grande
 *   data-lb-alt     testo alternativo
 *   data-lb-caption didascalia (facoltativo data-lb-caption-en per la pagina in inglese)
 * Tastiera: ← → per scorrere, Esc per chiudere. Telefono: swipe sinistra/destra.
 */

const EASE_OUT_QUART = 'cubic-bezier(0.25, 1, 0.5, 1)';
const EASE_OUT_EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';
const SWIPE = 48;

const pad2 = (n: number) => String(n).padStart(2, '0');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

function init(dialog: HTMLDialogElement) {
  const stage = dialog.querySelector<HTMLElement>('[data-lb-stage]')!;
  const img = dialog.querySelector<HTMLImageElement>('[data-lb-img]')!;
  const cap = dialog.querySelector<HTMLElement>('[data-lb-cap]')!;
  const capWrap = dialog.querySelector<HTMLElement>('[data-lb-cap-wrap]')!;
  const counter = dialog.querySelector<HTMLElement>('[data-lb-counter]')!;
  const prevBtn = dialog.querySelector<HTMLButtonElement>('[data-lb-prev]')!;
  const nextBtn = dialog.querySelector<HTMLButtonElement>('[data-lb-next]')!;
  const closeBtn = dialog.querySelector<HTMLButtonElement>('[data-lb-close]')!;

  let items: HTMLElement[] = [];
  let index = 0;
  let trigger: HTMLElement | null = null;
  let token = 0;
  let closing = false;
  let prevOverflow = '';

  const animate = (el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions) =>
    reduceMotion.matches || !el.animate ? null : el.animate(frames, opts);

  const captionOf = (el: HTMLElement) =>
    (document.documentElement.lang === 'en' && el.dataset.lbCaptionEn) || el.dataset.lbCaption || '';

  const groupOf = (el: HTMLElement) => {
    const g = el.dataset.lbGroup;
    if (!g) return [el];
    return Array.from(
      document.querySelectorAll<HTMLElement>(`[data-lb-item][data-lb-group="${CSS.escape(g)}"]`),
    );
  };

  const renderText = () => {
    const el = items[index];
    if (!el) return;
    const caption = captionOf(el);
    const count = items.length > 1 ? `${pad2(index + 1)} / ${pad2(items.length)}` : '';
    cap.textContent = caption;
    // se la didascalia contiene già "03 / 14" il contatore non si ripete
    counter.textContent = count && !caption.includes(count) ? count : '';
  };

  const preloadNeighbours = () => {
    if (items.length < 2) return;
    [index - 1, index + 1].forEach((k) => {
      const el = items[(k + items.length) % items.length];
      if (el?.dataset.lbSrc) new Image().src = el.dataset.lbSrc;
    });
  };

  // dir: -1 precedente, 1 successivo, 0 apertura
  const show = async (i: number, dir: number) => {
    index = (i + items.length) % items.length;
    const el = items[index];
    const my = ++token;
    renderText();

    const src = el.dataset.lbSrc ?? '';
    const alt = el.dataset.lbAlt ?? el.querySelector('img')?.alt ?? '';
    const thumb = el.querySelector('img')?.currentSrc;
    const enter = () =>
      dir === 0
        ? animate(img, [{ opacity: 0, transform: 'scale(0.965)' }, { opacity: 1, transform: 'none' }], {
            duration: 480,
            easing: EASE_OUT_EXPO,
          })
        : animate(img, [{ opacity: 0.35, transform: `translateX(${dir * 28}px)` }, { opacity: 1, transform: 'none' }], {
            duration: 360,
            easing: EASE_OUT_EXPO,
          });

    // l'immagine grande viene decodificata prima di comparire; se tarda, intanto la miniatura
    const big = new Image();
    big.src = src;
    let entered = false;
    dialog.setAttribute('aria-busy', 'true');
    const early = window.setTimeout(() => {
      if (my !== token || !thumb) return;
      img.src = thumb;
      img.alt = alt;
      enter();
      entered = true;
    }, 90);

    try {
      await big.decode();
    } catch {
      /* formato non decodificabile in anticipo: lo carica l'<img> */
    }
    window.clearTimeout(early);
    if (my !== token) return;
    img.src = src;
    img.alt = alt;
    if (!entered) enter();
    dialog.removeAttribute('aria-busy');
    preloadNeighbours();
  };

  const go = (step: number) => {
    if (items.length > 1) show(index + step, step);
  };

  const open = (el: HTMLElement) => {
    if (dialog.open) return;
    trigger = el;
    items = groupOf(el);
    index = items.indexOf(el);
    if (index < 0) {
      items = [el];
      index = 0;
    }
    dialog.classList.toggle('is-single', items.length < 2);
    img.removeAttribute('src');
    prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    closing = false;
    dialog.showModal();
    closeBtn.focus();
    animate(dialog, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: EASE_OUT_QUART });
    show(index, 0);
  };

  const close = () => {
    if (!dialog.open || closing) return;
    closing = true;
    const out = animate(dialog, [{ opacity: 1 }, { opacity: 0 }], {
      duration: 180,
      easing: EASE_OUT_QUART,
      fill: 'forwards',
    });
    if (!out) {
      dialog.close();
      return;
    }
    out.onfinish = () => {
      dialog.close();
      out.cancel();
    };
  };

  dialog.addEventListener('close', () => {
    closing = false;
    token++;
    dialog.removeAttribute('aria-busy');
    document.documentElement.style.overflow = prevOverflow;
    trigger?.focus({ preventScroll: true });
    trigger = null;
  });

  // Esc: chiusura animata invece di quella istantanea del browser
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });

  // l'immagine riempie lo stage con object-fit: contain → conta solo la parte disegnata
  const hitsImage = (e: MouseEvent) => {
    if (!img.naturalWidth || !img.naturalHeight) return false;
    const r = img.getBoundingClientRect();
    const ratio = img.naturalWidth / img.naturalHeight;
    let w = r.width;
    let h = r.height;
    if (w / h > ratio) w = h * ratio;
    else h = w / ratio;
    const x = r.left + (r.width - w) / 2;
    const y = r.top + (r.height - h) / 2;
    return e.clientX >= x && e.clientX <= x + w && e.clientY >= y && e.clientY <= y + h;
  };

  let swiped = false;
  dialog.addEventListener('click', (e) => {
    if (swiped) {
      swiped = false;
      return;
    }
    const t = e.target as HTMLElement;
    if (t.closest('button') || capWrap.contains(t)) return;
    if (t === img && hitsImage(e)) return;
    close();
  });

  prevBtn.addEventListener('click', () => go(-1));
  nextBtn.addEventListener('click', () => go(1));
  closeBtn.addEventListener('click', close);

  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    }
  });

  // swipe orizzontale (touch/penna); lo scroll verticale e il pinch restano al browser
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let pointer = -1;
  const reset = () => {
    pointer = -1;
    img.style.transform = '';
  };
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || items.length < 2 || !e.isPrimary) return;
    pointer = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0;
  });
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointer) return;
    dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
      dx = 0;
      reset();
      return;
    }
    if (!reduceMotion.matches) img.style.transform = `translateX(${dx * 0.5}px)`;
  });
  stage.addEventListener('pointerup', (e) => {
    if (e.pointerId !== pointer) return;
    const moved = dx;
    reset();
    if (Math.abs(moved) > SWIPE) {
      swiped = true;
      window.setTimeout(() => (swiped = false), 350);
      go(moved < 0 ? 1 : -1);
    }
  });
  stage.addEventListener('pointercancel', reset);

  // apertura: delega sul documento, vale anche per elementi aggiunti dopo
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const el = (e.target as Element | null)?.closest<HTMLElement>('[data-lb-item]');
    if (!el || !el.dataset.lbSrc || dialog.contains(el)) return;
    e.preventDefault();
    open(el);
  });

  document.addEventListener('mm:lang', () => {
    if (dialog.open) renderText();
  });
}

const dialog = document.querySelector<HTMLDialogElement>('[data-lightbox]');
if (dialog && typeof dialog.showModal === 'function') init(dialog);
