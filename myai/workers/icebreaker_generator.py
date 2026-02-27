import random

async def generate_icebreaker(context: str) -> str:
    """
    Generates a personalized icebreaker based on company context.
    In production, this should call an LLM (Gemini/GPT-4).
    """
    templates = [
        "Lenyűgözött a {name} weboldalán látható szakmai felkészültség, különösen a {context_snip} rész.",
        "Gratulálok a {name} sikereihez! Észrevettem, hogy nagy hangsúlyt fektetnek a {context_snip} területre.",
        "A {name} portfólióját nézegetve láttam, hogy a {context_snip} nálatok kiemelt prioritás, amihez lenne egy ötletem.",
        "Üdvözlöm! A {name} innovatív megoldásai, különösen a {context_snip} kapcsán keltették fel az érdeklődésemet."
    ]
    
    name = context.split(" - ")[0] if " - " in context else context
    snip = context.split(" - ")[1][:30] if " - " in context else "szolgáltatásaik"
    
    return random.choice(templates).format(name=name, context_snip=snip)

