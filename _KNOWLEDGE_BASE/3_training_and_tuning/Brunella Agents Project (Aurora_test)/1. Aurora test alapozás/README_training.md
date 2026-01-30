📘 Brunella Training Guide – Gemini CLI

Ez a dokumentum végigvezet a 7 napos kognitív tréningprogramon, amely a Brunella AI ügynök kognitív képességeit fejleszti. A program az előzetes kutatás és az AI Agent Cognitive Enhancement anyag alapján készült.

📂 Mappa-struktúra
training-scripts/
├── day1_zero_few.gem
├── day2_react.gem
├── day3_reflexion.gem
├── day4_tot.gem
├── day5_meta_refine.gem
├── day6_cai_reft.gem
└── day7_aurora.gem

logs/
└── dayX_*.json

⚙️ Futási mód

Minden script .gem fájl futtatható a Gemini CLI segítségével:

gemini run --file training-scripts/day1_zero_few.gem

Az eredmények automatikusan a logs/ mappába kerülnek.

📅 Heti program
Nap 1 – Zero-Shot & Few-Shot

Parancs:

gemini run --file training-scripts/day1_zero_few.gem


Kimenet: logs/day1_zero.json, logs/day1_few.json

Céltéma: baseline érvelés mérése, fordítás és magyarázat.

Nap 2 – ReAct Workflow

Parancs:

gemini run --file training-scripts/day2_react.gem


Kimenet: logs/day2_react.json

Céltéma: gondolkodás + cselekvés + megfigyelés.

Nap 3 – Reflexion

Parancs:

gemini run --file training-scripts/day3_reflexion.gem


Kimenet: logs/day3_reflexion.json

Céltéma: hibákból tanulás, epizodikus memória.

Nap 4 – Tree-of-Thought

Parancs:

gemini run --file training-scripts/day4_tot.gem


Kimenet: logs/day4_tot.json

Céltéma: párhuzamos érvelési utak feltárása.

Nap 5 – Self-Refine & Meta-Prompting

Parancs:

gemini run --file training-scripts/day5_meta_refine.gem


Kimenet: logs/day5_refine.json, logs/day5_meta.json

Céltéma: javítás + meta-prompt generálás.

Nap 6 – Constitutional AI & ReFT

Parancs:

gemini run --file training-scripts/day6_cai_reft.gem


Kimenet: logs/day6_cai.json, logs/day6_reft.json

Céltéma: etikai válaszok + reward-alapú érvelés.

Nap 7 – Integrált Misszió (Operation Aurora)

Parancs:

gemini run --file training-scripts/day7_aurora.gem


Kimenet: logs/day7_final_report.json

Céltéma: teljes workflow → adatmentés, diagnózis, stratégia, kommunikáció, QA.

🗄️ Memória integráció

A tréning minden nap végén az új logokat mentsd a Brunella memóriafájljába (brunella_memoria.md):

Formátum:

## [Dátum] – Tréningnap X
- Gyakorolt technika: Zero-Shot / ReAct / Reflexion …
- Futtatott script: dayX_*.gem
- Output log: logs/dayX_*.json
- Eredmény rövid összefoglaló: …


Ez biztosítja, hogy Brunella „emlékezzen” a tréning eredményeire, és a későbbi szimulációkban felhasználhassa őket.

📊 Haladás követése

Pontosság: helyes válaszok aránya.

Kreativitás: alternatív utak száma (ToT).

Reflexió minősége: hány hibát javított.

Konzisztencia: meta-prompt stabilitás.

Idő: futtatási ciklusok gyorsasága.