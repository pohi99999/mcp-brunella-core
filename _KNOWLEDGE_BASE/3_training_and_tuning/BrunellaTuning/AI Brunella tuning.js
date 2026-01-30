import pandas as pd
import io

# Data derived from all the uploaded documents
data = {
    'Kategória': [
        "Stratégiai Keretrendszer", "Stratégiai Keretrendszer", "Stratégiai Keretrendszer", "Stratégiai Keretrendszer", "Stratégiai Keretrendszer",
        "Stratégiai Trend", "Stratégiai Trend", "Stratégiai Trend", "Stratégiai Trend", "Stratégiai Trend",
        "Kognitív Technika (Architektúra)", "Kognitív Technika (Keretrendszer)", "Kognitív Technika (Keretrendszer)", "Kognitív Technika (Prompting)",
        "Kognitív Technika (Keretrendszer)", "Kognitív Technika (Meta-Keretrendszer)", "Kognitív Technika (Irányítás)", "Kognitív Technika (Prompting)",
        "Kognitív Technika (Képzés)", "Kognitív Technika (Prompting)",
        "Kompetencia Keretrendszer", "Kompetencia Keretrendszer", "Kompetencia Keretrendszer", "Kompetencia Keretrendszer",
        "Fejlesztői Eszköztár (Python)", "Fejlesztői Eszköztár (Python)", "Fejlesztői Eszköztár (Python)", "Fejlesztői Eszköztár (Python)",
        "Fejlesztői Eszköztár (Python)", "Fejlesztői Eszköztár (Python)", "Fejlesztői Eszköztár (Python)",
        "Fejlesztői Eszköztár (Node.js)"
    ],
    'Forrás': [
        "AI Agent.pdf (Microsoft)", "AI Agent.pdf (Microsoft)", "AI Agent.pdf (Microsoft)", "AI Agent.pdf (Microsoft)", "AI Agent.pdf (Microsoft)",
        "google_cloud_ai_trends_másolat.pdf", "google_cloud_ai_trends_másolat.pdf", "google_cloud_ai_trends_másolat.pdf", "google_cloud_ai_trends_másolat.pdf", "google_cloud_ai_trends_másolat.pdf",
        "AI Agent Cognitive Enhancement Research", "AI Agent Cognitive Enhancement Research", "AI Agent Cognitive Enhancement Research", "AI Agent Cognitive Enhancement Research",
        "AI Agent Cognitive Enhancement Research", "AI Agent Cognitive Enhancement Research", "AI Agent Cognitive Enhancement Research", "AI Agent Cognitive Enhancement Research",
        "AI Agent Cognitive Enhancement Research", "AI Agent Cognitive Enhancement Research",
        "AI Csapat DELTAS Készségfejlesztési Terve", "AI Csapat DELTAS Készségfejlesztési Terve", "AI Csapat DELTAS Készségfejlesztési Terve", "AI Csapat DELTAS Készségfejlesztési Terve",
        "7 Python Libraries.pdf", "7 Python Libraries.pdf", "7 Python Libraries.pdf", "7 Python Libraries.pdf",
        "7 Python Libraries.pdf", "7 Python Libraries.pdf", "7 Python Libraries.pdf",
        "package.json"
    ],
    'Elem / Képesség': [
        "Üzleti stratégia", "Technológiai és adatstratégia", "AI-stratégia és -élmény", "Vállalat és kultúra", "AI-irányítás",
        "Multimodal AI", "AI Agents", "Assistive Search", "AI-powered Customer Experience (CX)", "AI in Security",
        "LangGraph Több-ágenses Architektúra", "ReAct (Reason+Act) Keretrendszer", "Reflexion Keretrendszer", "Gondolatfa (Tree of Thoughts - ToT)",
        "Önfinomítás (Self-Refine)", "Önfelfedezés (Self-Discover)", "Alkotmányos MI (Constitutional AI - CAI)", "Meta-Prompting",
        "Megerősítéses Finomhangolás (ReFT)", "Fejlett CoT Variánsok (Auto-CoT, Self-Consistency)",
        "Kognitív Képességek (DELTAS)", "Interperszonális Képességek (DELTAS)", "Önvezetés (DELTAS)", "Digitális Képességek (DELTAS)",
        "Haystack", "Jina AI", "DeepSpeed", "Sentence-Transformers", "AutoGluon", "Fastdup", "LangChain",
        "Firebase & Google Cloud & OpenAI"
    ],
    'Rövid Leírás': [
        "Annak biztosítása, hogy az AI-projektek stratégiai üzleti célokat szolgáljanak.",
        "Az AI-megoldások futtatásához szükséges adatok és infrastruktúra megteremtése.",
        "A fenntartható értékteremtéshez szükséges szakértelem és megismételhető folyamatok.",
        "A bevezetést alakító jövőkép, működési modell, készségek, erőforrások és kultúra.",
        "Az adatvédelem, biztonság, megfelelőség és felelős MI biztosítására szolgáló folyamatok.",
        "Kép, videó, hang és szöveg együttes értelmezése a mélyebb kontextuális megértésért.",
        "Az egyszerű chatbotoktól a komplex, több-ágenses rendszerekig terjedő evolúció, amelyek feladatokat hajtanak végre.",
        "A tudás létrehozására és nem csak visszakeresésére összpontosító, asszisztív keresési technológiák.",
        "Zökkenőmentes, hiperperszonalizált ügyfélélmények létrehozása, ahol a technológia szinte láthatatlan.",
        "A kiberbiztonsági védelem és támadások kifinomultabbá tétele AI segítségével.",
        "Több specializált ágens állapot-alapú vezénylése egy irányítható gráfstruktúrán belül.",
        "Az érvelés és cselekvés (eszközhasználat) szinergikus összekapcsolása a gondolatok validálására.",
        "Lehetővé teszi az ágens számára, hogy a múltbeli kudarcokra adott nyelvi visszajelzésekből tanuljon (verbális megerősítés).",
        "Több párhuzamos érvelési út feltárása és a legígéretesebbek kiválasztása önértékelés segítségével.",
        "Egy kezdeti kimenet iteratív javítása egy FEEDBACK -> REFINE cikluson keresztül, ugyanazon LLM használatával.",
        "Egy meta-érvelési keretrendszer, amelyben az ágens először egy optimális érvelési struktúrát fedez fel a feladathoz.",
        "Az ágensek viselkedésének összehangolása explicit alapelvekkel, MI által generált visszajelzések használatával.",
        "Egy LLM használata egy optimalizált, részletes prompt generálására a felhasználó egyszerű lekérdezése alapján.",
        "Felügyelt finomhangolás és megerősítéses tanulás ötvözése a helyes eredmények jutalmazására.",
        "A kevés példás CoT-példák automatikus létrehozása (Auto-CoT) és többségi szavazás használata (Self-Consistency).",
        "Gondolkodás, problémamegoldás, kommunikáció és mentális rugalmasság képességei.",
        "Másokkal való interakció, kapcsolatépítés és csapatmunka képességei.",
        "Önismeret, célkitűzés, a bizonytalanság kezelése és vállalkozói szemlélet.",
        "Technológiai eszközök és rendszerek használata, megértése és fejlesztése.",
        "End-to-end NLP keretrendszer a vállalati adatokon alapuló 'Kérdezz-felelek' rendszerekhez.",
        "Egyszerűen telepíthető neurális keresési (szemantikus, multimodális) backend.",
        "Microsoft keretrendszer elosztott tréning optimalizálására, lehetővé téve nagy modellek finomhangolását egyetlen GPU-n.",
        "Szövegek szemantikai jelentésének vektoros reprezentációja, hasonlósági elemzésekhez.",
        "Automatizált gépi tanulás (AutoML) táblázatos adatokhoz, modellek tucatjait futtatja és ensemblálja.",
        "Adattisztító eszköz, amely embeddingek segítségével talál duplikátumokat, anomáliákat és címkézési hibákat.",
        "Keretrendszer LLM hívások, API-k és adatforrások láncolására komplex munkafolyamatokká.",
        "Felhőalapú backend szolgáltatások (adatbázis, authentikáció, tárhely) és fejlett AI modellek API-n keresztüli elérése."
    ],
    'Kulcsfontosságú Használat / Cél': [
        "Az AI értékteremtésének maximalizálása, ROI biztosítása.",
        "A megbízható és skálázható AI működés alapjainak megteremtése.",
        "A sikeres AI bevezetések ismételhetőségének és fenntarthatóságának biztosítása.",
        "Az AI elfogadásának felgyorsítása, a szervezeti ellenállás csökkentése.",
        "A jogi, etikai és reputációs kockázatok minimalizálása.",
        "Pontosabb, árnyaltabb és emberibb interakciók létrehozása.",
        "Komplex üzleti folyamatok automatizálása, emberi tehermentesítés.",
        "Belső tudásbázisok hatékonyabb kihasználása, innováció gyorsítása.",
        "Ügyfél-elégedettség és konverzió növelése.",
        "Védelmi rendszerek megerősítése, fenyegetések proaktív észlelése.",
        "Komplex, többlépéses feladatok (pl. kutatás+kódolás+validálás) megbízható végrehajtása.",
        "A hallucinációk csökkentése, valós idejű, tényszerűen pontos válaszok biztosítása.",
        "Iteratív feladatok (pl. kódgenerálás, tervezés) sikerességi arányának növelése.",
        "Stratégiai tervezés, optimális útvonal megtalálása nagy keresési terekben.",
        "Generált tartalom (szöveg, e-mail) minőségének (stílus, hangnem) javítása.",
        "Újszerű, ismeretlen problémák hatékony megoldása egyedi stratégiák kidolgozásával.",
        "A biztonságos és etikus működés garantálása felhasználóval szembeni alkalmazásokban.",
        "A felhasználói bevitel pontatlanságából eredő hibák csökkentése, a kimenet minőségének szabványosítása.",
        "Egy modell alapvető érvelési képességeinek mélyebb, robusztusabb fejlesztése.",
        "A Chain-of-Thought érvelés megbízhatóságának és skálázhatóságának növelése.",
        "Problémamegoldás, adatelemzés, logikai következtetés, riportálás.",
        "Ügyfélszolgálat, tárgyalás, csapatmunka koordináció, coaching.",
        "Célok elérése, proaktivitás, reziliencia, folyamatos tanulás.",
        "Szoftverfejlesztés, adatkezelés, digitális együttműködés, kiberbiztonság.",
        "Belső tudásbázis vagy dokumentáció alapján működő chatbot építése.",
        "Kép- vagy termékkereső motor fejlesztése percek alatt.",
        "Nagy nyelvi modellek finomhangolása korlátozott hardveren.",
        "Duplikátumtartalom-szűrés, ajánlórendszerek, szándékfelismerés.",
        "Gyors prototípus készítése táblázatos adatokból anélkül, hogy mélyen értenénk a modellekhez.",
        "Nagy kép- vagy adathalmazok előkészítése gépi tanuláshoz.",
        "Eszközöket (API-kat) használó, több lépésből álló automatizációk létrehozása.",
        "Modern, skálázható web- és mobilalkalmazások backendjének biztosítása és AI-képességekkel való kiegészítése."
    ]
}

df = pd.DataFrame(data)
df.to_csv("AI_Tudasbazis.csv", index=False, encoding='utf-8-sig')

print("Az 'AI_Tudasbazis.csv' fájl sikeresen létrehozva.")

