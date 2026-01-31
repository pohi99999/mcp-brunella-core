# -*- coding: utf-8 -*-
"""
Qwen3 Coder Tool - Wrapper Script for Brunella Agents System

Ez a script egy "burkoló" (wrapper) a Qwen3 kódgeneráló modellhez,
hogy az a Brunella Agents System számára eszközként használható legyen.

Működési elv:
1. A script egyetlen fő funkciót, a `generate_code`-ot tartalmazza.
2. Ez a funkció egy promptot és egy nyelvi specifikációt vár bemenetként.
3. Mivel a Brunella rendszer közvetlenül nem tud külső modelleket hívni,
   ez a script a Gemini API-t használja a Qwen3 modell *szimulálására*.
4. A Gemini modellt egy speciális rendszer-prompttal instruálja, hogy
   viselkedjen úgy, mintha a Qwen3 kódoló modell lenne.
5. Visszaadja a generált kódot szövegként.
"""

import os
import google.generativeai as genai

# --- Konfiguráció ---
# A GOOGLE_API_KEY-t a környezeti változókból kell beolvasni.
# A Brunella rendszer gondoskodik ennek a változónak a beállításáról.
try:
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("A GOOGLE_API_KEY környezeti változó nincs beállítva.")
    genai.configure(api_key=api_key)
except Exception as e:
    print(f"Hiba a Gemini konfigurálása során: {e}")
    # A script további része hibára fog futni, de ez jelzi a problémát.

# --- Rendszer Prompt a Qwen3 Szimulációhoz ---
QWEN3_SYSTEM_PROMPT = """
Te egy specializált, nyílt forráskódú kódgeneráló AI vagy, a Qwen3-coder.
Kizárólagos feladatod, hogy a kapott prompt alapján magas minőségű, tiszta és hatékony kódot generálj a megadott programozási nyelven.
- NE adj magyarázatot a kódhoz.
- NE használj markdown formázást (pl. ```python).
- NE írj semmilyen üdvözlő vagy bevezető szöveget.
- Csak és kizárólag a kért kódot add vissza.
- Ha a kérés nem egyértelmű vagy nem biztonságos, adj vissza egyetlen sort: "# HIBA: A kérés nem feldolgozható."
"""

def generate_code(prompt: str, language: str = "python") -> str:
    """
    Kódot generál a megadott prompt alapján a Qwen3 modell szimulálásával.

    Args:
        prompt (str): A kódgeneráláshoz szükséges részletes leírás.
        language (str, optional): A cél programozási nyelv. Alapértelmezett: "python".

    Returns:
        str: A generált kód, vagy hibaüzenet.
    """
    try:
        # Modell inicializálása (Gemini-t használunk a szimulációhoz)
        model = genai.GenerativeModel(
            model_name='gemini-1.5-pro-latest',
            system_instruction=QWEN3_SYSTEM_PROMPT
        )

        # A felhasználói prompt kiegészítése a nyelvi információval
        full_prompt = f"Programozási nyelv: {language}\n\nFeladat: {prompt}"

        # Kódgenerálás
        response = model.generate_content(full_prompt)

        # A generált kód kinyerése a válaszból
        generated_code = response.text.strip()
        
        return generated_code

    except Exception as e:
        return f"# HIBA: A kódgenerálás során hiba történt: {e}"

# --- Tesztelési rész ---
if __name__ == '__main__':
    print("--- Qwen3 Coder Tool Teszt ---")
    
    # Ellenőrizzük, hogy az API kulcs be van-e állítva a teszthez
    if "GOOGLE_API_KEY" not in os.environ or not os.environ["GOOGLE_API_KEY"]:
        print("FIGYELEM: A teszt futtatásához állítsd be a GOOGLE_API_KEY környezeti változót!")
    else:
        test_prompt = "Írj egy egyszerű Python függvényt, ami összead két számot és visszaadja az eredményt. A függvény neve legyen `osszead`."
        print(f"Teszt Prompt: {test_prompt}\n")
        
        generated_code = generate_code(test_prompt, language="python")
        
        print("--- Generált Kód ---")
        print(generated_code)
        print("--------------------")

        # Teszt egy másik nyelven
        test_prompt_js = "Write a JavaScript function that takes a name as a parameter and returns a greeting string 'Hello, [name]!'."
        print(f"\nTeszt Prompt (JS): {test_prompt_js}\n")
        
        generated_code_js = generate_code(test_prompt_js, language="javascript")

        print("--- Generált Kód (JS) ---")
        print(generated_code_js)
        print("-------------------------")
