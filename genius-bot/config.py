# -*- coding: utf-8 -*-
import os

from dotenv import load_dotenv

load_dotenv()

# --- обязательное ---
BOT_TOKEN = os.environ["BOT_TOKEN"]          # токен от @BotFather

# --- опционально ---
# Твой telegram id (узнать: @userinfobot). Если не задан, владельцем
# становится первый, кто напишет боту /start.
CHAT_ID = int(os.getenv("CHAT_ID", "0")) or None

# Часовой пояс для расписания
TIMEZONE = os.getenv("TIMEZONE", "Europe/Moscow")

# Время утреннего сообщения с планом на день (часы:минуты)
MORNING_HOUR = int(os.getenv("MORNING_HOUR", "8"))
MORNING_MINUTE = int(os.getenv("MORNING_MINUTE", "30"))
