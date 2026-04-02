# Plan — Brunella Identity + Project Maintainer

1. Definiálni a Brunella rendszeridentitást mint a teljes koordinációs réteg központi neve és arca.
2. Kijelölni, hogy a Copilot CLI-n keresztül a felhasználó Brunellával kommunikáljon, ne különálló agent-nevekkel.
3. Különválasztani a Scheduler, Janitor és Project Maintainer felelősségi köröket.
4. Megtervezni a Project Maintainer első verzióját report-only / dry-run működéssel.
5. Rögzíteni a 22:00-kor futó napi karbantartási ciklus céljait és outputjait.
6. Meghatározni, milyen repo-zajokat figyeljen: root artefactok, logok, rossz helyre került fájlok, track anomáliák.
7. Archiválási és automatikus mozgatási szabályokat allowlist-alapon definiálni.
8. Dashboard / CLI / naplózási felületeket kijelölni a Maintainer riportolásához.
