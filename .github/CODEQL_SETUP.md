# 🔒 CodeQL Code Scanning Aktiválási Útmutató

## ⚠️ FONTOS: A Code Scanning még nincs aktiválva!

A CodeQL workflow már be van állítva, de a GitHub Code Scanning funkció nincs engedélyezve a repository-ban.

## 📝 LÉPÉSEK AZ AKTIVÁLÁSHOZ

### 1️⃣ **Engedélyezd a Code Scanning-et**

1. Menj a repository Settings oldalára:
   👉 https://github.com/pohi99999/mcp-brunella-core/settings/security_analysis

2. Görgess le a **"Code scanning"** szekcióhoz

3. Kattints az **"Enable"** vagy **"Set up"** gombra

4. **VAGY** használd a "Advanced" opciót, és válaszd ki a már meglévő `.github/workflows/codeql.yml` workflow-t

### 2️⃣ **Ellenőrizd a beállításokat**

A workflow automatikusan:
- ✅ Minden `main` branch push-nál fut
- ✅ Minden pull request-nél fut
- ✅ Hétfőnként 6:00 UTC-kor fut ütemezetten
- ✅ Python és JavaScript/TypeScript kódot elemez
- ✅ Security-extended és quality query-ket használ

### 3️⃣ **Futtasd az első scan-t**

Miután engedélyezted:

```bash
# Kézzel indítsd el a workflow-t
gh workflow run codeql.yml
```

**VAGY**

- Menj a Actions fülre
- Válaszd ki a "CodeQL Analysis" workflow-t
- Kattints a "Run workflow" gombra

### 4️⃣ **Nézd meg az eredményeket**

Az eredmények itt jelennek meg:
👉 https://github.com/pohi99999/mcp-brunella-core/security/code-scanning

## 🛠️ MI TÖRTÉNIK A HÁTTÉRBEN?

A CodeQL workflow:

1. **Kiolvassa a kódot** a repository-ból
2. **Elemzi** a Python és JavaScript/TypeScript fájlokat
3. **Keres** biztonsági réseket, bug-okat, code quality problémákat
4. **Feltölti** az eredményeket a GitHub Security fülre

## 🔍 MILYEN HIBÁKAT TALÁL?

### Biztonsági problémák:
- ❌ Code injection sebezhetőségek
- ❌ SQL injection lehetőségek
- ❌ XPath injection
- ❌ Gyenge kriptográfiai algoritmusok
- ❌ Nem biztonságos cookie beállítások
- ❌ Stack trace exposure

### Kód minőségi problémák:
- ⚠️ Körkörös importok (cyclic imports)
- ⚠️ Nem használt importok
- ⚠️ Syntax errorok
- ⚠️ Hiányzó exception kezelés
- ⚠️ Nem optimális kód szerkezet

## 📊 STÁTUSZ BADGE

Miután aktiváltad, add hozzá ezt a badge-et a README.md-hez:

```markdown
[![CodeQL](https://github.com/pohi99999/mcp-brunella-core/workflows/CodeQL%20Analysis/badge.svg)](https://github.com/pohi99999/mcp-brunella-core/actions/workflows/codeql.yml)
```

## 🚨 HIBAELHÁRÍTÁS

### "Code scanning is not enabled" hiba

**Megoldás:**
- Menj a Settings → Security → Code scanning
- Kattints az Enable gombra

### Workflow timeout

**Megoldás:**
- A `timeout-minutes` jelenleg 30 perc
- Ha szükséges, növeld a `.github/workflows/codeql.yml` fájlban

### "Failed to find module" figyelmeztetések

**Megoldás:**
- Ezek NEM kritikus hibák
- A CodeQL csak jelzi, hogy néhány relatív import nem oldható fel
- A security scan ettől működik

## 🔗 HASZNOS LINKEK

- [GitHub Code Scanning dokumentáció](https://docs.github.com/en/code-security/code-scanning)
- [CodeQL dokumentáció](https://codeql.github.com/docs/)
- [Security best practices](https://docs.github.com/en/code-security/getting-started/securing-your-repository)

## 💡 TIPP

Állítsd be a **Dependabot**-ot is a teljes security coverage-hez:
👉 https://github.com/pohi99999/mcp-brunella-core/settings/security_analysis

---

**Kérdés van? Nézd meg a Security fül alatt a Code Scanning alerts-et az aktiválás után!** 🔐
