# Projekt Munkafolyamat és Szabványok (Workflow)

> **Szerep:** A Fejlesztési Folyamat, Minőségbiztosítási Szabványok és Git Munkafolyamat elsődleges forrása (Source of Truth).

## 1. Vezérelvek

1.  **A Terv a Biblia:** Minden munkát a `plan.md`-ben kell követni.
2.  **A Tech Stack Szándékos:** A technológiai változtatásokat a `tech-stack.md`-ben kell dokumentálni a megvalósítás *előtt*.
3.  **TDD (Test-Driven Development):** Írj egységteszteket (unit tests) a funkcionalitás implementálása *előtt*.
4.  **Magas Kódlefedettség:** Célozd meg a **>80%** kódlefedettséget minden modulnál.
5.  **Felhasználói Élmény Elsőként:** Minden döntésnél a felhasználói élmény (UX) legyen az elsődleges szempont.
6.  **Interaktivitás Kerülése & CI-Tudatosság:** Preferáld a nem-interaktív parancsokat. Használd a `CI=true` beállítást a figyelő-módú (watch) eszközöknél.

---

## 2. Feladat Életciklus (Task Workflow)

Minden feladat szigorú életciklust követ.

### 2.1 Általános Feladat Folyamat

1.  **Feladat Kiválasztása:** Válaszd ki a következő elérhető feladatot a `plan.md`-ből.
2.  **Folyamatban Jelölés:** Frissítsd a `plan.md`-t (`[ ]` -> `[~]`).
3.  **🔴 Bukó Tesztek Írása (Piros Fázis):**
    *   Hozz létre egy új tesztfájlt.
    *   Írj teszteket, amelyek definiálják az elvárt működést.
    *   **KRITIKUS:** Győződj meg róla, hogy a tesztek elbuknak.
4.  **🟢 Implementálás (Zöld Fázis):**
    *   Írd meg a minimális kódot a tesztek teljesítéséhez.
    *   Erősítsd meg, hogy minden teszt zöld.
5.  **🔵 Refaktorálás:** Javítsd a kód szerkezetét a viselkedés megváltoztatása nélkül.
6.  **Lefedettség Ellenőrzése:** Biztosítsd a >80% lefedettséget.
7.  **Kód Változások Kommitolása:**
    *   Stage-eld a változásokat.
    *   Commit konvencionális üzenettel (pl. `feat(ui): ...`).
8.  **Feladat Összefoglaló Csatolása (Git Notes):**
    *   Írj egy összefoglalót (Mit változtattál? Miért?).
    *   `git notes add -m "<összefoglaló>" <commit_hash>`
9.  **Terv Frissítése:** Jelöld készre `[x]` a `plan.md`-ben és fűzd hozzá a commit SHA-t.

### 2.2 Fázis Lezárás és Checkpoint Protokoll

**Kiváltó ok:** Azonnal, miután befejeződik egy feladat, amely lezár egy fázist a `plan.md`-ben.

1.  **Protokoll Kezdésének Bejelentése**
2.  **Tesztlefedettség Biztosítása:** Ellenőrizd, hogy minden módosított fájlhoz tartozik-e teszt.
3.  **Automatizált Tesztek Futtatása:** Futtasd a teljes tesztcsomagot (`CI=true npm test`).
4.  **Manuális Ellenőrzési Terv:**
    *   Javasolj konkrét lépéseket a felhasználónak a funkcionalitás ellenőrzésére (pl. "Menj a localhost:3000-re...").
5.  **Felhasználói Visszajelzés Megvárása:** Ne lépj tovább kifejezett "Igen" nélkül.
6.  **Checkpoint Commit Létrehozása:** `conductor(checkpoint): Checkpoint end of Phase X`.
7.  **Ellenőrzési Jelentés Csatolása:** Használd a `git notes`-ot a jelentés csatolásához.
8.  **Terv Frissítése:** Jelöld a fázist készre `[checkpoint: <sha>]`.

---

## 3. Minőségbiztosítási Kapuk (Quality Gates)

Mielőtt bármilyen feladatot készre jelölsz, ellenőrizd:

- [ ] ✅ Minden teszt sikeres
- [ ] 📊 Kódlefedettség >80%
- [ ] 📝 A kód követi a stílusirányzatokat
- [ ] 📚 Publikus függvények dokumentálva vannak
- [ ] 🛡️ Típusbiztonság (Type safety) kényszerítve van
- [ ] 🧹 Nincsenek linter hibák
- [ ] 📱 Mobil reszponzivitás (ha releváns)

---

## 4. Fejlesztői Parancsok

*Adaptáld a projekt specifikumaihoz.*

### Telepítés (Setup)
```bash
npm install
```

### Napi Fejlesztés
```bash
npm run dev     # Szerver indítása
npm test        # Tesztek futtatása
npm run lint    # Linter futtatása
```

### Commit Előtt (Pre-Commit)
```bash
npm run check   # Minden ellenőrzés futtatása
```

---

## 5. Tesztelési Stratégia

### Egységtesztelés (Unit Testing)
- Minden modulhoz kell teszt.
- Külső függőségek mockolása.
- Sikeres és sikertelen ágak tesztelése.

### Integrációs Tesztelés
- Teljes felhasználói folyamatok tesztelése.
- Adatbázis tranzakciók ellenőrzése.

### Mobil Tesztelés
- Reszponzív elrendezés és érintés (touch) interakciók ellenőrzése.

---

## 6. Commit Irányelvek

### Üzenet Formátum
```
<típus>(<hatókör>): <leírás>
```

### Típusok
- `feat`: Új funkció
- `fix`: Hibajavítás
- `docs`: Dokumentáció
- `style`: Formázás
- `refactor`: Kód átszervezés
- `test`: Tesztek hozzáadása
- `chore`: Karbantartás

**Példák:**
- `feat(auth): Emlékezz rám funkció hozzáadása`
- `fix(core): Null válasz kezelése`

---

## 7. A "Kész" Definíciója (Definition of Done)

Egy feladat akkor van kész, ha:
1.  A kód implementálva van & a tesztek futnak.
2.  Lefedettség >80%.
3.  Linter ellenőrzések sikeresek.
4.  `plan.md` frissítve van a jegyzetekkel és SHA-val.
5.  Git note csatolva van.

---

## 8. Vészhelyzeti Eljárások

### Kritikus Hiba Élesben (Production)
1.  Hotfix branch létrehozása.
2.  **Írj egy bukó tesztet.**
3.  Javítás & Deploy.
4.  Dokumentálás a tervben.

### Biztonsági incidens
1.  Titkok (secrets) azonnali cseréje.
2.  Sérülékenység javítása (patch).
3.  Értesítés és Dokumentálás.

