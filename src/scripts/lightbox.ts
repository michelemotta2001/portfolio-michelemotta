/**
 * Lightbox condiviso (nessuna libreria). Apre qualunque elemento con data-lb-item:
 *   data-lb-group   gruppo: precedente/successivo restano nel gruppo, in ordine di DOM
 *   data-lb-src     URL dell'immagine grande
 *   data-lb-alt     testo alternativo
 *   data-lb-caption didascalia (facoltativo data-lb-caption-en per la pagina in inglese)
 * Tastiera: ← → per scorrere, Esc per chiudere. Telefono: swipe sinistra/destra,
 * doppio tocco o pinch per ingrandire (poi un dito sposta l'immagine).
 */

const EASE_OUT_QUART = 'cubic-bezier(0.25, 1, 0.5, 1)';
const EASE_OUT_EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';
const SWIPE = 48;
const MAX_ZOOM = 4;

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
    resetZoom();
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
    resetZoom();
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

  // dopo uno swipe, un pinch o un doppio tocco il "click" che segue non deve chiudere
  let swiped = false;
  const suppress = () => {
    swiped = true;
    window.setTimeout(() => (swiped = false), 350);
  };
  dialog.addEventListener('click', (e) => {
    if (swiped) {
      swiped = false;
      return;
    }
    const t = e.target as HTMLElement;
    if (t.closest('button') || capWrap.contains(t)) return;
    if (zoom > 1) return; // ingrandita: si chiude solo col pulsante
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

  /* --- gesti touch/penna (il mouse resta com'è) ---------------------------------
     un dito: swipe orizzontale = precedente/successiva; con l'immagine ingrandita sposta.
     doppio tocco sull'immagine: ingrandisce (le tavole orizzontali riempiono l'altezza) / torna intera.
     due dita: pinch. Lo zoom usa solo transform; si azzera cambiando immagine o chiudendo. */
  type Pt = { x: number; y: number };
  const touches = new Map<number, Pt>();
  let zoom = 1;
  let zx = 0;
  let zy = 0;
  let pinch: { d: number; z: number; mx: number; my: number } | null = null;
  let swipeId = -1;
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let down = { t: 0, x: 0, y: 0 };
  let lastTap = { t: 0, x: 0, y: 0 };

  const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

  // riquadro dell'<img> senza trasformazioni + misura del disegno (object-fit: contain) a scala 1
  const frameOf = () => {
    const s = stage.getBoundingClientRect();
    const bw = img.offsetWidth || 1;
    const bh = img.offsetHeight || 1;
    const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : bw / bh;
    const fit = bw / bh > ratio ? { w: bh * ratio, h: bh } : { w: bw, h: bw / ratio };
    return { cx: s.left + img.offsetLeft + bw / 2, cy: s.top + img.offsetTop + bh / 2, bw, bh, ...fit };
  };

  const paint = (smooth = false) => {
    img.style.transition = smooth && !reduceMotion.matches ? `transform 0.36s ${EASE_OUT_EXPO}` : '';
    img.style.transform = zoom > 1 ? `translate3d(${zx}px, ${zy}px, 0) scale(${zoom})` : '';
    dialog.classList.toggle('is-zoomed', zoom > 1);
  };

  // l'immagine ingrandita non lascia vuoti ai bordi
  const clampPan = (f = frameOf()) => {
    const mx = Math.max(0, (f.w * zoom - f.bw) / 2);
    const my = Math.max(0, (f.h * zoom - f.bh) / 2);
    zx = Math.min(mx, Math.max(-mx, zx));
    zy = Math.min(my, Math.max(-my, zy));
  };

  // porta la scala a z tenendo fermo sotto le dita il punto (px, py)
  const zoomAt = (z: number, px: number, py: number) => {
    const f = frameOf();
    const next = Math.min(MAX_ZOOM, Math.max(1, z));
    const k = next / zoom;
    zx = px - f.cx - k * (px - f.cx - zx);
    zy = py - f.cy - k * (py - f.cy - zy);
    zoom = next;
    if (zoom === 1) zx = zy = 0;
    clampPan(f);
  };

  const resetZoom = () => {
    zoom = 1;
    zx = zy = 0;
    pinch = null;
    touches.clear();
    swipeId = -1;
    paint();
  };

  const tapZoom = (px: number, py: number) => {
    if (zoom > 1) {
      zoom = 1;
      zx = zy = 0;
    } else {
      const f = frameOf();
      zoomAt(Math.max(2, f.bh / f.h), px, py);
    }
    paint(true);
  };

  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    img.style.transition = '';
    if (touches.size === 1) {
      down = { t: e.timeStamp, x: e.clientX, y: e.clientY };
      if (zoom === 1 && items.length > 1) {
        swipeId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        dx = 0;
      }
    } else if (touches.size === 2) {
      // secondo dito: parte il pinch, lo swipe si annulla
      swipeId = -1;
      dx = 0;
      lastTap.t = 0;
      const [a, b] = [...touches.values()];
      pinch = { d: Math.max(1, dist(a, b)), z: zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      paint();
    }
  });

  stage.addEventListener('pointermove', (e) => {
    const prev = touches.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    touches.set(e.pointerId, cur);

    if (pinch && touches.size > 1) {
      const [a, b] = [...touches.values()];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      // il pinch segue anche lo spostamento delle dita
      zx += mx - pinch.mx;
      zy += my - pinch.my;
      pinch.mx = mx;
      pinch.my = my;
      zoomAt(pinch.z * (dist(a, b) / pinch.d), mx, my);
      paint();
      return;
    }

    if (zoom > 1) {
      zx += cur.x - prev.x;
      zy += cur.y - prev.y;
      clampPan();
      paint();
      return;
    }

    if (e.pointerId !== swipeId) return;
    dx = cur.x - startX;
    const dy = cur.y - startY;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
      swipeId = -1;
      dx = 0;
      img.style.transform = '';
      return;
    }
    if (!reduceMotion.matches) img.style.transform = `translateX(${dx * 0.5}px)`;
  });

  const lift = (e: PointerEvent) => {
    if (!touches.delete(e.pointerId)) return;

    if (pinch) {
      if (touches.size < 2) {
        pinch = null;
        if (zoom < 1.1) {
          zoom = 1;
          zx = zy = 0;
        }
        paint(true);
        suppress();
      }
      return;
    }

    if (e.pointerId === swipeId) {
      const moved = dx;
      swipeId = -1;
      dx = 0;
      img.style.transform = '';
      if (e.type === 'pointerup' && Math.abs(moved) > SWIPE) {
        lastTap.t = 0;
        suppress();
        go(moved < 0 ? 1 : -1);
        return;
      }
    }
    if (e.type !== 'pointerup') return;

    const tap = e.timeStamp - down.t < 300 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10;
    if (!tap) {
      lastTap.t = 0;
      if (zoom > 1) suppress(); // fine di uno spostamento
      return;
    }
    const again = e.timeStamp - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40;
    if (again) {
      lastTap.t = 0;
      tapZoom(e.clientX, e.clientY);
      suppress();
    } else if (zoom > 1 || hitsImage(e)) {
      lastTap = { t: e.timeStamp, x: e.clientX, y: e.clientY };
    }
  };
  stage.addEventListener('pointerup', lift);
  stage.addEventListener('pointercancel', lift);
  addEventListener('resize', () => {
    if (zoom > 1) resetZoom();
  });

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
