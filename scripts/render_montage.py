#!/usr/bin/env python3
"""Чистовой рендер ролика: плавные переходы + лёгкое движение внутри кадра.

Отличие от assemble_full.py (быстрый черновик): здесь каждый кадр считается
покадрово — фото медленно наезжает/отъезжает (эффект Кена Бёрнса), а между
кадрами идут разные переходы: растворение, сдвиг, наезд, размытие, шторка.

Запуск:
  python3 scripts/render_montage.py ПАПКА_ИСХОДНИКОВ ПЕСНЯ.mp3 ВЫХОД.mp4 [ХВОСТ.mp4]
ХВОСТ — необязательный ролик (титры/салют), приклеивается в конец.
"""
import csv
import math
import multiprocessing as mp
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib

from assemble_full import FONT_BOLD, FONT_REG, GOLD, expand, intro_cards

# план монтажа берётся из модуля PLAN_MODULE (по умолчанию — старая редакция)
_plan = importlib.import_module(os.environ.get("PLAN_MODULE", "assemble_full"))
CHORUS, PLAN = _plan.CHORUS, _plan.PLAN
VIDEOS = getattr(_plan, "VIDEOS", {})
VIDEO_ROOT = os.environ.get("VIDEO_ROOT", "")

W, H = 1920, 1080
FPS = 30
OVER = 1.14                  # запас по краям под движение кадра
BW, BH = int(W * OVER), int(H * OVER)

# длительность переходов, с
T_FAST, T_NORM, T_SLOW = 0.30, 0.55, 0.85


def natural_key(name):
    import re
    return [int(p) if p.isdigit() else p.lower()
            for p in re.split(r"(\d+)", name)]


def audio_duration(path, ff):
    out = subprocess.run([ff, "-i", path], capture_output=True, text=True)
    for line in out.stderr.splitlines():
        if "Duration:" in line:
            h, m, s = line.split("Duration:")[1].split(",")[0].strip().split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
    raise SystemExit("не читается длина трека")


def build_shots(src, total):
    """Разворачивает план в список кадров с точными временами."""
    shots = []
    for start, end, block, spec in PLAN:
        end = total if end is None else min(end, total)
        if start >= total:
            break
        kind = spec[0]
        if kind == "clip":
            shots.append(dict(start=start, dur=end - start, kind="clip",
                              path=spec[1].replace("{V}", VIDEO_ROOT),
                              seek=spec[2] if len(spec) > 2 else 0.0,
                              block=block, line="", kb=False))
            continue
        if kind == "text":
            shots.append(dict(start=start, dur=end - start, kind="text",
                              path=spec[1], block=block, line="", kb=False))
            continue
        if kind == "intro":
            t = start
            for card, d in zip(intro_cards(os.path.join(src, spec[1])), spec[2]):
                shots.append(dict(start=t, dur=d, kind="card_img", img=card,
                                  block=block, line="", kb=False))
                t += d
            continue
        if kind == "video" and VIDEOS.get(spec[1]):
            items = [("clip", VIDEOS[spec[1]])]
        elif kind == "video":
            items = ([("photo", p) for p in expand(src, [spec[2]])] if spec[2]
                     else [("card", spec[1])])
        else:
            paths = expand(src, spec[1] if kind == "photos" else [spec[1]])
            items = [("photo", p) for p in paths] or [("card", block)]
        per = (end - start) / len(items)
        for i, (typ, val) in enumerate(items):
            shots.append(dict(start=start + i * per, dur=per, kind=typ, path=val,
                              block=block, kb=typ == "photo",
                              line=CHORUS[i] if kind == "chorus" and i < 8 else ""))
    return shots


def transition_plan(shots):
    """Тип и длина перехода на каждом стыке."""
    plan = []
    fancy = ["push_left", "zoom", "blur", "wipe", "push_right", "dissolve"]
    fi = 0
    for i in range(len(shots) - 1):
        a, b = shots[i], shots[i + 1]
        same_block = a["block"] == b["block"]
        short = min(a["dur"], b["dur"])
        if "ПРИПЕВ" in a["block"] and same_block:
            kind, dur = "dissolve", T_FAST
        elif a["block"] == "ФИНАЛ":
            kind, dur = fancy[fi % len(fancy)], T_NORM
            fi += 1
        elif not same_block:
            kind, dur = ("blur" if fi % 2 else "zoom"), T_SLOW
            fi += 1
        else:
            kind, dur = "dissolve", T_NORM
        plan.append((kind, min(dur, short * 0.6)))
    return plan


def base_image(shot):
    """Большая подложка кадра (с запасом под движение)."""
    if shot["kind"] == "card_img":
        im = shot["img"]
    elif shot["kind"] == "text":
        return text_card(shot["path"])
    elif shot["kind"] == "card":
        return placeholder(shot["path"] if "path" in shot else shot["block"])
    else:
        try:
            im = Image.open(shot["path"]).convert("RGB")
        except Exception:
            return placeholder(os.path.basename(str(shot.get("path", ""))))
    bg = im.copy().resize((BW, BH), Image.BILINEAR).filter(ImageFilter.GaussianBlur(45))
    bg = Image.eval(bg, lambda v: int(v * 0.45))
    k = min(BW / im.width, BH / im.height)
    fg = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)
    bg.paste(fg, ((BW - fg.width) // 2, (BH - fg.height) // 2))
    return bg


def placeholder(text):
    img = Image.new("RGB", (BW, BH), (16, 16, 22))
    d = ImageDraw.Draw(img)
    f1 = ImageFont.truetype(FONT_BOLD, 96)
    f2 = ImageFont.truetype(FONT_REG, 46)
    for t, f, dy, col in ((text.upper(), f1, -50, GOLD),
                          ("ждём видеопоздравление", f2, 70, (150, 150, 160))):
        b = d.textbbox((0, 0), t, font=f)
        d.text(((BW - (b[2] - b[0])) / 2 - b[0], BH / 2 + dy - (b[3] - b[1]) / 2 - b[1]),
               t, font=f, fill=col)
    return img


def kb_window(shot, u, idx):
    """Окно кадра для эффекта наезда: (left, top, right, bottom)."""
    if not shot["kb"]:
        z0 = z1 = 1 / OVER
        dx = dy = 0.0
    else:
        d = idx % 4
        zoom_in = d in (0, 2)
        z0, z1 = (1 / OVER, 1 / OVER * 0.93) if zoom_in else (1 / OVER * 0.93, 1 / OVER)
        dx = (0.5 - (d in (1, 3))) * 0.35        # лёгкая проводка по горизонтали
        dy = (0.5 - (d in (2, 3))) * 0.20
    u = min(max(u, -0.15), 1.15)
    z = z0 + (z1 - z0) * u
    cw, ch = BW * z, BH * z
    cx = BW / 2 + dx * (BW - cw) * (u - 0.5)
    cy = BH / 2 + dy * (BH - ch) * (u - 0.5)
    cx = min(max(cx, cw / 2), BW - cw / 2)
    cy = min(max(cy, ch / 2), BH - ch / 2)
    return (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)


def draw_line(img, line):
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT_BOLD, 56)
    b = d.textbbox((0, 0), line, font=f)
    x, y = (W - (b[2] - b[0])) / 2 - b[0], H - 155
    for ox in (-3, 3):
        for oy in (-3, 3):
            d.text((x + ox, y + oy), line, font=f, fill=(0, 0, 0))
    d.text((x, y), line, font=f, fill=GOLD)
    return img


CLIP_FILTER = (
    "split[a][b];"
    "[a]scale=480:270:force_original_aspect_ratio=increase,crop=480:270,"
    "gblur=sigma=12,eq=brightness=-0.10,scale=1920:1080[bg];"
    "[b]scale=1920:1080:force_original_aspect_ratio=decrease[fg];"
    "[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=30,format=rgb24"
)


class ClipSource:
    """Кадры видеопоздравления: ffmpeg отдаёт готовый 1920x1080 поток."""

    FRAME = W * H * 3

    def __init__(self, path, seek, start_t, ff):
        self.path, self.seek, self.start, self.ff = path, seek, start_t, ff
        self.proc = None
        self.cur = None
        self.idx = -1
        self.base = start_t

    def _open(self, at):
        self.close()
        off = self.seek + max(0.0, at - self.start)
        self.base = self.start + max(0.0, at - self.start)
        self.idx = -1
        self.proc = subprocess.Popen(
            [self.ff, "-v", "error", "-ss", f"{off:.3f}", "-i", self.path,
             "-vf", CLIP_FILTER, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            bufsize=self.FRAME)

    def close(self):
        if self.proc:
            try:
                self.proc.stdout.close()
                self.proc.kill()
                self.proc.wait(timeout=5)
            except Exception:
                pass
            self.proc = None

    def _read(self):
        buf = self.proc.stdout.read(self.FRAME)
        if not buf or len(buf) < self.FRAME:
            return None
        return np.frombuffer(buf, np.uint8).reshape(H, W, 3)

    def frame(self, t):
        if self.proc is None:
            self._open(t)
        want = max(0, int(round((t - self.base) * FPS)))
        while self.idx < want:
            f = self._read()
            if f is None:                      # клип кончился — пускаем сначала
                self._open(self.start)
                f = self._read()
                if f is None:
                    return self.cur if self.cur is not None else np.zeros(
                        (H, W, 3), np.uint8)
                want = 0
            self.cur = f
            self.idx += 1
        return self.cur


def text_card(lines):
    """Титры на чёрном: список строк золотом по центру."""
    img = Image.new("RGB", (BW, BH), (0, 0, 0))
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT_BOLD, 72)
    step = 104
    y0 = BH / 2 - step * (len(lines) - 1) / 2
    for i, t in enumerate(lines):
        if not t:
            continue
        b = d.textbbox((0, 0), t, font=f)
        d.text(((BW - (b[2] - b[0])) / 2 - b[0], y0 + i * step - (b[3] - b[1]) / 2 - b[1]),
               t, font=f, fill=GOLD)
    return img


class Frames:
    """Отрисовка кадра шота на любой момент времени, с кэшем подложек."""

    def __init__(self, shots, ff=None):
        self.shots = shots
        self.cache = {}
        self.clips = {}
        self.ff = ff

    def base(self, i):
        if i not in self.cache:
            if len(self.cache) > 3:
                self.cache.pop(next(iter(self.cache)))
            self.cache[i] = base_image(self.shots[i])
        return self.cache[i]

    def at(self, i, t):
        s = self.shots[i]
        if s["kind"] == "clip":
            src = self.clips.get(i)
            if src is None:
                if len(self.clips) > 2:
                    k, old = next(iter(self.clips.items()))
                    old.close()
                    del self.clips[k]
                src = self.clips[i] = ClipSource(s["path"], s["seek"],
                                                 s["start"], self.ff)
            return src.frame(t).astype(np.float32)
        u = (t - s["start"]) / max(s["dur"], 1e-6)
        box = kb_window(s, u, i)
        img = self.base(i).resize((W, H), Image.BILINEAR, box=box)
        if s["line"]:
            draw_line(img, s["line"])
        return np.asarray(img, np.float32)


def blend(a, b, p, kind):
    """Переход: a — уходящий кадр, b — приходящий, p от 0 до 1."""
    p = min(max(p, 0.0), 1.0)
    e = p * p * (3 - 2 * p)                       # плавный старт/стоп
    if kind == "dissolve":
        return a + (b - a) * e
    if kind in ("push_left", "push_right"):
        off = int(W * e)
        out = np.empty_like(a)
        if kind == "push_left":
            out[:, :W - off] = a[:, off:]
            out[:, W - off:] = b[:, :off] if off else b[:, :0]
        else:
            out[:, off:] = a[:, :W - off]
            out[:, :off] = b[:, W - off:] if off else b[:, :0]
        return out
    if kind == "zoom":                            # наезд на приходящий кадр
        k = 1.0 + 0.18 * (1 - e)
        cw, ch = int(W / k), int(H / k)
        x, y = (W - cw) // 2, (H - ch) // 2
        z = np.asarray(Image.fromarray(b.astype(np.uint8)).resize(
            (W, H), Image.BILINEAR, box=(x, y, x + cw, y + ch)), np.float32)
        return a + (z - a) * e
    if kind == "blur":                            # растворение через размытие
        r = 1 + 10 * math.sin(math.pi * e)
        ia = Image.fromarray(a.astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))
        ib = Image.fromarray(b.astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))
        return (np.asarray(ia, np.float32) * (1 - e) + np.asarray(ib, np.float32) * e)
    if kind == "wipe":                            # мягкая шторка слева направо
        soft = W * 0.18
        x = np.arange(W, dtype=np.float32)
        m = np.clip((e * (W + soft) - x) / soft, 0, 1)[None, :, None]
        return a * (1 - m) + b * m
    return a + (b - a) * e


def render_chunk(job):
    src_shots, trans, f0, f1, path, ff = job
    fr = Frames(src_shots, ff)
    ends = [s["start"] + s["dur"] for s in src_shots]
    proc = subprocess.Popen(
        [ff, "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-c:v", "libx264", "-preset", "medium", "-crf", "19",
         "-pix_fmt", "yuv420p", path],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    i = 0
    for n in range(f0, f1):
        t = n / FPS
        while i < len(src_shots) - 1 and t >= ends[i]:
            i += 1
        kind, dur = trans[i] if i < len(trans) else (None, 0)
        half = dur / 2
        if i < len(trans) and t >= ends[i] - half:
            p = (t - (ends[i] - half)) / max(dur, 1e-6)
            frame = blend(fr.at(i, t), fr.at(i + 1, t), p, kind)
        elif i > 0 and t < src_shots[i]["start"] + trans[i - 1][1] / 2:
            k, d = trans[i - 1]
            p = (t - (src_shots[i]["start"] - d / 2)) / max(d, 1e-6)
            frame = blend(fr.at(i - 1, t), fr.at(i, t), p, k)
        else:
            frame = fr.at(i, t)
        proc.stdin.write(np.clip(frame, 0, 255).astype(np.uint8).tobytes())
    proc.stdin.close()
    proc.wait()
    return path


def main():
    src, song, out = sys.argv[1], sys.argv[2], sys.argv[3]
    tail = sys.argv[4] if len(sys.argv) > 4 else None
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    total = audio_duration(song, ff)
    shots = build_shots(src, total)
    trans = transition_plan(shots)
    n_frames = int(total * FPS)

    work = os.path.abspath(out) + ".parts"
    os.makedirs(work, exist_ok=True)
    workers = max(1, min(4, os.cpu_count() or 2))
    step = math.ceil(n_frames / workers)
    jobs = []
    for w in range(workers):
        f0, f1 = w * step, min((w + 1) * step, n_frames)
        if f0 < f1:
            jobs.append((shots, trans, f0, f1, os.path.join(work, f"p{w}.mp4"), ff))
    print(f"кадров: {len(shots)}, длина {total:.1f} с, потоков {len(jobs)}")
    with mp.Pool(len(jobs)) as pool:
        parts = pool.map(render_chunk, jobs)

    concat = os.path.join(work, "parts.txt")
    with open(concat, "w") as f:
        for p in parts:
            f.write(f"file '{p}'\n")
    silent = os.path.join(work, "video.mp4")
    subprocess.run([ff, "-y", "-v", "error", "-f", "concat", "-safe", "0",
                    "-i", concat, "-c", "copy", silent], check=True)
    body = os.path.join(work, "body.mp4")
    subprocess.run([ff, "-y", "-v", "error", "-i", silent, "-i", song,
                    "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-c:a", "aac", "-b:a", "192k", "-shortest",
                    "-movflags", "+faststart", body], check=True)
    if tail:
        subprocess.run(
            [ff, "-y", "-v", "error", "-i", body, "-i", tail,
             "-filter_complex",
             "[0:v]fps=30,scale=1920:1080,setsar=1[v0];"
             "[1:v]fps=30,scale=1920:1080,setsar=1[v1];"
             "[0:a]aformat=sample_rates=48000:channel_layouts=stereo[a0];"
             "[1:a]aformat=sample_rates=48000:channel_layouts=stereo[a1];"
             "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]",
             "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium",
             "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
             "-movflags", "+faststart", out], check=True)
    else:
        os.replace(body, out)

    csv_path = os.path.splitext(out)[0] + "_монтажный_лист.csv"
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["таймкод", "длит., с", "блок", "строка", "источник", "переход"])
        for i, s in enumerate(shots):
            t = s["start"]
            w.writerow([f"{int(t // 60):02d}:{t % 60:06.3f}", f"{s['dur']:.2f}",
                        s["block"], s["line"],
                        os.path.basename(str(s.get("path", "плашка"))),
                        trans[i][0] if i < len(trans) else ""])
    print("готово:", out, "|", csv_path)


if __name__ == "__main__":
    main()
