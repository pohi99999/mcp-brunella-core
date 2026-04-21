# Proaktív Kódíró Ügynök - Gyors Indítás

## 🚀 Indítás

### 1. Környezeti Változók Beállítása

```powershell
cd "G:\Brunella\[ACTIVE]_Agents\ready-agents\agents-chat"
$env:GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY_HERE"
$env:WORKSPACE_ROOT="G:\Brunella"
```

### 2. Ügynök Indítása

```powershell
uv run adk web app.coding_assistant_agent --port=8504
```

**URL**: http://localhost:8504

## 💡 Használati Példák

### Chat felületen keresztül:

1. **"Olvasd be a README.md fájlt"**
   - Az ügynök használja a `read_file` eszközt

2. **"Hozz létre egy új fájlt: test.py"**
   - Az ügynök használja a `write_file` eszközt

3. **"Listázd ki a projekt fájljait"**
   - Az ügynök használja a `list_directory` eszközt

4. **"Keresd meg az összes Python fájlt"**
   - Az ügynök használja a `search_files` eszközt

5. **"Milyen változások vannak a git-ben?"**
   - Az ügynök használja a `git_status` eszközt

## 🛠️ Elérhető Eszközök

- `read_file` - Fájlok olvasása
- `write_file` - Fájlok írása
- `list_directory` - Könyvtárak listázása
- `create_directory` - Könyvtárak létrehozása
- `search_files` - Fájlok keresése
- `git_status` - Git státusz
- `git_commit` - Git commit

## 📚 További Információ

- **Részletes útmutató**: `PROAKTIV_KODIRO_UGYNOK_GUIDE.md`
- **Integrációs útmutató**: `INTEGRACIOS_UTMUTATO.md`


