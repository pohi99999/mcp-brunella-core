\# Track: Codex NeuralLink Chat Refactor

\*\*Dátum:\*\* 2026-02-12

\*\*Prioritás:\*\* HIGH

\*\*Status:\*\* IN_PROGRESS

\## 🎯 Célkitűzés

A `NeuralLinkChat.tsx` komponens monolitikus logikájának szétszedése, Provider Adapter minta bevezetése, típusbiztonság növelése és session perzisztencia megvalósítása. A cél, hogy a Chat UI csak a megjelenítéssel foglalkozzon, a logikát pedig dedikált providerek kezeljék.

\## 🛠️ Érintett Fájlok

\- `src/dashboard/components/dashboard/NeuralLinkChat.tsx` (Refaktor)

\- `src/dashboard/lib/chat/\*` (Új struktúra)

\- `src/dashboard/lib/apiService.ts` (Hardening)

\- `.gitignore` (Cleanup)

\## 📅 Megvalósítási Terv (Phases)

\### Phase 1: Chat Provider Adapter Layer (Architektúra)

Létrehozzuk az interfészeket és a konkrét providereket, hogy kiváltsuk az if/else logikát.

1\. \*\*Típusdefiníciók létrehozása:\*\*

&nbsp; - Fájl: `src/dashboard/lib/chat/types.ts`

&nbsp; - Tartalom: `ChatMode`, `ChatMessage`, `ChatSendInput`, `ChatSendOutput`, `ChatProvider` interface.

2\. \*\*Providerek implementálása:\*\*

&nbsp; - `src/dashboard/lib/chat/providers/orchestratorProvider.ts`

&nbsp; - `src/dashboard/lib/chat/providers/ollamaProvider.ts`

&nbsp; - `src/dashboard/lib/chat/providers/githubProvider.ts`

&nbsp; - `src/dashboard/lib/chat/providers/geminiProvider.ts`

&nbsp; - `src/dashboard/lib/chat/providers/cloudflareEdgeProvider.ts`

&nbsp; - `src/dashboard/lib/chat/providers/cloudflareChatProvider.ts`

3\. \*\*Registry létrehozása:\*\*

&nbsp; - Fájl: `src/dashboard/lib/chat/providerRegistry.ts`

&nbsp; - Logika: Map-alapú lookup (`getProvider(mode)`).

\### Phase 2: NeuralLinkChat Refactor (UI Tisztítás)

A komponens karcsúsítása az új providerek használatával.

1\. \*\*Context Builder kiszervezése:\*\*

&nbsp; - Mozgasd át a `buildConversationPrompt` logikát ide: `src/dashboard/lib/chat/contextBuilder.ts`.

2\. \*\*Komponens tisztítás (`NeuralLinkChat.tsx`):\*\*

&nbsp; - Állapotok maradnak (messages, input, selected model).

&nbsp; - A `send()` metódus cseréje: `provider.send(...)` hívásra.

&nbsp; - Provider-specifikus if/else blokkok törlése.

\### Phase 3: Session Persistence (UX)

A chat állapotának megőrzése frissítés után.

1\. \*\*Store létrehozása:\*\*

&nbsp; - Fájl: `src/dashboard/lib/chat/sessionStore.ts`

&nbsp; - Kulcs: `brunella:chat:session:v1`

2\. \*\*Integráció:\*\*

&nbsp; - Mentés debounce-olva (300ms) a `NeuralLinkChat.tsx`-ben.

&nbsp; - Restore initkor.

&nbsp; - Mentett mezők: messages, mode, selectedModel-ek.

\### Phase 4: API \& Git Hygiene (Stabilitás)

Típusbiztonság és verziókezelés rendbetétele.

1\. \[x] \*\*API Hardening (`apiService.ts`):\*\*

&nbsp; - `safeJson<any>` cseréje `safeJson<SpecificType>`-ra.

&nbsp; - Type guardok bevezetése a provider válaszokra.

2\. \[x] \*\*Git Cleanup (`.gitignore`):\*\*

&nbsp; - Hozzáadni: `data/\*.db-wal`, `data/\*.db-shm`, `developer\_metrics.json`.

\### Phase 5: Tesztelés

Biztosítani, hogy a refaktor nem törte el a funkcionalitást.

1\. \[x] \*\*Új tesztek írása:\*\*

&nbsp; - Fájl: `test/dashboard/components/NeuralLinkChat.test.tsx`

&nbsp; - Tesztek: Mode váltás, History átadás, Session restore, Cloudflare fallback.

&nbsp; - Dashboard test run lefuttatva.

\## ✅ Definition of Done

_Megjegyzés:_ a méretcsökkentés DoD tétel tudatos döntés alapján nyitva marad ebben a körben.

- [ ] `NeuralLinkChat.tsx` mérete 30-40%-kal csökkent.
- [x] **Track lezárva:** a méretcsökkentés tétel deferred, külön follow-up trackben kezeljük.
- [x] Új provider hozzáadása csak 1 új fájlt + 1 registry sort igényel.
- [x] Böngésző frissítés után a chat előzmények megmaradnak.
- [x] `npm test` hiba nélkül lefut.

## ✅ Completion Note

A track lezárva. A méretcsökkentési cél tudatosan deferred státuszban maradt, külön follow-up feladatban kerül véglegesítésre.
