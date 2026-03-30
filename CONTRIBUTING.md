# 🤝 Hozzájárulási Útmutató - BAS (Brunella Agent System)

Köszönjük, hogy hozzá szeretnél járulni a Brunella Agent System projekthez! Ez a dokumentum tartalmazza az irányelveket a projekt sikeres együttműködéséhez.

---

## 📋 Tartalomjegyzék

- [Branch Naming Convention](#branch-naming-convention)
- [Commit Message Formátum](#commit-message-formátum)
- [Pull Request Folyamat](#pull-request-folyamat)
- [Kód Minőségi Szabályok](#kód-minőségi-szabályok)
- [Fejlesztési Környezet](#fejlesztési-környezet)
- [Tesztelés](#tesztelés)
- [Git Hook-ok](#-git-hook-ok)

---

## 🌿 Branch Naming Convention

Használd az alábbi prefixeket minden branch létrehozásakor:

| Prefix | Cél | Példa |
|--------|-----|-------|
| `feature/` | Új funkció | `feature/researcher-agent` |
| `fix/` | Hibajavítás | `fix/memory-leak` |
| `perf/` | Performance javítás | `perf/async-conductor` |
| `docs/` | Dokumentáció frissítés | `docs/api-guide` |
| `refactor/` | Kód refaktorálás | `refactor/agent-factory` |
| `chore/` | Maintenance feladatok | `chore/dependency-update` |
| `test/` | Teszt fejlesztés | `test/integration-suite` |

### Példák helyes branch nevekre:

```bash
git checkout -b feature/researcher-agent
git checkout -b fix/api-timeout
git checkout -b perf/rag-cache-optimization
git checkout -b docs/readme-update
git checkout -b refactor/logger-service
```

### Branch szabályok:

- ✅ Használj kisbetűket
- ✅ Használj kötőjelet szavak között
- ✅ Légy konkrét és leíró
- ✅ Tartsd röviden (max 50 karakter)
- ❌ Ne használj szóközöket
- ❌ Ne használj nagybetűket
- ❌ Ne használj általános neveket (pl. "fix", "update")

---

## 📝 Commit Message Formátum

Használd a [Conventional Commits](https://www.conventionalcommits.org/) szabványt:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type (kötelező):

- `feat`: Új funkció
- `fix`: Hibajavítás
- `docs`: Dokumentáció változás
- `style`: Formázás, pontosvessző hiánya, stb. (nem kód logika)
- `refactor`: Kód átírás (nem új funkció, nem hibajavítás)
- `perf`: Performance javítás
- `test`: Tesztek hozzáadása vagy módosítása
- `chore`: Build folyamat, eszköz konfiguráció, stb.

### Scope (opcionális):

A scope a változtatás területét jelöli, pl.: `agent`, `cli`, `api`, `ui`

### Subject (kötelező):

- Rövid leírás (max 50 karakter)
- Használj felszólító módot: "add" nem "added" vagy "adds"
- Ne használj pontot a végén
- Kisbetűvel kezdd (kivéve tulajdonnevek)

### Példák:

```bash
# Egyszerű commit
git commit -m "feat(agent): add researcher agent implementation"

# Részletesebb commit
git commit -m "fix(api): handle timeout errors in LLM client

Previously the API would crash on timeout. Now it returns
a proper error message and retries the request.

Fixes #123"

# Breaking change
git commit -m "feat(api)!: change authentication method

BREAKING CHANGE: JWT tokens are now required for all API endpoints.
Update your client to include Authorization header."

# További példák
git commit -m "docs: update README with installation steps"
git commit -m "perf(conductor): optimize task scheduling algorithm"
git commit -m "test(agent): add unit tests for developer agent"
git commit -m "chore: update dependencies to latest versions"
```

---

## 🔄 Pull Request Folyamat

### 1. Előkészítés

```bash
# Frissítsd a main branchet
git checkout main
git pull origin main

# Hozz létre új branchet
git checkout -b feature/your-feature

# Végezd el a változtatásokat
# ...

# Commitolj gyakran, kis egységekben
git add .
git commit -m "feat: implement basic feature"
```

### 2. Pull Request Létrehozása

1. Push-old a branchet GitHubra:
   ```bash
   git push origin feature/your-feature
   ```

2. Nyiss Pull Requestet a GitHub UI-on

3. Töltsd ki a PR templateet:
   - **Cím**: Rövid, leíró cím a változtatásról
   - **Leírás**: Mit csinál a változtatás és miért szükséges
   - **Issue referencia**: `Fixes #123` vagy `Relates to #456`
   - **Screenshots**: UI változtatásoknál képernyőképek
   - **Testing**: Hogyan tesztelted a változtatást

### 3. PR Template Példa

```markdown
## 📝 Változtatások összefoglalója

Rövid leírás arról, mit csinál ez a PR.

## 🎯 Motiváció

Miért szükséges ez a változtatás? Milyen problémát old meg?

## 🧪 Hogyan teszteltem

- [ ] Unit tesztek futtatása: `pnpm test`
- [ ] Build sikeresen lefut: `pnpm run build`
- [ ] Manuális tesztelés: [leírás]

## 📸 Screenshots (ha releváns)

## 🔗 Kapcsolódó Issue-k

Fixes #123
Relates to #456

## ✅ Checklist

- [ ] Kód követi a projekt stílus útmutatóját
- [ ] Tesztek hozzáadva/frissítve
- [ ] Dokumentáció frissítve
- [ ] Commit üzenetek követik a conventional commits szabványt
- [ ] Build és tesztek lefutnak hiba nélkül
```

### 4. Review Folyamat

- Legalább 1 jóváhagyás szükséges
- CI/CD checks-eknek sikeresnek kell lenniük
- Válaszolj a review kommentekre
- Kérj változtatásokat ha szükséges

### 5. Merge

- **Squash and merge** az előnyben részesített módszer
- Branch automatikusan törlődik merge után
- Zárd le a kapcsolódó issue-kat

---

## 🪝 Git Hook-ok

Ez a repository Husky hookokat használ a gyors visszajelzéshez és a dokumentációs drift csökkentéséhez.

### Pre-commit

Fut minden commit előtt:

1. `npx tsx scripts/sync_bootstrap.ts --stage`
  - `.ai/BOOTSTRAP.md` az egyetlen forrás
  - automatikusan frissíti a `BOOTSTRAP.md` és `.vscode/BOOTSTRAP.md` másolatokat
  - a generált példányokat újra stage-eli, ha változtak
2. `npm run build`
3. `node scripts/precommit-lint.mjs`
  - csak a stage-elt TS/JS fájlokat linteli

**Cél:** gyors commit-visszajelzés, teljes teszt suite nélkül.

### Pre-push

Fut minden push előtt:

1. `npx tsx scripts/sync_doc_stats.ts --dry-run`
  - figyelmeztet, ha a README / BOOTSTRAP / PROJEKT_DIAGRAM statisztikái eltérnek a kódtól
2. `npm run build`
3. `vitest` gyorsított exclude listával

**Cél:** a gyors fejlesztői élmény megtartása commitnál, de erősebb ellenőrzés push előtt.

---

## 💻 Kód Minőségi Szabályok

### TypeScript/JavaScript

- ✅ Használj ESM importokat `.js` kiterjesztéssel
- ✅ Strict TypeScript mode
- ✅ Használd a projekt logger-ét (`../utils/logger.js`), NE `console.log`-ot
- ✅ Async/await preferált a Promise.then() helyett
- ✅ Proper error handling minden async műveletnél
- ✅ JSDoc kommentek publikus API-khoz

```typescript
// ✅ Helyes
import { logger } from '../utils/logger.js';

async function fetchData(): Promise<Data> {
  try {
    const result = await api.getData();
    logger.info('Data fetched successfully');
    return result;
  } catch (error) {
    logger.error('Failed to fetch data', error);
    throw error;
  }
}

// ❌ Helytelen
function fetchData() {
  api.getData().then(result => {
    console.log('Got data:', result);
    return result;
  }).catch(err => console.error(err));
}
```

### Python

- ✅ Használj type hints-et
- ✅ Docstrings minden függvényhez
- ✅ PEP 8 követése
- ✅ Proper exception handling

```python
# ✅ Helyes
from typing import Optional

def process_data(input_data: str) -> Optional[dict]:
    """
    Process input data and return structured result.
    
    Args:
        input_data: Raw input string
        
    Returns:
        Processed data dict or None if invalid
    """
    try:
        result = parse(input_data)
        return result
    except ValueError as e:
        logger.error(f"Invalid input: {e}")
        return None
```

### Általános Szabályok

- 📏 Max 100 karakter sorhossz
- 🎯 Egy függvény = egy felelősség
- 📚 Kommentezz bonyolult logikát
- 🚫 Kerüld a "magic numbers"-t, használj konstansokat
- 🧪 Írj teszteket új funkcionalitáshoz
- 🔒 Ne commitolj semmilyen titokot (API kulcsok, jelszavak)

---

## 🛠️ Fejlesztési Környezet

### Előfeltételek

- Node.js 20+
- Python 3.11+
- pnpm 8+
- Git

### Telepítés

```bash
# Clone repository
git clone https://github.com/pohi99999/mcp-brunella-core.git
cd mcp-brunella-core

# Node.js dependencies
pnpm install

# Python dependencies
pip install -r requirements.txt

# Build
pnpm run build

# Run tests
pnpm test
```

### Fejlesztési parancsok

```bash
# Development mode
pnpm run dev

# Watch mode (auto-rebuild)
pnpm run watch

# Run CLI
pnpm run cli

# Run tests in watch mode
pnpm run test:watch

# Coverage
pnpm run test:coverage

# Build UI
pnpm run build:ui
```

---

## 🧪 Tesztelés

### Unit Tesztek

- Minden új funkció tesztekkel kell rendelkezzen
- Használj Vitest-et TypeScript/JavaScript tesztekhez
- Használj pytest-et Python tesztekhez

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm exec vitest run test/agents/DeveloperAgent.test.ts

# Run tests in watch mode
pnpm run test:watch

# Run with coverage
pnpm run test:coverage
```

### Teszt Írási Útmutató

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MyClass } from '../src/MyClass.js';

describe('MyClass', () => {
  let instance: MyClass;

  beforeEach(() => {
    instance = new MyClass();
  });

  it('should do something correctly', () => {
    const result = instance.doSomething();
    expect(result).toBe(expectedValue);
  });

  it('should handle errors gracefully', () => {
    expect(() => instance.throwError()).toThrow();
  });
});
```

---

## 📚 További Források

- [Project README](./README.md)
- [Architecture Documentation](./docs/)
- [API Documentation](./docs/api/)
- [Branch Cleanup Guide](./.github/branch-cleanup.md)

---

## 🤔 Kérdések?

Ha bármilyen kérdésed van:

1. Nézd meg a [dokumentációt](./docs/)
2. Keress a [GitHub Issues](https://github.com/pohi99999/mcp-brunella-core/issues)-ban
3. Nyiss új issue-t a kérdéseddel
4. Kérdezz a PR review során

---

## 📄 Licensz

A projekt hozzájárulásával egyetértesz azzal, hogy a hozzájárulásaid a projekt licensze alatt kerülnek felhasználásra.

---

**Köszönjük a hozzájárulást! 🎉**
