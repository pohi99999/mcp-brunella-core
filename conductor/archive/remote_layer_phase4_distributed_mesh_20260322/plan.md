# Plan — Brunella Remote Layer — Fázis 4: Distributed Mesh & Edge Routing

1. Meghatározni a mesh node metadata és capability exchange alapmodelljét.
2. Implementálni a `meshNode.ts` és `meshManager.ts` alap node lifecycle-ját.
3. Létrehozni az edge router réteget Cloudflare worker fallback támogatással.
4. Bevezetni a multi-device session linking és context sharing logikát.
5. Elkészíteni az offline delta sync adaptert replay és merge képességekkel.
6. Létrehozni a federated agent futtatási alapokat a meglévő AgentManagerre ráépítve.
7. Kibővíteni a Phoenix protokollt state replikációval és auto-join folyamattal.
8. Dashboardon láthatóvá tenni a mesh, sync és federation állapotokat.
9. Integrációs teszteket írni a node, edge, sync és federation use-case-ekre.
10. Build + test + dokumentált státuszfrissítés.
