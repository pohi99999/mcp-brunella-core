# Specifikáció: Error Handling Standardization

## 🎯 Célkitűzés
A Brunella Agent System hibakezelési mechanizmusainak standardizálása. A cél a bizonytalan típusú hibaobjektumok (`catch (e: any)`) megszüntetése, a hibaüzenetek informatívabbá tétele és a hibák elnémításának (silent swallow) tiltása.

## ⚠️ Jelenlegi Probléma
- Generikus `catch (e: any)` használata, ami elrejti a hiba valódi okát.
- `/* non-critical */` megjegyzéssel elnémított catch blokkok a tudásbázis és egyéb modulokban.
- Nincs egységes formátum a hibák "becsomagolására" (error wrapping) a modulok között.

## ✅ Elvárt Állapot
- Minden catch blokk `(error: unknown)` formátumot használ.
- A hibaobjektumok biztonságos kinyerése (`instanceof Error` ellenőrzéssel).
- Minden hiba (még a "nem kritikus" is) naplózásra kerül legalább `logDebug` szinten.
- Egységes hiba válaszformátum az Agenteknél és az API végpontoknál.

## 🛠️ Technikai Követelmények
- Használd az `utils/logger.ts` hívásokat a catch blokkokban.
- Implementálj egy `ensureError(e: unknown): Error` helper függvényt.
- Kövesd a `BaseAgent` hibakezelési mintáját mindenhol.
