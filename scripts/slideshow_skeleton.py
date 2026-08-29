#!/usr/bin/env python3
"""Скелет поздравительного ролика под музыку: фото режутся по тактам трека.

Кадры расставляются по блокам сценария, длительность каждого кратна такту,
общая длина подгоняется под длину песни. На выходе — черновое видео
1920x1080 и монтажный лист с таймкодами.

Запуск:
  python3 scripts/slideshow_skeleton.py ИСХОДНИКИ ВЫХОД.mp4
где ИСХОДНИКИ — папка «план ролика» (рядом должен лежать mp3).
"""
import csv
import os
import subprocess
import sys

from PIL import Image, ImageFilter

W, H = 1920, 1080
FPS = 30
BPM = 105.47
BAR = 4 * 60.0 / BPM          # длительность такта, ~2.276 с

# Порядок блоков сценария. weight — сколько тактов на кадр (базово).
# ('файл'|'папка', подпись, вес)
BLOCKS = [
    ("Начало.png",                    "Заставка",                 3),
    ("Начало только файлы для заставки.png", "Заставка 2",         2),
    ("СЕРЕЖЕЧКА.jpg",                 "Виновник торжества",       2),
    ("друзьями простыми.JPG",         "Друзьями простыми",        1),
    ("БЫЛИ ДРУЗЬЯМИ",                 "Были друзьями",            1),
    ("Море Горы",                     "Море и горы",              1),
    ("ХОЧЕТСЯ ПОБЫВАТЬ",              "Хочется побывать",         1),
    ("ВОЗЬМЕМ ВЕРШИНУ.jpg",           "Возьмём вершину",          1),
    ("ВЕРХОВНЫЙ.jpg",                 "Верховный",                1),
    ("1 припев фото",                 "ПРИПЕВ 1",                 1),
    ("КИРИЛЛ",                        "Кирилл",                   1),
    ("МИША",                          "Миша",                     1),
    ("ВСТРЕЧА С РУСЛАНОМ.jpg",        "Встреча с Русланом",       1),
    ("иРОЧКА вАСИЛЕГА ФОТО",          "Ирочка Василега",          1),
    ("2 припев фото",                 "ПРИПЕВ 2",                 1),
    ("ФОТО  БЛОК лЮДА 2",             "Люда",                     1),
    ("ФОТО АРСЕНИЙ",                  "Арсений",                  1),
    ("ФОТО КСЮ",                      "Ксю",                      1),
    ("эВЕЛИНА",                       "Эвелина",                  1),
    ("3 припев",                      "ПРИПЕВ 3",                 1),
    ("ФОТО ФИНАЛ",                    "Финальный блок",           1),
    ("4 ПРИПЕВ",                      "ПРИПЕВ 4 / финал",         1),
]

# строки припева — подписи к 8 кадрам каждого припева
CHORUS = [
    "Тебе говорят: полтинник",
    "Да бросьте, какой полтинник",
    "Ты только вошёл во вкус",
    "Ты только понял расклад",
    "Да где-то бывал виновник",
    "Да где-то почти разбойник",
    "Но если судьба противник",
    "Ты точно не проиграл",
]

IMG_EXT = (".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG")


def natural_key(name):
    """Сортировка «1, 2, 10», а не «1, 10, 2»."""
    import re
    return [int(p) if p.isdigit() else p.lower()
            for p in re.split(r"(\d+)", name)]


def collect(src):
    """Список кадров: (путь, блок, подпись строки)."""
    shots = []
    for entry, label, weight in BLOCKS:
        path = os.path.join(src, entry)
        if os.path.isdir(path):
            names = sorted((n for n in os.listdir(path) if n.endswith(IMG_EXT)),
                           key=natural_key)
            for i, n in enumerate(names):
                line = CHORUS[i] if ("ПРИПЕВ" in label.upper() and
                                     i < len(CHORUS)) else ""
                shots.append([os.path.join(path, n), label, line, weight])
        elif os.path.isfile(path):
            shots.append([path, label, "", weight])
        else:
            print("нет исходника:", entry)
    return shots


def fit_frame(src_path, dst_path):
    """Кадр в 1920x1080: вписан целиком, фон — размытая копия."""
    im = Image.open(src_path).convert("RGB")
    bg = im.copy().resize((W, H), Image.BILINEAR).filter(
        ImageFilter.GaussianBlur(40))
    bg = Image.eval(bg, lambda v: int(v * 0.55))
    k = min(W / im.width, H / im.height)
    im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))),
                   Image.LANCZOS)
    bg.paste(im, ((W - im.width) // 2, (H - im.height) // 2))
    bg.save(dst_path, quality=93)


def audio_duration(path, ff):
    out = subprocess.run([ff, "-i", path], capture_output=True, text=True)
    for line in out.stderr.splitlines():
        if "Duration:" in line:
            hms = line.split("Duration:")[1].split(",")[0].strip()
            h, m, s = hms.split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
    raise SystemExit("не удалось прочитать длину трека")


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "план ролика"
    out = sys.argv[2] if len(sys.argv) > 2 else "skeleton.mp4"
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()

    audio = None
    for root in (os.path.dirname(src.rstrip("/")) or ".", src):
        for n in sorted(os.listdir(root)):
            if n.lower().endswith((".mp3", ".m4a", ".wav")):
                audio = os.path.join(root, n)
                break
        if audio:
            break
    if not audio:
        raise SystemExit("рядом с папкой не найден аудиофайл")
    dur = audio_duration(audio, ff)
    bars_total = int(dur // BAR)

    shots = collect(src)
    if not shots:
        raise SystemExit("не найдено ни одного кадра")
    # раздаём такты: сначала по весу, остаток — на заставку и финал
    bars = [s[3] for s in shots]
    while sum(bars) > bars_total:
        i = max(range(len(bars)), key=lambda j: bars[j])
        if bars[i] == 1:
            break
        bars[i] -= 1
    extra = bars_total - sum(bars)
    order = [0, len(bars) - 1] + list(range(1, len(bars) - 1))
    i = 0
    while extra > 0:
        bars[order[i % len(order)]] += 1
        extra -= 1
        i += 1

    work = os.path.abspath(out) + ".frames"
    os.makedirs(work, exist_ok=True)
    lines, rows, t = [], [], 0.0
    for i, (path, block, line, _) in enumerate(shots):
        dst = os.path.join(work, f"{i:04d}.jpg")
        try:
            fit_frame(path, dst)
        except Exception:            # битый/недокачанный исходник — заглушка
            Image.new("RGB", (W, H), (32, 32, 40)).save(dst, quality=90)
            print("кадр не читается, поставлена заглушка:", path)
        d = bars[i] * BAR
        lines.append(f"file '{dst}'\nduration {d:.3f}\n")
        rows.append([f"{int(t // 60):02d}:{t % 60:06.3f}", f"{d:.3f}",
                     bars[i], block, line, os.path.basename(path)])
        t += d
    lines.append(f"file '{dst}'\n")          # последний кадр держим до конца
    listfile = os.path.join(work, "list.txt")
    with open(listfile, "w") as f:
        f.write("".join(lines))

    csv_path = os.path.splitext(out)[0] + "_монтажный_лист.csv"
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["таймкод", "длит., с", "тактов", "блок", "строка", "файл"])
        w.writerows(rows)

    print(f"кадров: {len(shots)}, тактов: {sum(bars)}, "
          f"видеоряд: {t:.1f} с, трек: {dur:.1f} с")
    subprocess.run(
        [ff, "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listfile,
         "-i", audio, "-vf", f"fps={FPS},format=yuv420p",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
         "-c:a", "aac", "-b:a", "192k", "-shortest",
         "-movflags", "+faststart", out], check=True)
    print("готово:", out, "и", csv_path)


if __name__ == "__main__":
    main()
