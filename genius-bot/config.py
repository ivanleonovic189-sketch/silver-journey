# -*- coding: utf-8 -*-
import os

from dotenv import load_dotenv

load_dotenv()

# --- обязательные ---
BOT_TOKEN = os.environ["BOT_TOKEN"]          # токен от @BotFather
CHAT_ID = int(os.environ["CHAT_ID"])         # твой telegram id (узнать: @userinfobot)

# --- часовой пояс для расписания ---
TIMEZONE = os.getenv("TIMEZONE", "Europe/Moscow")

# --- MTProto watcher (опционально, для "написать когда проснулся") ---
# Получить на https://my.telegram.org -> API development tools
API_ID = int(os.getenv("API_ID", "0"))
API_HASH = os.getenv("API_HASH", "")
WATCHER_ENABLED = bool(API_ID and API_HASH)

# Час, после которого первая активность считается пробуждением (по TIMEZONE)
WAKE_AFTER_HOUR = int(os.getenv("WAKE_AFTER_HOUR", "4"))
