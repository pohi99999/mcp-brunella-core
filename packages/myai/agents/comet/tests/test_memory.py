"""Unit tesztek: Comet ActionMemory — SQLite műveletei"""
import os
import pytest
from myai.agents.comet.memory import ActionMemory


@pytest.fixture
def temp_memory(tmp_path):
    """Ideiglenes SQLite DB-vel működő ActionMemory instance."""
    db_path = str(tmp_path / "test_memory.db")
    yield ActionMemory(db_path=db_path)


@pytest.mark.asyncio
async def test_empty_hints(temp_memory):
    hints = await temp_memory.get_hints("example.com", "click button")
    assert hints == []


@pytest.mark.asyncio
async def test_record_and_retrieve(temp_memory):
    await temp_memory.record_success("example.com", "click login", "#login-btn")
    hints = await temp_memory.get_hints("example.com", "login")
    assert len(hints) == 1
    assert "#login-btn" in hints[0]
    assert "1x" in hints[0]


@pytest.mark.asyncio
async def test_multiple_successes(temp_memory):
    await temp_memory.record_success("example.com", "click login", "#login-btn")
    await temp_memory.record_success("example.com", "click login", "#login-btn")
    await temp_memory.record_success("example.com", "click login", "#login-btn")
    hints = await temp_memory.get_hints("example.com", "login")
    assert len(hints) == 1
    assert "3x" in hints[0]


@pytest.mark.asyncio
async def test_different_selectors(temp_memory):
    await temp_memory.record_success("example.com", "click login", "#login-btn")
    await temp_memory.record_success("example.com", "click login", ".btn-login")
    hints = await temp_memory.get_hints("example.com", "login")
    assert len(hints) == 2


@pytest.mark.asyncio
async def test_clear_all(temp_memory):
    await temp_memory.record_success("example.com", "click login", "#login-btn")
    # days=-1 biztosítja, hogy a "most" mentett rekordokat is törölje (jövőbeli dátumhoz hasonlít)
    import sqlite3
    with sqlite3.connect(temp_memory.db_path) as conn:
        conn.execute("UPDATE site_actions SET last_used = '2020-01-01T00:00:00'")
        conn.commit()
    await temp_memory.clear_old(days=0)
    hints = await temp_memory.get_hints("example.com", "login")
    assert len(hints) == 0


@pytest.mark.asyncio
async def test_different_domains(temp_memory):
    await temp_memory.record_success("google.com", "search", "#searchbox")
    await temp_memory.record_success("bing.com", "search", "#sb_form_q")
    google_hints = await temp_memory.get_hints("google.com", "search")
    bing_hints = await temp_memory.get_hints("bing.com", "search")
    assert len(google_hints) == 1
    assert len(bing_hints) == 1
    assert "#searchbox" in google_hints[0]
    assert "#sb_form_q" in bing_hints[0]


@pytest.mark.asyncio
async def test_empty_selector_skipped(temp_memory):
    await temp_memory.record_success("example.com", "click login", "")
    hints = await temp_memory.get_hints("example.com", "login")
    assert len(hints) == 0
