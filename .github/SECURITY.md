# 🔒 Biztonsági Irányelvek

## 🚨 Biztonsági sérülékenység jelentése

Ha biztonsági sérülékenységet találsz a projektben, kérlek **NE** nyiss publikus issue-t!

### Jelentési folyamat:

1. **Privát jelentés** a GitHub Security fül alatt:
   👉 [Report a vulnerability](https://github.com/pohi99999/mcp-brunella-core/security/advisories/new)

2. **Email**: Küldj részletes leírást a repository tulajdonosának

3. **Várt válaszidő**: 48 órán belül reagálunk

## 🛡️ Biztonsági Eszközök

A projekt a következő biztonsági eszközöket használja:

### ✅ GitHub Code Scanning (CodeQL)

- **Státusz**: Konfigurálva ✅ (aktiválás szükséges)
- **Lefedi**: Python, JavaScript/TypeScript
- **Futás**: Minden push, PR, és hétfőnként ütemezetten
- **Setup útmutató**: [CODEQL_SETUP.md](.github/CODEQL_SETUP.md)

### 🔍 Ellenőrzött területek:

#### Biztonsági sérülékenységek:
- ❌ Code injection (CWE-94)
- ❌ SQL injection (CWE-89)
- ❌ XPath injection (CWE-643)
- ❌ Path traversal (CWE-22)
- ❌ Gyenge kriptográfia (CWE-327)
- ❌ Insecure cookies (CWE-614)
- ❌ Stack trace exposure (CWE-209)

#### Kód minőség:
- ⚠️ Import problémák
- ⚠️ Exception kezelés
- ⚠️ Unused imports
- ⚠️ Code smells

## 📋 Biztonsági Checklist

### Fejlesztőknek:

- [ ] **Soha ne commit-olj** API kulcsokat, jelszavakat, tokeneket
- [ ] Használj **környezeti változókat** érzékeny adatokhoz
- [ ] **Validáld** minden user input-ot
- [ ] Használj **parameterized queries**-t SQL injection ellen
- [ ] **Escapeld** output-ot XSS ellen
- [ ] Használj **strong crypto** algoritmusokat (SHA-256+, nem MD5/SHA-1)
- [ ] **Ellenőrizd** a dependency-ket (Dependabot)
- [ ] **Korlátozd** a file upload típusokat és méreteket
- [ ] Használj **secure cookies** (HttpOnly, Secure, SameSite)

### Pull Request Review:

- [ ] Code Scanning eredmények ellenőrzése
- [ ] Új dependency-k biztonsági vizsgálata
- [ ] Érzékeny adatok kezelésének felülvizsgálata
- [ ] Error handling megfelelőségének ellenőrzése

## 🔧 Függőség kezelés

### Javasolt eszközök:

- **Dependabot**: Automatikus dependency update-ek
- **pip-audit**: Python dependency security scanning
- **npm audit**: JavaScript dependency security scanning

### Update policy:

- **Security patch-ek**: Azonnal
- **Minor version-ök**: Hetente
- **Major version-ök**: Code review után

## 📊 Biztonsági Riportok

A biztonsági scan eredmények elérhetők:
👉 https://github.com/pohi99999/mcp-brunella-core/security

### Észlelt hibák kezelése:

1. **Critical/High**: Azonnal javítandó
2. **Medium**: 7 napon belül
3. **Low**: Következő sprint-ben

## 🔐 Kriptográfia

### Elfogadott algoritmusok:

✅ **Hash-elés**:
- SHA-256, SHA-384, SHA-512
- bcrypt, scrypt, Argon2 (jelszavakhoz)

❌ **NE használd**:
- MD5
- SHA-1
- DES, 3DES

✅ **Titkosítás**:
- AES-256
- RSA 2048+ bit
- ChaCha20-Poly1305

## 📞 Kapcsolat

- **Security issues**: GitHub Security Advisories
- **Általános kérdések**: GitHub Issues
- **Sürgős ügyek**: Repository owner

---

**Utolsó frissítés**: 2026-02-15  
**Verzió**: 1.0
