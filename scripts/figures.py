"""Scontorna i modelli (figure intere) dalle tavole Outfit di tutti i progetti.

Uso: python3 -E figures.py <img_root> <provini_dir> [slug ...]
Per ogni tavola cerca, dentro una regione, le forme "alte e piene" (figure),
scarta scritte, campioni di tessuto, barre colore e disegni tecnici a tratto,
toglie lo sfondo bianco e porta tutte le figure del progetto alla stessa altezza.
"""
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

WHITE = 228
MESH_MAX_AREA = 60

# regione = (x0, y0, x1, y1) in frazioni della tavola; per = figure attese per tavola
CONFIG = {
    # holes: i bianchi chiusi grandi sono sfondo (ascelle) | paper: sfondo = carta chiara poco satura
    "titina":      {"files": [f"outfit-{i:02d}" for i in range(1, 7)],  "region": (0.35, 0, 1, 1),        "per": 2, "sides": ("fronte", "retro"), "holes": True,  "paper": False},
    "gettin-busy": {"files": [f"outfit-{i:02d}" for i in range(2, 6)],  "region": (0, 0.08, 0.5, 1),      "per": 2, "sides": ("fronte", "retro"), "holes": False, "paper": False},
    "mondo-fuori": {"files": [f"outfit-{i:02d}" for i in range(1, 9)],  "region": (0, 0, 0.26, 1),        "per": 1, "sides": ("fronte",),         "holes": False, "paper": True},
    "luddovio":    {"files": [f"outfit-{i:02d}" for i in range(1, 15)], "region": (0.70, 0.60, 0.90, 1),  "per": 1, "sides": ("figurino",),       "holes": False, "paper": False},
}


def components(mask, min_px):
    """Componenti connesse (4-vicini) su una maschera booleana piccola."""
    h, w = mask.shape
    seen = np.zeros_like(mask)
    comps = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        seen[y0, x0] = True
        q, ys, xs = deque([(y0, x0)]), [], []
        while q:
            y, x = q.popleft()
            ys.append(y)
            xs.append(x)
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        if len(ys) >= min_px:
            comps.append((min(xs), min(ys), max(xs) + 1, max(ys) + 1))
    return comps


def find_figures(rgb, region, per, paper=False):
    W, H = rgb.size
    x0, y0, x1, y1 = int(region[0] * W), int(region[1] * H), int(region[2] * W), int(region[3] * H)
    reg = rgb.crop((x0, y0, x1, y1))
    arr = np.asarray(reg)
    ink = arr.min(axis=2) < (196 if paper else WHITE)
    k = 4  # lavoro su una versione ridotta per trovare le forme
    small = Image.fromarray((ink * 255).astype(np.uint8)).resize((ink.shape[1] // k, ink.shape[0] // k), Image.BOX)
    small = small.point(lambda v: 255 if v > 20 else 0).filter(ImageFilter.MaxFilter(5))
    rh = ink.shape[0]
    cands = []
    for bx0, by0, bx1, by1 in components(np.asarray(small) > 0, 30):
        fx0, fy0, fx1, fy1 = bx0 * k, by0 * k, min(ink.shape[1], bx1 * k), min(rh, by1 * k)
        bw, bh = fx1 - fx0, fy1 - fy0
        fill = ink[fy0:fy1, fx0:fx1].mean()
        aspect = bh / max(bw, 1)
        if bh >= 0.38 * rh and 1.6 <= aspect <= 6 and fill >= 0.2:
            cands.append((fx0, fy0, fx1, fy1, bh * bw))
    cands.sort(key=lambda c: -c[4])
    picked = sorted(cands[:per], key=lambda c: c[0])           # le più grandi, da sinistra a destra
    out = []
    for fx0, fy0, fx1, fy1, _ in picked:
        pad = 8
        box = (max(0, fx0 - pad), max(0, fy0 - pad), min(ink.shape[1], fx1 + pad), min(rh, fy1 + pad))
        out.append(reg.crop(box))
    return out


def cut_background(rgb, holes=True, paper=False):
    arr = np.asarray(rgb)
    lum = arr.min(axis=2)
    if paper:
        sat = arr.max(axis=2).astype(int) - arr.min(axis=2)
        white = ((lum >= 196) & (sat <= 32)).astype(np.uint8) * 255
    else:
        white = (lum >= WHITE).astype(np.uint8) * 255
    m = Image.fromarray(white).copy()   # copia: fromarray condivide la memoria e floodfill non scriverebbe
    h, w = white.shape
    seeds = [(x, 0) for x in range(0, w, 5)] + [(x, h - 1) for x in range(0, w, 5)]
    seeds += [(0, y) for y in range(0, h, 5)] + [(w - 1, y) for y in range(0, h, 5)]
    for s in seeds:
        if m.getpixel(s) == 255:
            ImageDraw.floodfill(m, s, 128)
    a = np.asarray(m).copy()
    seen = np.zeros(a.shape, dtype=bool)
    for y0, x0 in zip(*np.nonzero(a == 255)):
        if seen[y0, x0]:
            continue
        seen[y0, x0] = True
        q, region, ring = deque([(y0, x0)]), [], []
        while q:
            y, x = q.popleft()
            region.append((y, x))
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx]:
                    if a[ny, nx] == 255:
                        seen[ny, nx] = True
                        q.append((ny, nx))
                    elif white[ny, nx] == 0:
                        ring.append(arr[ny, nx])
        ry, rx = (list(t) for t in zip(*region))
        n = len(region)
        pure = lum[ry, rx].mean() >= 249            # bianco "di carta" = sfondo; bianco ombreggiato = capo
        r, g, b = np.mean(ring, axis=0) if ring else (0, 0, 255)
        yellow_graphic = r > 140 and g > 120 and b < 95
        is_bg = holes and (n < MESH_MAX_AREA or (pure and n >= 600 and not yellow_graphic))
        a[ry, rx] = 128 if is_bg else 0
    bg_mask = a == 128
    if not paper:
        near = np.asarray(Image.fromarray((bg_mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
        bg_mask |= near & (lum >= 185)
    bg = Image.fromarray((bg_mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
    alpha = Image.eval(bg, lambda v: 255 - v).filter(ImageFilter.GaussianBlur(0.6))
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    bbox = alpha.point(lambda v: 255 if v > 20 else 0).getbbox()
    return out.crop(bbox)


def main(img_root, prov_dir, slugs):
    root, prov = Path(img_root), Path(prov_dir)
    prov.mkdir(parents=True, exist_ok=True)
    for slug in slugs:
        cfg = CONFIG[slug]
        figs = []
        for look, name in enumerate(cfg["files"], start=1):
            src = next((root / slug).glob(name + ".*"), None)
            if src is None:
                print(slug, name, "MANCANTE")
                continue
            found = find_figures(Image.open(src).convert("RGB"), cfg["region"], cfg["per"], cfg["paper"])
            print(f"{slug} {name}: {len(found)} figure", [f.size for f in found])
            for side, crop in zip(cfg["sides"], found):
                figs.append((look, side, cut_background(crop, cfg["holes"], cfg["paper"])))
        if not figs:
            continue
        target_h = int(min(700, np.median([f.size[1] for _, _, f in figs])))
        scaled = []
        for look, side, f in figs:
            s = target_h / f.size[1]
            scaled.append((look, side, f.resize((max(1, round(f.size[0] * s)), target_h), Image.LANCZOS)))
        W = max(f.size[0] for _, _, f in scaled) + 40
        H = target_h + 30
        out_dir = root / slug / "modelli"
        out_dir.mkdir(exist_ok=True)
        for old in out_dir.glob("look-*.png"):
            old.unlink()
        tiles = []
        for look, side, f in scaled:
            canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            canvas.paste(f, ((W - f.size[0]) // 2, H - f.size[1] - 10), f)
            canvas.save(out_dir / f"look-{look:02d}-{side}.png", optimize=True)
            tiles.append(canvas)
        cols = min(len(tiles), 8)
        rows = -(-len(tiles) // cols)
        sheet = Image.new("RGB", (W * cols, H * rows), (20, 20, 20))
        for i, t in enumerate(tiles):
            sheet.paste(t, ((i % cols) * W, (i // cols) * H), t)
        sheet.thumbnail((1800, 1800))
        sheet.save(prov / f"provino-{slug}.png")
        print(f"{slug}: {len(tiles)} modelli, tela {W}x{H}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3:] or list(CONFIG))
