# KKV HR leave wait/resume orchestration

- [x] Manager approval wait/resume decision endpoint a leave jobhoz.
- [x] Approval döntés visszaírása a `business_jobs` rekordba.
- [x] Naptár esemény létrehozás retry-val és audit nyommal approve esetén.
- [x] Reject / approve / calendar-failure regression tesztek.
- [x] Rövid, explicit API dokumentáció a route kommentekben.

Kimenet: a leave request pending marad manager approvalig, majd resume után auditálva és visszakereshetően folytatódik.
