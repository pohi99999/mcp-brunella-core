# myai/workers/icebreaker_generator.py
async def generate_icebreaker(context: str) -> str:
    # Itt az LLM hívás történik majd a valóságban
    return f"Láttam a weboldalukon, hogy {context[:20]}..."
