# Spec: Funkcionális Integritás Helyreállítása

**Cél:** Annak biztosítása, hogy a Dashboardon végrehajtott felhasználói műveletek (pl. üzenet küldése a Chatben, feladat indítása) garantáltan elindítsák a megfelelő háttérfolyamatokat (pl. ügynök delegálás, Task Queue bejegyzés).

## Követelmények:
1.  **Útvonal Audit:** A Dashboard (`apiService.ts`) által hívott összes API végpontnak léteznie kell a Backendben (`web.ts`).
2.  **Queue-First Stratégia:** Minden ügynök-indításnak (akár Chatből, akár más panelről) először létre kell hoznia egy bejegyzést a központi Task Queue-ban, hogy a folyamat követhető legyen.
3.  **Névfeloldás:** Az ügynökök hívásának kis- és nagybetű-függetlennek kell lennie.
4.  **Visszacsatolás:** A háttérfolyamat elindulásáról a Dashboardnak azonnali visszajelzést kell kapnia (pl. Task ID, "running" státusz).
5.  **E2E Verifikáció:** Egy dedikált tesztnek kell igazolnia, hogy a Chat-ben elküldött üzenet után a feladat valóban megjelenik a `/api/tasks` végponton.
