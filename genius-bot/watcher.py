# -*- coding: utf-8 -*-
"""
MTProto-наблюдатель (Telethon) на твоём собственном аккаунте.

Обычный бот через Bot API не видит твой онлайн-статус, поэтому здесь
используется юзер-сессия. Telegram не присылает сессии её собственный
статус "online", но присылает другие сигналы активности со всех твоих
устройств:

  • UpdateReadHistoryInbox / UpdateReadChannelInbox — ты прочитал чат
  • исходящее сообщение с телефона

Первый такой сигнал после WAKE_AFTER_HOUR (и после ночного сброса)
считается пробуждением — бот присылает утреннюю рутину.
"""

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from telethon import TelegramClient, events
from telethon.tl import types

import config
import db
from routines import MORNING_TEXT

log = logging.getLogger("watcher")

WAKE_KEY = "last_wake_day"


def _now():
    return datetime.now(ZoneInfo(config.TIMEZONE))


async def _maybe_wake(bot):
    now = _now()
    if now.hour < config.WAKE_AFTER_HOUR:
        return  # ночная активность — не считаем пробуждением
    today = now.date().isoformat()
    if await db.get_state(WAKE_KEY) == today:
        return  # сегодня уже поздоровались
    await db.set_state(WAKE_KEY, today)
    log.info("Wake detected at %s", now.isoformat())
    await bot.send_message(
        config.CHAT_ID,
        f"👀 Заметил активность в {now.strftime('%H:%M')}.\n\n" + MORNING_TEXT,
    )


async def run_watcher(bot):
    """Запускается как фоновая задача рядом с ботом."""
    client = TelegramClient("data/user_session", config.API_ID, config.API_HASH)

    @client.on(events.NewMessage(outgoing=True))
    async def on_outgoing(event):
        await _maybe_wake(bot)

    @client.on(events.Raw(types.UpdateReadHistoryInbox))
    async def on_read(update):
        await _maybe_wake(bot)

    @client.on(events.Raw(types.UpdateReadChannelInbox))
    async def on_read_channel(update):
        await _maybe_wake(bot)

    await client.start()  # при первом запуске спросит телефон и код в консоли
    log.info("MTProto watcher started")
    await client.run_until_disconnected()
