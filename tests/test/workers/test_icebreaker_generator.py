# test/workers/test_icebreaker_generator.py
import pytest
from myai.workers.icebreaker_generator import generate_icebreaker

@pytest.mark.asyncio
async def test_generate_icebreaker():
    company_context = "Családi fogászat 20 éve Budapesten. Modern technológia, fájdalommentes kezelés."
    icebreaker = await generate_icebreaker(company_context)
    assert isinstance(icebreaker, str)
    assert len(icebreaker) > 10
