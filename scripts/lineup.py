"""Scontorna le figure (fronte/retro) dalle tavole Outfit di Titina.

Uso: python3 -I lineup.py <dir_titina> <out_dir>
Per ogni outfit-0N.jpg trova le due figure (colonne con molti pixel non bianchi),
toglie lo sfondo bianco (flood fill dai bordi + buchi bianchi chiusi e grandi),
poi le mette tutte sulla stessa tela, piedi sulla stessa linea e centrate.
"""
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

WHITE = 228          # sopra questa soglia (su tutti i canali) un pixel è "sfondo"
FIG_COL_MIN = 60     # pixel non bianchi per colonna per dire "qui c'è una figura"
HOLE_MIN_AREA = 600  # buchi bianchi chiusi più grandi di così = sfondo (ascelle, gambe)
MESH_MAX_AREA = 60   # buchi più piccoli di così = celle della maglia a rete = sfondo


def runs(mask_1d, min_gap=14, min_len=60):
    idx = np.flatnonzero(mask_1d)
    if idx.size == 0:
        return []
    out, start, prev = [], idx[0], idx[0]
    for i in idx[1:]:
        if i - prev > min_gap:
            out.append((start, prev))
            start = i
        prev = i
    out.append((start, prev))
    return [(a, b) for a, b in out if b - a >= min_len]


def cut_background(rgb):
    arr = np.asarray(rgb)
    white = (arr.min(axis=2) >= WHITE).astype(np.uint8) * 255
    m = Image.fromarray(white)
    h, w = white.shape
    seeds = [(x, 0) for x in range(0, w, 6)] + [(x, h - 1) for x in range(0, w, 6)]
    seeds += [(0, y) for y in range(0, h, 6)] + [(w - 1, y) for y in range(0, h, 6)]
    for s in seeds:
        if m.getpixel(s) == 255:
            ImageDraw.floodfill(m, s, 128)
    # buchi bianchi chiusi, etichettati con una BFS solo sui loro pixel:
    #  - grandi (ascelle, tra le gambe)  -> sfondo
    #  - minuscoli (celle della rete)    -> sfondo
    #  - medi (numeri, scritte, dettagli) -> restano
    a = np.asarray(m).copy()
    seen = np.zeros(a.shape, dtype=bool)
    ys, xs = np.nonzero(a == 255)
    for y0, x0 in zip(ys.tolist(), xs.tolist()):
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
        n = len(region)
        if n >= HOLE_MIN_AREA or n < MESH_MAX_AREA:
            is_bg = True
        else:
            # medio: resta solo se è una grafica bianca su maglia gialla (15, UMILTÀ, righe)
            r, g, b = np.mean(ring, axis=0) if ring else (0, 0, 255)
            is_bg = not (r > 140 and g > 120 and b < 95)
        ry, rx = zip(*region)
        a[list(ry), list(rx)] = 128 if is_bg else 0
    bg_mask = a == 128
    # pixel molto chiari attaccati allo sfondo (alone, puntini della rete) = sfondo
    near = np.asarray(Image.fromarray((bg_mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    bg_mask |= near & (arr.min(axis=2) >= 185)
    bg = Image.fromarray((bg_mask * 255).astype(np.uint8))
    bg = bg.filter(ImageFilter.MaxFilter(3))            # mangia l'alone chiaro sul bordo
    alpha = Image.eval(bg, lambda v: 255 - v).filter(ImageFilter.GaussianBlur(0.6))
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def extract(path):
    rgb = Image.open(path).convert("RGB")
    arr = np.asarray(rgb)
    nonwhite = arr.min(axis=2) < WHITE
    cols = nonwhite.sum(axis=0) >= FIG_COL_MIN
    figs = []
    for x0, x1 in runs(cols):
        x0, x1 = max(0, x0 - 12), min(arr.shape[1] - 1, x1 + 12)
        band = nonwhite[:, x0:x1 + 1]
        rows = np.flatnonzero(band.sum(axis=1) > 0)
        y0, y1 = max(0, rows[0] - 6), min(arr.shape[0] - 1, rows[-1] + 6)
        crop = rgb.crop((x0, y0, x1 + 1, y1 + 1))
        cut = cut_background(crop)
        bbox = cut.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
        figs.append(cut.crop(bbox))
    return figs


def main(src_dir, out_dir):
    src, out = Path(src_dir), Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    all_figs = []
    for n in range(1, 7):
        figs = extract(src / f"outfit-{n:02d}.jpg")
        print(f"outfit-{n:02d}: {len(figs)} figure", [f.size for f in figs])
        for side, f in zip(("fronte", "retro"), figs[:2]):
            all_figs.append((n, side, f))
    W = max(f.size[0] for _, _, f in all_figs) + 40
    H = max(f.size[1] for _, _, f in all_figs) + 30
    tiles = []
    for n, side, f in all_figs:
        canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        canvas.paste(f, ((W - f.size[0]) // 2, H - f.size[1] - 10), f)
        canvas.save(out / f"look-{n:02d}-{side}.png", optimize=True)
        tiles.append(canvas)
    print("tela comune:", W, "x", H)
    # provino: una colonna per look, sopra il fronte e sotto il retro, su nero
    sheet = Image.new("RGB", (W * 6, H * 2), (0, 0, 0))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i // 2) * W, (i % 2) * H), t)
    sheet.thumbnail((1800, 1800))
    sheet.save(out / "provino.png")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
