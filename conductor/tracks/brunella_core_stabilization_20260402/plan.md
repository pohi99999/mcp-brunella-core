# Plan — Brunella Core Stabilization

1. Azonosítani a Node OOM és unstable runtime konkrét kiváltó okait az orchestrator és startup logok alapján.
2. Kialakítani a Brunella Core stable runtime modellt, ahol a Node a fő control plane, a Python külön runtime marad.
3. A dashboard stable kiszolgálását a buildelt `build/public` statikus assetekre szabványosítani, Vite dev szerver nélkül.
4. Host-native supervision modellt definiálni Windows (Windows Service), Linux (systemd) és hordozható/staging (Docker Compose) célokra.
5. Egységes healthcheck, restart és recovery viselkedést rögzíteni a Node + Python runtime számára.
6. Az `inditas.bat` szerepét egyetlen kézi belépési pontra szűkíteni, nem uptime-mechanizmusként használni.
7. A stable módhoz szükséges config, startup és operációs dokumentációs pontokat kijelölni.
8. Validációs és bevezetési checklistet készíteni a későbbi implementációhoz.
