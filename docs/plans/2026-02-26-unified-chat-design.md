# Design Document: Brunella Unified Chat (Desktop & Mobile)

**Dátum:** 2026-02-26
**Státusz:** Validált
**Cél:** Egy natív Windows asztali alkalmazás és egy mobil-optimalizált webes felület létrehozása, amely szinkronizált, magyar nyelvű chatet biztosít az összes elérhető modellhez (GPT-4o, Gemini, Ollama, Cloudflare).

## 1. Architektúra

A rendszer három fő rétegből áll:

1. **Desktop (Horgony):** Tauri (Rust) keretrendszerbe csomagolt React Dashboard. Közvetlen elérés a helyi `mcp-brunella-core` API-hoz és a Windows Automation Bridge-hez.
2. **Edge (Híd):** Cloudflare Worker, amely kiszolgálja a mobil frontendet és egy **Cloudflare D1** adatbázisban tárolja a szinkronizált üzeneteket.
3. **Intelligence:** A PC-n futó Bifrost Gateway, amely kezeli a 18 Ollama modellt, a GitHub GPT-4o-t és a Geminit.

## 2. Komponensek és Adatfolyam

### Adatfolyam
- **Mobilról:** Üzenet -> CF Worker -> D1 Database -> PC (Polling) -> AI Feldolgozás -> Válasz mentése D1-be -> Mobil megjeleníti.
- **Asztalról:** Üzenet -> Helyi API -> AI Feldolgozás -> Válasz megjelenítése + Szinkronizálás D1-be.

### Hang-interakció (STT/TTS)
- **STT (Speech-to-Text):** Whisper modell a `VoiceAgent`-en keresztül.
- **TTS (Text-to-Speech):** Python `edge-tts` könyvtár a "Noemi" (magyar női) hanggal. A válaszok mellett egy "Lejátszás" gombbal indítható.

## 3. Felhasználói Felület (UI/UX)

- **Responsive Design:** 768px alatt automatikus váltás "Mobil Chat" nézetbe (Sidebar elrejtése).
- **Modellválasztó:** Globális fejlécben elérhető lista (Cloud vs Local modellek).
- **Állapotjelző:** Vizuális visszajelzés a PC és a Cloudflare közötti szinkronizáció állapotáról.

## 4. Biztonság és Megvalósítás

- **Hálózat:** Nincs szükség portnyitásra, a PC "húzza le" az adatokat a Cloudflare-ről.
- **Tauri:** Natív Windows `.exe` támogatás, tálcára kicsinyíthető mód, automatikus indítás opció.

## 5. Tesztelési Terv

- **UI:** Reszponzivitás tesztelése különböző képernyőméreteken.
- **Sync:** D1 írás/olvasás késleltetésének és integritásának ellenőrzése.
- **Audio:** Whisper felismerési pontosság és Edge-TTS hangminőség validálása.

---
*Ez a dokumentum a Brunella Agent System bővítésének alapköve.*
