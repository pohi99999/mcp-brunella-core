# Spec — Pohánka freelancer terjeszkedés és profilrendszer

## Feladat összefoglalója

A `terv.md` alapján a Pohánka & Társa Kft. számára egy magyar fókuszú freelancer és B2B terjeszkedési rendszert kell felépíteni. A track célja nem új termék fejlesztése, hanem egy jól csomagolt, mérhető és Brunella-támogatott piacra lépési rendszer.

---

## Főbb megállapítások

### Website és pozicionálás
- A jelenlegi weboldal erős technikai alapot ad.
- A szolgáltatáslista túl széles, ezért productized offer irányba kell szűkíteni.
- A legerősebb első pozicionálás: **AI automatizáció + weboldalak + üzleti workflow-k KKV-knak**.

### Piaci fókusz
- **P1:** LinkedIn
- **P1:** Malt
- **P1:** Upwork
- **P2:** helyi Facebook csoportok és vállalkozói közösségek
- **P2:** partnerügynökségek
- **P3:** Freelancer.com, Fiverr, Profession.hu / CVonline
- **P3:** Product Hunt / IndieHackers későbbi showcase célra

### Brunella szerepe
- lead lista generálás
- profil copy draft
- outreach draft
- content repurpose
- follow-up emlékeztetők
- egyszerű csatorna-mérés

---

## Scope

### Benne van
- Magyar freelancer platform térkép
- Profil sablon LinkedIn / Upwork / Malt csatornákra
- Beállítási lépések és asset checklist
- Brunella workflow-k a lead-gen és content terjesztés támogatására
- Launch és mérési terv

### Nincs benne
- Teljes website redesign
- Fizetett hirdetési kampány
- Jogi állásfoglalás az outreach megfelelőségről
- Új SaaS termék implementáció
- Automatizált outreach emberi jóváhagyás nélkül

---

## Elfogadási kritériumok

1. Készen áll egy magyar fókuszú platformmátrix prioritási sorrenddel.
2. Van egy másolható profil sablon headline / about / CTA blokkokkal.
3. Van egy platformonként testreszabható beállítási checklist.
4. Van Brunella-alapú lead/content/outreach workflow terv.
5. Van launch sorrend és mérési logika.
6. A conductor track `active` állapotban van, a `plan.md` és `spec.md` kész.

---

## Delegálási térkép

| Feladat | Javasolt agent | Megjegyzés |
|---|---|---|
| Profil copy és CTA | `copywriter` | Headline, About, CTA, short bio |
| Content calendar és posztvázlatok | `CampaignGeneratorAgent` | Weboldalból social repurpose |
| Lead lista és enrichment | `LeadMiningAgent` | Magyar KKV és partner listák |
| Outreach és follow-up draft | `SalesHunterAgent` | Human-in-loop kötelező |
| Weboldal / landing finomhangolás | `bas-web-architect` | Ha a profilhoz külön landing kell |

---

## Handoff / aktuális állapot

- A stratégiai alapot a `.worktrees/terjeszkedés/terv.md` dokumentum tartalmazza.
- Ez a conductor track a platformtérképet, a profilrendszert és a Brunella által támogatott terjesztést viszi tovább.
- Következő lépés: a profilcopy és a launch checklist finomhangolása, majd publikálás.
