# KKV HR leave wait/resume orchestration

1. Manager approval wait/resume webhook vagy callback flow.
2. Approval döntés visszaírása a business_jobs rekordba.
3. Naptár esemény megerősítés és retry/rollback logika.
4. Reject / approve edge case tesztek.
5. Rövid runbook a support és HR csapatnak.

Kimenet: a leave request valóban megáll manager approvalnál, majd resume után auditálva és visszakereshetően folytatódik.
