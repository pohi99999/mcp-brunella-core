# Heti Kontextus Csomag

**Dátum:** {{report_date}}  
**Időszak:** {{period_start}} → {{period_end}}  
**Forrás:** Airtable + n8n  
**Cél:** Heti vezetői és operatív kontextus Claude számára  

---

## 1. Vezetői összkép

- Aktív projektek száma: **{{active_project_count}}**
- Késésben lévő projektek száma: **{{delayed_project_count}}**
- Magas prioritású nyitott feladatok száma: **{{high_priority_task_count}}**
- Szabadságon lévő munkatársak: **{{vacation_count}}**
- Előző heti összes munkaidő: **{{weekly_hours_total}} óra**
- Ajánlati pipeline összértéke: **{{pipeline_total_huf}} Ft**

---

## 2. Aktív projektek

| Projekt | Státusz | Késés (nap) | Felelős | Nyitott feladat | Határidő |
| --- | --- | ---: | --- | ---: | --- |
{{active_projects_table}}

---

## 3. Kritikus projektek

### 30+ napos késések
{{critical_delays_list}}

### Számlázásra váró / pénzügyileg sürgős elemek
{{billing_waiting_list}}

### Gazdátlan vagy blokkolt projektek
{{blocked_projects_list}}

---

## 4. Magas prioritású feladatok

| Feladat | Felelős | Projekt | Státusz | Határidő |
| --- | --- | --- | --- | --- |
{{high_priority_tasks_table}}

---

## 5. Munkatárs elérhetőség

| Név | Beosztás | Leterheltség % | Szabadság | Megjegyzés |
| --- | --- | ---: | --- | --- |
{{staff_availability_table}}

---

## 6. Előző heti munkaidő

| Név | Óraszám | Fő projekt |
| --- | ---: | --- |
{{weekly_hours_table}}

---

## 7. Pénzügyi pipeline

- Ajánlati pipeline összértéke: **{{pipeline_total_huf}} Ft**
- Gyorsan zárható bevételi lehetőségek:
{{revenue_opportunities_list}}

---

## 8. Claude számára ajánlott kérdések

- Milyen legyen a jövő heti munkarend?
- Melyik projektekre kell most fókuszálni?
- Ki túlterhelt, és ki vállalhat még feladatot?
- Hol vannak a legsürgősebb pénzügyi prioritások?
- Mi legyen a jövő hét top 3 vezetői fókusza?
