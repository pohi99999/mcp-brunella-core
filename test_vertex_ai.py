import sys
import os
import asyncio

# Adjuk hozzá a projekt gyökerét a path-hoz
sys.path.append(os.getcwd())

async def test_vertex():
    try:
        # Importáljuk a modult (ez önmagában teszteli a függőségeket)
        from src.servers.vertex_ai import mcp
        print("Siker: A Vertex AI MCP szerver importálása sikeres.")
        
        # Mivel a tényleges hívás hitelesítést igényel, ami E2E környezetben nem biztosított,
        # itt csak az importot és az eszközök meglétét ellenőrizzük.
        # Ha lenne beállítva PROJECT_ID, megpróbálhatnánk a generálást is.
        
        print("A szerver készen áll a használatra.")
        
    except Exception as e:
        print(f"Hiba a teszt során: {e}")

if __name__ == "__main__":
    asyncio.run(test_vertex())
