"""Белые лилии венком вокруг сердца.

render(size, style) → (back, front):
  back  — венок ЗА сердцем: стебли-дуги обхватывают его, цветы выглядывают
          из-за силуэта (их центры лежат прямо на кромке сердца);
  front — цветы перед сердцем снизу, замыкающие объятие.

Стили: "noir" — мягкая растушёвка, холодный белый;
       "cartoon" — плоская заливка, толстый контур, жёлтая серединка.
"""

import math

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

PETAL_TIP = (255, 255, 255)
PETAL_BASE = (150, 156, 176)
STAMEN = (232, 200, 138)
LEAF = (86, 104, 92)
STEM = (74, 92, 78)

C_PETAL = (255, 255, 255)
C_PETAL_SHADE = (206, 212, 236)
C_OUTLINE = (46, 40, 64)
C_CENTER = (255, 206, 92)
C_LEAF = (108, 186, 116)
C_STEM = (86, 158, 96)


def _petal_polygon(cx, cy, angle, length, width, curl):
    left, right = [], []
    n = 26
    for i in range(n + 1):
        s = i / n
        w = math.sin(math.pi * s) ** 0.72 * width * (1 - 0.22 * s)
        bend = curl * length * 0.30 * math.sin(math.pi * s)
        a = angle + curl * 0.25 * s
        mx = cx + math.cos(a) * length * s - math.sin(a) * bend
        my = cy + math.sin(a) * length * s + math.cos(a) * bend
        px, py = -math.sin(a) * w, math.cos(a) * w
        left.append((mx + px, my + py))
        right.append((mx - px, my - py))
    return left + right[::-1]


def _shade(mask, size, cx, cy, reach, base=PETAL_BASE, tip=PETAL_TIP):
    """Радиальная растушёвка: у основания темнее, к краю лепестка светлее."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    d = np.clip(np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / max(reach, 1e-6), 0, 1)
    ramp = d[:, :, None] ** 0.75
    rgb = np.array(base, np.float32) * (1 - ramp) + np.array(tip, np.float32) * ramp
    out = np.concatenate([rgb, np.asarray(mask, np.float32)[:, :, None]], axis=2)
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def _outline(mask, size, weight, color, alpha=235):
    """Контур наружу от маски — для мультяшного стиля."""
    k = max(3, int(size * weight) | 1)
    grown = mask.filter(ImageFilter.MaxFilter(k))
    ring = ImageChops.subtract(grown, mask)
    layer = Image.new("RGBA", (size, size), color + (0,))
    layer.putalpha(ring.point(lambda v: int(v * alpha / 255)))
    return layer


def _flower(size, cx, cy, radius, rot, tilt=0.78, petals=6, style="noir"):
    cartoon = style == "cartoon"
    n = 5 if cartoon else petals
    mask = Image.new("L", (size, size), 0)
    edge = Image.new("L", (size, size), 0)
    md, ed = ImageDraw.Draw(mask), ImageDraw.Draw(edge)

    order = sorted(range(n), key=lambda i: -math.sin(rot + i * math.tau / n))
    for i in order:
        a = rot + i * math.tau / n
        squash = 1.0 - (1.0 - tilt) * max(0.0, -math.sin(a))
        if cartoon:
            length = radius * squash
            width = radius * 0.46 * squash
            curl = 0.12 if i % 2 else -0.12
        else:
            length = radius * squash * (0.92 + 0.16 * ((i * 0.37) % 1.0))
            width = radius * 0.30 * squash
            curl = (0.55 if i % 2 else -0.5) * (0.7 + 0.3 * ((i * 0.61) % 1.0))
        poly = _petal_polygon(cx, cy, a, length, width, curl)
        md.polygon(poly, fill=255)
        ed.line(poly + [poly[0]], fill=255 if cartoon else 120,
                width=max(1, int(size * (0.005 if cartoon else 0.0035))))

    petal_mask = mask.filter(ImageFilter.GaussianBlur(size * 0.0025))

    if cartoon:
        flower = _shade(petal_mask, size, cx, cy, radius * 1.1,
                        base=C_PETAL_SHADE, tip=C_PETAL)
        seam = Image.new("RGBA", (size, size), C_OUTLINE + (0,))
        seam.putalpha(ImageChops.multiply(edge, petal_mask).point(lambda v: int(v * 0.5)))
        flower = Image.alpha_composite(flower, seam)
        flower = Image.alpha_composite(_outline(petal_mask, size, 0.010, C_OUTLINE), flower)
        # жёлтая серединка с обводкой
        core = Image.new("L", (size, size), 0)
        r = radius * 0.26
        ImageDraw.Draw(core).ellipse((cx - r, cy - r * tilt, cx + r, cy + r * tilt), fill=255)
        dot = Image.new("RGBA", (size, size), C_CENTER + (0,))
        dot.putalpha(core)
        flower = Image.alpha_composite(flower, _outline(core, size, 0.008, C_OUTLINE))
        return Image.alpha_composite(flower, dot)

    flower = _shade(petal_mask, size, cx, cy, radius * 0.95)
    seam = Image.new("RGBA", (size, size), PETAL_BASE + (0,))
    seam.putalpha(ImageChops.multiply(
        edge.filter(ImageFilter.GaussianBlur(size * 0.002)), petal_mask))
    flower = Image.alpha_composite(flower, seam)

    st = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(st)
    for k in range(4):
        a = rot + 0.5 + k * 0.42
        ln = radius * (0.42 + 0.10 * k % 0.3)
        ex, ey = cx + math.cos(a) * ln, cy + math.sin(a) * ln * tilt
        sd.line((cx, cy, ex, ey), fill=(226, 226, 232, 190), width=max(1, int(size * 0.004)))
        r = size * 0.006
        sd.ellipse((ex - r, ey - r, ex + r, ey + r), fill=STAMEN + (235,))
    st = st.filter(ImageFilter.GaussianBlur(size * 0.0022))
    return Image.alpha_composite(flower, st)


def _bud(size, cx, cy, angle, length, style="noir"):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.polygon(_petal_polygon(cx, cy, angle, length, length * 0.30, 0.22), fill=255)
    d.polygon(_petal_polygon(cx, cy, angle + 0.22, length * 0.85, length * 0.24, -0.28), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(size * 0.003))
    if style == "cartoon":
        body = _shade(m, size, cx, cy, length, base=C_PETAL_SHADE, tip=C_PETAL)
        return Image.alpha_composite(_outline(m, size, 0.010, C_OUTLINE), body)
    return _shade(m, size, cx, cy, length)


def _stem(size, pts, width, style="noir"):
    color = C_STEM if style == "cartoon" else STEM
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(layer).line(pts, fill=color + (225,), width=width, joint="curve")
    if style == "cartoon":
        m = layer.split()[3]
        return Image.alpha_composite(_outline(m, size, 0.007, C_OUTLINE, 200), layer)
    return layer.filter(ImageFilter.GaussianBlur(size * 0.002))


def _leaf(size, cx, cy, angle, length, style="noir"):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).polygon(
        _petal_polygon(cx, cy, angle, length, length * 0.19, 0.5), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(size * 0.003))
    color = C_LEAF if style == "cartoon" else LEAF
    layer = Image.new("RGBA", (size, size), color + (0,))
    layer.putalpha(m.point(lambda v: int(v * 0.94)))
    if style == "cartoon":
        return Image.alpha_composite(_outline(m, size, 0.009, C_OUTLINE), layer)
    return layer


# --------------------------------------------------------------------------- #
# Венок
# --------------------------------------------------------------------------- #
def _arc(cx, cy, rx, ry, a0, a1, steps=26):
    """Точки эллиптической дуги — стебель, обхватывающий сердце."""
    return [
        (cx + math.cos(a0 + (a1 - a0) * i / steps) * rx,
         cy + math.sin(a0 + (a1 - a0) * i / steps) * ry)
        for i in range(steps + 1)
    ]


def _on_ring(cx, cy, rx, ry, deg):
    a = math.radians(deg)
    return cx + math.cos(a) * rx, cy + math.sin(a) * ry


def render(size, style="noir", heart_center=(0.5, 0.425), heart_rx=0.37, heart_ry=0.37):
    """Цветы ставятся прямо на кромку сердца, поэтому уходят под него."""
    S = size
    hcx, hcy = heart_center[0] * S, heart_center[1] * S
    rx, ry = heart_rx * S, heart_ry * S
    back = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    front = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    # --- стебли: два побега обхватывают сердце дугой снизу вверх ---
    stem_w = max(1, int(S * (0.013 if style == "cartoon" else 0.010)))
    back = Image.alpha_composite(back, _stem(
        S, _arc(hcx, hcy, rx * 1.02, ry * 1.08, math.radians(88), math.radians(228)),
        stem_w, style))
    back = Image.alpha_composite(back, _stem(
        S, _arc(hcx, hcy, rx * 1.02, ry * 1.08, math.radians(92), math.radians(-48)),
        stem_w, style))

    # --- листья на дуге ---
    for deg, ang in ((150, 2.5), (30, 0.6)):
        lx, ly = _on_ring(hcx, hcy, rx * 1.06, ry * 1.10, deg)
        back = Image.alpha_composite(back, _leaf(S, lx, ly, ang, S * 0.17, style))

    # --- цветы венка: центры на кромке, лепестки торчат из-за сердца ---
    fr = S * (0.125 if style == "cartoon" else 0.118)
    for deg, rot, tilt in ((196, -0.3, 0.76), (232, -1.0, 0.72),
                           (-16, 2.9, 0.76), (-52, 2.1, 0.72)):
        fx, fy = _on_ring(hcx, hcy, rx * 0.94, ry * 0.94, deg)
        back = Image.alpha_composite(back, _flower(S, fx, fy, fr, rot, tilt, style=style))

    # --- бутоны на кончиках обнимающих стеблей ---
    for deg, ang in ((228, -1.05), (-48, -2.10)):
        bx, by = _on_ring(hcx, hcy, rx * 1.02, ry * 1.08, deg)
        back = Image.alpha_composite(back, _bud(S, bx, by, ang, S * 0.105, style))

    # --- перед сердцем: объятие замыкается снизу ---
    for deg, ang in ((122, -2.2), (58, -0.95)):
        lx, ly = _on_ring(hcx, hcy, rx * 0.92, ry * 1.02, deg)
        front = Image.alpha_composite(front, _leaf(S, lx, ly, ang, S * 0.19, style))
    ff = S * (0.16 if style == "cartoon" else 0.155)
    for deg, rot, tilt in ((133, 0.35, 0.84), (47, 2.6, 0.84)):
        fx, fy = _on_ring(hcx, hcy, rx * 0.90, ry * 0.98, deg)
        front = Image.alpha_composite(front, _flower(S, fx, fy, ff, rot, tilt, style=style))
    bx, by = _on_ring(hcx, hcy, rx * 0.30, ry * 1.20, 90)
    front = Image.alpha_composite(front, _bud(S, bx, by, -1.2, S * 0.12, style))
    return back, front
