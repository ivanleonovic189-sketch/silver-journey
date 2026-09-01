"""Вырезание сердца из фотографии и перекраска его в чёрный.

Фон отделяется по «красноте» (R заметно выше G и B), затем маска чистится
морфологией и сглаживается. Освещение снимка сохраняется целиком: яркость
исходника прогоняется через степенную кривую, поэтому тело становится
чёрным, а блики остаются бликами.

    ash, eyes = ...          # не используется, это отдельный модуль
    rgba = load_black_heart('assets/heart_source.jpg', 400)
"""

import numpy as np
from PIL import Image, ImageChops, ImageFilter

# Кривая перекраски: линейная часть держит тени, степенная гасит тело,
# блики доживают до самого верха. Чем больше POW, тем чернее тело.
LIN, POW = 0.22, 3.0
# Подтон: чёрный не нейтральный, а с тем же тёплым отливом, что у оригинала.
TINT = (1.05, 0.965, 0.95)
FLOOR = (5, 4, 6)


def cutout(path, pad=0.06):
    """→ (rgb, alpha) без фона, обрезано по сердцу и дополнено полями."""
    img = Image.open(path).convert("RGB")
    a = np.asarray(img).astype(np.float32)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]

    # фон фиолетовый (синего больше красного), сердце красное — даже в тенях
    warm = (r - b > 8) | (r - np.maximum(g, b) > 18)
    m = Image.fromarray((warm.astype(np.uint8) * 255), "L")
    # закрыть дыры под бликом
    m = m.filter(ImageFilter.MaxFilter(11)).filter(ImageFilter.MinFilter(15))
    m = m.filter(ImageFilter.MaxFilter(5))
    # сгладить контур и подрезать его внутрь, чтобы срезать фиолетовую кайму
    m = m.filter(ImageFilter.MedianFilter(9))
    m = m.filter(ImageFilter.GaussianBlur(2.5)).point(lambda v: 255 if v > 150 else 0)
    m = m.filter(ImageFilter.MinFilter(5))

    box = m.getbbox()
    if box is None:
        raise SystemExit("сердце на снимке не найдено")
    x0, y0, x1, y1 = box
    side = max(x1 - x0, y1 - y0)
    grow = int(side * pad)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    half = side // 2 + grow
    crop = (cx - half, cy - half, cx + half, cy + half)

    rgb = img.crop(crop)
    alpha = m.crop(crop)
    # мягкий край, чтобы не было пилы после уменьшения
    alpha = alpha.filter(ImageFilter.GaussianBlur(1.6))
    return rgb, alpha


def to_black(rgb, alpha):
    """Красное → чёрное с сохранением всей светотени снимка."""
    a = np.asarray(rgb).astype(np.float32) / 255.0
    v = a.max(axis=2)                        # интенсивность освещения
    v = np.clip((v - 0.05) / 0.95, 0, 1)
    lit = LIN * v + (1 - LIN) * v ** POW

    out = np.zeros(a.shape, np.float32)
    for c in range(3):
        out[:, :, c] = FLOOR[c] + (255 - FLOOR[c]) * lit * TINT[c]
    # у самых ярких точек блик обесцвечивается — как на полированном чёрном
    hot = np.clip((lit - 0.55) / 0.45, 0, 1)[:, :, None]
    out = out * (1 - hot) + np.clip(out.mean(axis=2)[:, :, None] * 1.06, 0, 255) * hot

    rgba = np.concatenate([np.clip(out, 0, 255),
                           np.asarray(alpha, np.float32)[:, :, None]], axis=2)
    return Image.fromarray(rgba.astype(np.uint8), "RGBA")


def load_black_heart(path, size):
    rgb, alpha = cutout(path)
    black = to_black(rgb, alpha)
    return black.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    import sys
    src = sys.argv[1] if len(sys.argv) > 1 else "assets/heart_source.jpg"
    load_black_heart(src, 512).save("out/black_heart_cutout.png")
    print("✓ out/black_heart_cutout.png")
