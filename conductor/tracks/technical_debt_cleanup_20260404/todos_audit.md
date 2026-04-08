# TODO Audit - Technical Debt Cleanup

## 📊 Összesítés
- **Összes azonosított TODO:** 25+
- **Azonnal javítandó:** 5
- **Track szükséges:** 15
- **Törölhető / Elavult:** 5

## 🔴 Azonnal javítandó (Quick Fixes)
- [ ] `src/core/worker_thread_executor.ts:76` - CPU tracking implementálása (alap szinten).
- [ ] `src/server/routes/githubWebhook.ts:156` - Granulárisabb hiba követés.
- [ ] `src/dashboard/components/cean/CEANNavBar.tsx:37` - Logout handler pótlása.
- [ ] `src/dashboard/components/cean/components/PipelineVisualizer.tsx:263` - Node selection click handling.
- [ ] `src/server/routes/enterprise.ts:256` - TaskQueueManager integráció a history-hoz.

## 🟡 Track szükséges (Complex Tasks)
- [ ] **[security_hardening]** `src/core/securityEventsMonitor.ts:230, 235` - Notification és Blocking mechanizmus.
- [ ] **[jules_integration_phase3]** `src/core/julesIntegration.ts:73` - Jules API küldés Phase 3.3.2.
- [ ] **[dataset_monitoring]** `src/core/goldenDatasetBridge.ts:470` - Training run-ok követése D1-ben.
- [ ] **[logistics_email_integration]** `src/agents/LogisticsDispatcherAgent.ts:339` - Gmail API integráció.
- [ ] **[dynamic_surveys]** `src/agents/IntakeSurveyAgent.ts:5` - Dinamikus dokumentum követelmények.
- [ ] **[enterprise_intelligence]** `src/agents/EnterpriseOrchestratorAgent.ts:332, 440, 476` - Entity extraction, LanceDB storage és monitoring.
- [ ] **[fuzzy_matching_upgrade]** `src/agents/AdvancedMatchingAgent.ts:106` - Semantic/Fuzzy partner match.
- [ ] **[market_data_integration]** `src/agents/PropertyResearchAgent.ts:5, 88, 102` - Valós piaci adatok és kockázatelemzés.

## ⚪ Törölhető / Elavult
- [ ] `src/utils/accountingKbIngest.ts:47` - "detektálni kiterjesztés alapján" (ha már automatikusan kezelve van).
- [ ] `src/p-sales-standalone/tenant.config.ts:10` - "switch to clerk" (ha a projekt marad local auth-on).
- [ ] `src/agents/codeScaffold.ts` - A scaffold TODO-k nagy része törölhető, ha az adott agent már implementálva van.

## 📝 Megjegyzés
A megmaradó TODO-kat kiegészítettem a javasolt Track ID-val vagy kategóriával.
