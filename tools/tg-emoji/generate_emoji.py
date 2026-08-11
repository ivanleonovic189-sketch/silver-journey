#!/usr/bin/env python3
"""Генератор премиум-эмодзи Telegram: чёрное сердце с рисунком внутри.

Две версии:
  noir    — объёмное полированное сердце без цветов: рельефное освещение,
            блик ходит маятником, при ударе оно раскаляется изнутри и
            выбрасывает искры;
  cartoon — мультяшная: толстый контур, упругий пульс, венок из белых лилий.

Итог — 100x100, VP9 + альфа, 3 с, 30 fps, до 64 КБ (требования Telegram
к анимированным кастом-эмодзи, бот @Stickers).

    python3 generate_emoji.py --photo assets/monster.jpg
    python3 generate_emoji.py --style cartoon --still 8
"""

from __future__ import annotations

import argparse
import math
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

import lilies
import monster

HERE = os.path.dirname(os.path.abspath(__file__))

SS = 4                      # супер-сэмплинг
OUT_SIZE = 100              # финальный размер эмодзи
W = OUT_SIZE * SS           # рабочий холст 400x400
FPS = 30
DURATION = 3.0
FRAMES = int(FPS * DURATION)
MAX_BYTES = 62 * 1024      # лимит Telegram 64 КБ, держим запас

STYLES = {
    # Угольная: объёмное сердце с рельефным освещением, без венка.
    "noir": dict(
        ratio=0.80, y=-0.02, wreath=False, shading=True,
        fill_top=(38, 38, 50), fill_bot=(7, 7, 11),
        rim=(214, 30, 52), rim_gain=0.55, outline=None,
        ash=(178, 182, 198), eye=(255, 66, 48),
        beat=0.075, squash=0.5, gloss=0.0, shine=0.0, blink=False, sparkle="ember",
    ),
    # Мультяшная: плоская заливка, толстый контур, венок из лилий.
    "cartoon": dict(
        ratio=0.74, y=-0.075, wreath=True, shading=False,
        fill_top=(58, 46, 74), fill_bot=(14, 10, 22),
        rim=(255, 86, 124), rim_gain=0.95, outline=(248, 244, 255),
        ash=(226, 228, 244), eye=(255, 92, 74),
        beat=0.125, squash=1.0, gloss=1.1, shine=0.09, blink=True, sparkle="star",
    ),
}

# Материал угольного сердца: чёрный полированный камень.
ALBEDO = (11, 11, 16)
LIGHT = (54, 56, 74)        # рассеянный свет
SPEC = (255, 246, 250)      # цвет блика
SSS = (214, 26, 48)         # свечение изнутри


# --------------------------------------------------------------------------- #
# Геометрия
# --------------------------------------------------------------------------- #
def heart_mask(size: int, fill_ratio: float = 0.92, y_shift: float = 0.0) -> Image.Image:
    """Классическая параметрическая кривая сердца → L-маска."""
    pts = []
    steps = 720
    for i in range(steps):
        t = i / steps * math.tau
        x = 16 * math.sin(t) ** 3
        y = -(13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
        pts.append((x, y))
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    sx, sy = max(xs) - min(xs), max(ys) - min(ys)
    k = size * fill_ratio / max(sx, sy)
    cx = (max(xs) + min(xs)) / 2
    cy = (max(ys) + min(ys)) / 2
    poly = [
        (size / 2 + (x - cx) * k, size / 2 + (y - cy) * k + size * y_shift)
        for x, y in pts
    ]
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    return m


def vertical_gradient(size, top, bottom):
    ramp = np.linspace(0, 1, size, dtype=np.float32)[:, None]
    arr = np.zeros((size, size, 3), dtype=np.float32)
    for c in range(3):
        arr[:, :, c] = top[c] * (1 - ramp) + bottom[c] * ramp
    return Image.fromarray(arr.astype(np.uint8), "RGB")


def radial_alpha(size, cx, cy, radius, power=2.2):
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / max(radius, 1e-6)
    a = np.clip(1.0 - d, 0.0, 1.0) ** power
    return Image.fromarray((a * 255).astype(np.uint8), "L")


def tint(mask: Image.Image, color, gain=1.0) -> Image.Image:
    """L-маска → цветной RGBA-слой."""
    layer = Image.new("RGBA", mask.size, tuple(color) + (0,))
    a = mask if gain == 1.0 else mask.point(lambda v: min(255, int(v * gain)))
    layer.putalpha(a)
    return layer


def add(base: Image.Image, layer: Image.Image) -> Image.Image:
    """Аддитивное смешивание с сохранением альфы (для свечения)."""
    b = np.asarray(base, dtype=np.float32)
    l = np.asarray(layer, dtype=np.float32)
    la = l[:, :, 3:4] / 255.0
    rgb = np.clip(b[:, :, :3] + l[:, :, :3] * la, 0, 255)
    alpha = np.clip(b[:, :, 3:4] + l[:, :, 3:4], 0, 255)
    return Image.fromarray(np.concatenate([rgb, alpha], axis=2).astype(np.uint8), "RGBA")


def scale_xy(layer, sx, sy, anchor=0.5):
    """Неравномерное масштабирование от центра — squash & stretch."""
    if abs(sx - 1) < 1e-3 and abs(sy - 1) < 1e-3:
        return layer
    w, h = max(1, int(round(W * sx))), max(1, int(round(W * sy)))
    big = layer.resize((w, h), Image.LANCZOS)
    canvas = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    canvas.paste(big, ((W - w) // 2, int((W - h) * anchor)))
    return canvas


# --------------------------------------------------------------------------- #
# Источник рисунка
# --------------------------------------------------------------------------- #
def load_artwork(path: str | None, size: int, style: str):
    """→ (ash, eyes): L-маски штрихов и красных глаз."""
    if not path:
        return monster.render(size, style)

    img = Image.open(path).convert("RGB")
    s = min(img.size)
    img = img.crop((
        (img.width - s) // 2, (img.height - s) // 2,
        (img.width + s) // 2, (img.height + s) // 2,
    )).resize((size, size), Image.LANCZOS)

    arr = np.asarray(img, dtype=np.float32)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    # Красные глаза: где красный заметно доминирует.
    redness = np.clip(r - np.maximum(g, b) - 18, 0, None)
    redness = redness / max(redness.max(), 1.0)
    eyes = Image.fromarray((np.clip(redness * 2.4, 0, 1) * 255).astype(np.uint8), "L")
    eyes = eyes.filter(ImageFilter.GaussianBlur(size * 0.006))

    # Штрихи: бумага светлая, уголь тёмный → инвертируем.
    gray = ImageOps.autocontrast(ImageOps.grayscale(img), cutoff=2)
    ash = ImageOps.invert(gray).point(lambda v: min(255, int(255 * (v / 255) ** 1.35)))
    if style == "cartoon":
        # мультяшно: меньше полутонов, чётче пятна
        ash = ImageOps.posterize(ash, 3).filter(ImageFilter.GaussianBlur(size * 0.004))
        ash = ash.point(lambda v: min(255, int(v * 1.15)))
    return ash, eyes


# --------------------------------------------------------------------------- #
# Анимация
# --------------------------------------------------------------------------- #
def wrapped_pulse(p, center, width):
    d = abs(((p - center + 0.5) % 1.0) - 0.5)
    return math.exp(-(d * d) / (2 * width * width))


def beat_envelope(t):
    """Двойной удар «туц-туц» — два цикла за 3 секунды."""
    p = (t / DURATION * 2.0) % 1.0
    return wrapped_pulse(p, 0.00, 0.055) + 0.62 * wrapped_pulse(p, 0.17, 0.05)


def blink_factor(t):
    """Короткое моргание раз за цикл."""
    p = t / DURATION
    return 1.0 - 0.95 * wrapped_pulse(p, 0.72, 0.014)


# --------------------------------------------------------------------------- #
# Сборка слоёв
# --------------------------------------------------------------------------- #
def build_normals(mask):
    """Маска → карта высот купола и нормали. Отсюда берётся весь объём."""
    m = np.asarray(mask, np.float32) / 255.0
    h = np.asarray(mask.filter(ImageFilter.GaussianBlur(W * 0.060)), np.float32) / 255.0
    h = np.clip(h, 0, 1) ** 0.62 * m
    gy, gx = np.gradient(h)
    k = W * 0.135
    nx, ny, nz = -gx * k, -gy * k, np.ones_like(h)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    return h, nx / ln, ny / ln, nz / ln


def shade_heart(L, ang, beat, tilt):
    """Ламберт + блик Блинна-Фонга + Френель по краю + свечение изнутри."""
    nx, ny, nz = L["nx"], L["ny"], L["nz"]
    lx, ly, lz = math.cos(ang) * 0.62, math.sin(ang) * 0.30 - 0.46, 0.70
    ln = math.sqrt(lx * lx + ly * ly + lz * lz)
    lx, ly, lz = lx / ln, ly / ln, lz / ln
    hx, hy, hz = lx, ly, lz + 1.0
    hn = math.sqrt(hx * hx + hy * hy + hz * hz)
    hx, hy, hz = hx / hn, hy / hn, hz / hn

    ndl = np.clip(nx * lx + ny * ly + nz * lz, 0, 1)
    ndh = np.clip(nx * hx + ny * hy + nz * hz, 0, 1)
    fres = np.clip(1.0 - nz, 0, 1) ** 2.2

    rgb = np.zeros((W, W, 3), np.float32)
    for c in range(3):
        rgb[:, :, c] = (
            ALBEDO[c]
            + LIGHT[c] * (0.06 + 0.94 * ndl ** 1.5) * (0.45 + 0.55 * L["h"])
            + SPEC[c] * (ndh ** 72) * 1.15                 # горячая точка блика
            + SPEC[c] * (ndh ** 16) * 0.24                 # скользящий глянец
            + SPEC[c] * (ndh ** 5) * 0.05                  # общий отсвет
            + SSS[c] * fres * (0.22 + 0.60 * beat)         # кант, дышащий с ударом
            + SSS[c] * L["core"] * (0.04 + 0.42 * beat)    # жар изнутри
        )
    # лёгкий разворот подсветки при покачивании
    rgb += np.array(LIGHT, np.float32) * (tilt * 0.06 * nx)[:, :, None]

    rgb *= (1.0 - 0.42 * np.clip(1.0 - nz, 0, 1) ** 1.1)[:, :, None]   # закругление силуэта
    out = np.concatenate([np.clip(rgb, 0, 255),
                          np.asarray(L["mask"], np.float32)[:, :, None]], axis=2)
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def build_static_layers(photo: str | None, style: str):
    S = STYLES[style]
    ratio, HEART_Y = S["ratio"], S["y"]
    mask = heart_mask(W, ratio, y_shift=HEART_Y)
    inner = heart_mask(W, ratio * 0.80, y_shift=HEART_Y - 0.012)
    inner = inner.filter(ImageFilter.GaussianBlur(W * 0.030))

    # Тело сердца.
    body = vertical_gradient(W, S["fill_top"], S["fill_bot"]).convert("RGBA")
    body.putalpha(mask)
    sheen = tint(radial_alpha(W, W * 0.33, W * 0.24, W * 0.42, 2.6), (70, 72, 90))
    sheen.putalpha(ImageChops.multiply(sheen.split()[3].point(lambda v: v // 2), mask))
    body = Image.alpha_composite(body, sheen)

    # Кант.
    shrunk = mask.filter(ImageFilter.MinFilter(9 if style == "noir" else 13))
    edge = ImageChops.subtract(mask, shrunk)
    edge = edge.filter(ImageFilter.GaussianBlur(W * (0.006 if style == "noir" else 0.003)))

    top_bias = Image.linear_gradient("L").resize((W, W)).transpose(Image.FLIP_TOP_BOTTOM)
    edge_gloss = ImageChops.multiply(edge, top_bias)

    halo = mask.filter(ImageFilter.GaussianBlur(W * 0.045))
    halo = ImageChops.subtract(halo, shrunk.filter(ImageFilter.GaussianBlur(W * 0.01)))

    # Внешний белый контур — только мультяшный стиль.
    outline = None
    if S["outline"]:
        grown = mask.filter(ImageFilter.MaxFilter(15))
        ring = ImageChops.subtract(grown, mask).filter(ImageFilter.GaussianBlur(W * 0.002))
        outline = tint(ring, S["outline"], 1.0)

    # Глянцевое пятно-блик (мультяшный «стеклянный» отблеск).
    gloss = Image.new("L", (W, W), 0)
    gd = ImageDraw.Draw(gloss)
    gx, gy = W * 0.345, W * (0.5 + HEART_Y) - W * 0.17
    gd.ellipse((gx - W * 0.085, gy - W * 0.055, gx + W * 0.085, gy + W * 0.055), fill=255)
    gloss = gloss.rotate(-28, center=(gx, gy), resample=Image.BICUBIC)
    gloss = ImageChops.multiply(
        gloss.filter(ImageFilter.GaussianBlur(W * (0.010 if style == "cartoon" else 0.02))), mask)

    # Рисунок внутри сердца.
    ash, eyes = load_artwork(photo, W, style)
    ash = ash.point(lambda v: int(255 * (v / 255) ** 1.45))
    art_box = int(W * 0.56)
    pad = Image.new("L", (W, W), 0)
    off = ((W - art_box) // 2, int(W * (0.5 + HEART_Y) - art_box * 0.50))
    ash_f, eyes_f = pad.copy(), pad.copy()
    ash_f.paste(ash.resize((art_box, art_box), Image.LANCZOS), off)
    eyes_f.paste(eyes.resize((art_box, art_box), Image.LANCZOS), off)
    ash_f = ImageChops.multiply(ash_f, inner)
    eyes_f = ImageChops.multiply(eyes_f, inner)

    art = tint(ash_f, S["ash"], 1.0)
    art_glow = tint(ash_f.filter(ImageFilter.GaussianBlur(W * 0.02)), (120, 130, 160), 0.5)

    L = dict(S=S, style=style, mask=mask, body=body, edge=edge, edge_gloss=edge_gloss,
             halo=halo, outline=outline, gloss=gloss, art=art, art_glow=art_glow,
             eyes=eyes_f, art_mask=ash_f, ratio=ratio, hy=HEART_Y,
             lily_back=None, lily_front=None, bloom=None)

    # Венок из лилий — только там, где он предусмотрен стилем.
    if S["wreath"]:
        back, front = lilies.render(W, style, heart_center=(0.5, 0.5 + HEART_Y),
                                    heart_rx=ratio / 2, heart_ry=ratio / 2 * 0.90)
        bloom = Image.alpha_composite(back, front).split()[3]
        bloom = bloom.filter(ImageFilter.GaussianBlur(W * 0.035)).point(lambda v: int(v * 0.55))
        L.update(lily_back=back, lily_front=front, bloom=bloom)

    # Рельеф: карта нормалей и ядро для свечения изнутри.
    if S["shading"]:
        h, nx, ny, nz = build_normals(mask)
        core = np.asarray(
            heart_mask(W, ratio * 0.62, y_shift=HEART_Y).filter(
                ImageFilter.GaussianBlur(W * 0.085)), np.float32) / 255.0
        L.update(h=h, nx=nx, ny=ny, nz=nz, core=core * (np.asarray(mask, np.float32) / 255.0))
    return L


def shine_layer(mask, phase, gain=0.20):
    """Диагональная блик-полоса, проходящая по сердцу."""
    yy, xx = np.mgrid[0:W, 0:W].astype(np.float32)
    proj = (xx + yy) / (2 * W)
    band = np.exp(-((proj - (phase * 1.6 - 0.3)) ** 2) / (2 * 0.045 ** 2))
    layer = tint(Image.fromarray((band * 255).astype(np.uint8), "L"), (255, 255, 255))
    layer.putalpha(ImageChops.multiply(layer.split()[3], mask).point(lambda v: int(v * gain)))
    return layer


def _star(d, x, y, r, color, alpha):
    """Четырёхлучевая искорка."""
    pts = []
    for i in range(8):
        a = i * math.pi / 4
        rad = r if i % 2 == 0 else r * 0.28
        pts.append((x + math.cos(a) * rad, y + math.sin(a) * rad))
    d.polygon(pts, fill=tuple(color) + (alpha,))


def sparkles(t, mask, S):
    layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    star = S["sparkle"] == "star"
    for i in range(9 if not star else 7):
        seed = i * 0.618
        p = (t / DURATION + seed) % 1.0
        x = W * (0.30 + 0.40 * ((seed * 3.7) % 1.0)) + math.sin(p * math.tau + i) * W * 0.02
        y = W * (0.80 - 0.58 * p)
        a = int((215 if star else 190) * math.sin(math.pi * p) ** 1.4)
        r = W * (0.010 + 0.006 * ((seed * 5.1) % 1.0)) if star else \
            W * (0.006 + 0.004 * ((seed * 5.1) % 1.0))
        if star:
            _star(d, x, y, r, (255, 236, 246), a)
        else:
            d.ellipse((x - r, y - r, x + r, y + r), fill=tuple(S["eye"]) + (a,))
    layer = layer.filter(ImageFilter.GaussianBlur(W * 0.004))
    layer.putalpha(ImageChops.multiply(layer.split()[3], mask))
    return layer


def bursts(phase, L):
    """Искры, вылетающие наружу на каждом ударе сердца."""
    layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = W * 0.5, W * (0.5 + L["hy"])
    rx, ry = W * L["ratio"] * 0.46, W * L["ratio"] * 0.42
    life = 0.44
    for i in range(14):
        seed = (i * 0.6180339887) % 1.0
        spawn = (i % 2) * 0.5 + seed * 0.03
        p = ((phase - spawn) % 1.0) / life
        if p >= 1.0:
            continue
        a = math.tau * seed + (i % 2) * 0.4
        ease = 1 - (1 - p) ** 2.2
        reach = 0.26 + 0.30 * ((seed * 7.3) % 1.0)
        x = cx + math.cos(a) * rx * (1 + reach * ease)
        y = cy + math.sin(a) * ry * (1 + reach * ease) - W * 0.10 * ease * ease
        al = int(235 * (1 - p) ** 1.6)
        r = W * (0.0085 - 0.004 * p)
        if r <= 0 or al <= 2:
            continue
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 148, 96, al))
        d.ellipse((x - r * 0.45, y - r * 0.45, x + r * 0.45, y + r * 0.45),
                  fill=(255, 232, 210, min(255, al + 20)))
    return layer.filter(ImageFilter.GaussianBlur(W * 0.0035))


def render_noir(L, i):
    """Объёмное сердце: свет обходит его по кругу, оно качается и бьётся."""
    S = L["S"]
    t = i / FPS
    phase = t / DURATION
    b = beat_envelope(t)
    tilt = math.sin(phase * math.tau)              # покачивание вокруг оси
    glow = 0.35 + 0.65 * b

    # Свет ходит маятником по верхней полусфере — блик скользит, тело остаётся чёрным.
    frame = shade_heart(L, -math.pi / 2 + tilt * 0.95, b, tilt)

    # Рисунок лежит на поверхности: подчиняется свету и сдвигается при качании.
    ndl = np.clip(L["nx"] * -0.45 + L["ny"] * -0.42 + L["nz"] * 0.79, 0, 1)
    lit = Image.fromarray(
        (np.asarray(L["art_mask"], np.float32) * (0.45 + 0.55 * ndl)).astype(np.uint8), "L")
    shift = int(round(tilt * W * 0.014))
    lit = ImageChops.offset(lit, shift, 0)
    eyes = ImageChops.offset(L["eyes"], shift, 0)
    frame = add(frame, tint(lit.filter(ImageFilter.GaussianBlur(W * 0.022)), (74, 80, 108), 0.38))
    frame = Image.alpha_composite(frame, tint(lit, S["ash"], 0.80))

    # Глаза разгораются на ударе.
    frame = add(frame, tint(eyes.filter(ImageFilter.GaussianBlur(W * 0.020)), S["eye"], 1.05 * glow))
    frame = add(frame, tint(eyes, (255, 216, 202), 0.45 + 0.55 * glow))

    # Пульс со сжатием и покачивание по горизонтали.
    amp = S["beat"] * b
    frame = scale_xy(frame,
                     (1 + amp * (1 + 0.20 * S["squash"])) * (1 - 0.022 * abs(tilt)),
                     1 + amp * (1 - 0.20 * S["squash"]))

    out = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    out = add(out, tint(L["halo"], S["rim"], 0.22 + 0.55 * b))
    out = Image.alpha_composite(out, frame)
    out = add(out, bursts(phase, L))
    return out.resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS)


def sway(layer, deg, sx=1.0, sy=1.0):
    """Покачивание венка вокруг нижнего центра холста."""
    out = scale_xy(layer, sx, sy, anchor=1.0)
    if abs(deg) > 1e-3:
        out = out.rotate(deg, resample=Image.BICUBIC, center=(W * 0.5, W * 0.98))
    return out


def render_frame(L, i):
    S = L["S"]
    if S["shading"]:
        return render_noir(L, i)
    t = i / FPS
    phase = t / DURATION
    b = beat_envelope(t)
    glow = 0.35 + 0.65 * b
    breathe = 0.5 + 0.5 * math.sin(phase * math.tau)

    frame = L["body"].copy()
    frame = add(frame, L["art_glow"])
    frame = Image.alpha_composite(frame, L["art"])

    # Глаза: пульсируют с ударом сердца, в мультяшной версии ещё и моргают.
    eye_gain = blink_factor(t) if S["blink"] else 1.0
    frame = add(frame, tint(L["eyes"].filter(ImageFilter.GaussianBlur(W * 0.018)),
                            S["eye"], 0.9 * glow * eye_gain))
    frame = add(frame, tint(L["eyes"], (255, 214, 200), (0.55 + 0.45 * glow) * eye_gain))

    # Кант, глянец, блик.
    frame = add(frame, tint(L["edge"], S["rim"], S["rim_gain"] * (0.6 + 0.6 * glow)))
    frame = add(frame, tint(L["edge_gloss"], (255, 236, 240), 0.30 + 0.20 * breathe))
    frame = add(frame, tint(L["gloss"], (255, 255, 255), 0.40 * S["gloss"]))
    frame = add(frame, shine_layer(L["mask"], phase, S["shine"]))
    frame = add(frame, sparkles(t, L["mask"], S))

    if L["outline"] is not None:
        frame = Image.alpha_composite(L["outline"], frame)

    # Пульс: в мультяшной версии с приплюснутостью.
    amp = S["beat"] * b
    frame = scale_xy(frame, 1 + amp * (1 + 0.18 * S["squash"]),
                     1 + amp * (1 - 0.18 * S["squash"]))

    # Сцена: венок сзади → сияние → сердце → цветы спереди.
    swing = math.sin(phase * math.tau) * 1.7
    out = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    out = Image.alpha_composite(out, sway(L["lily_back"], swing, 1 + 0.012 * b, 1 + 0.012 * b))
    out = add(out, tint(L["bloom"], (236, 240, 255), 0.45 * (0.55 + 0.45 * breathe)))
    out = add(out, tint(L["halo"], S["rim"], 0.30 + 0.45 * b))
    out = Image.alpha_composite(out, frame)
    out = Image.alpha_composite(out, sway(L["lily_front"], -swing, 1 + 0.02 * b, 1 + 0.02 * b))
    return out.resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS)


# --------------------------------------------------------------------------- #
# Кодирование
# --------------------------------------------------------------------------- #
def ffmpeg_bin():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def encode(frames_dir, dst, size, bitrate_k):
    vf = f"scale={size}:{size}:flags=lanczos" if size != OUT_SIZE else "null"
    subprocess.run([
        ffmpeg_bin(), "-y", "-loglevel", "error",
        "-framerate", str(FPS), "-i", os.path.join(frames_dir, "%03d.png"),
        "-vf", vf,
        "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
        "-auto-alt-ref", "0", "-lag-in-frames", "0",
        "-deadline", "best", "-cpu-used", "0",
        "-b:v", f"{bitrate_k}k", "-maxrate", f"{int(bitrate_k * 1.4)}k",
        "-an", "-sn", dst,
    ], check=True)
    return os.path.getsize(dst)


def build_style(style, photo, out_dir):
    print(f"\n=== стиль: {style} ===")
    L = build_static_layers(photo, style)
    frames_dir = os.path.join(out_dir, f"frames_{style}")
    shutil.rmtree(frames_dir, ignore_errors=True)
    os.makedirs(frames_dir)
    for i in range(FRAMES):
        render_frame(L, i).save(os.path.join(frames_dir, f"{i:03d}.png"))
        if (i + 1) % 30 == 0:
            print(f"  кадр {i + 1}/{FRAMES}")

    still = Image.open(os.path.join(frames_dir, "008.png"))
    still.save(os.path.join(out_dir, f"thumb_{style}.webp"), lossless=True)
    still.resize((512, 512), Image.NEAREST).save(os.path.join(out_dir, f"still_{style}.png"))

    emoji = os.path.join(out_dir, f"black_heart_{style}.webm")
    lo, hi, best = 30, 460, None
    while lo <= hi:
        mid = (lo + hi) // 2
        if encode(frames_dir, emoji, OUT_SIZE, mid) <= MAX_BYTES:
            best, lo = mid, mid + 1
        else:
            hi = mid - 1
    if best is None:
        sys.exit("Не удалось уложиться в 64 КБ")
    encode(frames_dir, emoji, OUT_SIZE, best)
    print(f"✓ {os.path.basename(emoji)}  {os.path.getsize(emoji) / 1024:.1f} КБ  @ {best}k")

    big = os.path.join(out_dir, f"preview_{style}_512.webm")
    encode(frames_dir, big, 512, 1400)
    print(f"✓ {os.path.basename(big)}  {os.path.getsize(big) / 1024:.1f} КБ")
    shutil.rmtree(frames_dir, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--photo", default=None, help="путь к фото рисунка")
    ap.add_argument("--style", default="both", choices=["noir", "cartoon", "both"])
    ap.add_argument("--out", default=os.path.join(HERE, "out"))
    ap.add_argument("--still", type=int, default=None,
                    help="быстрый предпросмотр одного кадра (0..89)")
    args = ap.parse_args()

    photo = args.photo
    if photo and not os.path.exists(photo):
        sys.exit(f"Файл не найден: {photo}")
    if not photo:
        photo = next((p for p in (
            os.path.join(HERE, "assets", n)
            for n in ("monster.jpg", "monster.jpeg", "monster.png", "monster.webp")
        ) if os.path.exists(p)), None)
    print("Источник рисунка:", photo or "процедурный (assets/monster.* не найден)")

    os.makedirs(args.out, exist_ok=True)
    styles = ["noir", "cartoon"] if args.style == "both" else [args.style]

    if args.still is not None:
        for st in styles:
            f = render_frame(build_static_layers(photo, st), args.still)
            dst = os.path.join(args.out, f"still_{st}.png")
            f.resize((512, 512), Image.NEAREST).save(dst)
            print("✓", dst)
        return

    for st in styles:
        build_style(st, photo, args.out)


if __name__ == "__main__":
    main()
