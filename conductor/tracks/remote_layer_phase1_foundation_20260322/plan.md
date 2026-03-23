# Plan — Brunella Remote Layer — Fázis 1: Remote Foundation

1. A koncepcionális szövegből véglegesíteni a remote session, target és command minimális adatmodelljét.
2. Létrehozni a `remote.ts` route-ot a session / targets / command alapvégpontokkal.
3. Bevezetni az in-memory RemoteSession kezelést lejárati és stream-azonosító logikával.
4. Kibővíteni a Socket.IO/WebSocket réteget sessionhöz kötött remote eseményfolyammal.
5. Elkészíteni a `mcpRouter.ts` skeleton modult szerver- és capability-regisztrációs alapokkal.
6. Kibővíteni a dashboardot `RemoteConsole`, `RemoteTargetSelector`, `RemoteStream` komponensekkel.
7. Hozzáadni a `BrunellaRemoteClient` kliens wrapper-t PAIOS és külső kliensek számára.
8. Smoke teszteket írni a session, target lista, command routing és stream működésére.
9. Build + test + conductor naplófrissítés.
