"""Вырезание сердца из фотографии и перекраска его в чёрный.

Фон отделяется по «теплоте» пикселя (у фиолетового фона синего больше, чем
красного), контур замыкается заливкой от угла, сглаживается в увеличенном
разрешении и возвращается обратно — так на краю получается ровная
субпиксельная альфа без зазубрин и без фиолетовой каймы.

Освещение снимка сохраняется целиком: яркость прогоняется через кривую,
у которой линейная часть держит тени, степенная гасит тело, а блики доживают
до самого верха.

    python3 heart_photo.py [путь_к_фото]
"""

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

LIN, POW = 0.16, 3.6            # кривая перекраски
TINT = (1.05, 0.965, 0.95)      # тёплый подтон, как у оригинала
FLOOR = (5, 4, 6)               # самая глубокая тень
SMOOTH = 4                      # во сколько раз увеличиваем маску для сглаживания


def _binary_mask(img):
    a = np.asarray(img).astype(np.float32)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    warm = (r - b > 4) | (r - np.maximum(g, b) > 14)
    return Image.fromarray((warm.astype(np.uint8) * 255), "L")


def _close_holes(m):
    """Заливка от угла: всё, что фон не достал, считается телом сердца."""
    inv = ImageChops.invert(m)
    ImageDraw.floodfill(inv, (0, 0), 0)          # фон → 0
    return ImageChops.lighter(m, inv)            # остались только дыры внутри


def _smooth_contour(m, strength=0.017):
    """Сглаживание контура: размытие с порогом в увеличенном масштабе.

    Зазубрины мельче радиуса исчезают, а форма сердца остаётся прежней.
    Обратное уменьшение даёт мягкий антиалиасный край.
    """
    w, h = m.size
    big = m.resize((w * SMOOTH, h * SMOOTH), Image.NEAREST)
    r = max(1.0, w * SMOOTH * strength)
    big = big.filter(ImageFilter.GaussianBlur(r)).point(lambda v: 255 if v > 128 else 0)
    big = big.filter(ImageFilter.GaussianBlur(r * 0.55)).point(lambda v: 255 if v > 128 else 0)
    return big.resize((w, h), Image.LANCZOS)


def _defringe(rgb, alpha, reach=6):
    """Убирает фиолетовый ободок: краевые пиксели берут цвет изнутри.

    Считается размытие цвета, взвешенное альфой, и нормируется на размытую
    альфу — то есть цвет «растекается» наружу только из тела сердца.
    """
    a = np.asarray(alpha, np.float32) / 255.0
    src = np.asarray(rgb, np.float32)
    wa = Image.fromarray((a * 255).astype(np.uint8), "L").filter(
        ImageFilter.GaussianBlur(reach))
    wa = np.asarray(wa, np.float32) / 255.0 + 1e-4

    spread = np.zeros_like(src)
    for c in range(3):
        ch = Image.fromarray((src[:, :, c] * a).astype(np.uint8), "L")
        spread[:, :, c] = np.asarray(ch.filter(ImageFilter.GaussianBlur(reach)), np.float32) / wa

    # чем прозрачнее пиксель, тем сильнее он берёт цвет изнутри
    k = np.clip((1.0 - a) * 1.35, 0, 1)[:, :, None]
    return Image.fromarray(np.clip(src * (1 - k) + spread * k, 0, 255).astype(np.uint8), "RGB")


def cutout(path, pad=0.05):
    """→ (rgb, alpha): сердце без фона, обрезано в квадрат с полями."""
    img = Image.open(path).convert("RGB")
    m = _binary_mask(img)
    m = m.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(11))
    m = _close_holes(m)
    m = _smooth_contour(m)

    box = m.point(lambda v: 255 if v > 40 else 0).getbbox()
    if box is None:
        raise SystemExit("сердце на снимке не найдено")
    x0, y0, x1, y1 = box
    side = max(x1 - x0, y1 - y0)
    half = side // 2 + int(side * pad)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    crop = (cx - half, cy - half, cx + half, cy + half)

    rgb, alpha = img.crop(crop), m.crop(crop)
    return _defringe(rgb, alpha), alpha


def to_black(rgb, alpha):
    """Красное → чёрное с сохранением всей светотени снимка."""
    a = np.asarray(rgb).astype(np.float32) / 255.0
    v = np.clip((a.max(axis=2) - 0.05) / 0.95, 0, 1)
    lit = LIN * v + (1 - LIN) * v ** POW

    out = np.zeros(a.shape, np.float32)
    for c in range(3):
        out[:, :, c] = FLOOR[c] + (255 - FLOOR[c]) * lit * TINT[c]
    # самые яркие точки обесцвечиваются — блик на полированном чёрном белый
    hot = np.clip((lit - 0.55) / 0.45, 0, 1)[:, :, None]
    out = out * (1 - hot) + np.clip(out.mean(axis=2)[:, :, None] * 1.06, 0, 255) * hot

    rgba = np.concatenate([np.clip(out, 0, 255),
                           np.asarray(alpha, np.float32)[:, :, None]], axis=2)
    return Image.fromarray(rgba.astype(np.uint8), "RGBA")


def load_black_heart(path, size):
    rgb, alpha = cutout(path)
    return to_black(rgb, alpha).resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    import os
    import sys
    src = sys.argv[1] if len(sys.argv) > 1 else "assets/heart_source.jpg"
    os.makedirs("out", exist_ok=True)
    for size in (512, 100):
        img = load_black_heart(src, size)
        img.save(f"out/black_heart_{size}.png")
        print(f"✓ out/black_heart_{size}.png")
    # 100x100 WebP — формат статичного кастом-эмодзи Telegram
    load_black_heart(src, 100).save("out/black_heart_100.webp", lossless=True)
    print("✓ out/black_heart_100.webp")
