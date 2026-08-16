# -*- coding: utf-8 -*-
"""SQLite-хранилище: выполнение рутин, журнал предчувствий, состояние пробуждения."""

import aiosqlite
from datetime import date, datetime

DB_PATH = "data/genius.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_key TEXT NOT NULL,
    day TEXT NOT NULL,
    done_at TEXT NOT NULL,
    UNIQUE(routine_key, day)
);
CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    outcome INTEGER  -- NULL = не проверено, 1 = сбылось, 0 = не сбылось
);
CREATE TABLE IF NOT EXISTS state (
    key TEXT PRIMARY KEY,
    value TEXT
);
"""


async def init():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(SCHEMA)
        await db.commit()


async def mark_done(routine_key: str) -> bool:
    """Отметить рутину выполненной сегодня. False, если уже была отмечена."""
    async with aiosqlite.connect(DB_PATH) as db:
        try:
            await db.execute(
                "INSERT INTO completions (routine_key, day, done_at) VALUES (?, ?, ?)",
                (routine_key, date.today().isoformat(), datetime.now().isoformat()),
            )
            await db.commit()
            return True
        except aiosqlite.IntegrityError:
            return False


async def add_note(text: str) -> int:
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "INSERT INTO notes (text, created_at) VALUES (?, ?)",
            (text, datetime.now().isoformat()),
        )
        await db.commit()
        return cur.lastrowid


async def pending_notes(limit: int = 10):
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "SELECT id, text, created_at FROM notes WHERE outcome IS NULL "
            "ORDER BY id LIMIT ?",
            (limit,),
        )
        return await cur.fetchall()


async def set_outcome(note_id: int, outcome: int) -> bool:
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "UPDATE notes SET outcome = ? WHERE id = ? AND outcome IS NULL",
            (outcome, note_id),
        )
        await db.commit()
        return cur.rowcount > 0


async def stats():
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "SELECT routine_key, COUNT(*) FROM completions GROUP BY routine_key"
        )
        completions = dict(await cur.fetchall())
        cur = await db.execute(
            "SELECT COUNT(*), SUM(outcome IS NOT NULL), SUM(outcome = 1) FROM notes"
        )
        total, checked, hits = await cur.fetchone()
        return completions, (total or 0, checked or 0, hits or 0)


async def get_state(key: str):
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute("SELECT value FROM state WHERE key = ?", (key,))
        row = await cur.fetchone()
        return row[0] if row else None


async def set_state(key: str, value: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO state (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )
        await db.commit()
