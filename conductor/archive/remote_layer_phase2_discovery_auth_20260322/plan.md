# Plan — Brunella Remote Layer — Fázis 2: Discovery, Capability & Auth

1. Meghatározni a támogatott MCP discovery források és config-formátumok szerkezetét.
2. Létrehozni az `mcpDiscovery.ts` modult lokális és placeholder remote discovery támogatással.
3. Kibővíteni az `mcpRouter` modult capability regisztrációval, lookupkal és listázással.
4. Bevezetni a token generálást és ellenőrzést a remote auth rétegben.
5. Létrehozni a perzisztens `remoteSessionStore` adaptert SQLite-backed működéssel.
6. Elkészíteni a `remote_actions.ts` route-ot a magas szintű PAIOS action API-hoz.
7. Kibővíteni a dashboardot MCP Servers és Devices nézetekkel.
8. Teszteket írni discovery, capabilities, auth és remote action use-case-ekre.
9. Build + test + állapotfrissítés.
