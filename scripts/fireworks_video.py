#!/usr/bin/env python3
"""Генератор ролика с салютом 1920x1080 для монтажа поздравления.

Таймлайн:
  0.0 - 1.2  чёрное небо со звёздами
  1.2 - 4.0  первые золотые залпы
  4.0 - 7.0  синие раскрытия между золотыми
  7.0 - 10.0 плотный золотой финал на весь экран (последний залп ~9.1с)
  10.0 - 15.0 титры

Звук: процедурная подложка (гул толпы + удары залпов) — поверх неё
в монтаже кладутся живые крики «С ДНЁМ РОЖДЕНИЯ!!!».

Запуск: python3 scripts/fireworks_video.py [выходной.mp4]
"""
import math
import os
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1920, 1080
FPS = 30
SHOW_END = 10.0          # конец салюта
TOTAL = 15.0             # вместе с титрами
N_FRAMES = int(TOTAL * FPS)
SR = 44100
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

GOLD = (1.00, 0.78, 0.32)
WARM = (1.00, 0.62, 0.18)
BLUE = (0.35, 0.62, 1.00)
CYAN = (0.45, 0.90, 1.00)
WHITE = (1.00, 0.95, 0.85)

rng = np.random.default_rng(20260829)


class Shell:
    """Один залп: подъём, вспышка, разлёт искр."""

    def __init__(self, t0, x, y, color, n, speed, size=1.0, ring=False, trail=0.9):
        self.t0 = t0                     # момент раскрытия
        self.launch = t0 - trail         # момент старта с земли
        self.x, self.y = x, y
        self.color = color
        self.size = size
        self.ring = ring
        # разлёт: направления + скорости
        ang = rng.uniform(0, 2 * math.pi, n)
        z = rng.uniform(-1, 1, n)
        r = np.sqrt(np.maximum(0.0, 1 - z * z))
        vx = np.cos(ang) * r
        vy = np.sin(ang) * r
        mag = speed * (1.0 if ring else rng.uniform(0.25, 1.0, n) ** 0.45)
        self.vx = vx * mag
        self.vy = vy * mag
        self.life = rng.uniform(1.5, 2.6, n) * (0.8 + 0.4 * size)
        self.flick = rng.uniform(0, 2 * math.pi, n)
        self.n = n

    def points(self, t):
        """Возвращает (x, y, яркость) искр на момент t."""
        dt = t - self.t0
        if dt < 0 or dt > self.life.max():
            return None
        alive = dt < self.life
        if not alive.any():
            return None
        drag = np.exp(-1.1 * dt)
        # интеграл скорости с затуханием + гравитация
        k = (1 - drag) / 1.1
        px = self.x + self.vx[alive] * k
        py = self.y + self.vy[alive] * k + 55.0 * dt * dt
        frac = dt / self.life[alive]
        bright = np.clip(1.0 - frac, 0, 1) ** 1.6
        bright = bright * (0.65 + 0.35 * np.sin(self.flick[alive] + dt * 46.0))
        if dt < 0.09:                     # ослепительная вспышка в первый миг
            bright = bright * (1.0 + 7.0 * (1 - dt / 0.09))
        return px, py, bright

    def rocket(self, t):
        """Точка ракеты на подъёме, пока залп не раскрылся."""
        if not (self.launch <= t < self.t0):
            return None
        f = (t - self.launch) / (self.t0 - self.launch)
        ease = 1 - (1 - f) ** 2
        y = H + 60 - (H + 60 - self.y) * ease
        return self.x, y, 1.0 - 0.35 * f


def build_show():
    shells, booms = [], []

    def add(t, x, y, color, n, speed, size=1.0, ring=False, boom=1.0):
        shells.append(Shell(t, x, y, color, int(n * 1.8), speed * 1.9, size, ring))
        booms.append((t, boom, size))

    # --- Акт 1: первые золотые залпы (одиночные, с воздухом между ними)
    add(1.35, 660, 400, GOLD, 420, 320, 1.0)
    add(2.20, 1280, 330, WARM, 460, 340, 1.05)
    add(3.10, 950, 470, GOLD, 380, 300, 0.95)
    add(3.70, 430, 300, GOLD, 500, 360, 1.1)

    # --- Акт 2: синие раскрытия между золотыми
    add(4.15, 1450, 430, BLUE, 520, 350, 1.05)
    add(4.75, 780, 260, CYAN, 460, 330, 1.0, ring=True)
    add(5.10, 250, 470, BLUE, 420, 300, 0.95)
    add(5.55, 1150, 350, GOLD, 440, 330, 1.0)
    add(6.00, 1650, 300, BLUE, 480, 340, 1.05, ring=True)
    add(6.40, 560, 420, CYAN, 430, 320, 0.95)
    add(6.75, 1000, 250, BLUE, 540, 380, 1.15)

    # --- Акт 3: нарастание в плотный золотой финал
    dense = [
        (7.05, 350, 380), (7.20, 1520, 430), (7.38, 880, 260),
        (7.55, 1180, 600), (7.70, 620, 200), (7.85, 1700, 340),
        (8.00, 200, 560), (8.12, 1000, 400), (8.26, 1380, 230),
        (8.38, 760, 640), (8.50, 1600, 620), (8.60, 420, 260),
        (8.70, 1250, 350), (8.80, 900, 700), (8.88, 1750, 520),
    ]
    for i, (t, x, y) in enumerate(dense):
        c = GOLD if i % 3 else WARM
        add(t, x, y, c, 520 + 40 * i, 420 + 18 * i, 1.05 + 0.02 * i, boom=1.1)

    # финальный самый громкий залп — синхронизировать с общим криком
    add(9.05, 960, 520, GOLD, 4200, 900, 1.7, boom=2.2)
    add(9.08, 480, 360, WARM, 2200, 760, 1.4, boom=1.4)
    add(9.10, 1460, 380, GOLD, 2200, 760, 1.4, boom=1.4)
    add(9.14, 200, 640, GOLD, 1500, 700, 1.3, boom=1.2)
    add(9.16, 1740, 620, WARM, 1500, 700, 1.3, boom=1.2)
    add(9.20, 960, 200, WHITE, 1600, 820, 1.4, boom=1.2)
    return shells, booms


def star_field():
    """Статичное звёздное небо (яркость 0..1)."""
    layer = np.zeros((H, W), np.float32)
    n = 420
    xs = rng.integers(0, W, n)
    ys = rng.integers(0, int(H * 0.85), n)
    layer[ys, xs] = rng.uniform(0.10, 0.45, n)
    img = Image.fromarray((layer * 255).astype(np.uint8))
    img = img.filter(ImageFilter.GaussianBlur(0.7))
    return np.asarray(img, np.float32) / 255.0


def splat(buf, x, y, b, color, radius=1):
    """Аддитивно кладёт искры в RGB-буфер."""
    m = (x >= 0) & (x < W) & (y >= 0) & (y < H) & (b > 0.004)
    if not m.any():
        return
    xi = x[m].astype(np.int32)
    yi = y[m].astype(np.int32)
    bi = b[m].astype(np.float32)
    idx = yi * W + xi
    flat = buf.reshape(-1, 3)
    for ch in range(3):
        np.add.at(flat[:, ch], idx, bi * color[ch])
    if radius:  # мягкий крестик вокруг искры — толще след
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            xj = np.clip(xi + dx, 0, W - 1)
            yj = np.clip(yi + dy, 0, H - 1)
            j = yj * W + xj
            for ch in range(3):
                np.add.at(flat[:, ch], j, bi * 0.35 * color[ch])


def glow(buf, amount=1.15, radius=18):
    """Ореол вокруг ярких мест (bloom) через уменьшённую копию."""
    small = Image.fromarray(np.clip(buf * 255, 0, 255).astype(np.uint8)).resize(
        (W // 4, H // 4), Image.BILINEAR)
    small = small.filter(ImageFilter.GaussianBlur(radius / 4))
    big = np.asarray(small.resize((W, H), Image.BILINEAR), np.float32) / 255.0
    return buf + big * amount


def titles_alpha():
    """Кадры титров: список (маска альфа, изображение) на 5 секунд."""
    lines = [
        ("С ДНЁМ РОЖДЕНИЯ!", 130, GOLD, -150),
        ("Любим, обнимаем и желаем самого яркого года", 46, (1, 1, 1), 30),
        ("от всех нас", 40, (0.75, 0.82, 1.0), 120),
    ]
    img = Image.new("RGB", (W, H), (0, 0, 0))
    d = ImageDraw.Draw(img)
    for text, size, color, dy in lines:
        f = ImageFont.truetype(FONT_BOLD if size > 60 else FONT_REG, size)
        bbox = d.textbbox((0, 0), text, font=f)
        x = (W - (bbox[2] - bbox[0])) / 2 - bbox[0]
        y = H / 2 + dy - (bbox[3] - bbox[1]) / 2 - bbox[1]
        d.text((x, y), text, font=f,
               fill=tuple(int(c * 255) for c in color))
    return np.asarray(img, np.float32) / 255.0


def render_video(path, shells):
    stars = star_field()
    titles = titles_alpha()
    ff = os.environ.get("FFMPEG", None)
    if ff is None:
        import imageio_ffmpeg
        ff = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [ff, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-c:v", "libx264", "-preset", "medium", "-crf", "17",
           "-pix_fmt", "yuv420p", "-movflags", "+faststart", path]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for i in range(N_FRAMES):
        t = i / FPS
        buf = np.zeros((H, W, 3), np.float32)
        # небо: чёрное, к финалу чуть подсвечено дымом от залпов
        haze = 0.0
        for s in shells:
            d = t - s.t0
            if 0 <= d < 2.2:
                haze += 0.012 * s.size * math.exp(-d * 1.4)
        haze = min(haze, 0.16)
        buf += np.array([haze * 0.55, haze * 0.42, haze * 0.30], np.float32)
        sf = stars * (1.0 if t < 1.2 else max(0.35, 1.0 - haze * 4))
        buf += sf[:, :, None] * np.array([0.9, 0.93, 1.0], np.float32)

        for s in shells:
            r = s.rocket(t)
            if r:
                rx, ry, rb = r
                n = 14
                jx = rx + rng.normal(0, 3, n)
                jy = ry + np.arange(n) * 9 + rng.normal(0, 2, n)
                splat(buf, jx, jy,
                      np.full(n, rb * 0.8) * np.linspace(1, 0.05, n),
                      WARM)
            p = s.points(t)
            if p:
                px, py, pb = p
                splat(buf, px, py, pb * s.size * 1.6, s.color)

        buf = glow(buf)
        # финальные титры поверх затемнённого неба
        if t >= SHOW_END - 0.6:
            k = min(1.0, (t - (SHOW_END - 0.6)) / 1.2)
            buf *= (1 - k)
            fade_in = np.clip((t - (SHOW_END + 0.1)) / 0.9, 0, 1)
            fade_out = np.clip((TOTAL - 0.6 - t) / 0.6, 0, 1)
            buf += titles * fade_in * fade_out
        frame = np.clip(buf, 0, 1)
        frame = frame ** (1 / 1.25)
        proc.stdin.write((frame * 255).astype(np.uint8).tobytes())
    proc.stdin.close()
    proc.wait()


def render_audio(path, booms):
    """Подложка: удары залпов, треск искр и нарастающий гул толпы."""
    n = int(TOTAL * SR)
    left = np.zeros(n, np.float32)
    right = np.zeros(n, np.float32)
    t = np.arange(n) / SR

    # гул толпы: розовый шум с огибающей, пик на финальном залпе
    noise = rng.normal(0, 1, n).astype(np.float32)
    k = np.exp(-np.arange(1200) / 260.0).astype(np.float32)
    roar = np.convolve(noise, k, "same")
    roar /= np.abs(roar).max()
    env = 0.05 + 0.30 * np.clip((t - 1.0) / 8.0, 0, 1) ** 1.6
    env *= np.clip((SHOW_END + 1.4 - t) / 1.4, 0, 1) ** 0.8
    env += 0.22 * np.exp(-((t - 9.15) ** 2) / (2 * 0.55 ** 2))
    crowd = roar * env * (0.6 + 0.4 * np.sin(2 * math.pi * 0.7 * t))
    left += crowd
    right += np.roll(crowd, 231)

    for t0, gain, size in booms:
        i0 = int(t0 * SR)
        dur = int(SR * (0.9 + 0.6 * size))
        if i0 + dur > n:
            dur = n - i0
        if dur <= 0:
            continue
        tt = np.arange(dur) / SR
        thump = np.sin(2 * math.pi * (58 - 22 * tt) * tt) * np.exp(-tt * 7.5)
        crack = rng.normal(0, 1, dur).astype(np.float32) * np.exp(-tt * 4.2)
        crack *= (0.25 + 0.25 * np.sin(2 * math.pi * 9 * tt))
        seg = (thump * 0.9 + crack * 0.35) * gain * 0.55
        pan = 0.5 + 0.45 * math.sin(t0 * 2.1)
        left[i0:i0 + dur] += seg * (1 - pan) * 2
        right[i0:i0 + dur] += seg * pan * 2

    stereo = np.stack([left, right], 1)
    stereo /= max(1e-6, np.abs(stereo).max()) / 0.89
    data = (stereo * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "birthday_fireworks_1920x1080.mp4"
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    shells, booms = build_show()
    tmp_v, tmp_a = out + ".video.mp4", out + ".audio.wav"
    print("рендер видео…")
    render_video(tmp_v, shells)
    print("рендер звука…")
    render_audio(tmp_a, booms)
    print("сборка…")
    subprocess.run([ff, "-y", "-i", tmp_v, "-i", tmp_a,
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                    "-shortest", out],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.remove(tmp_v)
    os.remove(tmp_a)
    print("готово:", out)


if __name__ == "__main__":
    main()
