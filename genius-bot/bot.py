# -*- coding: utf-8 -*-
"""
Genius Routines Bot — напоминания о рутинах развития мышления и интуиции.

Владелец: задаётся через CHAT_ID в .env, либо автоматически — первый,
кто напишет боту /start.

Запуск: python bot.py
"""

import asyncio
import logging
import os

from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.filters import Command, CommandObject
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)
from apscheduler.schedulers.asyncio import AsyncIOScheduler

import config
import db
from routines import MORNING_TEXT, ROUTINES

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("bot")

bot = Bot(config.BOT_TOKEN, default=DefaultBotProperties(parse_mode="HTML"))
dp = Dispatcher()

OWNER_KEY = "owner_chat_id"
_owner_id: int | None = config.CHAT_ID


async def get_owner() -> int | None:
    global _owner_id
    if _owner_id is None:
        stored = await db.get_state(OWNER_KEY)
        _owner_id = int(stored) if stored else None
    return _owner_id


async def claim_owner(chat_id: int) -> bool:
    """Первый написавший /start становится владельцем."""
    global _owner_id
    owner = await get_owner()
    if owner is None:
        _owner_id = chat_id
        await db.set_state(OWNER_KEY, str(chat_id))
        log.info("Owner registered: %s", chat_id)
        return True
    return owner == chat_id


def done_kb(routine_key: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="✅ Сделал", callback_data=f"done:{routine_key}")
    ]])


async def send_routine(routine_key: str):
    owner = await get_owner()
    if owner is None:
        log.warning("No owner yet — skip reminder %s (send /start to the bot)", routine_key)
        return
    r = ROUTINES[routine_key]
    await bot.send_message(owner, r["text"], reply_markup=done_kb(routine_key))


async def send_morning():
    owner = await get_owner()
    if owner is None:
        return
    await bot.send_message(owner, MORNING_TEXT)


async def is_owner(obj) -> bool:
    owner = await get_owner()
    return obj.from_user is not None and obj.from_user.id == owner


# ---------- команды ----------

@dp.message(Command("start"))
async def cmd_start(msg: Message):
    if not await claim_owner(msg.from_user.id):
        return await msg.answer("Это личный бот. Извини 🙂")
    lines = "\n".join(f"• <b>{r['title']}</b>" for r in ROUTINES.values())
    await msg.answer(
        "🧠 <b>Genius Routines Bot</b>\n\n"
        "Ты зарегистрирован как владелец. Буду напоминать тебе о рутинах:\n"
        + lines + "\n\n"
        "Команды:\n"
        "/routines — прислать список рутин\n"
        "/note &lt;текст&gt; — записать предчувствие / мысль / вопрос на ночь\n"
        "/check — отметить, какие предчувствия сбылись\n"
        "/stats — статистика выполнения и точность интуиции\n"
        "/morning — прислать утренний план вручную"
    )


@dp.message(Command("routines"))
async def cmd_routines(msg: Message):
    if not await is_owner(msg):
        return
    for key in ROUTINES:
        await send_routine(key)


@dp.message(Command("morning"))
async def cmd_morning(msg: Message):
    if not await is_owner(msg):
        return
    await msg.answer(MORNING_TEXT)


@dp.message(Command("note"))
async def cmd_note(msg: Message, command: CommandObject):
    if not await is_owner(msg):
        return
    if not command.args:
        return await msg.answer("Напиши так: <code>/note кажется, сейчас позвонит Саша</code>")
    note_id = await db.add_note(command.args.strip())
    await msg.answer(f"📝 Запись #{note_id} сохранена. Отметить исход: /check")


@dp.message(Command("check"))
async def cmd_check(msg: Message):
    if not await is_owner(msg):
        return
    notes = await db.pending_notes()
    if not notes:
        return await msg.answer("Непроверенных записей нет. Добавь новую: /note")
    for note_id, text, created_at in notes:
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="✅ Сбылось", callback_data=f"outcome:{note_id}:1"),
            InlineKeyboardButton(text="❌ Нет", callback_data=f"outcome:{note_id}:0"),
        ]])
        await msg.answer(
            f"#{note_id} ({created_at[:10]})\n<i>{text}</i>", reply_markup=kb
        )


@dp.message(Command("stats"))
async def cmd_stats(msg: Message):
    if not await is_owner(msg):
        return
    completions, (total, checked, hits) = await db.stats()
    lines = ["📈 <b>Статистика</b>\n", "<b>Рутины (дней выполнено):</b>"]
    for key, r in ROUTINES.items():
        lines.append(f"• {r['title']}: {completions.get(key, 0)}")
    lines.append("\n<b>Интуиция (этап 1):</b>")
    lines.append(f"• Записей: {total}")
    lines.append(f"• Проверено: {checked}")
    if checked:
        acc = round(100 * hits / checked)
        lines.append(f"• Сбылось: {hits} → точность интуиции <b>{acc}%</b>")
    await msg.answer("\n".join(lines))


# ---------- кнопки ----------

@dp.callback_query(F.data.startswith("done:"))
async def cb_done(cb: CallbackQuery):
    if not await is_owner(cb):
        return await cb.answer()
    key = cb.data.split(":", 1)[1]
    fresh = await db.mark_done(key)
    await cb.answer("Записал! 🔥" if fresh else "Сегодня уже отмечено 😉")
    if fresh and cb.message:
        await cb.message.edit_reply_markup(reply_markup=None)
        await cb.message.reply("✅ Отлично, рутина выполнена!")


@dp.callback_query(F.data.startswith("outcome:"))
async def cb_outcome(cb: CallbackQuery):
    if not await is_owner(cb):
        return await cb.answer()
    _, note_id, outcome = cb.data.split(":")
    updated = await db.set_outcome(int(note_id), int(outcome))
    await cb.answer("Записал!" if updated else "Уже отмечено")
    if updated and cb.message:
        mark = "✅ сбылось" if outcome == "1" else "❌ не сбылось"
        await cb.message.edit_text(cb.message.html_text + f"\n\n{mark}")


# ---------- расписание ----------

def setup_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone=config.TIMEZONE)
    for key, r in ROUTINES.items():
        scheduler.add_job(send_routine, "cron", args=[key], id=key, **r["cron"])
    scheduler.add_job(
        send_morning, "cron", id="morning",
        hour=config.MORNING_HOUR, minute=config.MORNING_MINUTE,
    )
    return scheduler


async def main():
    os.makedirs("data", exist_ok=True)
    await db.init()

    scheduler = setup_scheduler()
    scheduler.start()

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
