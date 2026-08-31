#!/usr/bin/env python3
"""Полная сборка поздравительного ролика «Какой полтинник?!» по монтажному плану.

Таймлайн взят из сценария (docx): блоки с точными таймкодами, внутри блока
кадры делятся поровну. Где видеопоздравления ещё не присланы — ставится
карточка-заглушка с именем, её достаточно заменить в словаре VIDEOS.

Запуск:
  python3 scripts/assemble_full.py ПАПКА_ИСХОДНИКОВ ПЕСНЯ.mp3 ВЫХОД.mp4
ПАПКА_ИСХОДНИКОВ — «план ролика» с подпапками фото.
"""
import csv
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1920, 1080
FPS = 30
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
GOLD = (255, 199, 82)

# Видеопоздравления: блок -> путь к файлу. Пусто = будет заглушка.
VIDEOS = {
    # "Люда": "/path/люда.mp4",
    # "Папа Сергея": ..., "Мама Сергея": ..., "Папа Люды": ..., "Мама Люды": ...,
    # "Женечка": ..., "Андрей": ..., "Миша": ..., "Кирилл": ..., "Ольга": ...,
    # "Руслан": ..., "Эвелина": ..., "Арсений": ..., "Ксю": ..., "Ирочка Василега": ...,
}

# (начало, конец, блок, источник)
# источник: ("photos", папка/файл...) | ("video", имя блока) | ("chorus", папка)
PLAN = [
    # вступление: лист «Начало только файлы для заставки.png» режется на 4 плашки;
    # уложены в 16 с, дальше идёт основной видеоряд
    (0.0,   16.0, "Интро",            ("intro", "Начало только файлы для заставки.png",
                                       [3.5, 3.5, 5.5, 3.5])),
    (16.0,  38.0, "Люда",             ("video", "Люда", "ФОТО  БЛОК лЮДА 2")),
    (38.0,  57.0, "ПРИПЕВ 1",         ("chorus", "1 припев фото")),
    (57.0,  59.5, "Папа Сергея",      ("video", "Папа Сергея", None)),
    (59.5,  62.0, "Мама Сергея",      ("video", "Мама Сергея", None)),
    (62.0,  64.0, "Папа Сергея",      ("video", "Папа Сергея", None)),
    (64.0,  67.0, "Мама Сергея",      ("video", "Мама Сергея", None)),
    (67.0,  69.0, "Папа Люды",        ("video", "Папа Люды", None)),
    (69.0,  71.0, "Мама Люды",        ("video", "Мама Люды", None)),
    (71.0,  74.0, "Папа Люды",        ("video", "Папа Люды", None)),
    (74.0,  75.5, "Мама Люды",        ("video", "Мама Люды", None)),
    (75.5,  79.0, "Серёжечка",        ("photos", ["СЕРЕЖЕЧКА.jpg"])),
    (79.0,  80.0, "Женечка",          ("video", "Женечка", None)),
    (80.0,  85.0, "Были друзьями",    ("photos", ["БЫЛИ ДРУЗЬЯМИ"])),
    (85.0,  94.0, "Хочется побывать", ("photos", ["ХОЧЕТСЯ ПОБЫВАТЬ"])),
    (94.0,  98.0, "Море и горы",      ("photos", ["Море Горы"])),
    (98.0, 105.0, "Андрей",           ("video", "Андрей", "друзьями простыми.JPG")),
    (105.0, 123.0, "ПРИПЕВ 2",        ("chorus", "2 припев фото")),
    (123.0, 127.0, "Миша",            ("video", "Миша", None)),
    (127.0, 139.0, "Миша / фото",     ("photos", ["МИША/зеленое с кислым.jpg",
                                                  "МИША/зеленое с кислым 2.jpg"])),
    (139.0, 142.0, "Миша / фото",     ("photos", ["МИША/логика гуляла.jpg"])),
    (142.0, 143.5, "Миша / фото",     ("photos", ["МИША/ТОЧКА.jpg"])),
    (143.5, 145.0, "Миша / фото",     ("photos", ["МИША/ВЗЯТО.jpg"])),
    (145.0, 146.0, "Миша / фото",     ("photos", ["МИША/ПОБЕДА.jpg"])),
    (146.0, 155.0, "Миша",            ("video", "Миша", None)),
    (155.0, 162.0, "Кирилл",          ("video", "Кирилл", None)),
    (162.0, 169.0, "Кирилл / фото",   ("photos", ["КИРИЛЛ/вернемся.jpg"])),
    (169.0, 172.0, "Кирилл / фото",   ("photos", ["КИРИЛЛ/ГОРЫ УЧИЛИ 2.jpg",
                                                  "КИРИЛЛ/БУДЕМ РЯДОМ.jpg"])),
    (172.0, 175.0, "Кирилл / фото",   ("photos", ["ВОЗЬМЕМ ВЕРШИНУ.jpg"])),
    (175.0, 180.0, "Ольга",           ("photos", ["ВЕРХОВНЫЙ.jpg"])),
    (180.0, 186.0, "Ольга",           ("video", "Ольга", None)),
    (186.0, 191.0, "Руслан",          ("video", "Руслан", None)),
    (191.0, 197.0, "Руслан / фото",   ("photos", ["ВСТРЕЧА С РУСЛАНОМ.jpg"])),
    (197.0, 200.0, "Руслан",          ("video", "Руслан", None)),
    (200.0, 204.0, "Эвелина",         ("video", "Эвелина", None)),
    (204.0, 208.0, "Эвелина / фото",  ("photos", ["эВЕЛИНА/НАША ДАТА.jpg"])),
    (208.0, 213.0, "Эвелина / фото",  ("photos", ["эВЕЛИНА/РАЗДЕЛИЛИ.jpg"])),
    (213.0, 218.0, "Эвелина",         ("video", "Эвелина", None)),
    (218.0, 224.0, "Эвелина / фото",  ("photos", ["эВЕЛИНА/РОДНОЙ.jpg"])),
    (224.0, 256.0, "ПРИПЕВ 3",        ("chorus", "3 припев")),
    (256.0, 269.0, "Арсений",         ("photos", ["ФОТО АРСЕНИЙ"])),
    (269.0, 271.0, "Ксю",             ("video", "Ксю", None)),
    (271.0, 280.0, "Ксю / фото",      ("photos", ["ФОТО КСЮ"])),
    (280.0, 290.0, "Ирочка Василега", ("video", "Ирочка Василега", None)),
    (290.0, 317.0, "Ирочка / фото",   ("photos", ["иРОЧКА вАСИЛЕГА ФОТО"])),
    (317.0, 338.0, "ПРИПЕВ 4",        ("chorus", "4 ПРИПЕВ")),
    (338.0, None, "ФИНАЛ",            ("photos", ["ФОТО ФИНАЛ"])),
]

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
    import re
    return [int(p) if p.isdigit() else p.lower()
            for p in re.split(r"(\d+)", name)]


def expand(src, items):
    """Разворачивает список файлов/папок в список путей к кадрам."""
    out = []
    for it in items:
        p = os.path.join(src, it)
        if os.path.isdir(p):
            out += [os.path.join(p, n) for n in
                    sorted((n for n in os.listdir(p) if n.endswith(IMG_EXT)),
                           key=natural_key)]
        elif os.path.isfile(p):
            out.append(p)
        else:
            print("нет исходника:", it)
    return out


def frame_from_photo(path, dst):
    im = Image.open(path).convert("RGB")
    bg = im.copy().resize((W, H), Image.BILINEAR).filter(ImageFilter.GaussianBlur(40))
    bg = Image.eval(bg, lambda v: int(v * 0.5))
    k = min(W / im.width, H / im.height)
    im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)
    bg.paste(im, ((W - im.width) // 2, (H - im.height) // 2))
    bg.save(dst, quality=93)


def frame_cover(im, dst):
    """Кадр под срез: заполняет 1920x1080 целиком, лишнее обрезается."""
    k = max(W / im.width, H / im.height)
    im = im.resize((int(im.width * k), int(im.height * k)), Image.LANCZOS)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    im.crop((x, y, x + W, y + H)).save(dst, quality=95)


def intro_cards(path):
    """Делит лист вступления на 4 плашки (сетка 2x2, порядок чтения)."""
    im = Image.open(path).convert("RGB")
    w, h = im.size
    mx, my = w // 2, int(h * 0.512)          # шов между плашками
    gap = int(h * 0.018)
    return [im.crop(b) for b in (
        (0, 0, mx, my - gap), (mx, 0, w, my - gap),
        (0, my + gap, mx, h), (mx, my + gap, w, h))]


def frame_placeholder(text, sub, dst):
    img = Image.new("RGB", (W, H), (18, 18, 24))
    d = ImageDraw.Draw(img)
    f1 = ImageFont.truetype(FONT_BOLD, 92)
    f2 = ImageFont.truetype(FONT_REG, 44)
    for t, f, dy, col in ((text, f1, -40, GOLD), (sub, f2, 70, (170, 170, 180))):
        b = d.textbbox((0, 0), t, font=f)
        d.text(((W - (b[2] - b[0])) / 2 - b[0], H / 2 + dy - (b[3] - b[1]) / 2 - b[1]),
               t, font=f, fill=col)
    img.save(dst, quality=93)


def caption(dst, line):
    """Подписывает кадр строкой припева внизу."""
    img = Image.open(dst)
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT_BOLD, 54)
    b = d.textbbox((0, 0), line, font=f)
    x, y = (W - (b[2] - b[0])) / 2 - b[0], H - 150
    for ox, oy in ((-3, 0), (3, 0), (0, -3), (0, 3)):
        d.text((x + ox, y + oy), line, font=f, fill=(0, 0, 0))
    d.text((x, y), line, font=f, fill=GOLD)
    img.save(dst, quality=93)


def audio_duration(path, ff):
    out = subprocess.run([ff, "-i", path], capture_output=True, text=True)
    for line in out.stderr.splitlines():
        if "Duration:" in line:
            h, m, s = line.split("Duration:")[1].split(",")[0].strip().split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
    raise SystemExit("не читается длина трека")


def main():
    src = sys.argv[1]
    song = sys.argv[2]
    out = sys.argv[3] if len(sys.argv) > 3 else "final.mp4"
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    total = audio_duration(song, ff)

    work = os.path.abspath(out) + ".frames"
    os.makedirs(work, exist_ok=True)
    entries, rows, idx = [], [], 0

    for start, end, block, spec in PLAN:
        end = total if end is None else min(end, total)
        if start >= total:
            break
        span = end - start
        kind = spec[0]
        if kind == "intro":
            cards = intro_cards(os.path.join(src, spec[1]))
            durs = spec[2]
            t = start
            for card, d in zip(cards, durs):
                dst = os.path.join(work, f"{idx:04d}.jpg")
                frame_cover(card, dst)
                entries.append((dst, d, None))
                rows.append([f"{int(t // 60):02d}:{t % 60:06.3f}", f"{d:.2f}",
                             block, "", "плашка вступления"])
                t += d
                idx += 1
            continue
        if kind == "video" and VIDEOS.get(spec[1]):
            shots = [("video", VIDEOS[spec[1]])]
        elif kind == "video":
            fallback = spec[2]
            shots = ([("photo", p) for p in expand(src, [fallback])]
                     if fallback else [("card", spec[1])])
        else:
            paths = expand(src, spec[1] if kind == "photos" else [spec[1]])
            shots = [("photo", p) for p in paths] or [("card", block)]
        per = span / len(shots)
        t = start
        for i, (typ, val) in enumerate(shots):
            dst = os.path.join(work, f"{idx:04d}.jpg")
            line = CHORUS[i] if kind == "chorus" and i < len(CHORUS) else ""
            if typ == "photo":
                try:
                    frame_from_photo(val, dst)
                except Exception:
                    frame_placeholder("НЕТ ФАЙЛА", os.path.basename(val), dst)
            elif typ == "card":
                frame_placeholder(val.upper(), "ждём видеопоздравление", dst)
            else:                                  # видео вставим отдельным шагом
                frame_placeholder(val.upper(), "видео", dst)
            if line:
                caption(dst, line)
            entries.append((dst, per, val if typ == "video" else None))
            rows.append([f"{int(t // 60):02d}:{t % 60:06.3f}", f"{per:.2f}",
                         block, line, os.path.basename(str(val))])
            t += per
            idx += 1

    listfile = os.path.join(work, "list.txt")
    with open(listfile, "w") as f:
        for dst, dur, _ in entries:
            f.write(f"file '{dst}'\nduration {dur:.3f}\n")
        f.write(f"file '{entries[-1][0]}'\n")

    csv_path = os.path.splitext(out)[0] + "_монтажный_лист.csv"
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["таймкод", "длит., с", "блок", "строка", "источник"])
        w.writerows(rows)

    subprocess.run(
        [ff, "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listfile,
         "-i", song, "-map", "0:v", "-map", "1:a",
         "-vf", f"fps={FPS},format=yuv420p",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
         "-c:a", "aac", "-b:a", "192k", "-shortest",
         "-movflags", "+faststart", out], check=True)
    print("готово:", out, "|", csv_path, f"| длина {total:.1f} с")


if __name__ == "__main__":
    main()
