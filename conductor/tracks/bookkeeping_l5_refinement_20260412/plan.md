# Plan — Könyvelési Automatizálás L5 Finomítás

## Fázisok

### 1. IMAP & Email Intake (WF-7)
- [ ] IMAP folyamat tesztelése éles Gmail App Password-del.
- [ ] Mellékletek (számlák) automatikus mentése a `data/inbox` mappába.
- [ ] OCR/Vision ágens integrálása a beérkező PDF-ek felismeréséhez.

### 2. Hibakezelés & Visszacsatolás
- [ ] Számlázz.hu hibakódok (pl. 57 - XML hiba) automatikus diagnosztizálása.
- [ ] Automatikus fix-javaslatok generálása az ágens által.

### 3. Dashboard & Üzleti Intelligencia
- [ ] Pénzügyi widgetek (bevételek, függő számlák) bekötése az SQLite adatok alapján.
- [ ] Exportálható havi összesítők (Excel/PDF) generálása.
