# -*- coding: utf-8 -*-
"""
Точка входа для Hugging Face Spaces с SDK "gradio" (бесплатный тариф).

Gradio занимает веб-порт (это требование Space), а сам бот работает
в фоновом потоке. Локально и в Docker по-прежнему запускается bot.py.
"""

import asyncio
import logging
import os
import threading

# Порт займёт gradio — отключаем встроенный health-сервер бота
os.environ.pop("PORT", None)

import gradio as gr

# На бесплатном тарифе HF Gradio-Spaces работают на ZeroGPU, который требует
# наличия хотя бы одной функции @spaces.GPU. Боту GPU не нужен — функция
# фиктивная и никогда не вызывается.
try:
    import spaces

    @spaces.GPU
    def _zerogpu_stub():
        return "ok"
except ImportError:
    pass  # локальный запуск / обычный CPU-хостинг

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("app")

_status = {"text": "запускается..."}


def _run_bot():
    import bot

    async def runner():
        _status["text"] = "работает ✅"
        await bot.main()

    try:
        asyncio.run(runner())
    except Exception as e:  # показываем ошибку в UI, чтобы было видно без логов
        _status["text"] = f"упал ❌: {e}"
        log.exception("Bot crashed")


threading.Thread(target=_run_bot, daemon=True).start()

with gr.Blocks(title="genius-bot") as demo:
    gr.Markdown("# 🧠 Genius Routines Bot")
    out = gr.Textbox(label="Статус бота", value=lambda: _status["text"], every=5)
    gr.Markdown("Бот работает в фоне. Управление — в Telegram: команда /start.")

demo.launch(server_name="0.0.0.0", server_port=int(os.getenv("GRADIO_SERVER_PORT", 7860)))
