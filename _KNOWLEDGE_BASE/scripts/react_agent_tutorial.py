
# -*- coding: utf-8 -*-
"""
ReAct Agent Tutorial a LangChain és Gemini segítségével

AI Architektúra Szakértői Oktatóanyag
Készítette: Brunella (a 2025. augusztus 13-i kutatási jelentés alapján)

Ez a script bemutatja, hogyan lehet egy egyszerű, ReAct logikán alapuló ügynököt
létrehozni a LangChain könyvtár segítségével. Az ügynök a Google Gemini modellt
használja a következtetéshez.
"""

import os
from langchain.agents import tool, AgentExecutor, create_react_agent
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate

# --- 0. LÉPÉS: Konfiguráció ---
# A futtatáshoz telepíteni kell a szükséges csomagokat:
# pip install langchain langchain-google-genai

# Állítsd be a Google API kulcsodat.
# FONTOS: Cseréld le a "YOUR_GOOGLE_API_KEY" szöveget a saját kulcsodra!
# A kulcsot a Google AI Studio-ban tudod generálni.
os.environ['GOOGLE_API_KEY'] = "YOUR_GOOGLE_API_KEY"


# --- 1. LÉPÉS: A ReAct elv magyarázata ---
# A ReAct (Reason + Act) egy keretrendszer, ami arra ösztönzi az MI-t, hogy
# a cselekvés előtt gondolkodjon. A működése egy ciklusra épül:
#
# 1. Thought (Gondolat): Az ügynök elemzi a célt és az eddigi információkat,
#    majd megtervezi a következő lépést.
# 2. Action (Cselekvés): A terv alapján kiválaszt egy eszközt (pl. kereső).
# 3. Observation (Megfigyelés): Végrehajtja a cselekvést, és megkapja
#    annak eredményét (pl. a keresési találatot).
#
# Ezt a ciklust ismétli, amíg össze nem gyűjti az összes szükséges információt
# a végső válaszhoz.


# --- 2. LÉPÉS: Szükséges Eszközök Létrehozása ---
# Definiálunk két egyszerű "ál-eszközt" (mock tool). A valóságban ezek lehetnének
# webes API hívások, adatbázis-lekérdezések vagy fájlműveletek.
# A `@tool` dekorátor jelzi a LangChain számára, hogy ez egy használható eszköz.

@tool
def company_search_tool(product_name: str) -> str:
    """
    Megkeresi, hogy egy adott terméket melyik cég fejleszt.
    Bemenet: egy termék neve (pl. "ChatGPT").
    Kimenet: a fejlesztő cég neve.
    """
    print(f"Tool: company_search_tool, Input: {product_name}")
    if product_name.lower() == "chatgpt":
        return "OpenAI"
    return "Ismeretlen cég"

@tool
def ceo_age_search_tool(company_name: str) -> str:
    """
    Megkeresi egy cég vezérigazgatójának nevét és korát.
    Bemenet: egy cég neve (pl. "OpenAI").
    Kimenet: a CEO neve és kora.
    """
    print(f"Tool: ceo_age_search_tool, Input: {company_name}")
    if company_name.lower() == "openai":
        return "Sam Altman, 39"
    return "Nincs információ a CEO-ról"


# --- 3. LÉPÉS: A ReAct Prompt Sablon ---
# Ez a sablon határozza meg, hogyan kell az ügynöknek gondolkodnia.
# Megadja a formátumot, amit követnie kell a Thought/Action/Observation ciklushoz.

template = """
Válaszolj a következő kérdésekre a legjobb tudásod szerint. Hozzáférésed van a következő eszközökhöz:

{tools}

Használd a következő formátumot:

Question: a kérdés, amire válaszolnod kell
Thought: mindig gondolkodj, hogy mit kell tenned
Action: a végrehajtandó művelet, a következőkből választhatsz: [{tool_names}]
Action Input: a művelet bemenete
Observation: a művelet eredménye
... (ez a Thought/Action/Action Input/Observation ismétlődhet N-szer)
Thought: Most már tudom a végső választ
Final Answer: az eredeti kérdésre adott végső válasz

Kezdjük!

Question: {input}
{agent_scratchpad}
"""

# Prompt létrehozása a sablonból
prompt = PromptTemplate.from_template(template)


# --- 4. LÉPÉS: Az Ügynök Létrehozása ---

def create_agent():
    """
    Ez a funkció létrehozza és visszaadja a kész ReAct ügynököt.
    """
    print("Ügynök inicializálása...")
    # Gemini modell inicializálása
    llm = ChatGoogleGenerativeAI(model="gemini-1.5-pro-latest", temperature=0)

    # Eszközök listájának összeállítása
    tools = [company_search_tool, ceo_age_search_tool]

    # Az ügynök létrehozása a `create_react_agent` funkcióval
    agent = create_react_agent(llm, tools, prompt)

    # Az AgentExecutor felel az ügynök futtatásáért és a ciklusok kezeléséért
    agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
    print("Ügynök készen áll.")
    return agent_executor


# --- 5. LÉPÉS: A Futás Elemzése ---

def run_analysis():
    """
    Lefuttatja az ügynököt és bemutatja a működését.
    """
    agent_executor = create_agent()
    
    question = "Ki a jelenlegi vezérigazgatója annak a cégnek, amelyik a ChatGPT-t fejleszti, és hány éves?"
    print(f"Kérdés: {question}
")

    # Az ügynök meghívása a kérdéssel
    response = agent_executor.invoke({"input": question})

    print("
--- A FUTÁS EREDMÉNYE ---")
    print(response)

    print("
--- A FUTÁS LÉPÉSRŐL LÉPÉSRE ---")
    print("1. Az ügynök megkapja a kérdést, és elkezdi a gondolkodást (Thought).")
    print("   Thought: Először meg kell találnom, melyik cég fejleszti a ChatGPT-t. Ehhez a `company_search_tool` eszközt fogom használni.")
    print("2. Kiválasztja az eszközt (Action) és a bemenetét (Action Input).")
    print("   Action: company_search_tool, Action Input: 'ChatGPT'")
    print("3. Megkapja az eszköz eredményét (Observation).")
    print("   Observation: 'OpenAI'")
    print("4. Újra gondolkodik az új információ birtokában.")
    print("   Thought: Most már tudom, hogy a cég az OpenAI. A következő lépés a CEO nevének és korának megkeresése a `ceo_age_search_tool` eszközzel.")
    print("5. Kiválasztja a második eszközt.")
    print("   Action: ceo_age_search_tool, Action Input: 'OpenAI'")
    print("6. Megkapja a második eszköz eredményét.")
    print("   Observation: 'Sam Altman, 39'")
    print("7. Eljut a végső következtetésre.")
    print("   Thought: Megvan minden információm a válaszhoz.")
    print("8. Megadja a végső választ (Final Answer).")
    print(f"   Final Answer: {response['output']}")


if __name__ == '__main__':
    # Ellenőrizzük, hogy a felhasználó beállította-e az API kulcsot
    if os.environ.get("GOOGLE_API_KEY") == "YOUR_GOOGLE_API_KEY" or not os.environ.get("GOOGLE_API_KEY"):
        print("HIBA: Kérlek, állítsd be a GOOGLE_API_KEY környezeti változót a `react_agent_tutorial.py` fájlban!")
    else:
        run_analysis()

