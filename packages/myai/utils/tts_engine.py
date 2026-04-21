import asyncio
import edge_tts
import sys
import os
from pathlib import Path

async def generate_tts(text, output_file, voice="hu-HU-NoemiNeural"):
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_file)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python tts_engine.py '<text>' <output_path>")
        sys.exit(1)
    
    text_to_say = sys.argv[1]
    output_path = sys.argv[2]
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    asyncio.run(generate_tts(text_to_say, output_path))
    print(f"Audio saved to: {output_path}")
