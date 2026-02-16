# VS Code Insiders - GitHub Copilot Pro+ és MCP Szerverek Beállítása

**Utolsó frissítés:** 2026-02-16

## ✅ Elkészült Konfiguráció

### 📍 Fájlok Helye

- **MCP Konfiguráció:** `C:\Users\pohi9\AppData\Roaming\Code - Insiders\User\mcp.json`
- **VS Code Beállítások:** `C:\Users\pohi9\AppData\Roaming\Code - Insiders\User\settings.json`

---

## 🚀 Konfigurált MCP Szerverek

| Szerver | Típus | Funkció |
|---------|-------|---------|
| **github** | HTTP (Remote) | GitHub Copilot Chat + GitHub API művele tek |
| **brunella-core** | Stdio | Saját MCP szerver (Node.js) |
| **brunella-python** | Stdio | Python AI backend (FastAPI) |
| **filesystem** | Stdio | Fájl műveletek (F:\, G:\, C:\Users) |
| **windows-manager** | Stdio | Windows PC kezelés és beállítások |
| **playwright** | Stdio | Web scraping és böngésző automatizálás |
| **sqlite** | Stdio | Brunella adatbázis hozzáférés |
| **memory** | Stdio | Hosszútávú memória kezelés |

---

## 🎯 GitHub Copilot Pro+ Előnyök

### Elérhető Funkciók

✅ **1500 Premium LLM hívás havonta**
- GPT-4o
- Claude 3.5 Sonnet
- Gemini Pro

✅ **Végtelen GPT-4o használat** (Agent mode-ban)

✅ **GitHub Copilot Chat**
- Inline code suggestions
- Chat panel (`Ctrl + I`)
- Quick chat (`Ctrl + Shift + I`)

✅ **Agent Mode** (MCP Tool Access)
- GitHub API műveletek
- Repository kezelés
- Issue és PR automatizálás
- CI/CD workflow monitoring

---

## 📝 Használati Útmutató

### 1. VS Code Insiders Indítása

```bash
# Indítsd VS Code Insiders-t a Brunella projektben
cd F:\mcp-brunella-core
code-insiders .
```

### 2. Agent Mode Aktiválása

1. Nyisd meg a **Copilot Chat** panelt (`Ctrl + Shift + I`)
2. Kattints az **Agent Mode** ikonra (robot ikon a text input mellett)
3. Ellenőrizd hogy az MCP szerverek csatlakozva vannak:
   - Zöld pötty = Működik ✅
   - Piros pötty = Hiba ❌

### 3. GitHub MCP Szerver Használata

**Példa parancsok:**

```
@github List my repositories

@github Show open issues in mcp-brunella-core

@github Create a PR from current branch

@github Analyze workflow runs

@github Search code for "HeartbeatMonitor"
```

### 4. Brunella MCP Szerverek Használata

**Brunella Core:**
```
@brunella-core List all available tools

@brunella-core Execute agent task: "Create a health check report"
```

**Brunella Python:**
```
@brunella-python Execute Python code to analyze data

@brunella-python Run LangGraph orchestration
```

### 5. Windows Manager

```
@windows-manager List running processes

@windows-manager Get system info

@windows-manager Execute PowerShell command
```

### 6. Playwright Böngészés

```
@playwright Navigate to https://example.com and extract data

@playwright Take screenshot of dashboard

@playwright Fill form and submit
```

---

## 🔧 Hibaelhárítás

### MCP Szerver Nem Csatlakozik

1. **Ellenőrizd a Node.js build-et:**
   ```bash
   cd F:\mcp-brunella-core
   npm run build
   ```

2. **Ellenőrizd a Python szervert:**
   ```bash
   cd F:\mcp-brunella-core\myai
   python -m myai.mcp_server
   ```

3. **Indítsd újra VS Code Insiders-t:**
   - `Ctrl + Shift + P` → "Reload Window"

### GitHub Copilot Nem Működik

1. **Ellenőrizd a bejelentkezést:**
   - `Ctrl + Shift + P` → "GitHub Copilot: Sign In"

2. **Ellenőrizd a subscription-t:**
   - `Ctrl + Shift + P` → "GitHub Copilot: Check Status"

3. **GitHub PAT frissítése:**
   - Frissítsd a PAT-ot a `mcp.json` fájlban
   - Indítsd újra VS Code-ot

### Agent Mode Nem Elérhető

- **Követelmény:** VS Code Insiders **1.101+** verzió
- Ellenőrizd: `Help → About` (verzió szám)
- Frissítsd ha szükséges: `Help → Check for Updates`

---

## 🎨 Ajánlott Kiegészítők

Telepítsd ezeket a VS Code Insiders extension-öket:

```bash
# GitHub Copilot (KÖTELEZŐ)
code-insiders --install-extension GitHub.copilot

# GitHub Copilot Chat (KÖTELEZŐ)
code-insiders --install-extension GitHub.copilot-chat

# Hasznos kiegészítők
code-insiders --install-extension ms-python.python
code-insiders --install-extension dbaeumer.vscode-eslint
code-insiders --install-extension esbenp.prettier-vscode
```

---

## 📊 Monitorozás és Használat

### GitHub Copilot Használat Ellenőrzése

1. Nyisd meg: `https://github.com/settings/copilot`
2. Nézd meg az **Usage** fület
3. Ellenőrizd a havi limitet:
   - Premium hívások: **1500 / hónap**
   - GPT-4o (Agent): **Végtelen** ✅

### MCP Szerver Státusz

```bash
# Backend health check
curl http://localhost:3000/api/health

# Python backend health check
curl http://localhost:8010/health

# Heartbeat monitor status
curl http://localhost:3000/api/phoenix/heartbeat
```

---

## 🚀 Következő Lépések

1. ✅ **Indítsd el VS Code Insiders-t**
2. ✅ **Aktiváld Agent Mode-ot**
3. ✅ **Teszteld a GitHub MCP szervert**
4. ✅ **Használd a Copilot Chat-et kódoláshoz**
5. ✅ **Kihasználd a 1500 premium hívást és végtelen GPT-4o-t!**

---

## 📚 További Dokumentáció

- [GitHub MCP Server Docs](https://github.com/github/github-mcp-server)
- [VS Code MCP Support](https://code.visualstudio.com/docs/copilot/copilot-mcp)
- [GitHub Copilot Pro+](https://docs.github.com/en/copilot)

---

**Élvezd a hatékony fejlesztést! 🎉**
