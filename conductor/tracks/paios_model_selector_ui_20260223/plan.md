# Implementációs Terv: PAIOS ModelSelector UI
**Track ID:** `paios_model_selector_ui_20260223`

> ⚠️ Előfeltétel: `paios_orchestrator_chat_20260223` track COMPLETED állapotban kell legyen.

---

## Phase 1: ModelSelector komponens

* [ ] **Task 1.1** — `src/dashboard/components/dashboard/ModelSelector.tsx`
  - Radix UI `Select` alapú, 4 provider opcióval
  - Props: `value`, `onChange`, `health` (opcionális)
  - Inline health badge: zöld/piros/szürke pont a provider neve mellett
  - localStorage: `paios_selected_model` key-en menti az utolsó választást

* [ ] **Task 1.2** — `src/dashboard/lib/apiService.ts` bővítése:
  ```typescript
  export async function paiosChat(message: string, model?: string) {
    return apiFetch('/api/paios/chat', {
      method: 'POST',
      body: JSON.stringify({ message, model }),
    });
  }

  export async function getProviderHealth() {
    const health = await apiFetch('/api/health');
    return {
      gpt4o: health.github_models?.status === 'healthy' ? 'up' : 'down',
      gemini: health.gemini?.status === 'healthy' ? 'up' : 'down',
      local: health.ollama?.status === 'healthy' ? 'up' : 'down',
      workers: health.cloudflare?.status === 'healthy' ? 'up' : 'down',
    };
  }
  ```

---

## Phase 2: PAIOS Chat Panel

* [ ] **Task 2.1** — `src/dashboard/components/dashboard/PAIOSChatPanel.tsx`
  - Input mező + Küldés gomb (magyar felirattal)
  - ModelSelector beágyazva a panel tetején
  - Üzenet lista: user / assistant buborékok
  - `POST /api/paios/chat` hívás → response summary megjelenítése
  - Loading state jelzése küldés közben

* [ ] **Task 2.2** — Navigáció regisztráció: `src/dashboard/lib/navigation.tsx`
  ```typescript
  navigationRegistry.registerItem({
    id: 'paios-chat',
    label: 'PAIOS Chat',
    icon: 'Bot',
    component: PAIOSChatPanel,
    group: 'ai',
  });
  ```

---

## Phase 3: Provider health polling

* [ ] **Task 3.1** — `useProviderHealth` custom hook:
  ```typescript
  // src/dashboard/hooks/useProviderHealth.ts
  export function useProviderHealth(intervalMs = 30000) {
    const [health, setHealth] = useState<ProviderHealth>({});
    useEffect(() => {
      const poll = async () => setHealth(await getProviderHealth());
      poll();
      const id = setInterval(poll, intervalMs);
      return () => clearInterval(id);
    }, [intervalMs]);
    return health;
  }
  ```

* [ ] **Task 3.2** — ModelSelector-ba bekötve a `useProviderHealth` hook

---

## Phase 4: Tesztek

* [ ] **Task 4.1** — `test/dashboard/ModelSelector.test.tsx` (vitest + @testing-library/react)
  - Render 4 opció
  - onChange hívódik kattintásra
  - localStorage-ba ment

* [ ] **Task 4.2** — `npm run build && npm test` → 0 hiba

---

## 🎯 Sikerességi Kritériumok

- Dashboard-on megjelenik a PAIOS Chat panel ModelSelector-ral
- Model váltás → API hívás más `model` paramétert küld
- Health badge valós időben mutatja a provider elérhetőségét
- Oldal frissítés után is megmarad a model választás (localStorage)
- `npm run build` → 0 TypeScript hiba
