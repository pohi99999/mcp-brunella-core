# Projekt Könyvtárfa

**Generálva:** 2026-03-28T01:35:09.615Z
**Generátor:** ProjectConductorAgent

---

```
├── ADR/
│   ├── 0001-living-documentation-system.md
│   ├── 0002-embedding-standard-mxbai-with-legacy-fallback.md
│   └── README.md
├── AIDER.md
├── analyze.js
├── AnythingLLM
├── aranyfolyam.md
├── archive/
│   ├── build-cache/
│   │   └── coverage/
│   ├── ide-metadata/
│   ├── legacy-archive/
│   │   ├── Böngésző vezérlés/
│   │   ├── conductor/
│   │   ├── deleted_files/
│   │   ├── docs/
│   │   └── reports/
│   ├── mcp-brunella-core-UIX/
│   │   ├── components.json
│   │   ├── index.html
│   │   ├── LICENSE
│   │   ├── package-lock.json
│   │   ├── package.json
│   │   ├── PRD.md
│   │   ├── README.md
│   │   ├── runtime.config.json
│   │   ├── SECURITY.md
│   │   ├── spark.meta.json
│   │   ├── src/
│   │   ├── tailwind.config.js
│   │   ├── theme.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── workflow.md
│   ├── old-projects/
│   │   ├── external_research/
│   │   ├── mcp-brunella-core-UIX/
│   │   ├── open-interpreter/
│   │   └── testing/
│   ├── temp-data/
│   │   └── files/
│   └── test-artifacts/
│   │   └── playwright-report/
├── audit-results.json
├── bas-cloudflare-orchestrator/
│   ├── client/
│   │   └── bas_client.py
│   ├── cloudflared/
│   │   ├── config.yml
│   │   └── README.md
│   ├── docker-compose.yml
│   ├── GEMINI.md
│   ├── GEMINI_CLI_INSTRUCTIONS.md
│   ├── INSTALL_AND_TEST_GUIDE.md
│   ├── langflow/
│   │   ├── bas-orchestrator-agent.json
│   │   ├── bas-research-agent.json
│   │   ├── code-agent.json
│   │   ├── orchestrator-agent.json
│   │   ├── README.md
│   │   ├── research-agent.json
│   │   └── SETUP.md
│   ├── local/
│   │   ├── browser_use_api.py
│   │   ├── Dockerfile.browseruse
│   │   └── requirements.txt
│   ├── migrations/
│   │   ├── 0001_chat_sync.sql
│   │   ├── 0001_initial_schema.sql
│   │   └── 0002_task_analytics.sql
│   ├── n8n/
│   │   ├── bas-task-handler-workflow.json
│   │   └── bas-task-handler.json
│   ├── package-lock.json
│   ├── package.json
│   ├── README.md
│   ├── run-tests.ps1
│   ├── setup-complete.ps1
│   ├── setup.ps1
│   ├── src/
│   │   ├── analyticsEngine.ts
│   │   ├── browser.ts
│   │   ├── chat-sync-stub.ts
│   │   ├── index.ts
│   │   ├── queueHandler.ts
│   │   ├── r2Artifacts.ts
│   │   └── swarmCoordinator.ts
│   ├── TEST_RESULTS.md
│   ├── tsconfig.json
│   ├── VECTORIZE_POC.md
│   └── wrangler.jsonc
├── BEVETEL_AKCIO.md
├── bin/
│   └── cloudflared.exe
├── BOOTSTRAP.md
├── BOVITMENY.md
├── Brunella
├── Brunella.jpg
├── Brunella.md
├── BRUNELLA_MASTER_CONTEXT.md
├── BRUNELLA_START.bat
├── build-errors.txt
├── build-output.log
├── build-result.txt
├── capture-tests.cjs
├── capture-tests2.cjs
├── check_schema.py
├── CLAUDE.md
├── cloudflare/
│   ├── migrations/
│   │   └── 0000_schema.sql
│   ├── package-lock.json
│   ├── package.json
│   ├── src/
│   │   ├── edge-coordinator.ts
│   │   ├── index.ts
│   │   ├── lead-intelligence.ts
│   │   ├── types.ts
│   │   └── workflows/
│   ├── tsconfig.json
│   ├── wrangler.jsonc
│   └── wrangler.lead-intelligence.jsonc
├── cloudflare.md
├── cloudflareversup.md
├── conductor/
│   ├── archive/
│   │   ├── 006_trojan-horse-campaign/
│   │   ├── agent_architect_upgrade_20260205/
│   │   ├── agent_diagnostics_routing_modernization_20260323/
│   │   ├── agent_loader_modernization_20260323/
│   │   ├── agent_memory_structured_20260323/
│   │   ├── agent_orchestration_dag_20260323/
│   │   ├── aider_integration_20260222/
│   │   ├── ai_recommendation_system_20260216/
│   │   ├── apify_deep_scraping_agent_20260223/
│   │   ├── basic-test-task-structure-20260219/
│   │   ├── bas_comprehensive_test_protocol_20260210/
│   │   ├── bas_enterprise_suite/
│   │   ├── bas_orchestration_chain_20260221/
│   │   ├── bas_security_sandbox_20260221/
│   │   ├── browser_use_harvester_20260131/
│   │   ├── brunella_cli_init_20260120/
│   │   ├── campaign-generator-agent-20260225/
│   │   ├── cean_operations_center_ui_20260215/
│   │   ├── cean_phase2_c_prometheus_20250216/
│   │   ├── cean_phase_2_fleet_management_20260215/
│   │   ├── cf_analytics_engine_20260323/
│   │   ├── cf_durable_object_migrations_20260323/
│   │   ├── cf_hyperdrive_d1_20260323/
│   │   ├── cf_queues_task_distribution_20260323/
│   │   ├── cf_r2_activation_20260323/
│   │   ├── cf_r2_artifact_storage_20260323/
│   │   ├── cf_token_permissions_fix_20260323/
│   │   ├── cf_workers_ai_models_20260323/
│   │   ├── cf_workflows_orchestration_20260323/
│   │   ├── chrome_acp_integration_20260323/
│   │   ├── chrome_devtools_mcp_agent_20260223/
│   │   ├── cloudflare-chat-integration-20260211/
│   │   ├── cloudflare-iteration-2-20260212/
│   │   ├── cloudflare_browser_rendering_robotkez_20260221/
│   │   ├── cloudflare_d1_kv_storage_20260221_archived_20260222/
│   │   ├── cloudflare_edge_agents_network_20260215/
│   │   ├── cloudflare_edge_integration_20260202/
│   │   ├── cloudflare_full_optimization_20260325/
│   │   ├── cloudflare_vectorize_rag_20260221/
│   │   ├── cloudflare_workers_ai_20260221/
│   │   ├── cloudflare_workers_audit_20260221/
│   │   ├── codex_chat_refactor_20260212/
│   │   ├── code_quality_improvements_20260210/
│   │   ├── CONDUCTOR_MANIFEST_backup_20260204.md
│   │   ├── CONDUCTOR_MANIFEST_old.md
│   │   ├── creative_friction_mediator_20260212/
│   │   ├── cserszegtomaj-campaign-20260225/
│   │   ├── dashboard-500-and-test-timeouts-20260320/
│   │   ├── dashboard-integration_20260120/
│   │   ├── dashboard-stabilization-20260225/
│   │   ├── dashboard-todo-widget-20260211/
│   │   ├── dashboard_test_suite_20260210/
│   │   ├── dashboard_v2_robotkez_control_20260208/
│   │   ├── dashboard_v3_command_center_20260219/
│   │   ├── data_flywheel_incubator_20260205/
│   │   ├── developer_agent_2_0_20260206/
│   │   ├── enterprise_suite_master_20260216/
│   │   ├── epp-v2-protocol-20260211/
│   │   ├── ev_hunter_ai_research_20260202/
│   │   ├── financial-auditor-agent-20260214/
│   │   ├── functional-integrity-fix-20260225/
│   │   ├── gemini_git_agent_20260212/
│   │   ├── gold_protocol/
│   │   ├── green_lightning_20260212/
│   │   ├── guardrails_evaluation_20260323/
│   │   ├── hungarian-orchestration-tuning-20260225/
│   │   ├── hybrid_cloud_integration_20260203/
│   │   ├── hyper_local_supply_chain_20260216/
│   │   ├── industrial_machine_hunter_20260216/
│   │   ├── innovation_bridge_20260212/
│   │   ├── innovation_bridge_20260225/
│   │   ├── invoice-e2e-testing-20260217/
│   │   ├── invoice-to-sheets-automation-20260214/
│   │   ├── iron_clad_backend_20260212/
│   │   ├── jules-async-test-automation-20260211/
│   │   ├── jules-qa-integration_20260120/
│   │   ├── jules_continuous_ai_integration_20260215/
│   │   ├── jules_enterprise_cicd_20260212/
│   │   ├── law_detective_20260223/
│   │   ├── living_documentation_system_20260213/
│   │   ├── local_test_scheduler_20260215/
│   │   ├── magyar-cli-menu-system-20260211/
│   │   ├── marketing_swarm_20260216/
│   │   ├── master_track_1_lead_mining_20260223/
│   │   ├── master_track_2_invoice_to_sheets_20260223/
│   │   ├── master_track_3_market_watcher_20260223/
│   │   ├── mcp_ollama_integration_20260218/
│   │   ├── mcp_tool_discovery_20260323/
│   │   ├── micro_csr_automator_20260212/
│   │   ├── modular-command-center-dashboard-v3-20260219/
│   │   ├── observability_opentelemetry_20260323/
│   │   ├── onboarding-knowledge-manager-20260214/
│   │   ├── orchestrator_chat_upgrade_20260320/
│   │   ├── orchestrator_cognition_upgrade_20260320/
│   │   ├── orchestrator_safe_autopilot_20260320/
│   │   ├── orchestrator_state_machine_20260321/
│   │   ├── otel_agent_tracing_20260211/
│   │   ├── paios_model_selector_ui_20260223/
│   │   ├── paios_orchestrator_chat_20260223/
│   │   ├── paios_phoenix_events_panel_20260223/
│   │   ├── paios_unified_config_20260223/
│   │   ├── personal_assistant_windows_mvp_20260323/
│   │   ├── phoenix_protocol_v2_20260205/
│   │   ├── readme_bootstrap_health_fixes_20260324/
│   │   ├── real_estate_sales_campaign_20260216/
│   │   ├── remote_layer_phase2_discovery_auth_20260322/
│   │   ├── remote_layer_phase3_mobile_voice_20260322/
│   │   ├── remote_layer_phase4_distributed_mesh_20260322/
│   │   ├── remote_layer_phase5_adaptive_swarms_20260322/
│   │   ├── remote_layer_phase6_collective_evolution_20260322/
│   │   ├── remote_layer_phase7_superintelligent_infra_20260322/
│   │   ├── robotkezv2-full-comet-20260215/
│   │   ├── robotkez_n8n_sandbox_edzesterv/
│   │   ├── robotkez_stabilization_20260212/
│   │   ├── sandbox_security_hardening_20260323/
│   │   ├── self_healing_core_20260213/
│   │   ├── software_genesis_protocol_20260216/
│   │   ├── spec-writer-agent-20260211/
│   │   ├── swarm_intelligence_v2_20260323/
│   │   ├── task-decomposer-agent-20260211/
│   │   ├── test-20260211/
│   │   ├── test-feature-20260211/
│   │   ├── test-track-12345678/
│   │   ├── test-track-20260211/
│   │   ├── test_stabilization_20260221/
│   │   ├── TR-20260212-TECH-HAR/
│   │   └── tracks_backup_20260209/
│   ├── BAS_ARCHITECTURE_v2.md
│   ├── CHANGELOG.md
│   ├── epp-v2.md
│   ├── index.md
│   ├── meta-schema.json
│   ├── product-guidelines.md
│   ├── product.md
│   ├── project_state.json
│   ├── SUMMARY.md
│   ├── tech-stack.md
│   ├── tracks/
│   │   ├── agent_health_matrix_20260325/
│   │   ├── bootstrap_single_source_20260325/
│   │   ├── brunella_function_matrix_20260325/
│   │   ├── cloudflare_dns_zone_reconciliation_20260325/
│   │   ├── cloudflare_workers_migration_20260226/
│   │   ├── doc_code_auto_sync_20260325/
│   │   ├── e2b_sandbox_crawl4ai_20260325/
│   │   ├── invoice_automation_20260326/
│   │   ├── jules_pr_integration_20260222/
│   │   ├── konyveles_automatizalas/
│   │   ├── logistics_vertical_20260222/
│   │   ├── owl_agent_coordinator_20260321/
│   │   ├── P-Sales20260327/
│   │   ├── personal_assistant_windows_mvp_20260323/
│   │   ├── precommit_hook_optimization_20260325/
│   │   ├── readme_bootstrap_health_fixes_20260324/
│   │   ├── remote_layer_phase1_foundation_20260322/
│   │   ├── remote_layer_phase8_planetary_supersystem_20260322/
│   │   ├── remote_layer_phase9_emergent_superintelligence_20260322/
│   │   ├── robotkez_comet_upgrade_20260222/
│   │   ├── startup_smoke_test_20260325/
│   │   └── test_infrastructure_stabilization_20260325/
│   ├── tracks.md
│   └── workflow.md
├── config/
│   ├── copilot-agents.json
│   ├── google-service-account.json.example
│   ├── grants_2026.json
│   ├── mcp_servers.json
│   ├── outreach_accounts.json
│   ├── safe_zones.json
│   └── security/
│   │   └── network-policy.json
├── CONTRIBUTING.md
├── coverage/
│   ├── base.css
│   ├── block-navigation.js
│   ├── clover.xml
│   ├── coverage-final.json
│   ├── favicon.png
│   ├── index.html
│   ├── prettify.css
│   ├── prettify.js
│   ├── scripts/
│   │   ├── health_check.ts.html
│   │   └── index.html
│   ├── sort-arrow-sprite.png
│   ├── sorter.js
│   └── src/
│   │   ├── agents/
│   │   ├── cli/
│   │   ├── config/
│   │   ├── core/
│   │   ├── server/
│   │   ├── tools/
│   │   └── utils/
├── credentials/
│   └── credentials.json
├── credentials-page.png
├── cypress.config.ts
├── data/
│   ├── audit.db
│   ├── audit.db-shm
│   ├── audit.db-wal
│   ├── bookkeeping.db
│   ├── brunella.db
│   ├── brunella.db-shm
│   ├── brunella.db-wal
│   ├── brunella_lancedb/
│   │   ├── memory.lance/
│   │   ├── memory_v2_mxbai.lance/
│   │   ├── memory_v2_nomic.lance/
│   │   ├── memory_v3_nomic.lance/
│   │   ├── tech_trends.lance/
│   │   └── tech_trends_v2_mxbai.lance/
│   ├── brunella_lancedb_python/
│   │   └── memory.lance/
│   ├── cean.db
│   ├── cean_infrastructure_inventory.json
│   ├── checkpoints.db
│   ├── checkpoints.db-shm
│   ├── checkpoints.db-wal
│   ├── developer_metrics.json
│   ├── developer_metrics.json.corrupt.1773943625230
│   ├── developer_metrics.json.corrupt.1773943625231
│   ├── developer_metrics.json.corrupt.1773944374601
│   ├── developer_metrics.json.corrupt.1773951532107
│   ├── developer_metrics.json.corrupt.1773952005906
│   ├── ev_hunter_results.json
│   ├── fix_queue.json
│   ├── internal_needs.json
│   ├── invoice_templates/
│   │   └── invoice_schema.py
│   ├── konyveles/
│   │   └── match_results.json
│   ├── robotkez_memory.json
│   ├── schema.sql
│   ├── screenshots/
│   ├── tasks.db
│   └── training/
│   │   └── golden_dataset.jsonl
├── docker-compose.prod.yml
├── docker-compose.yml
├── Dockerfile.node
├── Dockerfile.python
├── docs/
│   ├── ## Chat Customization Diagnostics.md
│   ├── 01.2_Pohi AI Pro_hu.pdf
│   ├── 08_AIRTABLE_SCHEMA_ERROR_FIX.md
│   ├── 09_LIVE_N8N_AIRTABLE_SCHEMA_PATCH.ps1
│   ├── 1.jpg
│   ├── 10.jpg
│   ├── 10_CHECK_N8N_EXECUTIONS.ps1
│   ├── 11.jpg
│   ├── 11_INSPECT_EXEC_1784.ps1
│   ├── 12.jpg
│   ├── 12_LIVE_N8N_COMPREHENSIVE_FIX.ps1
│   ├── 13_FINAL_PROMPT_AND_MAPPING_FIX.ps1
│   ├── 14_CHECK_LATEST_EXECUTION.ps1
│   ├── 15_INSPECT_ERROR.ps1
│   ├── 16_CHECK_LATEST_EXEC_AGAIN.ps1
│   ├── 17_CHECK_EXEC_FIX.ps1
│   ├── 18_INSPECT_1787_ERROR.ps1
│   ├── 19_INSPECT_1787_TRIGGER.ps1
│   ├── 2.jpg
│   ├── 2026-02-06-.txt
│   ├── 2026-02-06-this-session-is-being-continued-from-a-previous-co.txt
│   ├── 2026-02-07-this-session-is-being-continued-from-a-previous-co.txt
│   ├── 2026-02-11-this-session-is-being-continued-from-a-previous-co.txt
│   ├── 20_DUMP_1787_RUNDATA.ps1
│   ├── 21_MODE_CHECK.ps1
│   ├── 22_QUICKFIX_MAPPING.ps1
│   ├── 23_CHECK_LATEST_AGAIN.ps1
│   ├── 24_CHECK_ERROR_DETAILS.ps1
│   ├── 25_RESTORE_BACKUP.ps1
│   ├── 26_REMOVE_SCHEMA_CRASH.ps1
│   ├── 27_CHECK_FINAL.ps1
│   ├── 28_NODE_RESTORE_AND_FIX.js
│   ├── 29_N8N_RESTORE.ts
│   ├── 3.jpg
│   ├── 30_RESTORE.ts
│   ├── 4.jpg
│   ├── 5.jpg
│   ├── 6.jpg
│   ├── 65.jpg
│   ├── 66.jpg
│   ├── 67.jpg
│   ├── 68.jpg
│   ├── 69.jpg
│   ├── 7.jpg
│   ├── 70.jpg
│   ├── 71.jpg
│   ├── 72.jpg
│   ├── 73.jpg
│   ├── 74.jpg
│   ├── 75.jpg
│   ├── 76.jpg
│   ├── 77.jpg
│   ├── 8.jpg
│   ├── 9.jpg
│   ├── agents/
│   │   ├── ArchitectAgent.md
│   │   ├── ConflictMediatorAgent.md
│   │   ├── DataScientistAgent.md
│   │   ├── DependencyGraphAgent.md
│   │   ├── DeveloperAgent.md
│   │   ├── DevOpsAgent.md
│   │   ├── DigitalHeadhunterAgent.md
│   │   ├── DocsIntelligenceAgent.md
│   │   ├── DynamicAgent.md
│   │   ├── EdgeProxyAgent.md
│   │   ├── EmailTriageAgent.md
│   │   ├── EnterpriseOrchestratorAgent.md
│   │   ├── EvaluatorAgent.md
│   │   ├── FinancialGuardAgent.md
│   │   ├── GitHubModelsAgent.md
│   │   ├── GrantWatcherAgent.md
│   │   ├── HeadHunterAgent.md
│   │   ├── KnowledgeBaseBuilderAgent.md
│   │   ├── LeadMiningAgent.md
│   │   ├── LintFixerAgent.md
│   │   ├── LocalCSRAgent.md
│   │   ├── LogisticsDispatcherAgent.md
│   │   ├── MarketingAgent.md
│   │   ├── MarketIntelAgent.md
│   │   ├── NurturerAgent.md
│   │   ├── OrchestratorAgent.md
│   │   ├── PricingAgent.md
│   │   ├── ProactiveClaimsAgent.md
│   │   ├── ProcurementAgent.md
│   │   ├── ProjectConductorAgent.md
│   │   ├── PropertyAnalystAgent.md
│   │   ├── PythonAgent.md
│   │   ├── README_COVERAGE.md
│   │   ├── ResearcherAgent.md
│   │   ├── RobotkezAgent.md
│   │   ├── RobotkezV2Agent.md
│   │   ├── SalesAgent.md
│   │   ├── SalesHunterAgent.md
│   │   ├── SpecWriterAgent.md
│   │   ├── TaskDecomposerAgent.md
│   │   ├── UXDesignerAgent.md
│   │   └── VoiceAgent.md
│   ├── AGENT_PERMISSIONS_GUIDE.md
│   ├── archive/
│   │   └── konyvtarfa.md
│   ├── bb1.jpg
│   ├── bb2.jpg
│   ├── bb3.jpg
│   ├── bb4.jpg
│   ├── BEFORE_AFTER_COMPARISON.md
│   ├── blueprints/
│   │   └── iszapfalo_heti_kontextus_workflow_blueprint.json
│   ├── browser-automation/
│   │   └── PUPPETEER_VS_PLAYWRIGHT_VS_BROWSER_USE.md
│   ├── CEAN_ALERTING_RUNBOOK.md
│   ├── CEAN_API_KEY_SETUP_GUIDE.md
│   ├── CEAN_COST_ANALYSIS.md
│   ├── CEAN_D1_SETUP_INTERACTIVE.md
│   ├── CEAN_DISASTER_RECOVERY_DRILL.md
│   ├── CEAN_GITHUB_ACTIONS_SETUP.md
│   ├── CEAN_GO_LIVE_CHECKLIST.md
│   ├── CEAN_GRAFANA_DASHBOARD.json
│   ├── CEAN_GRAFANA_SETUP.md
│   ├── CEAN_INFRASTRUCTURE_SNAPSHOT.md
│   ├── CEAN_LAUNCH_COMMUNICATION.md
│   ├── CEAN_NOTIFICATION_CHANNELS.json
│   ├── CEAN_PHASE_1C_COMPLETION.md
│   ├── CEAN_PHASE_1D_DEPLOYMENT.md
│   ├── CEAN_PHASE_2A_COMPLETION.md
│   ├── CEAN_PHASE_2A_D1_SETUP.md
│   ├── CEAN_PHASE_2A_DELIVERY_SUMMARY.md
│   ├── CEAN_PHASE_2A_MANUAL_SETUP.md
│   ├── CEAN_PHASE_2A_STATUS.md
│   ├── CEAN_PHASE_2B_STATUS.md
│   ├── CEAN_PHASE_2_COMPLETION.md
│   ├── CEAN_PHASE_3A_STATUS.md
│   ├── CEAN_PHASE_3B2_PIPELINE_DAG_COMPLETE.md
│   ├── CEAN_PHASE_3B_DASHBOARD_COMPLETE.md
│   ├── CEAN_PHASE_4_1_LOAD_TESTING_COMPLETE.md
│   ├── CEAN_PHASE_4_2_COST_OPTIMIZATION_COMPLETE.md
│   ├── CEAN_PHASE_4_2_NEXT_STEPS.md
│   ├── CEAN_PHASE_4_3_E2E_TESTING_PLAN.md
│   ├── CEAN_PHASE_4_3_E2E_TESTING_REPORT.md
│   ├── CEAN_PHASE_4_TESTING_OPTIMIZATION.md
│   ├── CEAN_PHASE_5_1_DEPLOYMENT_REPORT.md
│   ├── CEAN_PHASE_5_COMPLETION_SUMMARY.md
│   ├── CEAN_PHASE_5_PRODUCTION_DEPLOYMENT_PLAN.md
│   ├── CEAN_PHASE_6_1_LOAD_TEST_REPORT.md
│   ├── CEAN_PRODUCTION_RUNBOOK.md
│   ├── CEAN_PROGRESS_2026_02_18.md
│   ├── CEAN_PROMETHEUS_ALERTS.yml
│   ├── CEAN_R1_VECTOR_MAPPINGS.md
│   ├── CEAN_SECURITY_AUDIT.md
│   ├── CEAN_STATUS_REPORT.md
│   ├── CEAN_TEAM_TRAINING.md
│   ├── CEAN_TROUBLESHOOTING_GUIDE.md
│   ├── CEAN_WRANGLER_ENVIRONMENTS.md
│   ├── changelog/
│   │   └── 2026-02-16-agent-response-formatter.md
│   ├── CHROME_ACP_SETUP.md
│   ├── Claude-nak/
│   │   ├── computer.md
│   │   ├── fejlesztes.md
│   │   ├── Multi‑Agent Orchestration Mode (v1.1).md
│   │   └── PAIOS 1.0 – Péter AI Operating System.md
│   ├── cloudflare/
│   │   ├── DIAGRAM.txt
│   │   ├── INFRASTRUCTURE.md
│   │   └── README.md
│   ├── cloudflare-tunnel-setup.md
│   ├── CLOUDFLARE_INTEGRATION.md
│   ├── COMPLETED_PROJECTS.md
│   ├── copilot/
│   │   └── COPILOT_PRO_GUIDE.md
│   ├── DASHBOARD_INVOICE_TEST_REPORT.md
│   ├── Egyéb/
│   │   ├── cloudflare llm prompt/
│   │   ├── cloudflare_chat.md
│   │   ├── Géppark nyilvántartó_rendszer.jpg
│   │   ├── hangvezérelt rendszer_munkaügyi_nyilvántartó_kieg.jpg
│   │   ├── heti összefoglaló elemzés.jpg
│   │   ├── Jules/
│   │   ├── kategórizáló.jpg
│   │   ├── Munkaügyi_nyilvántartó_rendszer_AI_vezérelt.jpg
│   │   ├── n8n+robotkez+agentfactory/
│   │   ├── Okos_ajánlatadó.jpg
│   │   └── Workflow (n8n, Langflow)/
│   ├── examples/
│   │   └── Heti_Kontextus_teszt.md
│   ├── EXECUTIVE_SUMMARY_2026_02_18.md
│   ├── GEMINI.md
│   ├── github/
│   │   └── GITHUB_CHEAT_SHEET.md
│   ├── github-runner-setup.md
│   ├── GOOGLE_WORKSPACE_SETUP.md
│   ├── GYOKER_RENDEZESI_JAVASLAT.md
│   ├── harvester-structured-json.md
│   ├── interpreter clli.md
│   ├── ISZAPFALO_ATADASI_ES_HASZNALATI_DOKUMENTACIO_2026-03-26.md
│   ├── ISZAPFALO_CLAUDE_VIZIO_2026.md
│   ├── ISZAPFALO_HETI_KONTEXTUS_AKCIOPLAN.md
│   ├── ISZAPFALO_HETI_KONTEXTUS_CODE_NODE_GUIDE.md
│   ├── ISZAPFALO_HETI_KONTEXTUS_NODE_BY_NODE.md
│   ├── ISZAPFALO_HETI_KONTEXTUS_ONEPAGER.md
│   ├── ISZAPFALO_POHI_BRIEF_HETI_KONTEXTUS.md
│   ├── JCAI_PHASE_3_TESTING_GUIDE.md
│   ├── JCAI_PHASE_3_VERIFICATION_REPORT.md
│   ├── JCAI_PROGRESS_UPDATE.md
│   ├── jules-repo-config.md
│   ├── jules-setup.md
│   ├── JULES_CLI_QUICK_START.md
│   ├── JULES_INTEGRATION.md
│   ├── jules_session_10296005880240118694/
│   │   ├── myai/
│   │   ├── package-lock.json
│   │   ├── src/
│   │   └── test/
│   ├── jules_session_10830104862054860677/
│   │   ├── docs/
│   │   └── scripts/
│   ├── jules_session_14523312123441564704/
│   │   ├── myai/
│   │   ├── pnpm-lock.yaml
│   │   ├── src/
│   │   ├── test/
│   │   └── vitest.config.ts
│   ├── jules_session_8716822409536279237/
│   │   └── myai/
│   ├── Képernyőkép 2026-02-28 155422.jpg
│   ├── LOCAL_WINDOWS_ASSISTANT_BLUEPRINT.md
│   ├── MAGYAR_NLP_TASK_ROUTING.md
│   ├── MCP_DEPLOYMENT_GUIDE.md
│   ├── MCP_TOOL_PERMISSIONS_GUIDE.md
│   ├── monitoring/
│   │   └── grafana/
│   ├── MONITORING_PROMETHEUS.md
│   ├── n8n-setup.md
│   ├── N8N_WORKFLOW_AUDIT.md
│   ├── NEXT_STEPS.md
│   ├── p1.jpg
│   ├── p10.jpg
│   ├── p11.jpg
│   ├── p12.jpg
│   ├── p2.jpg
│   ├── p3.jpg
│   ├── p4.jpg
│   ├── p5.jpg
│   ├── p6.jpg
│   ├── p7.jpg
│   ├── p8.jpg
│   ├── p9.jpg
│   ├── PAIOS_SUITE_README.md
│   ├── PHASE_4_ROOT_CLEANUP.md
│   ├── plans/
│   │   ├── 2026-02-25-innovation-bridge-design.md
│   │   ├── 2026-02-26-unified-chat-design.md
│   │   ├── 2026-02-26-windows-automation-bridge-design.md
│   │   ├── 2026-02-27-iszapfalo-geppark-figyelo-design.md
│   │   ├── 2026-02-27-iszapfalo-geppark-figyelo-guide.md
│   │   ├── 2026-02-27-iszapfalo-okos-ajanlatado-design.md
│   │   ├── 2026-02-27-iszapfalo-okos-ajanlatado-guide.md
│   │   ├── 2026-02-27-robotkez-pro-design.md
│   │   ├── 2026-02-27-robotkez-pro-implementation.md
│   │   ├── 2026-03-20-robotkez-mission-control-design.md
│   │   ├── 2026-03-20-robotkez-mission-control-plan.md
│   │   ├── 2026-03-20-robotkez-mission-control-prd.md
│   │   ├── 2026-03-22-dashboard-v3-design.md
│   │   ├── 2026-03-22-dashboard-v3-implementation.md
│   │   ├── 2026-03-26-invoice-automation-design.md
│   │   ├── 2026-03-27-bookkeeping-automation-design.md
│   │   ├── 2026-03-27-bookkeeping-automation-mvp.md
│   │   ├── langflow_ajanlatado_prompt_template.md
│   │   └── langflow_prompt_template.md
│   ├── PROJECT_ARCHITECTURE_DIAGRAM.md
│   ├── PROJECT_STRUCTURE.md
│   ├── PROJEKT_DIAGRAM_2026-02-13.md
│   ├── REPO_CLEANUP_SUMMARY.md
│   ├── robotkezv2-dev-guide.md
│   ├── robotkezv2-user-guide.md
│   ├── ROBOTKEZV2_TEST_SUMMARY.md
│   ├── ROBOTKEZ_LIVE_VIEW_SETUP.md
│   ├── ROBOTKEZ_SETUP.md
│   ├── services/
│   │   ├── green-market-watcher.md
│   │   └── invoice-to-sheets.md
│   ├── SESSION_COMPLETION_2026-02-18.md
│   ├── SESSION_COMPLETION_2026-02-19.md
│   ├── SESSION_COMPLETION_2026_02_18.md
│   ├── snippets/
│   │   └── n8n/
│   ├── STATUS_REPORT_2026_02_18.md
│   ├── superpowers/
│   │   ├── plans/
│   │   └── specs/
│   ├── SYSTEM_AUDIT.md
│   ├── templates/
│   │   └── HETI_KONTEXTUS_TEMPLATE.md
│   ├── tool-outputs/
│   │   ├── activate_skill_189.txt
│   │   ├── activate_skill_192.txt
│   │   ├── activate_skill_426.txt
│   │   ├── activate_skill_535.txt
│   │   ├── agent_delegate_122.txt
│   │   ├── agent_execute_102.txt
│   │   ├── agent_execute_119.txt
│   │   ├── agent_execute_121.txt
│   │   ├── agent_execute_93.txt
│   │   ├── apify-slash-website-content-crawler_38.txt
│   │   ├── apify__actors__call_143.txt
│   │   ├── apify__apify_slash_rag_web_browser_92.txt
│   │   ├── apify__call_actor_138.txt
│   │   ├── apify__run_actor_140.txt
│   │   ├── ask_user_163.txt
│   │   ├── ask_user_164.txt
│   │   ├── ask_user_71.txt
│   │   ├── ask_user_76.txt
│   │   ├── ask_user_96.txt
│   │   ├── ask_user_97.txt
│   │   ├── ask_user_98.txt
│   │   ├── chats/
│   │   ├── cli_help_107.txt
│   │   ├── cli_help_118.txt
│   │   ├── cli_help_120.txt
│   │   ├── cli_help_128.txt
│   │   ├── cli_help_137.txt
│   │   ├── cli_help_141.txt
│   │   ├── cli_help_178.txt
│   │   ├── cli_help_63.txt
│   │   ├── codebase_investigator_193.txt
│   │   ├── docs_create_129.txt
│   │   ├── enter_plan_mode_162.txt
│   │   ├── exit_plan_mode_51.txt
│   │   ├── exit_plan_mode_53.txt
│   │   ├── exit_plan_mode_57.txt
│   │   ├── exit_plan_mode_59.txt
│   │   ├── glob_112.txt
│   │   ├── glob_143.txt
│   │   ├── glob_186.txt
│   │   ├── glob_187.txt
│   │   ├── glob_359.txt
│   │   ├── glob_390.txt
│   │   ├── glob_392.txt
│   │   ├── glob_399.txt
│   │   ├── glob_400.txt
│   │   ├── glob_468.txt
│   │   ├── glob_499.txt
│   │   ├── glob_5.txt
│   │   ├── glob_501.txt
│   │   ├── glob_508.txt
│   │   ├── glob_509.txt
│   │   ├── glob_55.txt
│   │   ├── glob_58.txt
│   │   ├── glob_65.txt
│   │   ├── glob_79.txt
│   │   ├── gmail_createdraft_145.txt
│   │   ├── gmail_createdraft_146.txt
│   │   ├── gmail_createdraft_147.txt
│   │   ├── gmail_createdraft_148.txt
│   │   ├── gmail_createdraft_149.txt
│   │   ├── gmail_createdraft_150.txt
│   │   ├── gmail_createdraft_151.txt
│   │   ├── gmail_createdraft_152.txt
│   │   ├── gmail_createdraft_153.txt
│   │   ├── gmail_createdraft_154.txt
│   │   ├── gmail_createdraft_19.txt
│   │   ├── gmail_createdraft_20.txt
│   │   ├── gmail_createdraft_21.txt
│   │   ├── gmail_createdraft_22.txt
│   │   ├── gmail_createdraft_23.txt
│   │   ├── gmail_createdraft_24.txt
│   │   ├── gmail_createdraft_25.txt
│   │   ├── gmail_createdraft_26.txt
│   │   ├── gmail_createdraft_27.txt
│   │   ├── gmail_createdraft_28.txt
│   │   ├── gmail_createdraft_327.txt
│   │   ├── gmail_createdraft_328.txt
│   │   ├── gmail_createdraft_329.txt
│   │   ├── gmail_createdraft_330.txt
│   │   ├── gmail_createdraft_331.txt
│   │   ├── gmail_createdraft_332.txt
│   │   ├── gmail_createdraft_333.txt
│   │   ├── gmail_createdraft_334.txt
│   │   ├── gmail_createdraft_335.txt
│   │   ├── gmail_createdraft_336.txt
│   │   ├── google-workspace__create_spreadsheet_127.txt
│   │   ├── google-workspace__sheets_create_spreadsheet_64.txt
│   │   ├── google_web_search_158.txt
│   │   ├── google_web_search_32.txt
│   │   ├── google_web_search_340.txt
│   │   ├── google_web_search_37.txt
│   │   ├── google_web_search_39.txt
│   │   ├── google_web_search_42.txt
│   │   ├── google_web_search_43.txt
│   │   ├── google_web_search_44.txt
│   │   ├── google_web_search_45.txt
│   │   ├── google_web_search_46.txt
│   │   ├── google_web_search_47.txt
│   │   ├── google_web_search_48.txt
│   │   ├── google_web_search_49.txt
│   │   ├── google_web_search_68.txt
│   │   ├── google_web_search_74.txt
│   │   ├── google_web_search_98.txt
│   │   ├── google_workspace__sheets_create_spreadsheet_62.txt
│   │   ├── google_workspace__sheets_find_91.txt
│   │   ├── grep_search_113.txt
│   │   ├── grep_search_114.txt
│   │   ├── grep_search_12.txt
│   │   ├── grep_search_120.txt
│   │   ├── grep_search_13.txt
│   │   ├── grep_search_142.txt
│   │   ├── grep_search_18.txt
│   │   ├── grep_search_23.txt
│   │   ├── grep_search_272.txt
│   │   ├── grep_search_281.txt
│   │   ├── grep_search_295.txt
│   │   ├── grep_search_296.txt
│   │   ├── grep_search_302.txt
│   │   ├── grep_search_377.txt
│   │   ├── grep_search_486.txt
│   │   ├── grep_search_56.txt
│   │   ├── grep_search_57.txt
│   │   ├── grep_search_6.txt
│   │   ├── grep_search_60.txt
│   │   ├── grep_search_61.txt
│   │   ├── grep_search_62.txt
│   │   ├── grep_search_63.txt
│   │   ├── grep_search_66.txt
│   │   ├── grep_search_67.txt
│   │   ├── grep_search_68.txt
│   │   ├── grep_search_7.txt
│   │   ├── grep_search_90.txt
│   │   ├── grep_search_99.txt
│   │   ├── list_directory_11.txt
│   │   ├── list_directory_119.txt
│   │   ├── list_directory_124.txt
│   │   ├── list_directory_127.txt
│   │   ├── list_directory_128.txt
│   │   ├── list_directory_139.txt
│   │   ├── list_directory_141.txt
│   │   ├── list_directory_142.txt
│   │   ├── list_directory_143.txt
│   │   ├── list_directory_144.txt
│   │   ├── list_directory_16.txt
│   │   ├── list_directory_163.txt
│   │   ├── list_directory_164.txt
│   │   ├── list_directory_17.txt
│   │   ├── list_directory_179.txt
│   │   ├── list_directory_18.txt
│   │   ├── list_directory_182.txt
│   │   ├── list_directory_185.txt
│   │   ├── list_directory_188.txt
│   │   ├── list_directory_19.txt
│   │   ├── list_directory_192.txt
│   │   ├── list_directory_201.txt
│   │   ├── list_directory_25.txt
│   │   ├── list_directory_324.txt
│   │   ├── list_directory_325.txt
│   │   ├── list_directory_326.txt
│   │   ├── list_directory_36.txt
│   │   ├── list_directory_39.txt
│   │   ├── list_directory_415.txt
│   │   ├── list_directory_419.txt
│   │   ├── list_directory_42.txt
│   │   ├── list_directory_439.txt
│   │   ├── list_directory_441.txt
│   │   ├── list_directory_444.txt
│   │   ├── list_directory_445.txt
│   │   ├── list_directory_45.txt
│   │   ├── list_directory_46.txt
│   │   ├── list_directory_52.txt
│   │   ├── list_directory_524.txt
│   │   ├── list_directory_528.txt
│   │   ├── list_directory_53.txt
│   │   ├── list_directory_548.txt
│   │   ├── list_directory_550.txt
│   │   ├── list_directory_553.txt
│   │   ├── list_directory_554.txt
│   │   ├── list_directory_59.txt
│   │   ├── list_directory_60.txt
│   │   ├── list_directory_61.txt
│   │   ├── list_directory_63.txt
│   │   ├── list_directory_65.txt
│   │   ├── list_directory_68.txt
│   │   ├── list_directory_70.txt
│   │   ├── list_directory_77.txt
│   │   ├── list_directory_78.txt
│   │   ├── list_directory_8.txt
│   │   ├── list_directory_81.txt
│   │   ├── list_directory_82.txt
│   │   ├── list_directory_86.txt
│   │   ├── list_directory_87.txt
│   │   ├── list_directory_90.txt
│   │   ├── list_directory_93.txt
│   │   ├── list_directory_97.txt
│   │   ├── list_directory_98.txt
│   │   ├── people_getme_130.txt
│   │   ├── read_file_10.txt
│   │   ├── read_file_100.txt
│   │   ├── read_file_102.txt
│   │   ├── read_file_103.txt
│   │   ├── read_file_104.txt
│   │   ├── read_file_105.txt
│   │   ├── read_file_108.txt
│   │   ├── read_file_11.txt
│   │   ├── read_file_111.txt
│   │   ├── read_file_112.txt
│   │   ├── read_file_113.txt
│   │   ├── read_file_114.txt
│   │   ├── read_file_115.txt
│   │   ├── read_file_116.txt
│   │   ├── read_file_118.txt
│   │   ├── read_file_12.txt
│   │   ├── read_file_122.txt
│   │   ├── read_file_123.txt
│   │   ├── read_file_124.txt
│   │   ├── read_file_126.txt
│   │   ├── read_file_13.txt
│   │   ├── read_file_131.txt
│   │   ├── read_file_133.txt
│   │   ├── read_file_134.txt
│   │   ├── read_file_135.txt
│   │   ├── read_file_136.txt
│   │   ├── read_file_137.txt
│   │   ├── read_file_138.txt
│   │   ├── read_file_14.txt
│   │   ├── read_file_140.txt
│   │   ├── read_file_141.txt
│   │   ├── read_file_144.txt
│   │   ├── read_file_145.txt
│   │   ├── read_file_147.txt
│   │   ├── read_file_148.txt
│   │   ├── read_file_149.txt
│   │   ├── read_file_15.txt
│   │   ├── read_file_150.txt
│   │   ├── read_file_151.txt
│   │   ├── read_file_152.txt
│   │   ├── read_file_153.txt
│   │   ├── read_file_154.txt
│   │   ├── read_file_155.txt
│   │   ├── read_file_156.txt
│   │   ├── read_file_157.txt
│   │   ├── read_file_158.txt
│   │   ├── read_file_159.txt
│   │   ├── read_file_160.txt
│   │   ├── read_file_161.txt
│   │   ├── read_file_162.txt
│   │   ├── read_file_165.txt
│   │   ├── read_file_167.txt
│   │   ├── read_file_168.txt
│   │   ├── read_file_169.txt
│   │   ├── read_file_17.txt
│   │   ├── read_file_170.txt
│   │   ├── read_file_171.txt
│   │   ├── read_file_172.txt
│   │   ├── read_file_175.txt
│   │   ├── read_file_18.txt
│   │   ├── read_file_181.txt
│   │   ├── read_file_182.txt
│   │   ├── read_file_183.txt
│   │   ├── read_file_184.txt
│   │   ├── read_file_185.txt
│   │   ├── read_file_19.txt
│   │   ├── read_file_191.txt
│   │   ├── read_file_197.txt
│   │   ├── read_file_20.txt
│   │   ├── read_file_200.txt
│   │   ├── read_file_202.txt
│   │   ├── read_file_204.txt
│   │   ├── read_file_206.txt
│   │   ├── read_file_207.txt
│   │   ├── read_file_209.txt
│   │   ├── read_file_21.txt
│   │   ├── read_file_213.txt
│   │   ├── read_file_214.txt
│   │   ├── read_file_216.txt
│   │   ├── read_file_218.txt
│   │   ├── read_file_22.txt
│   │   ├── read_file_220.txt
│   │   ├── read_file_221.txt
│   │   ├── read_file_222.txt
│   │   ├── read_file_226.txt
│   │   ├── read_file_23.txt
│   │   ├── read_file_230.txt
│   │   ├── read_file_233.txt
│   │   ├── read_file_235.txt
│   │   ├── read_file_237.txt
│   │   ├── read_file_24.txt
│   │   ├── read_file_240.txt
│   │   ├── read_file_241.txt
│   │   ├── read_file_244.txt
│   │   ├── read_file_248.txt
│   │   ├── read_file_25.txt
│   │   ├── read_file_250.txt
│   │   ├── read_file_252.txt
│   │   ├── read_file_257.txt
│   │   ├── read_file_259.txt
│   │   ├── read_file_26.txt
│   │   ├── read_file_261.txt
│   │   ├── read_file_262.txt
│   │   ├── read_file_264.txt
│   │   ├── read_file_266.txt
│   │   ├── read_file_269.txt
│   │   ├── read_file_27.txt
│   │   ├── read_file_271.txt
│   │   ├── read_file_274.txt
│   │   ├── read_file_276.txt
│   │   ├── read_file_280.txt
│   │   ├── read_file_284.txt
│   │   ├── read_file_286.txt
│   │   ├── read_file_29.txt
│   │   ├── read_file_294.txt
│   │   ├── read_file_298.txt
│   │   ├── read_file_30.txt
│   │   ├── read_file_300.txt
│   │   ├── read_file_304.txt
│   │   ├── read_file_305.txt
│   │   ├── read_file_308.txt
│   │   ├── read_file_31.txt
│   │   ├── read_file_313.txt
│   │   ├── read_file_318.txt
│   │   ├── read_file_32.txt
│   │   ├── read_file_320.txt
│   │   ├── read_file_322.txt
│   │   ├── read_file_323.txt
│   │   ├── read_file_33.txt
│   │   ├── read_file_337.txt
│   │   ├── read_file_338.txt
│   │   ├── read_file_34.txt
│   │   ├── read_file_342.txt
│   │   ├── read_file_343.txt
│   │   ├── read_file_344.txt
│   │   ├── read_file_345.txt
│   │   ├── read_file_346.txt
│   │   ├── read_file_35.txt
│   │   ├── read_file_350.txt
│   │   ├── read_file_355.txt
│   │   ├── read_file_358.txt
│   │   ├── read_file_36.txt
│   │   ├── read_file_360.txt
│   │   ├── read_file_368.txt
│   │   ├── read_file_37.txt
│   │   ├── read_file_374.txt
│   │   ├── read_file_376.txt
│   │   ├── read_file_378.txt
│   │   ├── read_file_379.txt
│   │   ├── read_file_38.txt
│   │   ├── read_file_381.txt
│   │   ├── read_file_385.txt
│   │   ├── read_file_386.txt
│   │   ├── read_file_388.txt
│   │   ├── read_file_389.txt
│   │   ├── read_file_39.txt
│   │   ├── read_file_391.txt
│   │   ├── read_file_393.txt
│   │   ├── read_file_394.txt
│   │   ├── read_file_395.txt
│   │   ├── read_file_396.txt
│   │   ├── read_file_397.txt
│   │   ├── read_file_398.txt
│   │   ├── read_file_4.txt
│   │   ├── read_file_40.txt
│   │   ├── read_file_401.txt
│   │   ├── read_file_41.txt
│   │   ├── read_file_412.txt
│   │   ├── read_file_414.txt
│   │   ├── read_file_417.txt
│   │   ├── read_file_421.txt
│   │   ├── read_file_423.txt
│   │   ├── read_file_424.txt
│   │   ├── read_file_43.txt
│   │   ├── read_file_432.txt
│   │   ├── read_file_435.txt
│   │   ├── read_file_436.txt
│   │   ├── read_file_437.txt
│   │   ├── read_file_438.txt
│   │   ├── read_file_44.txt
│   │   ├── read_file_440.txt
│   │   ├── read_file_442.txt
│   │   ├── read_file_443.txt
│   │   ├── read_file_446.txt
│   │   ├── read_file_447.txt
│   │   ├── read_file_448.txt
│   │   ├── read_file_449.txt
│   │   ├── read_file_45.txt
│   │   ├── read_file_450.txt
│   │   ├── read_file_451.txt
│   │   ├── read_file_452.txt
│   │   ├── read_file_453.txt
│   │   ├── read_file_454.txt
│   │   ├── read_file_455.txt
│   │   ├── read_file_459.txt
│   │   ├── read_file_46.txt
│   │   ├── read_file_464.txt
│   │   ├── read_file_467.txt
│   │   ├── read_file_469.txt
│   │   ├── read_file_47.txt
│   │   ├── read_file_477.txt
│   │   ├── read_file_48.txt
│   │   ├── read_file_483.txt
│   │   ├── read_file_485.txt
│   │   ├── read_file_487.txt
│   │   ├── read_file_488.txt
│   │   ├── read_file_49.txt
│   │   ├── read_file_490.txt
│   │   ├── read_file_494.txt
│   │   ├── read_file_495.txt
│   │   ├── read_file_497.txt
│   │   ├── read_file_498.txt
│   │   ├── read_file_5.txt
│   │   ├── read_file_50.txt
│   │   ├── read_file_500.txt
│   │   ├── read_file_502.txt
│   │   ├── read_file_503.txt
│   │   ├── read_file_504.txt
│   │   ├── read_file_505.txt
│   │   ├── read_file_506.txt
│   │   ├── read_file_507.txt
│   │   ├── read_file_51.txt
│   │   ├── read_file_510.txt
│   │   ├── read_file_52.txt
│   │   ├── read_file_521.txt
│   │   ├── read_file_523.txt
│   │   ├── read_file_526.txt
│   │   ├── read_file_53.txt
│   │   ├── read_file_530.txt
│   │   ├── read_file_532.txt
│   │   ├── read_file_533.txt
│   │   ├── read_file_54.txt
│   │   ├── read_file_541.txt
│   │   ├── read_file_544.txt
│   │   ├── read_file_545.txt
│   │   ├── read_file_546.txt
│   │   ├── read_file_547.txt
│   │   ├── read_file_549.txt
│   │   ├── read_file_55.txt
│   │   ├── read_file_551.txt
│   │   ├── read_file_552.txt
│   │   ├── read_file_555.txt
│   │   ├── read_file_556.txt
│   │   ├── read_file_557.txt
│   │   ├── read_file_558.txt
│   │   ├── read_file_559.txt
│   │   ├── read_file_56.txt
│   │   ├── read_file_57.txt
│   │   ├── read_file_58.txt
│   │   ├── read_file_59.txt
│   │   ├── read_file_6.txt
│   │   ├── read_file_61.txt
│   │   ├── read_file_62.txt
│   │   ├── read_file_63.txt
│   │   ├── read_file_64.txt
│   │   ├── read_file_66.txt
│   │   ├── read_file_67.txt
│   │   ├── read_file_68.txt
│   │   ├── read_file_69.txt
│   │   ├── read_file_7.txt
│   │   ├── read_file_70.txt
│   │   ├── read_file_72.txt
│   │   ├── read_file_74.txt
│   │   ├── read_file_75.txt
│   │   ├── read_file_76.txt
│   │   ├── read_file_77.txt
│   │   ├── read_file_78.txt
│   │   ├── read_file_79.txt
│   │   ├── read_file_8.txt
│   │   ├── read_file_80.txt
│   │   ├── read_file_81.txt
│   │   ├── read_file_82.txt
│   │   ├── read_file_84.txt
│   │   ├── read_file_85.txt
│   │   ├── read_file_86.txt
│   │   ├── read_file_87.txt
│   │   ├── read_file_88.txt
│   │   ├── read_file_89.txt
│   │   ├── read_file_9.txt
│   │   ├── read_file_90.txt
│   │   ├── read_file_91.txt
│   │   ├── read_file_92.txt
│   │   ├── read_file_94.txt
│   │   ├── read_file_95.txt
│   │   ├── read_file_96.txt
│   │   ├── read_file_97.txt
│   │   ├── read_file_98.txt
│   │   ├── replace_1.txt
│   │   ├── replace_10.txt
│   │   ├── replace_101.txt
│   │   ├── replace_103.txt
│   │   ├── replace_104.txt
│   │   ├── replace_105.txt
│   │   ├── replace_106.txt
│   │   ├── replace_107.txt
│   │   ├── replace_108.txt
│   │   ├── replace_109.txt
│   │   ├── replace_110.txt
│   │   ├── replace_111.txt
│   │   ├── replace_115.txt
│   │   ├── replace_116.txt
│   │   ├── replace_117.txt
│   │   ├── replace_12.txt
│   │   ├── replace_125.txt
│   │   ├── replace_126.txt
│   │   ├── replace_127.txt
│   │   ├── replace_128.txt
│   │   ├── replace_13.txt
│   │   ├── replace_130.txt
│   │   ├── replace_131.txt
│   │   ├── replace_132.txt
│   │   ├── replace_133.txt
│   │   ├── replace_134.txt
│   │   ├── replace_135.txt
│   │   ├── replace_137.txt
│   │   ├── replace_138.txt
│   │   ├── replace_14.txt
│   │   ├── replace_140.txt
│   │   ├── replace_142.txt
│   │   ├── replace_143.txt
│   │   ├── replace_144.txt
│   │   ├── replace_146.txt
│   │   ├── replace_147.txt
│   │   ├── replace_15.txt
│   │   ├── replace_150.txt
│   │   ├── replace_151.txt
│   │   ├── replace_152.txt
│   │   ├── replace_155.txt
│   │   ├── replace_156.txt
│   │   ├── replace_158.txt
│   │   ├── replace_16.txt
│   │   ├── replace_17.txt
│   │   ├── replace_18.txt
│   │   ├── replace_19.txt
│   │   ├── replace_194.txt
│   │   ├── replace_196.txt
│   │   ├── replace_199.txt
│   │   ├── replace_2.txt
│   │   ├── replace_20.txt
│   │   ├── replace_21.txt
│   │   ├── replace_211.txt
│   │   ├── replace_212.txt
│   │   ├── replace_215.txt
│   │   ├── replace_22.txt
│   │   ├── replace_225.txt
│   │   ├── replace_229.txt
│   │   ├── replace_23.txt
│   │   ├── replace_231.txt
│   │   ├── replace_232.txt
│   │   ├── replace_24.txt
│   │   ├── replace_242.txt
│   │   ├── replace_243.txt
│   │   ├── replace_245.txt
│   │   ├── replace_246.txt
│   │   ├── replace_25.txt
│   │   ├── replace_256.txt
│   │   ├── replace_26.txt
│   │   ├── replace_268.txt
│   │   ├── replace_27.txt
│   │   ├── replace_270.txt
│   │   ├── replace_279.txt
│   │   ├── replace_28.txt
│   │   ├── replace_283.txt
│   │   ├── replace_285.txt
│   │   ├── replace_288.txt
│   │   ├── replace_29.txt
│   │   ├── replace_292.txt
│   │   ├── replace_293.txt
│   │   ├── replace_3.txt
│   │   ├── replace_30.txt
│   │   ├── replace_307.txt
│   │   ├── replace_31.txt
│   │   ├── replace_32.txt
│   │   ├── replace_33.txt
│   │   ├── replace_34.txt
│   │   ├── replace_348.txt
│   │   ├── replace_349.txt
│   │   ├── replace_35.txt
│   │   ├── replace_354.txt
│   │   ├── replace_36.txt
│   │   ├── replace_367.txt
│   │   ├── replace_37.txt
│   │   ├── replace_370.txt
│   │   ├── replace_371.txt
│   │   ├── replace_372.txt
│   │   ├── replace_373.txt
│   │   ├── replace_375.txt
│   │   ├── replace_38.txt
│   │   ├── replace_380.txt
│   │   ├── replace_382.txt
│   │   ├── replace_383.txt
│   │   ├── replace_39.txt
│   │   ├── replace_4.txt
│   │   ├── replace_40.txt
│   │   ├── replace_404.txt
│   │   ├── replace_407.txt
│   │   ├── replace_408.txt
│   │   ├── replace_409.txt
│   │   ├── replace_41.txt
│   │   ├── replace_410.txt
│   │   ├── replace_411.txt
│   │   ├── replace_413.txt
│   │   ├── replace_418.txt
│   │   ├── replace_42.txt
│   │   ├── replace_422.txt
│   │   ├── replace_427.txt
│   │   ├── replace_428.txt
│   │   ├── replace_43.txt
│   │   ├── replace_431.txt
│   │   ├── replace_44.txt
│   │   ├── replace_457.txt
│   │   ├── replace_458.txt
│   │   ├── replace_46.txt
│   │   ├── replace_463.txt
│   │   ├── replace_47.txt
│   │   ├── replace_476.txt
│   │   ├── replace_479.txt
│   │   ├── replace_48.txt
│   │   ├── replace_480.txt
│   │   ├── replace_481.txt
│   │   ├── replace_482.txt
│   │   ├── replace_484.txt
│   │   ├── replace_489.txt
│   │   ├── replace_49.txt
│   │   ├── replace_491.txt
│   │   ├── replace_492.txt
│   │   ├── replace_5.txt
│   │   ├── replace_50.txt
│   │   ├── replace_513.txt
│   │   ├── replace_516.txt
│   │   ├── replace_517.txt
│   │   ├── replace_518.txt
│   │   ├── replace_519.txt
│   │   ├── replace_520.txt
│   │   ├── replace_522.txt
│   │   ├── replace_527.txt
│   │   ├── replace_531.txt
│   │   ├── replace_536.txt
│   │   ├── replace_537.txt
│   │   ├── replace_54.txt
│   │   ├── replace_540.txt
│   │   ├── replace_56.txt
│   │   ├── replace_57.txt
│   │   ├── replace_6.txt
│   │   ├── replace_60.txt
│   │   ├── replace_61.txt
│   │   ├── replace_63.txt
│   │   ├── replace_64.txt
│   │   ├── replace_7.txt
│   │   ├── replace_72.txt
│   │   ├── replace_73.txt
│   │   ├── replace_74.txt
│   │   ├── replace_8.txt
│   │   ├── replace_80.txt
│   │   ├── replace_81.txt
│   │   ├── replace_82.txt
│   │   ├── replace_83.txt
│   │   ├── replace_84.txt
│   │   ├── replace_86.txt
│   │   ├── replace_87.txt
│   │   ├── replace_88.txt
│   │   ├── replace_9.txt
│   │   ├── replace_97.txt
│   │   ├── run_gcloud_command_123.txt
│   │   ├── run_shell_command_1.txt
│   │   ├── run_shell_command_100.txt
│   │   ├── run_shell_command_101.txt
│   │   ├── run_shell_command_102.txt
│   │   ├── run_shell_command_104.txt
│   │   ├── run_shell_command_105.txt
│   │   ├── run_shell_command_106.txt
│   │   ├── run_shell_command_107.txt
│   │   ├── run_shell_command_108.txt
│   │   ├── run_shell_command_109.txt
│   │   ├── run_shell_command_11.txt
│   │   ├── run_shell_command_110.txt
│   │   ├── run_shell_command_111.txt
│   │   ├── run_shell_command_112.txt
│   │   ├── run_shell_command_114.txt
│   │   ├── run_shell_command_115.txt
│   │   ├── run_shell_command_116.txt
│   │   ├── run_shell_command_117.txt
│   │   ├── run_shell_command_118.txt
│   │   ├── run_shell_command_119.txt
│   │   ├── run_shell_command_12.txt
│   │   ├── run_shell_command_120.txt
│   │   ├── run_shell_command_121.txt
│   │   ├── run_shell_command_122.txt
│   │   ├── run_shell_command_123.txt
│   │   ├── run_shell_command_124.txt
│   │   ├── run_shell_command_125.txt
│   │   ├── run_shell_command_126.txt
│   │   ├── run_shell_command_127.txt
│   │   ├── run_shell_command_128.txt
│   │   ├── run_shell_command_129.txt
│   │   ├── run_shell_command_13.txt
│   │   ├── run_shell_command_130.txt
│   │   ├── run_shell_command_132.txt
│   │   ├── run_shell_command_133.txt
│   │   ├── run_shell_command_134.txt
│   │   ├── run_shell_command_135.txt
│   │   ├── run_shell_command_136.txt
│   │   ├── run_shell_command_137.txt
│   │   ├── run_shell_command_139.txt
│   │   ├── run_shell_command_141.txt
│   │   ├── run_shell_command_142.txt
│   │   ├── run_shell_command_144.txt
│   │   ├── run_shell_command_145.txt
│   │   ├── run_shell_command_147.txt
│   │   ├── run_shell_command_15.txt
│   │   ├── run_shell_command_154.txt
│   │   ├── run_shell_command_156.txt
│   │   ├── run_shell_command_158.txt
│   │   ├── run_shell_command_160.txt
│   │   ├── run_shell_command_162.txt
│   │   ├── run_shell_command_164.txt
│   │   ├── run_shell_command_166.txt
│   │   ├── run_shell_command_168.txt
│   │   ├── run_shell_command_169.txt
│   │   ├── run_shell_command_170.txt
│   │   ├── run_shell_command_171.txt
│   │   ├── run_shell_command_173.txt
│   │   ├── run_shell_command_174.txt
│   │   ├── run_shell_command_176.txt
│   │   ├── run_shell_command_177.txt
│   │   ├── run_shell_command_178.txt
│   │   ├── run_shell_command_179.txt
│   │   ├── run_shell_command_18.txt
│   │   ├── run_shell_command_187.txt
│   │   ├── run_shell_command_188.txt
│   │   ├── run_shell_command_190.txt
│   │   ├── run_shell_command_193.txt
│   │   ├── run_shell_command_195.txt
│   │   ├── run_shell_command_2.txt
│   │   ├── run_shell_command_203.txt
│   │   ├── run_shell_command_205.txt
│   │   ├── run_shell_command_208.txt
│   │   ├── run_shell_command_21.txt
│   │   ├── run_shell_command_210.txt
│   │   ├── run_shell_command_217.txt
│   │   ├── run_shell_command_223.txt
│   │   ├── run_shell_command_224.txt
│   │   ├── run_shell_command_227.txt
│   │   ├── run_shell_command_228.txt
│   │   ├── run_shell_command_23.txt
│   │   ├── run_shell_command_234.txt
│   │   ├── run_shell_command_236.txt
│   │   ├── run_shell_command_238.txt
│   │   ├── run_shell_command_247.txt
│   │   ├── run_shell_command_249.txt
│   │   ├── run_shell_command_251.txt
│   │   ├── run_shell_command_253.txt
│   │   ├── run_shell_command_254.txt
│   │   ├── run_shell_command_255.txt
│   │   ├── run_shell_command_258.txt
│   │   ├── run_shell_command_26.txt
│   │   ├── run_shell_command_260.txt
│   │   ├── run_shell_command_263.txt
│   │   ├── run_shell_command_265.txt
│   │   ├── run_shell_command_267.txt
│   │   ├── run_shell_command_273.txt
│   │   ├── run_shell_command_275.txt
│   │   ├── run_shell_command_277.txt
│   │   ├── run_shell_command_278.txt
│   │   ├── run_shell_command_28.txt
│   │   ├── run_shell_command_282.txt
│   │   ├── run_shell_command_287.txt
│   │   ├── run_shell_command_289.txt
│   │   ├── run_shell_command_290.txt
│   │   ├── run_shell_command_297.txt
│   │   ├── run_shell_command_299.txt
│   │   ├── run_shell_command_3.txt
│   │   ├── run_shell_command_30.txt
│   │   ├── run_shell_command_301.txt
│   │   ├── run_shell_command_303.txt
│   │   ├── run_shell_command_306.txt
│   │   ├── run_shell_command_309.txt
│   │   ├── run_shell_command_31.txt
│   │   ├── run_shell_command_310.txt
│   │   ├── run_shell_command_311.txt
│   │   ├── run_shell_command_312.txt
│   │   ├── run_shell_command_314.txt
│   │   ├── run_shell_command_315.txt
│   │   ├── run_shell_command_316.txt
│   │   ├── run_shell_command_319.txt
│   │   ├── run_shell_command_32.txt
│   │   ├── run_shell_command_321.txt
│   │   ├── run_shell_command_33.txt
│   │   ├── run_shell_command_34.txt
│   │   ├── run_shell_command_347.txt
│   │   ├── run_shell_command_35.txt
│   │   ├── run_shell_command_352.txt
│   │   ├── run_shell_command_362.txt
│   │   ├── run_shell_command_364.txt
│   │   ├── run_shell_command_366.txt
│   │   ├── run_shell_command_369.txt
│   │   ├── run_shell_command_4.txt
│   │   ├── run_shell_command_403.txt
│   │   ├── run_shell_command_405.txt
│   │   ├── run_shell_command_41.txt
│   │   ├── run_shell_command_42.txt
│   │   ├── run_shell_command_45.txt
│   │   ├── run_shell_command_456.txt
│   │   ├── run_shell_command_46.txt
│   │   ├── run_shell_command_461.txt
│   │   ├── run_shell_command_471.txt
│   │   ├── run_shell_command_473.txt
│   │   ├── run_shell_command_475.txt
│   │   ├── run_shell_command_478.txt
│   │   ├── run_shell_command_48.txt
│   │   ├── run_shell_command_49.txt
│   │   ├── run_shell_command_5.txt
│   │   ├── run_shell_command_50.txt
│   │   ├── run_shell_command_512.txt
│   │   ├── run_shell_command_514.txt
│   │   ├── run_shell_command_52.txt
│   │   ├── run_shell_command_53.txt
│   │   ├── run_shell_command_54.txt
│   │   ├── run_shell_command_56.txt
│   │   ├── run_shell_command_58.txt
│   │   ├── run_shell_command_59.txt
│   │   ├── run_shell_command_6.txt
│   │   ├── run_shell_command_60.txt
│   │   ├── run_shell_command_61.txt
│   │   ├── run_shell_command_65.txt
│   │   ├── run_shell_command_67.txt
│   │   ├── run_shell_command_69.txt
│   │   ├── run_shell_command_7.txt
│   │   ├── run_shell_command_71.txt
│   │   ├── run_shell_command_72.txt
│   │   ├── run_shell_command_73.txt
│   │   ├── run_shell_command_74.txt
│   │   ├── run_shell_command_75.txt
│   │   ├── run_shell_command_76.txt
│   │   ├── run_shell_command_78.txt
│   │   ├── run_shell_command_79.txt
│   │   ├── run_shell_command_8.txt
│   │   ├── run_shell_command_80.txt
│   │   ├── run_shell_command_81.txt
│   │   ├── run_shell_command_82.txt
│   │   ├── run_shell_command_83.txt
│   │   ├── run_shell_command_84.txt
│   │   ├── run_shell_command_85.txt
│   │   ├── run_shell_command_87.txt
│   │   ├── run_shell_command_88.txt
│   │   ├── run_shell_command_89.txt
│   │   ├── run_shell_command_90.txt
│   │   ├── run_shell_command_91.txt
│   │   ├── run_shell_command_93.txt
│   │   ├── run_shell_command_94.txt
│   │   ├── run_shell_command_95.txt
│   │   ├── run_shell_command_96.txt
│   │   ├── run_shell_command_97.txt
│   │   ├── run_shell_command_99.txt
│   │   ├── search_workspace_docs_180.txt
│   │   ├── session-033bc6f8-c780-464c-a4ef-162632580f26/
│   │   ├── session-200e43c6-7665-4bf2-8ba2-b79eb53ced76/
│   │   ├── session-2026-02-15T13-47-d57831df.json
│   │   ├── session-2026-02-15T14-00-8242a07b.json
│   │   ├── session-2026-02-15T14-08-54844165.json
│   │   ├── session-2026-02-15T14-35-07768b97.json
│   │   ├── session-2026-02-15T14-39-1e51ab91.json
│   │   ├── session-2026-02-15T14-50-25ef5dfa.json
│   │   ├── session-2026-02-15T15-11-34204e21.json
│   │   ├── session-2026-02-15T15-19-f8e3a712.json
│   │   ├── session-2026-02-15T15-27-4ed956e8.json
│   │   ├── session-2026-02-15T15-49-6ca2d3f1.json
│   │   ├── session-2026-02-15T16-02-ee090e42.json
│   │   ├── session-2026-02-17T12-46-549230fc.json
│   │   ├── session-2026-02-17T15-06-382293a1.json
│   │   ├── session-2026-02-17T21-30-aa8d6a06.json
│   │   ├── session-2026-02-18T23-11-87f12225.json
│   │   ├── session-2026-02-19T00-43-360b31b1.json
│   │   ├── session-2026-02-19T01-52-234143af.json
│   │   ├── session-2026-02-19T16-34-ccf416df.json
│   │   ├── session-2026-02-19T19-48-ad7799f4.json
│   │   ├── session-2026-02-19T20-20-ad7799f4.json
│   │   ├── session-2026-02-19T20-22-ad7799f4.json
│   │   ├── session-2026-02-20T00-46-033bc6f8.json
│   │   ├── session-2026-02-21T10-01-06f41a41.json
│   │   ├── session-2026-02-22T16-13-8eeb49a8.json
│   │   ├── session-2026-02-22T18-07-a43599af.json
│   │   ├── session-2026-02-22T18-35-88db1579.json
│   │   ├── session-2026-02-23T18-50-940b702d.json
│   │   ├── session-2026-02-23T19-05-26d77dbf.json
│   │   ├── session-2026-02-23T20-06-7336db1b.json
│   │   ├── session-2026-02-23T21-44-7336db1b.json
│   │   ├── session-2026-02-24T17-32-31cf3175.json
│   │   ├── session-2026-02-24T17-55-31cf3175.json
│   │   ├── session-2026-02-24T18-42-d43fda10.json
│   │   ├── session-2026-02-24T19-32-d43fda10.json
│   │   ├── session-2026-02-24T19-34-d43fda10.json
│   │   ├── session-2026-02-24T19-39-d43fda10.json
│   │   ├── session-2026-02-24T19-41-2ee4c5a8.json
│   │   ├── session-2026-02-24T19-53-d43fda10.json
│   │   ├── session-2026-02-24T20-18-d43fda10.json
│   │   ├── session-26d77dbf-14b2-4b80-a9ba-3f01aa561cf8/
│   │   ├── session-7336db1b-f81c-45f1-8c77-12b7420ea09f/
│   │   ├── session-821ed3d6-3f57-4020-b293-ba80cda70380/
│   │   ├── session-855c0ab5-0cb8-4f90-a34e-ba1f64c8e5ad/
│   │   ├── session-88db1579-35a1-4f28-9b75-7261c5ebb570/
│   │   ├── session-ad7799f4-f338-4347-a1f5-b4a7b51d617b/
│   │   ├── session-c86e6063-7311-4cbf-9f35-d3d2089e6a0d/
│   │   ├── session-d43fda10-c170-4a49-98fa-f901d76ea08c/
│   │   ├── session-fda0ab1f-406c-438c-9f19-bc27475f58fd/
│   │   ├── session-ff8502c3-3337-42bf-9125-be0c94d50092/
│   │   ├── web_fetch_35.txt
│   │   ├── web_fetch_40.txt
│   │   ├── web_fetch_41.txt
│   │   ├── web_fetch_69.txt
│   │   ├── web_fetch_70.txt
│   │   ├── write_file_100.txt
│   │   ├── write_file_102.txt
│   │   ├── write_file_106.txt
│   │   ├── write_file_109.txt
│   │   ├── write_file_110.txt
│   │   ├── write_file_120.txt
│   │   ├── write_file_124.txt
│   │   ├── write_file_125.txt
│   │   ├── write_file_130.txt
│   │   ├── write_file_133.txt
│   │   ├── write_file_135.txt
│   │   ├── write_file_146.txt
│   │   ├── write_file_148.txt
│   │   ├── write_file_149.txt
│   │   ├── write_file_155.txt
│   │   ├── write_file_157.txt
│   │   ├── write_file_159.txt
│   │   ├── write_file_16.txt
│   │   ├── write_file_160.txt
│   │   ├── write_file_161.txt
│   │   ├── write_file_163.txt
│   │   ├── write_file_165.txt
│   │   ├── write_file_166.txt
│   │   ├── write_file_17.txt
│   │   ├── write_file_172.txt
│   │   ├── write_file_173.txt
│   │   ├── write_file_174.txt
│   │   ├── write_file_175.txt
│   │   ├── write_file_176.txt
│   │   ├── write_file_177.txt
│   │   ├── write_file_180.txt
│   │   ├── write_file_189.txt
│   │   ├── write_file_190.txt
│   │   ├── write_file_198.txt
│   │   ├── write_file_21.txt
│   │   ├── write_file_219.txt
│   │   ├── write_file_239.txt
│   │   ├── write_file_24.txt
│   │   ├── write_file_27.txt
│   │   ├── write_file_291.txt
│   │   ├── write_file_31.txt
│   │   ├── write_file_317.txt
│   │   ├── write_file_33.txt
│   │   ├── write_file_339.txt
│   │   ├── write_file_34.txt
│   │   ├── write_file_341.txt
│   │   ├── write_file_351.txt
│   │   ├── write_file_353.txt
│   │   ├── write_file_356.txt
│   │   ├── write_file_357.txt
│   │   ├── write_file_36.txt
│   │   ├── write_file_363.txt
│   │   ├── write_file_365.txt
│   │   ├── write_file_37.txt
│   │   ├── write_file_384.txt
│   │   ├── write_file_416.txt
│   │   ├── write_file_420.txt
│   │   ├── write_file_429.txt
│   │   ├── write_file_434.txt
│   │   ├── write_file_44.txt
│   │   ├── write_file_460.txt
│   │   ├── write_file_462.txt
│   │   ├── write_file_465.txt
│   │   ├── write_file_466.txt
│   │   ├── write_file_472.txt
│   │   ├── write_file_474.txt
│   │   ├── write_file_493.txt
│   │   ├── write_file_50.txt
│   │   ├── write_file_51.txt
│   │   ├── write_file_52.txt
│   │   ├── write_file_525.txt
│   │   ├── write_file_529.txt
│   │   ├── write_file_53.txt
│   │   ├── write_file_538.txt
│   │   ├── write_file_54.txt
│   │   ├── write_file_543.txt
│   │   ├── write_file_55.txt
│   │   ├── write_file_57.txt
│   │   ├── write_file_58.txt
│   │   ├── write_file_60.txt
│   │   ├── write_file_63.txt
│   │   ├── write_file_65.txt
│   │   ├── write_file_66.txt
│   │   ├── write_file_67.txt
│   │   ├── write_file_69.txt
│   │   ├── write_file_7.txt
│   │   ├── write_file_71.txt
│   │   ├── write_file_72.txt
│   │   ├── write_file_73.txt
│   │   ├── write_file_75.txt
│   │   ├── write_file_79.txt
│   │   ├── write_file_83.txt
│   │   ├── write_file_84.txt
│   │   ├── write_file_9.txt
│   │   ├── write_file_90.txt
│   │   ├── write_file_92.txt
│   │   ├── write_file_94.txt
│   │   ├── write_file_96.txt
│   │   ├── write_file_99.txt
│   │   ├── write_todos_18.txt
│   │   ├── write_todos_34.txt
│   │   ├── write_todos_361.txt
│   │   ├── write_todos_387.txt
│   │   ├── write_todos_402.txt
│   │   ├── write_todos_406.txt
│   │   ├── write_todos_425.txt
│   │   ├── write_todos_430.txt
│   │   ├── write_todos_433.txt
│   │   ├── write_todos_470.txt
│   │   ├── write_todos_496.txt
│   │   ├── write_todos_50.txt
│   │   ├── write_todos_511.txt
│   │   ├── write_todos_515.txt
│   │   ├── write_todos_534.txt
│   │   ├── write_todos_539.txt
│   │   ├── write_todos_542.txt
│   │   ├── write_todos_56.txt
│   │   ├── write_todos_59.txt
│   │   ├── write_todos_64.txt
│   │   ├── write_todos_66.txt
│   │   ├── write_todos_68.txt
│   │   ├── write_todos_73.txt
│   │   └── write_todos_74.txt
│   ├── tunnel-config.example.yml
│   ├── tunnel-config.yml
│   ├── TUNNEL_ARCHITECTURE.md
│   ├── VECTORIZE_BATCH_MIGRATION.md
│   ├── VECTORIZE_CLEANUP_SCHEDULE.md
│   ├── VECTORIZE_RAG_COMPLETE_SUMMARY.md
│   ├── VS_CODE_INSIDERS_SETUP.md
│   ├── _ARCHIVE_SESSION_COMPLETION_REPORT.md
│   └── _AUDIT/
│   │   └── 2026.03.11.md
├── eslint.config.js
├── extract_cookies.py
├── files/
│   ├── ice_edits.json
│   ├── silver_path_memories.json
│   └── smart_edits.json
├── fix2.py
├── fix_script.py
├── funkcio.md
├── GEMINI.md
├── github-sync.bat
├── inditas.bat
├── Inditsd_Brunellat.bat
├── Inditsd_Brunellat_Stabil.bat
├── konyvtarfa.md
├── last_action.jpg
├── LICENSE
├── list_tables.py
├── litellm_config.yaml
├── logs/
│   ├── archive/
│   │   └── ~6,2.zip
│   ├── brunella.db
│   ├── dashboard.log
│   ├── harvester.log
│   ├── harvest_pipeline.log
│   ├── health.log
│   ├── http.log
│   ├── knowledge_integrator.log
│   ├── node_backend.log
│   ├── orchestrator.log
│   ├── python_backend.log
│   ├── python_backend_err.log
│   ├── startup.log
│   ├── targeted-vitest.log
│   └── web_ui.log
├── mcp-brunella-core.code-workspace
├── mcp-brunella-core.sln
├── mcp_servers.json
├── MEGALLAPITAS.md
├── myai/
│   ├── agents/
│   │   ├── a2a-go/
│   │   ├── a2a-inspector/
│   │   ├── a2a-js/
│   │   ├── a2a-python/
│   │   ├── acme/
│   │   ├── adk-a2a/
│   │   ├── adk-agent-extension/
│   │   ├── adk-samples/
│   │   ├── ADK_WEB_TROUBLESHOOTING.md
│   │   ├── agents-chat/
│   │   ├── agent_architect.toml
│   │   ├── ai-foundry-for-vscode/
│   │   ├── BOBS_BRAIN_SETUP.md
│   │   ├── claude-agent-sdk-demos/
│   │   ├── coding-assistant-agent-example.py
│   │   ├── coding-assistant-tools-example.py
│   │   ├── comet/
│   │   ├── CopywriterAgent.toml
│   │   ├── ev_hunter/
│   │   ├── ev_hunter.toml
│   │   ├── examples/
│   │   ├── frameworks/
│   │   ├── GEMINI_ENTERPRISE_ALTERNATIVES.md
│   │   ├── google-adk-box-agent/
│   │   ├── INTEGRACIOS_UTMUTATO.md
│   │   ├── LaVague/
│   │   ├── lint_fixer.toml
│   │   ├── MarketingDirectorAgent.toml
│   │   ├── openai-agents-js/
│   │   ├── openai-agents-python/
│   │   ├── PROAKTIV_KODIRO_UGYNOK_GUIDE.md
│   │   ├── project_organizer.toml
│   │   ├── README.md
│   │   ├── ready-agents/
│   │   ├── robotkez_v2_hybrid.py
│   │   ├── STARTED_APPS.md
│   │   ├── tech_harvester.py
│   │   ├── TECH_HARVESTER_README.md
│   │   ├── tools/
│   │   └── workers/
│   ├── backend/
│   │   ├── app.py
│   │   ├── config.py
│   │   ├── interpreter_adapter.py
│   │   ├── langgraph_orchestrator.py
│   │   ├── opendevin_adapter.py
│   │   ├── providers.py
│   │   ├── README.md
│   │   ├── schemas.py
│   │   └── __init__.py
│   ├── browser_task_runner.py
│   ├── browser_worker.py
│   ├── chromadb_adapter.py
│   ├── cli.py
│   ├── clients/
│   │   ├── enhanced_invoice_client.py
│   │   ├── gmail_invoice_client.py
│   │   ├── gmail_invoice_fallback.py
│   │   ├── google_sheets_client.py
│   │   ├── szamlazz_hu_client.py
│   │   └── __init__.py
│   ├── config/
│   │   └── sources.json
│   ├── config.py
│   ├── core/
│   │   ├── agent.py
│   │   ├── llm.py
│   │   ├── project.py
│   │   ├── sandbox.py
│   │   ├── tools.py
│   │   ├── vision_worker.py
│   │   └── __init__.py
│   ├── crawl4ai_worker.py
│   ├── data/
│   │   ├── comet_memory.db
│   │   ├── comet_session.json
│   │   ├── screenshots/
│   │   └── training/
│   ├── demo_factory/
│   │   ├── active_a_konyvelo_demo.py
│   │   ├── finance.py
│   │   ├── main.py
│   │   ├── manufacturing.py
│   │   ├── nagyerdei_ingatlan_demo.py
│   │   ├── README.md
│   │   └── templates/
│   ├── examples/
│   │   ├── rag_golden_dataset_walkthrough.ipynb
│   │   └── README.md
│   ├── gmail_invoice_fetcher.py
│   ├── incubator/
│   │   ├── Modelfile.template
│   │   └── train.py
│   ├── interactive.py
│   ├── interactive_browser.py
│   ├── iszapfalo_api/
│   │   ├── main.py
│   │   ├── README.md
│   │   └── requirements.txt
│   ├── mcp_server.py
│   ├── prompts/
│   │   └── ev_hunter_prompt.md
│   ├── pydantic_models.py
│   ├── rag.py
│   ├── refiner/
│   │   ├── invoice_refiner.py
│   │   └── __init__.py
│   ├── refiners/
│   │   ├── enterprise_factory.py
│   │   ├── factory.py
│   │   ├── invoice_parser.py
│   │   ├── product_valuation.py
│   │   └── __init__.py
│   ├── refiner_logic.py
│   ├── requirements.txt
│   ├── robotkez/
│   │   ├── browser.py
│   │   ├── computer_use.py
│   │   └── n8n_anchors.json
│   ├── robotkez_pro/
│   │   ├── main.py
│   │   ├── requirements.txt
│   │   └── training_suite.py
│   ├── sandbox_env/
│   ├── scenarios/
│   │   ├── harvester_extraction_example.json
│   │   ├── job_posting_schema.json
│   │   ├── n8n_level1_basic.json
│   │   ├── n8n_level2_http_request.json
│   │   ├── n8n_level3_conditional.json
│   │   ├── n8n_level4_webhook_api.json
│   │   ├── n8n_login.json
│   │   ├── n8n_simple_test.json
│   │   ├── n8n_training.json
│   │   ├── n8n_training_ui.json
│   │   └── ROBOTKEZ_N8N_TRAINING_PLAN.md
│   ├── schemas/
│   │   ├── invoice.py
│   │   └── __init__.py
│   ├── schemas.py
│   ├── screenshot.png
│   ├── server.log
│   ├── server.py
│   ├── START_DEMO.bat
│   ├── SUMMARY.md
│   ├── sync_to_r2.py
│   ├── tasks/
│   │   ├── corporate_hunter.py
│   │   └── ev_hunter.py
│   ├── tests/
│   │   ├── test_agent.py
│   │   ├── test_browser_worker.py
│   │   ├── test_cli.py
│   │   ├── test_cma_worker.py
│   │   ├── test_computer_use.py
│   │   ├── test_dependencies.py
│   │   ├── test_geo_scraper.py
│   │   ├── test_interactive_browser.py
│   │   ├── test_iron_clad_backend_phase1.py
│   │   ├── test_iron_clad_interpreter_adapter.py
│   │   ├── test_iron_clad_langgraph_phase3.py
│   │   ├── test_iron_clad_opendevin_adapter.py
│   │   ├── test_iron_clad_provider.py
│   │   ├── test_llm.py
│   │   ├── test_machine_hunter.py
│   │   ├── test_mcp_bridge.py
│   │   ├── test_media_factory.py
│   │   ├── test_project.py
│   │   ├── test_rag_embeddings.py
│   │   ├── test_robotkez_comet.py
│   │   ├── test_sandbox.py
│   │   ├── test_structure.py
│   │   ├── test_supply_matcher.py
│   │   ├── test_tools.py
│   │   ├── test_trend_analyst.py
│   │   ├── test_vision_worker.py
│   │   ├── test_workers_lancedb_batch.py
│   │   ├── test_workers_ocr.py
│   │   └── test_workers_web_scraper.py
│   ├── tools/
│   │   ├── harvest_pipeline.py
│   │   ├── HARVEST_PIPELINE_README.md
│   │   ├── integrated_research.py
│   │   ├── jules_auto_sync.py
│   │   ├── knowledge_integrator.py
│   │   ├── mcp_bridge.py
│   │   └── __init__.py
│   ├── upload_trojan_to_sheets.py
│   ├── utils/
│   │   ├── dataset_manager.py
│   │   ├── dependency_detector.py
│   │   ├── lancedb_invoice_helper.py
│   │   ├── page.py
│   │   ├── parser.py
│   │   ├── pdfparser.py
│   │   ├── phoenix_protocol.py
│   │   ├── textsplitter.py
│   │   ├── tts_engine.py
│   │   └── __init__.py
│   ├── vector_db_interface.py
│   ├── workers/
│   │   ├── cma_worker.py
│   │   ├── geo_scraper.py
│   │   ├── google_maps_scraper.py
│   │   ├── icebreaker_generator.py
│   │   ├── lancedb_batch.py
│   │   ├── machine_hunter.py
│   │   ├── machine_scraper.py
│   │   ├── market_scraper.py
│   │   ├── media_factory.py
│   │   ├── ocr_worker.py
│   │   ├── os_worker.py
│   │   ├── route_optimizer.py
│   │   ├── supply_matcher.py
│   │   ├── trend_analyst.py
│   │   ├── vision_worker.py
│   │   └── web_scraper.py
│   ├── workflows/
│   │   └── n8n_lint_fixer_automation.json
│   └── __init__.py
├── n8n/
│   └── workflows/
│   │   └── market_watcher_report.json
├── n8n-current-state.png
├── n8n-signin-after-attempt.png
├── n8n-signin.png
├── n8n-workflows-list.md
├── n8nv2/
│   ├── AGENTS.md
│   ├── assets/
│   │   ├── n8n-logo.png
│   │   ├── n8n-screenshot-readme.png
│   │   └── n8n-screenshot.png
│   ├── biome.jsonc
│   ├── CHANGELOG.md
│   ├── CLAUDE.md
│   ├── codecov.yml
│   ├── CODE_OF_CONDUCT.md
│   ├── CONTRIBUTING.md
│   ├── CONTRIBUTOR_LICENSE_AGREEMENT.md
│   ├── cubic.yaml
│   ├── docker/
│   │   └── images/
│   ├── jest.config.js
│   ├── lefthook.yml
│   ├── LICENSE.md
│   ├── LICENSE_EE.md
│   ├── package.json
│   ├── packages/
│   │   ├── @n8n/
│   │   ├── cli/
│   │   ├── core/
│   │   ├── extensions/
│   │   ├── frontend/
│   │   ├── node-dev/
│   │   ├── nodes-base/
│   │   ├── testing/
│   │   └── workflow/
│   ├── patches/
│   │   ├── @lezer__highlight.patch
│   │   ├── @types__express-serve-static-core@5.0.6.patch
│   │   ├── @types__uuencode@0.0.3.patch
│   │   ├── @types__ws@8.18.1.patch
│   │   ├── assert@2.1.0.patch
│   │   ├── bull@4.16.4.patch
│   │   ├── element-plus@2.4.3.patch
│   │   ├── ics.patch
│   │   ├── js-base64.patch
│   │   ├── minifaker.patch
│   │   ├── pdfjs-dist@5.3.31.patch
│   │   ├── pkce-challenge@5.0.0.patch
│   │   ├── v-code-diff.patch
│   │   ├── vue-tsc@2.2.8.patch
│   │   └── z-vue-scan.patch
│   ├── pnpm-lock.yaml
│   ├── pnpm-workspace.yaml
│   ├── README.md
│   ├── renovate.json
│   ├── scripts/
│   │   ├── backend-module/
│   │   ├── block-npm-install.js
│   │   ├── build-n8n.mjs
│   │   ├── check-workspace-deps.mjs
│   │   ├── dockerize-n8n.mjs
│   │   ├── ensure-zx.mjs
│   │   ├── format.mjs
│   │   ├── generate-third-party-licenses.mjs
│   │   ├── os-normalize.mjs
│   │   ├── prepare.mjs
│   │   ├── reset.mjs
│   │   ├── scan-n8n-image.mjs
│   │   └── third-party-license-format.json
│   ├── security/
│   │   ├── trivy-ignore-policy.rego
│   │   ├── trivy.yaml
│   │   └── vex.openvex.json
│   ├── SECURITY.md
│   ├── tsconfig.json
│   ├── turbo.json
│   └── vitest.workspace.ts
├── npm-test-failures-extract-extended.log
├── npm-test-failures-extract.log
├── npm-test-output.log
├── nul
├── Ollama
├── open-interpreter/
│   ├── Dockerfile
│   ├── docs/
│   │   ├── assets/
│   │   ├── code-execution/
│   │   ├── computer/
│   │   ├── CONTRIBUTING.md
│   │   ├── getting-started/
│   │   ├── guides/
│   │   ├── integrations/
│   │   ├── language-models/
│   │   ├── legal/
│   │   ├── mint.json
│   │   ├── NCU_MIGRATION_GUIDE.md
│   │   ├── protocols/
│   │   ├── README_DE.md
│   │   ├── README_ES.md
│   │   ├── README_IN.md
│   │   ├── README_JA.md
│   │   ├── README_UK.md
│   │   ├── README_VN.md
│   │   ├── README_ZH.md
│   │   ├── ROADMAP.md
│   │   ├── safety/
│   │   ├── SAFE_MODE.md
│   │   ├── SECURITY.md
│   │   ├── server/
│   │   ├── settings/
│   │   ├── style.css
│   │   ├── telemetry/
│   │   ├── troubleshooting/
│   │   └── usage/
│   ├── examples/
│   │   ├── custom_tool.ipynb
│   │   ├── Dockerfile
│   │   ├── interactive_quickstart.py
│   │   ├── jan_computer_control.ipynb
│   │   ├── JARVIS.ipynb
│   │   ├── local3.ipynb
│   │   ├── local_server.ipynb
│   │   ├── Open_Interpreter_Demo.ipynb
│   │   ├── organize_photos.ipynb
│   │   ├── README.md
│   │   ├── screenpipe.ipynb
│   │   └── talk_to_your_database.ipynb
│   ├── installers/
│   │   ├── oi-linux-installer.sh
│   │   ├── oi-mac-installer.sh
│   │   ├── oi-windows-installer-conda.ps1
│   │   └── oi-windows-installer.ps1
│   ├── interpreter/
│   │   ├── computer_use/
│   │   ├── core/
│   │   ├── terminal_interface/
│   │   └── __init__.py
│   ├── LICENSE
│   ├── pyproject.toml
│   ├── README.md
│   ├── scripts/
│   │   └── wtf.py
│   └── tests/
│   │   ├── config.test.yaml
│   │   ├── core/
│   │   └── test_interpreter.py
├── package-lock.json
├── package.json
├── paios.config.yaml
├── plan.md
├── plans/
│   └── master-track-finalization-hu.md
├── playwright-report/
│   ├── data/
│   │   ├── 00faeb4829a43a1106a69eb82e2aa83089fa709f.png
│   │   ├── 023f5e30af8c9ff8acd0f94bf2fee57747ddac41.webm
│   │   ├── 02d11f3ba19fae31cc5cf4a7adef38417d3ffcaa.webm
│   │   ├── 04167d13fc2fb721964be1b14bf6aa2123e0448c.webm
│   │   ├── 07f537eacb57d095056b2aae0b26ce0740091aa2.webm
│   │   ├── 0957f2e4e9c1922fbc80fdbb1e81caed6c8fe2fa.webm
│   │   ├── 0d615187cec46dc58c2dc361b2bdef459adc3eb0.webm
│   │   ├── 0e052addba008c32675092677f5e37ceea1cd046.webm
│   │   ├── 0fd92ac2b4e26432893f509061b776f2ff56fa11.png
│   │   ├── 105893a9d22c9b7149f9b8f7cd94bb36e5350846.webm
│   │   ├── 157a8ad298010c593689e4fddfde7470c46dbb67.webm
│   │   ├── 158309ffc8f39e73ed2f9d10a9ab29a73e0f691a.png
│   │   ├── 167918dfae9f61b94cb44b69d64e4e2f121fb5d3.webm
│   │   ├── 18734ccd39361f3c237090210455f3b828299f3e.webm
│   │   ├── 1947fb1af218fee420dae46f21586de380afd4b2.md
│   │   ├── 1a4483f70eeec31037b2385e73d2c772e0ffafdc.webm
│   │   ├── 1d1e61357cd44c1ec7d2a38a110ef2e47b1d29e5.webm
│   │   ├── 2172a9230edc440bbb188a3daad9b2ae441f777b.webm
│   │   ├── 21f539bf62601c4f13d893f539220f705324e7fc.webm
│   │   ├── 2321dc0ee73c56bbc41d67be01aa787501d816c9.png
│   │   ├── 237aa6a1019c1d29472ba055a5005a390de6a3dc.webm
│   │   ├── 261b02bd0768c575add7f3c4a777be7204b3d4e9.png
│   │   ├── 2852394cb2ff7408fe7104683e361610305b53a5.webm
│   │   ├── 2882491624558bd5b129ecf530b113aff499c5e8.webm
│   │   ├── 298fc6968a70cfd3b436f1632c930ac4ea860430.webm
│   │   ├── 2a65db286464c041c9f12a1d360fff0c3104f643.png
│   │   ├── 2ab3866fa002950871cce176c8f16f4922ed9854.webm
│   │   ├── 2beaf38ab2ff965f006804568c9172556ef2aa24.png
│   │   ├── 2bfd7cc1dfdfcae886e46fda3e0be4af822e801c.webm
│   │   ├── 2f2eb7167f03bec960d00732e7484711457b14e7.webm
│   │   ├── 2f6926f74d873ded5c8197a4e271cacaded40941.webm
│   │   ├── 2fe54b89a5a15e0cb7835d7e2ad03e02f6f3045e.webm
│   │   ├── 30b13b3a8c37b3c7e0c2b41b5d13793fc6d8757f.md
│   │   ├── 30f15c58c0d6b4af4ff30f774c82ed48de4709a4.png
│   │   ├── 311a1e2dfa8f6eae4b5a2b975b0c33d6f15457ce.webm
│   │   ├── 31754841dda88211020d28f238b987d61eebfe47.webm
│   │   ├── 3371b83690ebd28d1e09499b4725256396120b67.webm
│   │   ├── 36549e7c9bbd480f1b180ddc93563d1816f89666.png
│   │   ├── 382410cb82f77827562bf66ecb39f817e0da99ea.png
│   │   ├── 3935146827860d63447ea94f58bfa416fee13129.png
│   │   ├── 3950fe421ae310c064444a93bb9c5092c781f1b8.webm
│   │   ├── 3b0f8cea6b6ac6614e7822c6965d0bbf45780be5.webm
│   │   ├── 3b5558b1470686f09222aa68d18dae43c938bf2b.png
│   │   ├── 3c072b873fd6019503fd66171c3d6e758e59df43.png
│   │   ├── 3cf37cb1478fd217492e1075ba8d7d1931b6b968.png
│   │   ├── 3d45950573d69169c4487438d2d2866e3ff3580c.webm
│   │   ├── 3daa9d792312137f02c40cb340977659d919b9f6.webm
│   │   ├── 3ef0cfdc7d6963b25be4f78544f1e664c4ac7a57.webm
│   │   ├── 41f2d16e5f16d545591bff38e16b957c4923ea8d.webm
│   │   ├── 4309997ccd96ec02387cafeceadab0b34c848cc1.png
│   │   ├── 44824f6db20409137a04937ea8ce0459c9c50389.webm
│   │   ├── 44dfb3264e4908d9c922440b334d85f6f88bc99c.webm
│   │   ├── 45697e8cda1113142d69d234c405b1bc81d39837.webm
│   │   ├── 468b8f3c82609f46af1c3782d7f8dfa65740fc20.webm
│   │   ├── 478f014bbcb3c99fc33c07834778c12cdef3b3cd.webm
│   │   ├── 4b3d139c1c7cb9869eebef0dea4f25b02f0c212f.png
│   │   ├── 4b4b8d76443bf8999144df3437dae4489af8b102.png
│   │   ├── 4d50757dc6aad78e3b2cced7e99e9066cef02567.webm
│   │   ├── 4ed74eb5c52425ac831c56fd66b71e2a57198f9c.png
│   │   ├── 4fcc307265616dd3db8368881206fda47d5fea67.png
│   │   ├── 50215af758d280375a74f3ba17507049ed1f19ac.md
│   │   ├── 507bde7754105a166260a5114ca62341dba0b7c9.png
│   │   ├── 50ba91565eec72e9218548918da23e14accc00e3.webm
│   │   ├── 50cd0d71b224cc24ce76ec6f9a9e4473555a40fb.webm
│   │   ├── 539c873127e18bce7bae8ffa1cb4a0dc386b82a3.webm
│   │   ├── 53c40a84ded23f875cdc1e59f6bd93d48a446a0a.md
│   │   ├── 54a0cac73c16f8bed79d8c2c952d16ee56c6ac74.md
│   │   ├── 55c8a0b3b411d2de06788d24761b8607c396a117.webm
│   │   ├── 56002da61b048802e9a14e64e39461388e6914d6.webm
│   │   ├── 561cbd6e20de0069257bd98eda990c63e24621a5.webm
│   │   ├── 569f100bcdc1db560d2bd34efb71fe3d4ea003e6.webm
│   │   ├── 58413cf8eb643c1d457fea139911244e230140c8.webm
│   │   ├── 586ea471aebed8f87104309c4747fa0c80950908.webm
│   │   ├── 588d963200f9df731769d30383b36fe101e0e0ef.webm
│   │   ├── 58b0b75ab3380066a449cc123937aafcecc0bc4c.webm
│   │   ├── 5a4bf30d8b80bce46a70d6de59a2bdf67ca256ab.webm
│   │   ├── 5bfbcf9af0061aac8dde72f2fe203f9349024d7a.png
│   │   ├── 5c8e0739c1e2a20690a28fddacea15fdc4b586e5.png
│   │   ├── 5dcaf8ec7a6736f5f7843e25e1362493249058cd.webm
│   │   ├── 5ecb0143dd117f03f9bda41d97d509c557926fc8.webm
│   │   ├── 5f7cac17696d07f4097c7f5e5c2bd26c26ccb285.webm
│   │   ├── 6061a3112302d53de8648273b916b30dc6ed5e35.webm
│   │   ├── 61eb51d2d31b391bdfac6f00233dfdaf1b14aee0.webm
│   │   ├── 624edf99b492f089a3af0cb1242a6432a8956c08.webm
│   │   ├── 627bf37c3467987f62f1c9bb450c0bbb114e048b.webm
│   │   ├── 66c6216bbb80ffe42c8a8e64522dffb1095cd07b.png
│   │   ├── 677767ae64b66015c30ca937779e5c2b87111d30.webm
│   │   ├── 6a38a5568bf6cd88720c92918f7f1ae77510ca65.webm
│   │   ├── 6b197d4dc096380e619136c7957dd9943f8fbb25.webm
│   │   ├── 6bc8cc53ff149ad92204c5c91d3c8d269ff7ef05.png
│   │   ├── 6caf69b0f641be652598378720adeb4f28e89853.png
│   │   ├── 6cc9ee687c64195cbfa4e5750f6209ccaa328150.webm
│   │   ├── 6fed77a835d2079d5730edc10d825f9d05d4d12c.webm
│   │   ├── 702858682345c8b6807013897e9af471b54031f3.webm
│   │   ├── 710499006e2acb684af0e7a19e2b228a46611668.png
│   │   ├── 71c1cfd9059589b9a5a0e616c6c1e113b17bd307.png
│   │   ├── 72da0db232300b74ccb650d3e71a24e164b41a24.webm
│   │   ├── 747f445162ef25bc61c352bc6b7ed068fcabafcd.webm
│   │   ├── 7503b8c161c340cd7dd114f708305fc34f94f4c9.webm
│   │   ├── 77ef59275adc53448fed6dbb55b90a9454af1aee.webm
│   │   ├── 783e5f0418c1839f77fbcff841bbb1231c8b6c5a.webm
│   │   ├── 787e468ccba07691f2f369c67784f413597c6146.png
│   │   ├── 789f26d999e51dd47bfa01270b481dfb38020398.webm
│   │   ├── 7962b5f9156f55cf2ec7b1afe085fd3dd6737fc8.webm
│   │   ├── 7a33d5db6370b6de345e990751aa1f1da65ad675.png
│   │   ├── 7aac4a3641ae88d09a86f379b39651b6a40f1594.webm
│   │   ├── 7b47581ea8bc787fe2e1d44bdaed2bfde632042b.webm
│   │   ├── 7c1375472e462ee9e4bde8d090d8f8113c105cf6.png
│   │   ├── 7e5ff79b693d51f4dc031fb070095588977e8f00.webm
│   │   ├── 7eb926805fbe35004918fe7d89967e931159b273.png
│   │   ├── 81672871c0f2ae9c499eb58c1debe7f7705d08be.webm
│   │   ├── 818843610596459bbe6afed400df741cf2afebaf.png
│   │   ├── 8479bde85d5a165dde788cec6ebcc0b6a94e5ad0.png
│   │   ├── 861cda5f3511b91b0256f5867e8ddd5470508aa2.webm
│   │   ├── 8621715f0c2fc18985a82602944dec80991c6fe7.webm
│   │   ├── 865d80fe7b999e647c09f3adaaf0dabf740048fe.webm
│   │   ├── 89eb140a16422498f639d1d3c5728e404edc1194.webm
│   │   ├── 8b572d17abb7c86ef3824ed6017c8a9de7bb0fb4.webm
│   │   ├── 8c48191bab6028a5a9dddbc17b3584cddb7fd7c5.webm
│   │   ├── 8eb1574e23c236a000ec5ac1af69c62a6c6c0653.webm
│   │   ├── 902b04ad820767caa838d1475273e346f90d5ced.webm
│   │   ├── 9255c927e5a53154332eb8709c1d4697aeeb4590.webm
│   │   ├── 93bbe30a44ab29a3a437ffe5969bcb8e1a97e353.webm
│   │   ├── 95369bd3e2315ad8764cc3322850c775b38363c9.webm
│   │   ├── 9599b440310c66022358f41afbc48a105e2e2527.png
│   │   ├── 96ef5470aa97e9d8288cfd46b510d00812b0fa7c.webm
│   │   ├── 973e371717f258cb165115f79cd376e0da0e09e7.webm
│   │   ├── 97db6600ca0884652e589cb8421d3eb6502e90f0.webm
│   │   ├── 98d377c7116f4f6005f65af0bf5d191dd1ede701.webm
│   │   ├── 99c2bb4164b9e692c2c30517e6877f5b70f27c74.webm
│   │   ├── 9a54bd17435be68afd912ab62ff45b4772cb49f0.png
│   │   ├── 9b963b5877f8e3017d8b2930ed015e9c7ce8cfcc.webm
│   │   ├── 9bc52302fb6e4297c18e91d314d7c4b84564fafc.webm
│   │   ├── 9d4bf9a3e0f9e12ad9c4f71fb2571304caaefc33.webm
│   │   ├── 9f3912fb7bbf9a56f7ca3c570af0977b87fe6071.webm
│   │   ├── a01930b4e333ea85545ae3ab05097b53256aa231.webm
│   │   ├── a085e38f7fa69b8bb0f8dcb80c31c1825491620f.webm
│   │   ├── a2d17ff00e04fbd249205f26b03e91ac74eee136.webm
│   │   ├── a3033d2236bba1a60d2aaa9d2f8b17ddcf00bdc3.webm
│   │   ├── a405f39c1e2244bf90efe0d0531c4974fd9743d3.webm
│   │   ├── a6ea9978852a6a4b5d1d32855e6cdddc120d85c2.webm
│   │   ├── a7bb19b6c80e2ceffd072c06e2207153ac37b63c.png
│   │   ├── a8c96d0f3b10f64b2ea125d9f8f6e463a0284a93.png
│   │   ├── ab08fc25671e23eea87c337cdcf5d2adeeff2e58.webm
│   │   ├── ad87b448ddb2ecfb06e6338cc6e3de46821cff56.webm
│   │   ├── ae9093d1b601bc5281a55f3e3e05a93021dd4ca5.png
│   │   ├── af351bc5b2e6afabcad607e65829b0dd5ebdbce0.webm
│   │   ├── b1dada5e1898d6eaf8210d5ebd1df8ca5db893b4.webm
│   │   ├── b2e65bc641d7919dcf76d5393a02a4658d1c60f9.webm
│   │   ├── b6607d52a0b548f9942e5d0e141d04a7f58df12e.webm
│   │   ├── b8e0bce7fbf646873fb27e435c6338daaed49963.webm
│   │   ├── b977fbfad85d1ee683786b09bf11de3bb68af641.webm
│   │   ├── b9c2197da1d882889239250bb06611fa9ffae10c.webm
│   │   ├── ba11869f9ba8282ac9efda97218ced1cf16d8070.webm
│   │   ├── bb4c75857787c2adeb64fb62d583b642b6f45c53.webm
│   │   ├── bc802a31f45e78fa2ef32c30886b8ace8acf2bf2.png
│   │   ├── be2a374fbb4ab46081346ff4cdf055053b027d22.png
│   │   ├── c4687e7850e49aabaa4dfe748600006f1d1bf4d9.png
│   │   ├── c4a3b0221fd342acaed496b35d6bd75d5a85b0d1.webm
│   │   ├── c552555b4c6cfaf40196434ad83b9ff03e33681e.webm
│   │   ├── c92ee814e2c373704ac71171483ee3d01c936353.webm
│   │   ├── c9bc675d5d32628848ffc804e04dd93aad87f4b3.webm
│   │   ├── c9cc65e07ea705612659217d07f6da8940a755ff.webm
│   │   ├── cb88ca92a8e639feb5aa1685c9429e6af792bb9e.webm
│   │   ├── cc775f6ec38f46a874fc9970b91fd407ad18602a.webm
│   │   ├── cca3e24c6a407d508944bedeb16d27ecf7bb04ba.png
│   │   ├── cdf4b8a827044c853cff6bf5dc7c3d5fa6c51869.md
│   │   ├── cf27fd39e7f1a82d8cd0f90639bac05a1e838f45.webm
│   │   ├── d04c09d08cf5ecd9d00a86f56d333d7b393fbd5f.webm
│   │   ├── d0f2e39495232e618371080dba279987bcffc918.webm
│   │   ├── d1284d8ff026119e54c193987cca49f77d14167a.webm
│   │   ├── d152e8436b1b79480a9fd82d8d3b57a674957635.webm
│   │   ├── d18121ea2b160c4809a852df9d48ea5fa988caac.webm
│   │   ├── d62ad99c0d6745fcfb841cc27cb70a1a0d95bba7.webm
│   │   ├── d7ae5961680a93ea20cf4feaf8d7609131a1ac4c.webm
│   │   ├── d8b120ef53dc5806cd23c196d469dd916ce03201.webm
│   │   ├── d9fd106cf14dcf04ba535f5cf173efa9aa0f8e25.webm
│   │   ├── dbbdf7c47e3c1eaac4d66bf5f273f6dfe7cbb0f1.png
│   │   ├── debc883d116e7c0c896085a1e07e8611d515c4df.png
│   │   ├── e54c932207589013ffe5718d131a3fa8a8419f06.md
│   │   ├── e5fa20170086ab937838333cc3ed33606737e1cd.webm
│   │   ├── e7daf44eccedf1447674d3577ca975f1186436e0.webm
│   │   ├── e8c2db7f245843f62cf3a38127f6e60234c2430b.webm
│   │   ├── e8c34059ed80184ad0822d773a5f4f416a3255a4.webm
│   │   ├── e960845e82debdc74bc1d640485fe4a355c797f6.webm
│   │   ├── ea1cf2db554a4d2f98abf315dee20fca73c4e6fd.webm
│   │   ├── eb66ba05522b7d3c6f271aeb0615c55b2e752268.webm
│   │   ├── eb8e726bca76b0baa39ea9030123ba6f7a1dd1cb.png
│   │   ├── ed46d7a4e126cf38a39ae1998fc336e511f08966.webm
│   │   ├── ed4b8f37e7c1f278c4daa4743830c03082ddaa9e.webm
│   │   ├── ed8bc22c2f0f0b7dbe0360a026ab6eb2983f4a7e.webm
│   │   ├── edbc7093ba92df5fc4d610f5b317be4447a56d35.webm
│   │   ├── eea128a828d33027f27e7015ab891efd77ddaf1b.webm
│   │   ├── ef5549b14ae97fe486873ed1ecc5e67e80d7486e.png
│   │   ├── f116e65b33fd7c220992af14133c2446abe0110d.png
│   │   ├── f48b977d356144cdf73cbc35d5058b375b97c986.webm
│   │   ├── f4ade417799360fdf51d39df9e731d3918e129f4.webm
│   │   ├── f4c3ad3fac75bf667f295fac805184e30c657ab8.webm
│   │   ├── f52b89a8560af09f24d6d239e48508603757de83.webm
│   │   ├── f614c341c59523fe694808ad6f7fd87907cd88b0.webm
│   │   ├── f7971a77d41b6bd503c3d013b3316e93f4d6cd9e.webm
│   │   ├── f98449b15d57ec01609160824b32da7b8968f0ef.md
│   │   ├── fe7d26586a6e4045260bd43bd00177dea2bbd028.webm
│   │   └── ff2b8009719566910776c4c6a7611023fa4bb381.md
│   ├── index.html
│   └── trace/
│   │   ├── assets/
│   │   ├── codeMirrorModule.DYBRYzYX.css
│   │   ├── codicon.DCmgc-ay.ttf
│   │   ├── defaultSettingsView.7ch9cixO.css
│   │   ├── index.BDwrLSGN.js
│   │   ├── index.BVu7tZDe.css
│   │   ├── index.html
│   │   ├── manifest.webmanifest
│   │   ├── playwright-logo.svg
│   │   ├── snapshot.html
│   │   ├── sw.bundle.js
│   │   ├── uiMode.Btcz36p_.css
│   │   ├── uiMode.CQJ9SCIQ.js
│   │   ├── uiMode.html
│   │   └── xtermModule.DYP7pi_n.css
├── playwright.config.ts
├── pnpm-lock.yaml
├── PROJEKT_DIAGRAM.md
├── public/
│   └── index.html
├── pyproject.toml
├── README.md
├── RENDSZER_DIAGRAM.md
├── requirements.txt
├── restore.json
├── run-tests.cjs
├── schemas/
│   ├── audit.sql
│   ├── checkpoint.sql
│   ├── settings.schema.json
│   └── telemetry.sql
├── scripts/
│   ├── ai-chat-log.js
│   ├── analyze_and_fix_02.py
│   ├── audit_workspace.ts
│   ├── bas_start_session.ps1
│   ├── cean-phase2a-setup.ps1
│   ├── check_tasks.js
│   ├── cleanup-root.bat
│   ├── cleanup_old_vectors.ts
│   ├── cloudflare_check_workers.py
│   ├── compare_registries.js
│   ├── conductor_diagnostics.mjs
│   ├── copilot-dashboard.js
│   ├── copilot-dispatch.ps1
│   ├── copilot-mcp-config.json
│   ├── copilot-route.js
│   ├── copilot-with-brunella.bat
│   ├── copilot-with-brunella.ps1
│   ├── daily_trigger.ts
│   ├── debug_robotkez.py
│   ├── deploy-lead-intelligence.bat
│   ├── deploy_fixer_prompt.md
│   ├── deprecated/
│   │   ├── commit.bat
│   │   ├── commit_recovery.bat
│   │   ├── commit_restoration.bat
│   │   ├── commit_testing.bat
│   │   ├── pull_model.js
│   │   └── test_ollama.js
│   ├── find_missing_agents.js
│   ├── fire_test_invoice_sync.ts
│   ├── fix_n8n_credentials.mjs
│   ├── generate-ai-context.js
│   ├── generate_tools_inventory.mjs
│   ├── generate_tree.mjs
│   ├── github_token_help.txt
│   ├── git_sync.ps1
│   ├── gmail_iszapfalo_extract.py
│   ├── gmail_iszapfalo_extract.py.bak
│   ├── health_check.js
│   ├── health_check.ts
│   ├── init_lancedb.py
│   ├── jules-sync.bat
│   ├── jules_api_client.py
│   ├── jules_check.mjs
│   ├── jules_cli_wrapper.py
│   ├── JULES_SYNC_README.md
│   ├── jules_sync_watchdog.py
│   ├── konyveles_discovery_run.js
│   ├── launchers/
│   │   ├── launch_anythingllm_console.bat
│   │   ├── launch_backend_console.bat
│   │   ├── launch_dashboard_console.bat
│   │   ├── launch_ollama_console.bat
│   │   ├── launch_python_api_console.bat
│   │   └── launch_windows_bridge_console.bat
│   ├── log_rotate.bat
│   ├── migrate-embeddings.ts
│   ├── migrate_lancedb_to_vectorize.ts
│   ├── Modelfile.nightly
│   ├── monitor_loop.py
│   ├── monitor_workflows.sh
│   ├── nightly_train.ps1
│   ├── patch_gmail.py
│   ├── pre-commit-docs.cjs
│   ├── precommit-lint.mjs
│   ├── register_nightly_task.ps1
│   ├── repair_registry_from_agents.mjs
│   ├── robotkez_cli.py
│   ├── robotkez_test_level1.py
│   ├── robotkez_test_level2_n8n.py
│   ├── robotkez_test_level3_monitoring.py
│   ├── rotate_api_keys.ps1
│   ├── run.cmd
│   ├── run_2026_campaign.ts
│   ├── run_ev_hunter.ps1
│   ├── run_jules_self_heal.mjs
│   ├── security_check.mjs
│   ├── setup-d1-advanced.ps1
│   ├── setup-d1-ascii.ps1
│   ├── setup-d1-auto.ps1
│   ├── setup-d1-interactive.bat
│   ├── setup-d1-interactive.ps1
│   ├── setup-d1-simple.ps1
│   ├── setup-d1.ps1
│   ├── setup_bas_update.ps1
│   ├── setup_invoice_automation.ps1
│   ├── setup_jules_sync_task.ps1
│   ├── setup_log_rotate_task.ps1
│   ├── smoke.mjs
│   ├── sophistication_test.ts
│   ├── spec-freeze-check.cjs
│   ├── start-chrome-acp.bat
│   ├── start-chrome-acp.ps1
│   ├── start-litellm.bat
│   ├── start-litellm.sh
│   ├── startup_smoke_test.ts
│   ├── start_architect.ps1
│   ├── start_brunella.ps1
│   ├── start_coder.ps1
│   ├── start_default.ps1
│   ├── start_remote.ps1
│   ├── start_server_debug.ps1
│   ├── sync-agent.js
│   ├── sync.bat
│   ├── sync.ps1
│   ├── sync.sh
│   ├── sync_conductor.py
│   ├── sync_foszal.py
│   ├── sync_gemini_app.ps1
│   ├── SYNC_README.md
│   ├── test-workflow.yaml
│   ├── test_bridge.ts
│   ├── test_cf_browser_api.ps1
│   ├── test_cf_browser_rendering.ps1
│   ├── test_cf_workers_ai.ps1
│   ├── test_cloudflare_agents.py
│   ├── test_cloudflare_history.ts
│   ├── test_prepare.cjs
│   ├── test_swarm.ts
│   ├── test_webhook_e2e.ts
│   ├── trigger_golden_run.ts
│   ├── trigger_golden_run_property.ts
│   ├── update_master_context.ts
│   ├── update_ollama_model.bat
│   └── watch-changes.js
├── SECURITY.md
├── server_output.log
├── show_tasks_db_tables.py
├── src/
│   ├── agents/
│   │   ├── AgentArchitect.ts
│   │   ├── agentLoader.ts
│   │   ├── AgentManager.ts
│   │   ├── agentRouting.ts
│   │   ├── ApifyScrapingAgent.ts
│   │   ├── ArchitectAgent.ts
│   │   ├── BankAgent.ts
│   │   ├── BaseAgent.ts
│   │   ├── CampaignGeneratorAgent.ts
│   │   ├── ChromeDevToolsAgent.ts
│   │   ├── cloudflare/
│   │   ├── codeReview.ts
│   │   ├── codeScaffold.ts
│   │   ├── CometBrowserAgent.ts
│   │   ├── ConflictMediatorAgent.ts
│   │   ├── contextBuilder.ts
│   │   ├── coverageAnalysis.ts
│   │   ├── CriticAgent.ts
│   │   ├── DataScientistAgent.ts
│   │   ├── DependencyGraphAgent.ts
│   │   ├── DeveloperAgent.ts
│   │   ├── developerPipeline.ts
│   │   ├── DevOpsAgent.ts
│   │   ├── DigitalHeadhunterAgent.ts
│   │   ├── DigitalOfficeManager.ts
│   │   ├── DocsIntelligenceAgent.ts
│   │   ├── DynamicAgent.ts
│   │   ├── DynamicAgentLoader.ts
│   │   ├── EdgeProxyAgent.ts
│   │   ├── EmailAgent.ts
│   │   ├── EmailTriageAgent.ts
│   │   ├── EnterpriseOrchestrator.ts
│   │   ├── EnterpriseOrchestratorAgent.ts
│   │   ├── EvaluatorAgent.ts
│   │   ├── evolution/
│   │   ├── federation/
│   │   ├── FinanceGuardian.ts
│   │   ├── FinancialGuardAgent.ts
│   │   ├── GenesisOrchestrator.ts
│   │   ├── GitHubModelsAgent.ts
│   │   ├── gitIntegration.ts
│   │   ├── GrantHunter.ts
│   │   ├── GrantWatcherAgent.ts
│   │   ├── HeadHunterAgent.ts
│   │   ├── InnovationBridgeAgent.ts
│   │   ├── InvoiceAutomationAgent.ts
│   │   ├── KnowledgeBaseBuilderAgent.ts
│   │   ├── KnowledgeBuilder.ts
│   │   ├── LawDetectiveAgent.ts
│   │   ├── LeadMiningAgent.ts
│   │   ├── LintFixerAgent.ts
│   │   ├── LocalCSRAgent.ts
│   │   ├── LocalCSRBot.ts
│   │   ├── LogisticsDispatcher.ts
│   │   ├── LogisticsDispatcherAgent.ts
│   │   ├── MarketingAgent.ts
│   │   ├── MarketingDirectorAgent.ts
│   │   ├── MarketIntelAgent.ts
│   │   ├── matcher.ts
│   │   ├── MatchingAgent.ts
│   │   ├── middleware/
│   │   ├── NavAgent.ts
│   │   ├── NurturerAgent.ts
│   │   ├── OrchestratorAgent.ts
│   │   ├── permissions.ts
│   │   ├── PricingAgent.ts
│   │   ├── ProactiveClaimsAgent.ts
│   │   ├── ProcurementAgent.ts
│   │   ├── ProjectConductorAgent.ts
│   │   ├── PropertyAnalystAgent.ts
│   │   ├── PropertyVisionaryAgent.ts
│   │   ├── PythonAgent.ts
│   │   ├── registry.json
│   │   ├── registryStandard.ts
│   │   ├── registryValidation.ts
│   │   ├── ResearcherAgent.ts
│   │   ├── RobotkezAgent.ts
│   │   ├── RobotkezV2Agent.ts
│   │   ├── SalesAgent.ts
│   │   ├── SalesHunterAgent.ts
│   │   ├── schemas/
│   │   ├── scoring/
│   │   ├── SentimentAnalysisModule.ts
│   │   ├── SheetsSyncAgent.ts
│   │   ├── specStatus.ts
│   │   ├── SpecWriterAgent.ts
│   │   ├── swarm/
│   │   ├── TaskDecomposerAgent.ts
│   │   ├── taskDecomposerCore.ts
│   │   ├── taskQueue.ts
│   │   ├── types.ts
│   │   ├── UXDesignerAgent.ts
│   │   └── VoiceAgent.ts
│   ├── analytics.ts
│   ├── cli/
│   │   ├── bookkeepingCommands.ts
│   │   ├── browserCopilotCommands.ts
│   │   ├── chromeAcpCommands.ts
│   │   ├── commands/
│   │   ├── conductorCommands.ts
│   │   ├── crawl4aiCommands.ts
│   │   ├── dashboardCommands.test.ts
│   │   ├── dashboardCommands.ts
│   │   ├── devCommands.ts
│   │   ├── edgeCommands.ts
│   │   ├── goldCommands.ts
│   │   ├── guardrailsCommands.ts
│   │   ├── invoiceCommands.ts
│   │   ├── invoiceSync.ts
│   │   ├── leadCommands.ts
│   │   ├── marketCommands.ts
│   │   ├── memoriaCommands.ts
│   │   ├── memoryCommands.ts
│   │   ├── observabilityCommands.ts
│   │   ├── progressCommands.ts
│   │   ├── propertySalesCommands.ts
│   │   ├── robotkezCommands.ts
│   │   ├── scheduledTasksCommands.ts
│   │   ├── securityCommands.ts
│   │   ├── suggestedTasksCommands.ts
│   │   ├── swarmCommands.ts
│   │   ├── taskCommands.ts
│   │   ├── taskDecomposerCommands.ts
│   │   ├── toolDiscoveryCommands.ts
│   │   ├── tracksCommands.ts
│   │   ├── workflowCommands.ts
│   │   └── workspaceCommands.ts
│   ├── cli-edge.ts
│   ├── cli-hu.ts
│   ├── cli-jules-interactive.ts
│   ├── cli.ts
│   ├── clients/
│   │   └── navClient.ts
│   ├── config/
│   │   ├── index.ts
│   │   ├── paiosConfig.ts
│   │   └── schema.ts
│   ├── connectors/
│   │   ├── gdriveConnector.ts
│   │   └── imapConnector.ts
│   ├── core/
│   │   ├── adaptiveFlow.ts
│   │   ├── agentStateMachine.ts
│   │   ├── assistantBlueprint.ts
│   │   ├── auditLog.ts
│   │   ├── autonomousInfraRuntime.ts
│   │   ├── bifrost_gateway.ts
│   │   ├── ceanFallback.ts
│   │   ├── checkpoint.ts
│   │   ├── codebaseIndexer.ts
│   │   ├── collectiveMind.ts
│   │   ├── copilotBridgeState.ts
│   │   ├── copilotCognitiveBridge.ts
│   │   ├── dagEngine.ts
│   │   ├── deviceOrchestrator.ts
│   │   ├── dynamicToolRegistry.ts
│   │   ├── edgeHealthMonitor.ts
│   │   ├── edgeRouter.ts
│   │   ├── eventBus.ts
│   │   ├── failoverRegistry.ts
│   │   ├── geneticFlow.ts
│   │   ├── githubAPIClient.ts
│   │   ├── gitRecovery.ts
│   │   ├── globalOptimizer.ts
│   │   ├── goalEngine.ts
│   │   ├── goldenDatasetBridge.ts
│   │   ├── graphRagEngine.ts
│   │   ├── hashUtils.ts
│   │   ├── intentAnalyzer.ts
│   │   ├── julesAutomationService.ts
│   │   ├── julesConfigParser.ts
│   │   ├── julesIntegration.ts
│   │   ├── julesMock.ts
│   │   ├── knowledgeGraph.ts
│   │   ├── llm_client.ts
│   │   ├── mcpDiscovery.ts
│   │   ├── MCPRouter.ts
│   │   ├── metaReasoner.ts
│   │   ├── mobileClientBootstrap.ts
│   │   ├── modelRouter.ts
│   │   ├── offlineSync.ts
│   │   ├── ollama_mcp_client.ts
│   │   ├── paiosRemoteIntegration.ts
│   │   ├── patternReuse.ts
│   │   ├── phoenixEventBus.ts
│   │   ├── phoenixReplication.ts
│   │   ├── predictiveIntelligence.ts
│   │   ├── predictiveRouter.ts
│   │   ├── processMonitor.ts
│   │   ├── prometheus.ts
│   │   ├── rbac/
│   │   ├── reflectionEngine.ts
│   │   ├── remoteEventBridge.ts
│   │   ├── remoteFileAccess.ts
│   │   ├── RemoteSessionManager.ts
│   │   ├── remoteSessionStore.ts
│   │   ├── retryStrategy.ts
│   │   ├── sandbox/
│   │   ├── scheduledTasksEngine.ts
│   │   ├── securityEventsMonitor.ts
│   │   ├── selfModel.ts
│   │   ├── sharedCognition.ts
│   │   ├── slackNotifications.ts
│   │   ├── structuredMemory.ts
│   │   ├── suggestedTasksScanner.ts
│   │   ├── swarm/
│   │   ├── testResultsService.ts
│   │   ├── toolComposition.ts
│   │   ├── toolRegistry.ts
│   │   ├── toolRunCapture.ts
│   │   ├── types/
│   │   ├── unifiedRuntime.ts
│   │   ├── universalOrchestratorService.ts
│   │   ├── userPreferences.ts
│   │   ├── voicePipeline.ts
│   │   ├── workerThreadPool.ts
│   │   └── worker_thread_executor.ts
│   ├── dashboard/
│   │   ├── App.tsx
│   │   ├── assets/
│   │   ├── build_result.txt
│   │   ├── components/
│   │   ├── components.json
│   │   ├── context/
│   │   ├── data/
│   │   ├── ErrorFallback.tsx
│   │   ├── hooks/
│   │   ├── index.css
│   │   ├── index.html
│   │   ├── lib/
│   │   ├── main.css
│   │   ├── main.tsx
│   │   ├── overlay/
│   │   ├── pages/
│   │   ├── public/
│   │   ├── store/
│   │   ├── styles/
│   │   ├── tailwind.config.js
│   │   ├── theme.json
│   │   ├── tsconfig.json
│   │   ├── types/
│   │   ├── ui/
│   │   ├── utils/
│   │   ├── vite-end.d.ts
│   │   └── vite.config.ts
│   ├── data/
│   │   ├── bookkeeping_db.ts
│   │   ├── pSalesTrack.ts
│   │   ├── triz_matrix.json
│   │   └── triz_principles.json
│   ├── database/
│   │   ├── agents_schema.sql
│   │   └── schema.sql
│   ├── declarations.d.ts
│   ├── demo_bookkeeping.ts
│   ├── genkit-flow.ts
│   ├── genkit.d.ts
│   ├── index.ts
│   ├── infra/
│   │   └── infraAI.ts
│   ├── interactive.ts
│   ├── kernel/
│   │   ├── BrunellaKernel.ts
│   │   └── HyperKernel.ts
│   ├── matching/
│   │   └── matcher.ts
│   ├── mesh/
│   │   ├── autoJoin.ts
│   │   ├── meshHealing.ts
│   │   ├── meshManager.ts
│   │   ├── meshNode.ts
│   │   ├── selfReplication.ts
│   │   └── topologyAI.ts
│   ├── metrics.ts
│   ├── orchestrator/
│   │   ├── orchestratorCore.ts
│   │   ├── robotkez_bridge.ts
│   │   ├── self_training_loop.ts
│   │   └── systemPrompt/
│   ├── p-sales-standalone/
│   │   ├── App.tsx
│   │   ├── index.html
│   │   └── main.tsx
│   ├── pipeline/
│   │   ├── alertDispatcher.ts
│   │   ├── llmPipeline.ts
│   │   └── salesOutreach.ts
│   ├── routes/
│   │   └── enterpriseApi.ts
│   ├── security/
│   │   ├── e2b_sandbox_manager.ts
│   │   ├── index.ts
│   │   ├── redactor.ts
│   │   ├── remoteAuth.ts
│   │   └── safe_zone_validator.ts
│   ├── server/
│   │   ├── auditRoutes.ts
│   │   ├── cron.ts
│   │   ├── guardrailsRoutes.ts
│   │   ├── McpProcessManager.ts
│   │   ├── mcp_server.ts
│   │   ├── memoryRoutes.ts
│   │   ├── middleware/
│   │   ├── middleware.ts
│   │   ├── phoenixRoutes.ts
│   │   ├── registry.ts
│   │   ├── routerRoutes.ts
│   │   ├── routes/
│   │   ├── schedulers/
│   │   ├── SocketService.ts
│   │   ├── specRoutes.ts
│   │   ├── swagger.ts
│   │   ├── SystemController.ts
│   │   ├── telemetryRoutes.ts
│   │   ├── ToolManager.ts
│   │   ├── tracksRoutes.ts
│   │   ├── web.ts
│   │   └── websocket.ts
│   ├── servers/
│   │   ├── automation.py
│   │   └── workspace.py
│   ├── services/
│   │   ├── anthropicClient.ts
│   │   ├── BrowserCopilotSessionService.ts
│   │   ├── emailValidator.ts
│   │   ├── fleetService.ts
│   │   ├── metricsArchiveService.ts
│   │   ├── metricsService.ts
│   │   ├── ModuleRegistry.ts
│   │   ├── outreachService.ts
│   │   ├── RobotkezProService.ts
│   │   ├── scalingService.ts
│   │   └── trackStateManager.ts
│   ├── SUMMARY.md
│   ├── tools/
│   │   ├── anythingllm.ts
│   │   ├── browser.ts
│   │   ├── browserBridge.ts
│   │   ├── claudeTool.ts
│   │   ├── copilotCliTool.ts
│   │   ├── crawl4aiTool.ts
│   │   ├── deploymentAnalyzer.ts
│   │   ├── evHunterTool.ts
│   │   ├── geminiTool.ts
│   │   ├── getAiRecommendation.ts
│   │   ├── getSzamlazzInvoices.ts
│   │   ├── gitAutomation.ts
│   │   ├── githubModelsTool.ts
│   │   ├── gmailInvoiceFetcher.ts
│   │   ├── googleWorkspace.ts
│   │   ├── interpreter.ts
│   │   ├── julesCliTool.ts
│   │   ├── knowledge.ts
│   │   ├── memoryTool.ts
│   │   ├── monitor.ts
│   │   ├── n8n.ts
│   │   ├── negotiationEngine.ts
│   │   ├── ollamaTool.ts
│   │   ├── persistentBrowserTools.ts
│   │   ├── swarmTools.ts
│   │   ├── system.ts
│   │   ├── testSchedulerTool.ts
│   │   ├── toolPermissions.ts
│   │   ├── unifiedGoogleWorkspaceTool.ts
│   │   ├── unifiedWorkspace.ts
│   │   ├── workspace.ts
│   │   └── writeSheetsInvoices.ts
│   ├── types/
│   │   ├── blueprint.ts
│   │   ├── bookkeeping.d.ts
│   │   ├── cean.ts
│   │   ├── deploymentErrors.ts
│   │   ├── enterprise.ts
│   │   ├── github.ts
│   │   ├── llm.ts
│   │   └── property.ts
│   ├── utils/
│   │   ├── activityFeed.ts
│   │   ├── agentTracer.ts
│   │   ├── aiGateway.ts
│   │   ├── AppError.ts
│   │   ├── approvalManager.ts
│   │   ├── backgroundTaskManager.ts
│   │   ├── browserEngine.ts
│   │   ├── browserRendering.ts
│   │   ├── BrunellaRemoteClient.ts
│   │   ├── checkpoint.ts
│   │   ├── cliConfig.ts
│   │   ├── cloudflareBrowser.ts
│   │   ├── cloudflareClient.ts
│   │   ├── cloudflareConfig.ts
│   │   ├── cloud_storage.ts
│   │   ├── d1Adapter.ts
│   │   ├── dagSort.ts
│   │   ├── db.ts
│   │   ├── degradationPolicy.ts
│   │   ├── developerMetrics.ts
│   │   ├── exec.ts
│   │   ├── fixQueue.ts
│   │   ├── fsInspector.ts
│   │   ├── globalDb.ts
│   │   ├── googleAuth.ts
│   │   ├── health.ts
│   │   ├── health_check.ts
│   │   ├── heartbeatMonitor.ts
│   │   ├── hooks.ts
│   │   ├── kvCache.ts
│   │   ├── lancedb_client.ts
│   │   ├── llmPlanner.ts
│   │   ├── logger.ts
│   │   ├── mcpClient.ts
│   │   ├── mcpClientManager.ts
│   │   ├── memoryContext.ts
│   │   ├── metrics.ts
│   │   ├── notificationService.ts
│   │   ├── otelTracing.ts
│   │   ├── persistentBrowser.ts
│   │   ├── pythonBridge.ts
│   │   ├── pythonShell.ts
│   │   ├── rag.ts
│   │   ├── responseFormatter.ts
│   │   ├── serverManager.ts
│   │   ├── skillsLoader.ts
│   │   ├── StudioRunner.ts
│   │   ├── syncService.ts
│   │   ├── systemHealth.ts
│   │   ├── tasksDb.ts
│   │   ├── telemetry.ts
│   │   ├── trackTodoParser.ts
│   │   ├── tts.ts
│   │   ├── validateSecrets.ts
│   │   ├── vectorize.ts
│   │   └── wranglerHelper.ts
│   └── vendor.d.ts
├── src-tauri/
│   ├── build.rs
│   ├── Cargo.lock
│   ├── Cargo.toml
│   ├── icons/
│   │   ├── 128x128.png
│   │   ├── 128x128@2x.png
│   │   ├── 32x32.png
│   │   ├── icon.icns
│   │   └── icon.ico
│   ├── src/
│   │   └── main.rs
│   ├── target/
│   │   ├── CACHEDIR.TAG
│   │   ├── debug/
│   │   └── flycheck0/
│   └── tauri.conf.json
├── start-all.bat
├── start-full-robust.bat
├── start-full-system.bat
├── start-full.bat
├── start-vscode-web.bat
├── start.bat
├── tailwind.config.js
├── tasks/
│   ├── deep-market-research-2026/
│   │   ├── ACT.md
│   │   ├── PLAN.md
│   │   ├── RESEARCH.md
│   │   ├── TEST.md
│   │   └── TODO.md
│   ├── developer-live-studio/
│   │   └── RESEARCH.md
│   ├── mobile-responsiveness/
│   │   └── RESEARCH.md
│   ├── orchestrator-cognitive-upgrade/
│   │   ├── ACT.md
│   │   ├── PLAN.md
│   │   ├── RESEARCH.md
│   │   ├── TEST.md
│   │   └── TODO.md
│   ├── revenue-acceleration/
│   │   ├── ACT.md
│   │   ├── PLAN.md
│   │   ├── RESEARCH.md
│   │   ├── TEST.md
│   │   └── TODO.md
│   ├── robotkez-browser-chat-impl/
│   │   ├── RESEARCH.md
│   │   └── RESEARCH_PAIOS.md
│   ├── robotkez-perfection/
│   │   ├── ACT.md
│   │   ├── PLAN.md
│   │   ├── RESEARCH.md
│   │   ├── TEST.md
│   │   └── TODO.md
│   └── system-wide-zero-mock/
│   │   ├── ACT.md
│   │   ├── PLAN.md
│   │   ├── TEST.md
│   │   └── TODO.md
├── task_complete.ps1
├── temp/
│   ├── audit-results.json
│   ├── betutipus.jpg
│   ├── cdp_auth_test.cjs
│   ├── cdp_check_state.cjs
│   ├── cdp_get_workflow.cjs
│   ├── cdp_navigate_wf06.cjs
│   ├── cdp_test.cjs
│   ├── harvest_results/
│   │   ├── error_HuggingFace Daily Papers_20260325_044318.png
│   │   ├── error_HuggingFace Daily Papers_20260325_153029.png
│   │   ├── error_HuggingFace Daily Papers_20260326_011512.png
│   │   ├── harvest_results_20260320_214524.json
│   │   ├── harvest_results_20260323_084522.json
│   │   ├── harvest_results_20260325_022829.json
│   │   ├── harvest_results_20260325_044318.json
│   │   ├── harvest_results_20260325_153029.json
│   │   ├── harvest_results_20260326_011513.json
│   │   ├── harvest_results_20260326_072511.json
│   │   ├── harvest_results_20260326_123811.json
│   │   └── harvest_results_20260326_181123.json
│   ├── hatter.jpg
│   ├── javitas2.md
│   ├── javítás.md
│   ├── lumen-ertesites-btn.png
│   ├── lumen-fine-tune-full.jpg
│   ├── lumen-fine-tune-hero.jpg
│   ├── lumen-full-italic-check.jpg
│   ├── lumen-helyi-btn.png
│   ├── lumen-italic-check.jpg
│   ├── Lumen-landing/
│   │   ├── AGENTS.md
│   │   ├── app/
│   │   ├── audit-err.txt
│   │   ├── audit-full.txt
│   │   ├── audit-out.txt
│   │   ├── audit-pass.txt
│   │   ├── audit-results.txt
│   │   ├── audit-screenshots/
│   │   ├── audit-stderr.txt
│   │   ├── audit-stdout.txt
│   │   ├── build-log.txt
│   │   ├── build-log2.txt
│   │   ├── build-log3.txt
│   │   ├── build-output.txt
│   │   ├── build-stderr2.txt
│   │   ├── build-stdout2.txt
│   │   ├── CLAUDE.md
│   │   ├── components/
│   │   ├── eslint.config.mjs
│   │   ├── lib/
│   │   ├── next-env.d.ts
│   │   ├── next.config.ts
│   │   ├── package-lock.json
│   │   ├── package.json
│   │   ├── playwright.config.ts
│   │   ├── postcss.config.mjs
│   │   ├── public/
│   │   ├── README.md
│   │   ├── test-audit.spec.ts
│   │   ├── test-output.txt
│   │   ├── test-results/
│   │   ├── THE_WHISPER_PROMPT.md
│   │   ├── tsconfig.json
│   │   ├── tsconfig.tsbuildinfo
│   │   └── workflow.md
│   ├── lumen-lighter-bottom.jpg
│   ├── lumen-lighter-footer.jpg
│   ├── lumen-lighter-hero.jpg
│   ├── lumen-lighter-mid1.jpg
│   ├── lumen-lighter-mid2.jpg
│   ├── lumen-lighter-very-bottom.jpg
│   ├── my_websitev2/
│   │   ├── adaptiveAnimation.html
│   │   ├── Ads.txt
│   │   ├── agent_diag.py
│   │   ├── app/
│   │   ├── brunella_cleaner.py
│   │   ├── brunella_diag_report.json
│   │   ├── brunella_force_clean.py
│   │   ├── brunella_scout.py
│   │   ├── brunella_status_report.json
│   │   ├── brunella_web_rescue.json
│   │   ├── characterAnimation.html
│   │   ├── CHECKLIST.md
│   │   ├── components/
│   │   ├── data-202511735220.json
│   │   ├── deploy-build.sh
│   │   ├── eslint.config.mjs
│   │   ├── example.js
│   │   ├── GEMINI.md
│   │   ├── gltfLoader.js
│   │   ├── hello-world-1/
│   │   ├── hello-world-2/
│   │   ├── kom.md
│   │   ├── lib/
│   │   ├── main.js
│   │   ├── mainWithScroll.js
│   │   ├── middleware.ts
│   │   ├── netlify.toml
│   │   ├── next-env.d.ts
│   │   ├── next.config.js
│   │   ├── package-lock.json
│   │   ├── package.json
│   │   ├── parallax.html
│   │   ├── pohanka.company (DNS Records).csv
│   │   ├── postcss.config.mjs
│   │   ├── ppp.jpg
│   │   ├── ppp4.jpg
│   │   ├── PROJECT_SUMMARY.md
│   │   ├── public/
│   │   ├── push.log
│   │   ├── qrcode_drive.google.com.png
│   │   ├── QUICK_REFERENCE.md
│   │   ├── README.md
│   │   ├── README_ThreeJS_Project.md
│   │   ├── scripts/
│   │   ├── scrollAnimations.js
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   ├── tsconfig.tsbuildinfo
│   │   ├── vite.config.js
│   │   ├── Weboldal_V5_Gemini_CLI_Utasitas.md
│   │   ├── WORLDQUANT_MODERNIZATION.md
│   │   └── __tests__/
│   ├── n8n_login_attempt.png
│   ├── n8n_page.png
│   ├── picn/
│   │   ├── 1.jpg
│   │   ├── 2.jpg
│   │   ├── 3.jpg
│   │   ├── 4.jpg
│   │   └── kérés.md
│   ├── website-audit.cjs
│   └── website-audit.js
├── test/
│   ├── ## Chat Customization Diagnostics.md
│   ├── activity_feed.test.js
│   ├── activity_feed.test.ts
│   ├── agentLoader.test.ts
│   ├── agentRouting.test.ts
│   ├── agents/
│   │   ├── LeadMiningAgent.test.ts
│   │   ├── MachineHunter.test.ts
│   │   ├── MarketIntelAgent.test.ts
│   │   └── permissions_audit.test.ts
│   ├── agentStateMachine.test.ts
│   ├── agentTracer.test.js
│   ├── agentTracer.test.ts
│   ├── agent_health_matrix.test.ts
│   ├── agent_template.test.js
│   ├── agent_template.test.ts
│   ├── aiGateway.test.js
│   ├── aiGateway.test.ts
│   ├── apifyScrapingAgent.test.ts
│   ├── api_v1.test.js
│   ├── api_v1.test.ts
│   ├── approval_manager.test.js
│   ├── approval_manager.test.ts
│   ├── auditLog.test.js
│   ├── auditLog.test.ts
│   ├── backgroundTaskManager.test.js
│   ├── backgroundTaskManager.test.ts
│   ├── BankAgent.test.ts
│   ├── bifrost_gateway.test.js
│   ├── bifrost_gateway.test.ts
│   ├── bookkeeping_db.test.ts
│   ├── browserCopilotSessionService.test.ts
│   ├── browser_rendering.test.js
│   ├── browser_rendering.test.ts
│   ├── CampaignGeneratorAgent.test.ts
│   ├── cean-alerting.test.js
│   ├── cean-alerting.test.ts
│   ├── cean-metrics.test.js
│   ├── cean-metrics.test.ts
│   ├── ceanFallback.test.ts
│   ├── checkpoint.test.js
│   ├── checkpoint.test.ts
│   ├── checkpointRetention.test.js
│   ├── checkpointRetention.test.ts
│   ├── chromeDevToolsAgent.test.ts
│   ├── cli-e2e.vitest.ts
│   ├── cli-phase3-e2e.vitest.ts
│   ├── cli.e2e.test.ts
│   ├── cli_config.test.js
│   ├── cli_config.test.ts
│   ├── cloudflareBrowser.test.ts
│   ├── cloudflare_integration.test.js
│   ├── cloudflare_integration.test.ts
│   ├── cloudflare_routes.test.js
│   ├── cloudflare_routes.test.ts
│   ├── codebaseIndexer.test.js
│   ├── codebaseIndexer.test.ts
│   ├── code_review.test.js
│   ├── code_review.test.ts
│   ├── code_scaffold.test.js
│   ├── code_scaffold.test.ts
│   ├── configSchema.test.js
│   ├── configSchema.test.ts
│   ├── conflictMediatorAgent.test.js
│   ├── conflictMediatorAgent.test.ts
│   ├── context_builder.test.js
│   ├── context_builder.test.ts
│   ├── copilotBridge.test.ts
│   ├── copilotCognitiveBridge.test.ts
│   ├── core_tools.test.js
│   ├── core_tools.test.ts
│   ├── coverage_analysis.test.js
│   ├── coverage_analysis.test.ts
│   ├── crawl4ai.test.ts
│   ├── dagSort.test.ts
│   ├── dashboard/
│   │   ├── components/
│   │   ├── mocks/
│   │   ├── setup.js
│   │   └── setup.ts
│   ├── dashboard_chat_lib.test.js
│   ├── dashboard_chat_lib.test.ts
│   ├── data_refiner.test.js
│   ├── data_refiner.test.ts
│   ├── degradationPolicy.test.js
│   ├── degradationPolicy.test.ts
│   ├── delegation_chain.test.js
│   ├── delegation_chain.test.ts
│   ├── deploymentAnalyzer.test.js
│   ├── deploymentAnalyzer.test.ts
│   ├── DeveloperAgent.test.js
│   ├── DeveloperAgent.test.ts
│   ├── developer_pipeline.test.js
│   ├── developer_pipeline.test.ts
│   ├── dev_commands.test.js
│   ├── dev_commands.test.ts
│   ├── digitalHeadhunterAgent.test.js
│   ├── digitalHeadhunterAgent.test.ts
│   ├── e2b_sandbox_manager.test.js
│   ├── e2b_sandbox_manager.test.ts
│   ├── e2e/
│   │   ├── action-triggering.spec.js
│   │   ├── action-triggering.spec.ts
│   │   ├── dashboard-comprehensive.spec.js
│   │   ├── dashboard-comprehensive.spec.ts
│   │   ├── dashboard-v3-integrity.spec.ts
│   │   ├── dashboard-widgets.spec.ts
│   │   ├── dashboard_audit.spec.ts
│   │   ├── error-handling.spec.js
│   │   ├── error-handling.spec.ts
│   │   ├── functional_integrity.spec.ts
│   │   ├── mission-control.spec.js
│   │   ├── mission-control.spec.ts
│   │   ├── navigation.spec.js
│   │   ├── navigation.spec.ts
│   │   ├── smoke-v3.spec.ts
│   │   ├── socket-reconnect.spec.js
│   │   ├── socket-reconnect.spec.ts
│   │   ├── tabs-advanced.spec.js
│   │   ├── tabs-advanced.spec.ts
│   │   ├── tabs-basic.spec.js
│   │   ├── tabs-basic.spec.ts
│   │   └── total_system_sync.spec.ts
│   ├── EdgeProxyAgent.test.ts
│   ├── edge_health_monitor.test.js
│   ├── edge_health_monitor.test.ts
│   ├── emailTriageAgent.test.js
│   ├── emailTriageAgent.test.ts
│   ├── enterpriseOrchestrator.test.js
│   ├── enterpriseOrchestrator.test.ts
│   ├── enterpriseOrchestratorAgent.test.js
│   ├── enterpriseOrchestratorAgent.test.ts
│   ├── eventBus.test.ts
│   ├── evHunterTool.test.js
│   ├── evHunterTool.test.ts
│   ├── ev_hunter_research.test.js
│   ├── ev_hunter_research.test.ts
│   ├── failover_registry.test.js
│   ├── failover_registry.test.ts
│   ├── FinanceGuardian_Duplicates.test.ts
│   ├── FinanceGuardian_Gmail.test.ts
│   ├── FinanceGuardian_Sheets.test.ts
│   ├── financialGuardAgent.test.js
│   ├── financialGuardAgent.test.ts
│   ├── fleetService.test.js
│   ├── fleetService.test.ts
│   ├── git_integration.test.js
│   ├── git_integration.test.ts
│   ├── gmail_invoice_client_test.py
│   ├── golden-dataset-tools.vitest.ts
│   ├── goldenDatasetBridge.test.js
│   ├── goldenDatasetBridge.test.ts
│   ├── google_sheets_client_phase4_test.py
│   ├── grantWatcherAgent.test.js
│   ├── grantWatcherAgent.test.ts
│   ├── grant_outreach.test.ts
│   ├── guardrails/
│   │   ├── confidenceScoring.test.ts
│   │   ├── redaction.test.ts
│   │   └── schemaValidation.test.ts
│   ├── harvestRoutes.test.ts
│   ├── health_check.test.js
│   ├── health_check.test.ts
│   ├── heartbeatMonitor.test.js
│   ├── heartbeatMonitor.test.ts
│   ├── hooks.test.js
│   ├── hooks.test.ts
│   ├── incubator_test.py
│   ├── innovationBridgeAgent.test.ts
│   ├── innovation_bridge_core.test.ts
│   ├── innovation_bridge_persistence.test.ts
│   ├── innovation_bridge_swarm.test.ts
│   ├── input_sanitization.test.js
│   ├── input_sanitization.test.ts
│   ├── InvoiceAutomationAgent.test.ts
│   ├── invoice_automation_e2e_test.py
│   ├── invoice_enhanced.test.py
│   ├── invoice_refiner_test.py
│   ├── ironCladBackend.test.js
│   ├── ironCladBackend.test.ts
│   ├── jcai-e2e-test.js
│   ├── jcai-e2e-test.ts
│   ├── jcai-phase3-verification.test.js
│   ├── jcai-phase3-verification.test.ts
│   ├── jcai-webhook-manual-test.js
│   ├── jcai-webhook-manual-test.ts
│   ├── jules_e2e_pipeline.test.js
│   ├── jules_e2e_pipeline.test.ts
│   ├── jules_workflow_routes.test.js
│   ├── jules_workflow_routes.test.ts
│   ├── knowledgeBaseBuilderAgent.test.js
│   ├── knowledgeBaseBuilderAgent.test.ts
│   ├── lawDetectiveAgent.test.ts
│   ├── lint_fixer.test.js
│   ├── lint_fixer.test.ts
│   ├── llmPlanner.test.js
│   ├── llmPlanner.test.ts
│   ├── llm_client.test.js
│   ├── llm_client.test.ts
│   ├── llm_provider.test.js
│   ├── llm_provider.test.ts
│   ├── localCSRAgent.test.js
│   ├── localCSRAgent.test.ts
│   ├── logisticsDispatcherAgent.test.js
│   ├── logisticsDispatcherAgent.test.ts
│   ├── marketing_swarm_integration_test.py
│   ├── marketIntelAgent.test.js
│   ├── marketIntelAgent.test.ts
│   ├── MatchingAgent.test.ts
│   ├── mcp/
│   │   ├── dynamicToolRegistry.test.ts
│   │   └── toolComposition.test.ts
│   ├── mcp-brunella-core.code-workspace
│   ├── mcp_server.test.js
│   ├── mcp_server.test.ts
│   ├── memory/
│   │   └── structuredMemory.test.ts
│   ├── memoryRoutes.golden.test.js
│   ├── memoryRoutes.golden.test.ts
│   ├── memory_context.test.js
│   ├── memory_context.test.ts
│   ├── metricsArchiveService.test.js
│   ├── metricsArchiveService.test.ts
│   ├── metricsService.test.js
│   ├── metricsService.test.ts
│   ├── middleware.test.js
│   ├── middleware.test.ts
│   ├── modelRouter.test.js
│   ├── modelRouter.test.ts
│   ├── monitor.test.js
│   ├── monitor.test.ts
│   ├── monitor.vitest.js
│   ├── monitor.vitest.ts
│   ├── n8n_automation.test.js
│   ├── n8n_automation.test.ts
│   ├── notificationService.test.js
│   ├── notificationService.test.ts
│   ├── observability/
│   │   └── telemetry.test.ts
│   ├── orchestration/
│   │   └── dagEngine.test.ts
│   ├── orchestratorChain.test.ts
│   ├── orchestratorReact.test.ts
│   ├── outreach_flow.test.ts
│   ├── paiosConfig.test.ts
│   ├── paiosOrchestrator.integration.test.ts
│   ├── paiosOrchestrator.test.ts
│   ├── persistentBrowser.test.js
│   ├── persistentBrowser.test.ts
│   ├── phase1_remote_foundation.test.ts
│   ├── phase2_discovery_auth.test.ts
│   ├── phase2_integration.test.js
│   ├── phase2_integration.test.ts
│   ├── phase3_integration.test.js
│   ├── phase3_integration.test.ts
│   ├── phase3_mobile_voice_paios.test.ts
│   ├── phase42-costopt.test.js
│   ├── phase42-costopt.test.ts
│   ├── phase43-e2e.test.js
│   ├── phase43-e2e.test.ts
│   ├── phase4_mesh.test.ts
│   ├── phase4_real_estate.test.js
│   ├── phase4_real_estate.test.ts
│   ├── phase4_software_genesis.test.js
│   ├── phase4_software_genesis.test.ts
│   ├── phase4_supply_chain.test.js
│   ├── phase4_supply_chain.test.ts
│   ├── phase5_swarms.test.ts
│   ├── phase6-integration.test.js
│   ├── phase6-integration.test.ts
│   ├── phase6_evolution.test.ts
│   ├── phase7_superintelligent_infra.test.ts
│   ├── phoenixRecoveryLogic.test.js
│   ├── phoenixRecoveryLogic.test.ts
│   ├── phoenix_event_bus.test.js
│   ├── phoenix_event_bus.test.ts
│   ├── phoenix_protocol_test.py
│   ├── phoenix_recovery.test.js
│   ├── phoenix_recovery.test.ts
│   ├── procurementAgent.test.js
│   ├── procurementAgent.test.ts
│   ├── project_conductor_living_docs.test.js
│   ├── project_conductor_living_docs.test.ts
│   ├── prometheus_metrics.test.js
│   ├── prometheus_metrics.test.ts
│   ├── pythonBridge.test.ts
│   ├── python_mcp_server.test.js
│   ├── python_mcp_server.test.ts
│   ├── python_shell.test.js
│   ├── python_shell.test.ts
│   ├── rag.test.js
│   ├── rag.test.ts
│   ├── rbac/
│   │   └── agentPermissions.test.ts
│   ├── refiners/
│   │   ├── test_invoice_parser.py
│   │   └── test_product_valuation.py
│   ├── registryValidation.test.ts
│   ├── responseFormatter.test.js
│   ├── responseFormatter.test.ts
│   ├── retryStrategy.test.js
│   ├── retryStrategy.test.ts
│   ├── robotkez-pro/
│   │   ├── bridge.test.ts
│   │   └── self-training-loop.test.ts
│   ├── robotkezAPI.test.js
│   ├── robotkezAPI.test.ts
│   ├── robotkezV2.e2e.test.js
│   ├── robotkezV2.e2e.test.ts
│   ├── robotkezV2Agent.test.js
│   ├── robotkezV2Agent.test.ts
│   ├── robotkez_integration.test.js
│   ├── robotkez_integration.test.ts
│   ├── robotkez_pro_e2e.test.ts
│   ├── robotkez_v2_integration.test.js
│   ├── robotkez_v2_integration.test.ts
│   ├── routes_developer.test.js
│   ├── routes_developer.test.ts
│   ├── safe_zone_validator.test.js
│   ├── safe_zone_validator.test.ts
│   ├── salesHunterAgent.test.js
│   ├── salesHunterAgent.test.ts
│   ├── sandbox/
│   │   ├── networkPolicy.test.ts
│   │   └── wasmSandbox.test.ts
│   ├── scalingService.test.js
│   ├── scalingService.test.ts
│   ├── scheduledTasks.test.js
│   ├── scheduledTasks.test.ts
│   ├── security.test.ts
│   ├── setup-ui.ts
│   ├── setup.js
│   ├── setup.ts
│   ├── SheetsSyncAgent.test.ts
│   ├── skills_loader.test.js
│   ├── skills_loader.test.ts
│   ├── smoke-phase3.vitest.ts
│   ├── smoke-phase4.vitest.ts
│   ├── smoke-websocket.vitest.ts
│   ├── smoke.vitest.js
│   ├── smoke.vitest.ts
│   ├── socketService.test.js
│   ├── socketService.test.ts
│   ├── specStatus.test.js
│   ├── specStatus.test.ts
│   ├── SpecWriterAgent.test.js
│   ├── SpecWriterAgent.test.ts
│   ├── state_restoration.test.js
│   ├── state_restoration.test.ts
│   ├── structured_output.test.js
│   ├── structured_output.test.ts
│   ├── suggestedTasks.test.js
│   ├── suggestedTasks.test.ts
│   ├── swagger_spec.test.js
│   ├── swagger_spec.test.ts
│   ├── swarm/
│   │   ├── colonyPersistence.test.ts
│   │   ├── dynamicResizer.test.ts
│   │   └── votingProtocol.test.ts
│   ├── swarmManager.test.ts
│   ├── swarmRoutes.test.ts
│   ├── swarmTools.test.ts
│   ├── swarm_coordinator.test.js
│   ├── swarm_coordinator.test.ts
│   ├── swarm_smoke.test.ts
│   ├── szamlazz_hu_client_test.py
│   ├── taskDecomposerCore.test.js
│   ├── taskDecomposerCore.test.ts
│   ├── task_queue.test.js
│   ├── task_queue.test.ts
│   ├── telemetry.test.js
│   ├── telemetry.test.ts
│   ├── testD1Adapter.ts
│   ├── test_vectorize.ts
│   ├── toolRegistry.test.ts
│   ├── tracks_todos_routes.test.js
│   ├── tracks_todos_routes.test.ts
│   ├── trackTodoParser.test.js
│   ├── trackTodoParser.test.ts
│   ├── triz_data.test.ts
│   ├── unifiedWorkspace.test.js
│   ├── unifiedWorkspace.test.ts
│   ├── userPreferences.test.ts
│   ├── webhooks.test.js
│   ├── webhooks.test.ts
│   ├── workers/
│   │   ├── test_google_maps_scraper.py
│   │   ├── test_icebreaker_generator.py
│   │   └── test_market_scraper.py
│   └── workerThreadPool.test.ts
├── test-crawl4ai-help.txt
├── test-fast-clean.txt
├── test-fast-output.txt
├── test-fast-result.txt
├── test-full-output.txt
├── test-json-results.json
├── test-json-stderr.txt
├── test-out4.txt
├── test-output.txt
├── test-results/
├── test-results.txt
├── test-results2.txt
├── testing/
│   ├── cypress/
│   │   └── support/
│   ├── hirszerzes_test_1/
│   │   ├── ai_research_pipeline.json
│   │   ├── arxiv_search_tool.py
│   │   ├── docker-compose.yml
│   │   ├── env.template
│   │   ├── github_trending_tool.py
│   │   ├── hirszerzes_test1.md.txt
│   │   ├── huggingface_papers_tool.py
│   │   ├── perplexity_search_tool.py
│   │   ├── README_TELJES.md
│   │   ├── requirements.txt
│   │   └── SETUP.md
│   ├── KÉSZ/
│   │   ├── 1. A Kreatív Súrlódás Mediátor (The Vibe-Check Mediator)/
│   │   ├── 2. Kereszt-Iparági Tudás-Híd Kereső (Cross-Industry Innovation Bridge)/
│   │   └── 3. A Mikro-Helyi CSR Automata (The Neighborhood Watchman)/
│   └── TEST_BOOK.md
├── test_output.txt
├── TEST_RESULTS.md
├── test_run_out.txt
├── todo_ops.py
├── todo_ops.sql
├── Toolskeszlet.md
├── tsc-agentmanager-afterfix.txt
├── tsc-agentmanager-errors.txt
├── tsc-output.txt
├── tsconfig.json
├── tsconfig.ui.json
├── USER_START.md
├── uv.lock
├── vite.config.ts
├── vite.overlay.config.ts
├── vite.p-sales.config.ts
├── vitest-rerun-output.txt
├── vitest.config.ts
├── vitest.dashboard.config.ts
├── vitest.ui.config.ts
├── vitest_output.txt
├── website_sources/
│   ├── adaptiveAnimation.html
│   ├── Ads.txt
│   ├── agent_diag.py
│   ├── app/
│   │   ├── adatvedelmi-nyilatkozat/
│   │   ├── admin/
│   │   ├── api/
│   │   ├── aszf/
│   │   ├── blog/
│   │   ├── components/
│   │   ├── context/
│   │   ├── de/
│   │   ├── desktop.ini
│   │   ├── en/
│   │   ├── fogalomtar/
│   │   ├── fogaszati-lead-lista/
│   │   ├── globals.css
│   │   ├── hooks/
│   │   ├── impresszum/
│   │   ├── kapcsolat/
│   │   ├── layout.tsx
│   │   ├── lib/
│   │   ├── locales/
│   │   ├── not-found.tsx
│   │   ├── opengraph-image.tsx
│   │   ├── page.jsx
│   │   ├── portfolio/
│   │   ├── rolunk/
│   │   ├── szolgaltatasok/
│   │   ├── termekek/
│   │   ├── twitter-image.tsx
│   │   └── _og/
│   ├── brunella_cleaner.py
│   ├── brunella_diag_report.json
│   ├── brunella_force_clean.py
│   ├── brunella_scout.py
│   ├── brunella_status_report.json
│   ├── brunella_web_rescue.json
│   ├── characterAnimation.html
│   ├── CHECKLIST.md
│   ├── components/
│   │   └── desktop.ini
│   ├── data-202511735220.json
│   ├── deploy-build.sh
│   ├── eslint.config.mjs
│   ├── example.js
│   ├── GEMINI.md
│   ├── gltfLoader.js
│   ├── hello-world-1/
│   │   ├── desktop.ini
│   │   ├── img/
│   │   ├── kubernetes-manifests/
│   │   ├── src/
│   │   └── tests/
│   ├── hello-world-2/
│   │   ├── desktop.ini
│   │   ├── img/
│   │   ├── kubernetes-manifests/
│   │   ├── src/
│   │   └── tests/
│   ├── kom.md
│   ├── lib/
│   │   ├── desktop.ini
│   │   └── markdown.ts
│   ├── main.js
│   ├── mainWithScroll.js
│   ├── middleware.ts
│   ├── netlify.toml
│   ├── next-env.d.ts
│   ├── next.config.js
│   ├── package-lock.json
│   ├── package.json
│   ├── parallax.html
│   ├── pohanka.company (DNS Records).csv
│   ├── postcss.config.mjs
│   ├── ppp.jpg
│   ├── ppp4.jpg
│   ├── PROJECT_SUMMARY.md
│   ├── public/
│   │   ├── 1.jpg
│   │   ├── 2.jpg
│   │   ├── 3.jpg
│   │   ├── about.mp4
│   │   ├── blog.mp4
│   │   ├── contact.mp4
│   │   ├── desktop.ini
│   │   ├── home.mp4
│   │   ├── images/
│   │   ├── portfolio.mp4
│   │   ├── products.mp4
│   │   ├── robots.txt
│   │   ├── services.mp4
│   │   └── sitemap.xml
│   ├── push.log
│   ├── qrcode_drive.google.com.png
│   ├── QUICK_REFERENCE.md
│   ├── README.md
│   ├── README_ThreeJS_Project.md
│   ├── scripts/
│   │   └── desktop.ini
│   ├── scrollAnimations.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.tsbuildinfo
│   ├── vite.config.js
│   ├── Weboldal_V5_Gemini_CLI_Utasitas.md
│   ├── WORLDQUANT_MODERNIZATION.md
│   └── __tests__/
│   │   ├── desktop.ini
│   │   └── ResponsiveTest.spec.ts-snapshots/
├── windows_bridge/
│   ├── logs/
│   │   └── wab_audit.log
│   ├── requirements.txt
│   ├── run_bridge.bat
│   ├── tests/
│   │   ├── test_api.py
│   │   ├── test_core.py
│   │   ├── test_logging.py
│   │   └── __init__.py
│   └── wab_server.py
├── worker/
│   └── bas-browser-orchestrator/
│   │   ├── index.js
│   │   └── wrangler.toml
├── workers/
│   ├── cean-harvest/
│   │   └── index.ts
│   ├── cean-refine/
│   │   └── index.ts
│   ├── cean-research/
│   │   └── index.ts
│   └── cean-router/
│   │   └── index.ts
├── workflow-heti-kontekstus.png
├── _archive/
│   ├── Böngésző vezérlés/
│   │   ├── Böngésző vezérlés.7z
│   │   ├── content.js.txt
│   │   ├── Dockerfile.txt
│   │   ├── manifest.json.txt
│   │   ├── popup.html.txt
│   │   └── popup.js.txt
│   ├── docs/
│   │   ├── bongeszo_hasznalat.md.txt
│   │   ├── CHANGELOG.md
│   │   ├── CONDUCTOR_PLAN.md
│   │   └── terv.md
│   └── reports/
│   │   ├── DASHBOARD_INTEGRATION_REPORT.md
│   │   ├── JELENTES.md
│   │   └── REPORT_REVISION_20260130.md
├── _br_temp/
│   ├── 04_after_airtable_fix_snapshot.md
│   ├── 04_after_airtable_fix_unsaved.md
│   ├── 04_debug1612_airtable_node.md
│   ├── 04_debug1612_airtable_node_expanded.md
│   ├── 04_debug1613_current.md
│   ├── 04_editor_after_node_change.md
│   ├── 04_editor_post_dialog.md
│   ├── 04_exec1611_after_fix.md
│   ├── 04_workflow_backup.json
│   ├── 04_workflow_live.json
│   ├── 04_workflow_MODIFIED.json
│   ├── 04_workflow_raw.json
│   ├── 06_editor_before_fix.md
│   ├── 06_exec1610_retry_check.md
│   ├── 06_login_snapshot_fresh.md
│   ├── 06_login_state_after_reload.md
│   ├── activate_workflows.py
│   ├── after_04_node_execute.md
│   ├── after_close_node_04.md
│   ├── analyze_munkado.py
│   ├── analyze_munkado2.py
│   ├── ATADASI_UTMUTATO.md
│   ├── batch_debug.cmd
│   ├── bootstrap_fix_build.log
│   ├── bootstrap_fix_smoke.log
│   ├── bootstrap_fix_test.log
│   ├── check_nodes.py
│   ├── commit_fix_backup/
│   │   ├── src/
│   │   └── test/
│   ├── copilot_bridge/
│   ├── creds.json
│   ├── current_page_fix_attempt.md
│   ├── error_mon.json
│   ├── fix_02.py
│   ├── fix_json_local.py
│   ├── fix_munkado_and_activate.py
│   ├── generate_heti_kontextus.py
│   ├── geppark.json
│   ├── get_airtable_schema.py
│   ├── get_exec.py
│   ├── get_exec_det.py
│   ├── get_telegram_ids.py
│   ├── get_telegram_ids_from_exec.py
│   ├── get_telegram_ids_from_exec_2.py
│   ├── get_tel_ids.py
│   ├── get_tel_raw.py
│   ├── get_wf.py
│   ├── get_wf_error.py
│   ├── gmail_kat_temp.json
│   ├── heti_kontextus_csomag.json
│   ├── imported_ids.json
│   ├── import_gmail_kat.py
│   ├── import_live.py
│   ├── import_ready_workflows.txt
│   ├── inditas_100.cmd
│   ├── inditas_120.cmd
│   ├── inditas_140.cmd
│   ├── inditas_40.cmd
│   ├── inditas_60.cmd
│   ├── inditas_80.cmd
│   ├── inspect_hetiemlek.py
│   ├── iszapfalo_analysis/
│   │   ├── analyze_content.py
│   │   ├── analyze_gemini_timeline.py
│   │   ├── build_inventory.py
│   │   ├── build_release_map.py
│   │   ├── canonical_release_map.json
│   │   ├── canonical_release_map.md
│   │   ├── canonical_release_map_v2.md
│   │   ├── content_analysis_raw.json
│   │   ├── content_analysis_summary.md
│   │   ├── gemini_timeline.md
│   │   ├── go_live_checklist.md
│   │   ├── go_live_runbook_v1.md
│   │   ├── inventory.json
│   │   └── inventory.md
│   ├── json_list.txt
│   ├── list_workflows.py
│   ├── live_07_workflow.json
│   ├── live_snapshot_04_debug1611_fresh.md
│   ├── live_snapshot_04_exec.md
│   ├── live_snapshot_06_exec1610_before_retry2.md
│   ├── live_snapshot_06_exec1610_retrycheck.md
│   ├── live_snapshot_1610.md
│   ├── live_snapshot_1610_open_node.md
│   ├── munkado_current.json
│   ├── munkado_FIXED.json
│   ├── n8n_01_start.png
│   ├── n8n_api_import.py
│   ├── n8n_auto_fix.py
│   ├── n8n_check.py
│   ├── n8n_credentials_page.png
│   ├── n8n_debug_1610.txt
│   ├── n8n_debug_1610_after_click.txt
│   ├── n8n_debug_1611.txt
│   ├── n8n_full_deploy.py
│   ├── n8n_get_live_workflow.mjs
│   ├── n8n_interact.py
│   ├── n8n_list_live_credentials.mjs
│   ├── n8n_list_live_workflows.mjs
│   ├── n8n_login_form.png
│   ├── n8n_rest_get_workflow.mjs
│   ├── n8n_rest_list_credentials.mjs
│   ├── okos_ajanlo.json
│   ├── pohi_muvek_structure.txt
│   ├── pohi_wf1.json
│   ├── pohi_wf2.json
│   ├── post_runtime_fix_smoke.log
│   ├── readme_build_check.log
│   ├── readme_smoke_check.log
│   ├── registry_0d177faf.json
│   ├── registry_best.json
│   ├── registry_e2f4a445.json
│   ├── registry_pre.json
│   ├── registry_pre_ujjaszuletes.json
│   ├── root_workflows.txt
│   ├── show_creds.py
│   ├── test_input.json
│   ├── updated_07_workflow_payload.json
│   ├── update_heti_kontextus_workflow.mjs
│   ├── vitest_results.txt
│   ├── wake_n8n.py
│   ├── workflow_current.json
│   └── workflow_now.json
└── _KNOWLEDGE_BASE/
│   ├── 1_reports_and_outputs/
│   │   └── reports/
│   ├── 2_knowledge_base/
│   │   ├── documents/
│   │   └── notes/
│   ├── 3_training_and_tuning/
│   │   ├── Brunella Agents Project (Aurora_test)/
│   │   └── BrunellaTuning/
│   ├── 4_configs_and_data/
│   │   ├── cloud számlazasi fiok/
│   │   ├── configs/
│   │   └── data/
│   ├── admin.googleapis.com_$discovery_rest_version=directory_v1.pdf
│   ├── agent_backend.py
│   ├── AI Ügynökfejlesztés - Hatékony Promptok és Megbízh.md
│   ├── aiplatform.init
│   ├── architecture.md
│   ├── authenticate_google.py
│   ├── authentication.md
│   ├── auth_token_logs.csv
│   ├── auth_token_logs.xlsx
│   ├── Browser_API.txt
│   ├── Brunella_engedely.txt
│   ├── brunella_memoria.yaml
│   ├── brunella_memoria_config.yaml
│   ├── Brunell_str.md
│   ├── Buildings.csv
│   ├── böngészo_hasznalat.md.txt
│   ├── Bővítmények böngészése   Gemini parancssori felület.lnk
│   ├── C-GMAIL-B-m1-l5-en-file-7.en.pdf
│   ├── C-GMAIL-B-m2-l3-en-file-13.en.pdf
│   ├── campaigns/
│   │   ├── ai-marketing/
│   │   ├── ai-tools-2026/
│   │   ├── stdin-kampány-teszt/
│   │   └── teszt/
│   ├── checkpointing.md
│   ├── check_alt_tags.py
│   ├── Chrome Enterprise Core Postman API Integration.pdf
│   ├── Chrome-jelszavak.csv
│   ├── cli-cli-attestation-11373026.sigstore.json
│   ├── client_secret_1086791794235-gekmub010ieg3ree7hut50ppu8clhj43.apps.googleusercontent.com.json
│   ├── client_secret_608181723722-sv7rjf7tu45qpm1fs831via61k2pgl3f.apps.googleusercontent.com.json
│   ├── client_secret_608181723722-v2qrf64eq8lksbih9dk5fc1f7t9ksnop.apps.googleusercontent.com.json
│   ├── commands.md
│   ├── config/
│   │   ├── AI Agent Cognitive Enhancement Research.gdoc
│   │   ├── all.gsheet
│   │   ├── Brunella0911.md
│   │   ├── commands/
│   │   ├── config.yaml
│   │   ├── data-202510361031.json
│   │   ├── desktop.ini
│   │   ├── ehez jön még egy marketing ügynök aki ptofi lesz....gdoc
│   │   ├── esbuild.config.js
│   │   ├── eslint.config.js
│   │   ├── GEMINI.md
│   │   ├── GoogleCertificateAuthority.pem
│   │   ├── id_ed25519
│   │   ├── id_ed25519.pub
│   │   ├── Makefile
│   │   ├── tsconfig.json
│   │   └── users_logs_1756764000000.gsheet
│   ├── configuration-v1.md
│   ├── configuration.md
│   ├── connected_devtools.png
│   ├── considerations_when_benchmarking_udp_bulk_flows.pdf
│   ├── CONTRIBUTING.md
│   ├── data-202510361031.json
│   ├── deployment.md
│   ├── Dockerfile
│   ├── documents_core.md
│   ├── dwd_clients.csv
│   ├── enable-apis.md.pdf
│   ├── enroll_in_03ph8a2z1pgnztu.reg
│   ├── enterprise.md
│   ├── env
│   ├── env_github
│   ├── eszkozeim_core.md
│   ├── extension.md
│   ├── file-system.md
│   ├── gcloud-cheat-sheet.pdf
│   ├── gcloudignore
│   ├── Gemini CLI Konfigurációs Útmutató Google Szolgáltatásokhoz.md
│   ├── gemini-ignore.md
│   ├── gemini-screenshot.png
│   ├── GEMINI.md
│   ├── gemini_cli_setup.ps1
│   ├── genie3worldmodel2025.bib
│   ├── gitignore
│   ├── Google Gmail API, a Google Drive API,.docx
│   ├── google_integration_state.md
│   ├── google_vids_tool.py
│   ├── Hozzáférési kontextuskezelő API _ Google Cloud.pdf
│   ├── iam@peterpohanka.com.ics
│   ├── ide-integration.md
│   ├── id_ed25519
│   ├── id_ed25519.pub
│   ├── igen.md
│   ├── index.md
│   ├── index.ts
│   ├── integration-tests.md
│   ├── issue-and-pr-automation.md
│   ├── keyboard-shortcuts.md
│   ├── langgraph_gemini_podcast.ipynb
│   ├── llm.py
│   ├── main.py
│   ├── mcp-server.md
│   ├── memory/
│   │   ├── brunella_memory.json
│   │   ├── desktop.ini
│   │   └── structured-memory-1774405841785.jsonl
│   ├── memory.md
│   ├── memport.md
│   ├── mentor_script.py
│   ├── multi-file.md
│   ├── multiplier_simulation.py
│   ├── multi_agent_reliability_protocol.md
│   ├── munkamenet_robotkez_projekt.pdf
│   ├── Naptár.ics.pdf
│   ├── native_message_host_chromeos.json
│   ├── npm.md
│   ├── OSSZEFOGLALO.md
│   ├── package-lock.json
│   ├── package.json
│   ├── packages/
│   │   ├── a2a-server/
│   │   ├── cli/
│   │   ├── core/
│   │   ├── test-utils/
│   │   └── vscode-ide-companion/
│   ├── pdf.pdf
│   ├── prezentacio.md
│   ├── Program.py
│   ├── proxy-script.md
│   ├── quickstart.md.pdf
│   ├── quota-and-pricing.md
│   ├── qwen3_coder_tool.py
│   ├── QWEN3_INTEGRATION_PLAN.md
│   ├── react_agent_tutorial.py
│   ├── README.md
│   ├── releases.md
│   ├── release_patch.png
│   ├── replace_open.sh
│   ├── research_findings.md
│   ├── rest.pdf
│   ├── ROADMAP.md
│   ├── route_finder.py
│   ├── sa-key.json
│   ├── sandbox.md
│   ├── scripts/
│   │   ├── agent_backend.py
│   │   ├── authenticate_google.py
│   │   ├── build.js
│   │   ├── build_package.js
│   │   ├── build_sandbox.js
│   │   ├── build_vscode_companion.js
│   │   ├── check-build-status.js
│   │   ├── check-lockfile.js
│   │   ├── check_alt_tags.py
│   │   ├── clean.js
│   │   ├── copy_bundle_assets.js
│   │   ├── copy_files.js
│   │   ├── create_alias.sh
│   │   ├── desktop.ini
│   │   ├── example.mjs
│   │   ├── generate-git-commit-info.js
│   │   ├── get-release-version.js
│   │   ├── google_vids_tool.py
│   │   ├── inditas.bat
│   │   ├── lint.js
│   │   ├── local_telemetry.js
│   │   ├── main.py
│   │   ├── mentor_script.py
│   │   ├── multiplier_simulation.py
│   │   ├── pre-commit.js
│   │   ├── prepare-package.js
│   │   ├── Program.py
│   │   ├── react_agent_tutorial.py
│   │   ├── releasing/
│   │   ├── route_finder.py
│   │   ├── sandbox_command.js
│   │   ├── start.js
│   │   ├── telemetry.js
│   │   ├── telemetry_gcp.js
│   │   ├── telemetry_utils.js
│   │   ├── test-windows-paths.js
│   │   ├── tests/
│   │   ├── udvozlo.py
│   │   └── version.js
│   ├── secret.cer
│   ├── settings.json
│   ├── shell.md
│   ├── SUMMARY.md
│   ├── Supervised Fine-tuning Gemini for Predictive Maintenance - Build with AI _ Custom ML & MLOps - Google Developer forums.pdf
│   ├── swarm_ingested/
│   │   └── 1769641845751.md
│   ├── Szentgrál.md.txt
│   ├── Tanulmanyi_Utmutato_BrunellaAgentsSystem  Projekthez.md
│   ├── telemetry.md
│   ├── tests/
│   │   ├── desktop.ini
│   │   ├── get-release-version.test.js
│   │   ├── test-setup.ts
│   │   └── vitest.config.ts
│   ├── The gcloud CLI cheat sheet  _  Google Cloud SDK.pdf
│   ├── theme-ansi-light.png
│   ├── theme-ansi.png
│   ├── theme-atom-one.png
│   ├── theme-ayu-light.png
│   ├── theme-ayu.png
│   ├── theme-custom.png
│   ├── theme-default-light.png
│   ├── theme-default.png
│   ├── theme-dracula.png
│   ├── theme-github-light.png
│   ├── theme-github.png
│   ├── theme-google-light.png
│   ├── theme-xcode-light.png
│   ├── themes.md
│   ├── todo.md
│   ├── token-caching.md
│   ├── tools-api.md
│   ├── tos-privacy.md
│   ├── troubleshooting.md
│   ├── tsconfig.json
│   ├── Tudas.pdf
│   ├── Tudas2.pdf
│   ├── tutorials.md
│   ├── udvozlo.py
│   ├── uj.md
│   ├── Uninstall.md
│   ├── user_data.json
│   ├── web-fetch.md
│   ├── web-search.md
│   ├── webhook_server.py
│   └── _model_cards/
│   │   ├── Gemini_Pro_2.5_model_card.pdf
│   │   └── Gemini_Pro_2.5_model_card_melygondolkodás.pdf

```

---

## Főbb Mappák

| Mappa | Leírás |
|-------|--------|
| `src/` | TypeScript forráskód |
| `src/agents/` | AI ügynökök |
| `src/tools/` | MCP eszközök |
| `src/server/` | Backend szerver |
| `myai/` | Python alrendszer |
| `conductor/` | Projekt menedzsment |
| `cloudflare/` | Edge computing |
| `_KNOWLEDGE_BASE/` | Tudásbázis |

---

*Automatikusan generálva a ProjectConductorAgent által*
