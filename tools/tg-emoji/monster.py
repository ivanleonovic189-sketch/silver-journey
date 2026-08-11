"""Процедурный «угольный монстр» — запасной вариант, если фото не приложено.

Рисует шаггий силуэт углём с красными светящимися глазами, стилистически
повторяя исходный рисунок. Возвращает (ash, eyes):
  ash  — L-маска штрихов (255 = самый плотный уголь)
  eyes — L-маска зрачков для отдельного свечения
"""

import math
import random

import numpy as np

from PIL import Image, ImageDraw, ImageFilter


def _stroke(draw, x, y, angle, length, width, value):
    dx = math.cos(angle) * length / 2
    dy = math.sin(angle) * length / 2
    draw.line((x - dx, y - dy, x + dx, y + dy), fill=value, width=width)


def render(size, style="noir", seed=7):
    """size — сторона квадрата в пикселях (рендерим в супер-разрешении)."""
    if style == "cartoon":
        return render_cartoon(size)
    rnd = random.Random(seed)
    S = size
    ash = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(ash)

    cx, cy = S * 0.5, S * 0.52

    # 1. Общая масса головы: несколько перекрывающихся эллипсов.
    body = Image.new("L", (S, S), 0)
    bd = ImageDraw.Draw(body)
    blobs = [
        (0.50, 0.42, 0.34, 0.30),
        (0.42, 0.60, 0.26, 0.30),
        (0.60, 0.58, 0.24, 0.28),
        (0.50, 0.72, 0.22, 0.22),
    ]
    for fx, fy, rx, ry in blobs:
        bd.ellipse(
            (S * (fx - rx), S * (fy - ry), S * (fx + rx), S * (fy + ry)), fill=255
        )
    body = body.filter(ImageFilter.GaussianBlur(S * 0.02))

    # 2. Штриховка углём — плотные вертикальные/диагональные росчерки.
    for _ in range(1400):
        a = rnd.uniform(0, math.tau)
        r = math.sqrt(rnd.random())
        x = cx + math.cos(a) * r * S * 0.36
        y = cy + math.sin(a) * r * S * 0.40
        if body.getpixel((int(max(0, min(S - 1, x))), int(max(0, min(S - 1, y))))) < 40:
            continue
        ang = math.pi / 2 + rnd.uniform(-0.55, 0.55)
        _stroke(
            d,
            x,
            y,
            ang,
            rnd.uniform(0.10, 0.30) * S,
            max(1, int(rnd.uniform(0.006, 0.018) * S)),
            rnd.randint(120, 255),
        )

    # 3. Лохматые «перья» по краю силуэта — рваный контур.
    for _ in range(240):
        a = rnd.uniform(0, math.tau)
        rx, ry = S * 0.33, S * 0.38
        x = cx + math.cos(a) * rx * rnd.uniform(0.85, 1.12)
        y = cy + math.sin(a) * ry * rnd.uniform(0.85, 1.12)
        ang = math.atan2(y - cy, x - cx) + rnd.uniform(-0.4, 0.4)
        _stroke(
            d,
            x,
            y,
            ang,
            rnd.uniform(0.06, 0.16) * S,
            max(1, int(0.008 * S)),
            rnd.randint(140, 235),
        )

    # 4. Гребень справа — «зубцы», как на рисунке.
    for i in range(14):
        t = i / 13
        x = cx + S * (0.26 + 0.06 * math.sin(t * 3))
        y = cy + S * (-0.30 + 0.44 * t)
        _stroke(d, x, y, rnd.uniform(-0.4, 0.4), S * 0.10, max(1, int(0.010 * S)), 230)

    ash = ash.filter(ImageFilter.GaussianBlur(S * 0.004))
    ash = Image.composite(ash, Image.new("L", (S, S), 0), body)

    # 5. Глаза: два наклонённых кольца со светлым центром.
    eyes = Image.new("L", (S, S), 0)
    ed = ImageDraw.Draw(eyes)
    hole = ImageDraw.Draw(ash)
    for fx, fy, rot in ((0.405, 0.255, -12), (0.605, 0.245, 8)):
        ex, ey = S * fx, S * fy
        rx, ry = S * 0.075, S * 0.036
        box = (ex - rx, ey - ry, ex + rx, ey + ry)
        layer = Image.new("L", (S, S), 0)
        ld = ImageDraw.Draw(layer)
        ld.ellipse(box, fill=255)
        layer = layer.rotate(rot, center=(ex, ey), resample=Image.BICUBIC)
        eyes = Image.eval(
            Image.merge("L", (eyes,)).point(lambda v: v), lambda v: v
        )  # no-op, keeps L
        eyes.paste(layer, (0, 0), layer)
        # под глазом уголь чуть светлее — «прожжённая» дырка
        hole.ellipse(
            (ex - rx * 0.62, ey - ry * 0.62, ex + rx * 0.62, ey + ry * 0.62), fill=40
        )

    eyes = eyes.filter(ImageFilter.GaussianBlur(S * 0.006))
    return ash, eyes


def render_cartoon(size, seed=11):
    """Мультяшный монстрик: округлый лохматый силуэт и большие круглые глаза."""
    rnd = random.Random(seed)
    S = size
    cx, cy = S * 0.5, S * 0.54

    body = Image.new("L", (S, S), 0)
    bd = ImageDraw.Draw(body)
    bd.ellipse((S * 0.20, S * 0.20, S * 0.80, S * 0.88), fill=255)
    # лохматые клинья по периметру
    for i in range(26):
        a = i / 26 * math.tau
        rx, ry = S * 0.30, S * 0.34
        bx, by = cx + math.cos(a) * rx, cy + math.sin(a) * ry
        ln = S * rnd.uniform(0.05, 0.10)
        w = S * 0.055
        tip = (bx + math.cos(a) * ln, by + math.sin(a) * ln)
        p1 = (bx - math.sin(a) * w, by + math.cos(a) * w)
        p2 = (bx + math.sin(a) * w, by - math.cos(a) * w)
        bd.polygon([p1, tip, p2], fill=255)
    body = body.filter(ImageFilter.GaussianBlur(S * 0.004))

    # мягкая объёмная подсветка сверху
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    d = np.sqrt((xx - S * 0.40) ** 2 + (yy - S * 0.36) ** 2) / (S * 0.46)
    shade = np.clip(1.25 - d * 0.75, 0.52, 1.0)
    ash = Image.fromarray(
        (np.asarray(body, np.float32) * shade).astype(np.uint8), "L")

    eyes = Image.new("L", (S, S), 0)
    ed = ImageDraw.Draw(eyes)
    hole = ImageDraw.Draw(ash)
    for fx, fy, r in ((0.395, 0.415, 0.092), (0.618, 0.405, 0.084)):
        ex, ey, rr = S * fx, S * fy, S * r
        # белок глаза светлее шерсти, зрачок — дырка в чёрное тело сердца
        hole.ellipse((ex - rr, ey - rr, ex + rr, ey + rr), fill=255)
        pr = rr * 0.46
        hole.ellipse((ex - pr, ey + rr * 0.05 - pr, ex + pr, ey + rr * 0.05 + pr), fill=0)
        ed.ellipse((ex - rr * 0.98, ey - rr * 0.98, ex + rr * 0.98, ey + rr * 0.98), fill=170)
        ed.ellipse((ex - pr, ey + rr * 0.05 - pr, ex + pr, ey + rr * 0.05 + pr), fill=0)
        hr = rr * 0.24
        hole.ellipse((ex + rr * 0.30 - hr, ey - rr * 0.38 - hr,
                      ex + rr * 0.30 + hr, ey - rr * 0.38 + hr), fill=255)
    eyes = eyes.filter(ImageFilter.GaussianBlur(S * 0.004))
    return ash, eyes
