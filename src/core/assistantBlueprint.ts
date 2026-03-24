import { existsSync } from 'fs';
import path from 'path';
import { getBifrostGateway, type ProviderHealth, type ProviderType } from './bifrost_gateway.js';
import { GraphRagEngine } from './graphRagEngine.js';
import { ReflectionEngine } from './reflectionEngine.js';
import { HybridMemory } from '../utils/rag.js';

export type AssistantReadinessStatus = 'ready' | 'partial' | 'planned';

export interface AssistantCapability {
  id: string;
  title: string;
  status: AssistantReadinessStatus;
  score: number;
  summary: string;
  details: string[];
  evidence?: Record<string, unknown>;
}

export interface AssistantArchitectureLayer {
  id: string;
  title: string;
  summary: string;
  modules: string[];
  purpose: string;
  nextUpgrade?: string;
}

export interface AssistantRoadmapPhase {
  id: string;
  title: string;
  goal: string;
  deliverables: string[];
}

export interface AssistantBlueprint {
  assistantName: string;
  targetPlatform: string;
  generatedAt: string;
  recommendedMode: {
    primaryCloudProvider: ProviderType | 'github';
    localFallbackProvider: ProviderType | 'ollama';
    desktopShell: string;
    recommendation: string;
  };
  overallReadiness: {
    score: number;
    label: string;
    summary: string;
  };
  providerHealth: ProviderHealth[];
  capabilities: AssistantCapability[];
  architecture: AssistantArchitectureLayer[];
  roadmap: AssistantRoadmapPhase[];
  nextActions: string[];
}

function statusScore(status: AssistantReadinessStatus): number {
  if (status === 'ready') return 90;
  if (status === 'partial') return 60;
  return 25;
}

function statusLabel(status: AssistantReadinessStatus): string {
  if (status === 'ready') return 'Kész';
  if (status === 'partial') return 'Részben kész';
  return 'Tervezett';
}

function resolveOverallLabel(score: number): string {
  if (score >= 80) return 'Erős alap';
  if (score >= 60) return 'Jó MVP alap';
  if (score >= 40) return 'Kezdhető, de hiányos';
  return 'Korai előkészítés';
}

function rootPath(...segments: string[]): string {
  return path.join(process.cwd(), ...segments);
}

export async function getAssistantBlueprint(): Promise<AssistantBlueprint> {
  const gateway = getBifrostGateway();
  const enabledProviders = gateway.getEnabledProviders();
  const providerHealth = await gateway.checkHealth().catch(() => [] as ProviderHealth[]);
  const healthyProviders = new Set(providerHealth.filter((provider) => provider.available).map((provider) => provider.provider));

  const graphRag = GraphRagEngine.getInstance();
  await graphRag.init();
  const graphStats = graphRag.getStats();

  const reflection = ReflectionEngine.getInstance();
  const reflectionStats = reflection.getStats();

  const hybridMemory = new HybridMemory();
  const indexedDocuments = await hybridMemory.getTableCount().catch(() => 0);

  const hasTauriShell = existsSync(rootPath('src-tauri', 'tauri.conf.json'));
  const hasVoiceRoute = existsSync(rootPath('src', 'server', 'routes', 'voice.ts'));
  const hasTtsEngine = existsSync(rootPath('myai', 'utils', 'tts_engine.py'));
  const hasRobotkez = existsSync(rootPath('src', 'server', 'routes', 'robotkez.ts'));
  const hasWindowsBridge = existsSync(rootPath('windows_bridge', 'wab_server.py'));
  const hasSafeZones = existsSync(rootPath('config', 'safe_zones.json'));
  const hasPermissionProfiles = existsSync(rootPath('src', 'agents', 'permissions.ts'));

  const supportsGithubPrimary = enabledProviders.includes('github');
  const supportsOllamaFallback = enabledProviders.includes('ollama');
  const supportsCloudFallback = enabledProviders.includes('cloudflare') || enabledProviders.includes('gemini') || enabledProviders.includes('anthropic');

  const desktopCapability: AssistantCapability = {
    id: 'desktop-shell',
    title: 'Windows desktop shell',
    status: hasTauriShell ? 'ready' : 'planned',
    score: hasTauriShell ? 92 : 25,
    summary: hasTauriShell
      ? 'A projektben már van Tauri shell alap, ezért a személyi asszisztensből natív Windows alkalmazás készíthető.'
      : 'Desktop shell még nincs bekötve a személyi asszisztens nézetre.',
    details: [
      hasTauriShell ? 'Tauri konfiguráció jelen van a repo-ban.' : 'A Tauri desktop hostot be kell vezetni.',
      'A javasolt UX: egyetlen BAS Assistant felület chat + voice + automation nézettel.',
    ],
    evidence: {
      tauriShell: hasTauriShell,
    },
  };

  const modelCapability: AssistantCapability = {
    id: 'model-routing',
    title: 'GitHub Models + local Ollama váltás',
    status: supportsGithubPrimary && supportsOllamaFallback ? 'ready' : supportsGithubPrimary || supportsOllamaFallback ? 'partial' : 'planned',
    score: supportsGithubPrimary && supportsOllamaFallback ? 95 : supportsGithubPrimary || supportsOllamaFallback ? 65 : 25,
    summary: supportsGithubPrimary && supportsOllamaFallback
      ? 'A Bifrost gateway már most támogatja a GitHub Models → Ollama váltást, ami pontosan illik a kívánt működéshez.'
      : 'A multi-provider alap megvan, de a kívánt elsődleges/fallback működés nincs teljesen készre hangolva.',
    details: [
      `Engedélyezett providerek: ${enabledProviders.length > 0 ? enabledProviders.join(', ') : 'nincs aktív provider'}`,
      healthyProviders.size > 0
        ? `Egészséges providerek: ${Array.from(healthyProviders).join(', ')}`
        : 'Provider health ellenőrzés szerint jelenleg nincs garantáltan egészséges provider.',
      supportsCloudFallback ? 'Van felhős tartalék provider is a GitHub/Ollama pároson túl.' : 'Érdemes egy második cloud provider fallbacket is megtartani.',
    ],
    evidence: {
      enabledProviders,
      healthyProviders: Array.from(healthyProviders),
    },
  };

  const voiceCapability: AssistantCapability = {
    id: 'voice-experience',
    title: 'Magyar hang input/output',
    status: hasVoiceRoute && hasTtsEngine ? 'partial' : 'planned',
    score: hasVoiceRoute && hasTtsEngine ? 58 : 25,
    summary: hasVoiceRoute && hasTtsEngine
      ? 'Van meglévő TTS és böngészőalapú hangbevitel, de a dedikált női magyar hang és a stabil local STT még külön finomítást igényel.'
      : 'A hangréteg alapjai még hiányoznak a személyi asszisztens szinthez.',
    details: [
      hasVoiceRoute ? 'Létezik voice API route.' : 'Voice API route még nincs kész.',
      hasTtsEngine ? 'Python TTS engine jelen van.' : 'TTS engine hiányzik.',
      'A végső célhoz javasolt: faster-whisper STT + dedikált hu-HU női TTS hang.',
      'A jelenlegi browser SpeechRecognition jó átmeneti MVP, de nem elég stabil végleges desktop hangvezérléshez.',
    ],
    evidence: {
      voiceRoute: hasVoiceRoute,
      ttsEngine: hasTtsEngine,
      openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
    },
  };

  const memoryCapability: AssistantCapability = {
    id: 'memory-graphrag',
    title: 'Long-term memory + GraphRAG + self-eval',
    status: graphStats.nodes > 0 || reflectionStats.totalReflections > 0 || indexedDocuments > 0 ? 'ready' : 'partial',
    score: graphStats.nodes > 0 || reflectionStats.totalReflections > 0 || indexedDocuments > 0 ? 88 : 62,
    summary: 'A repo-ban már van HybridMemory (LanceDB), GraphRAG és ReflectionEngine, ezért a hosszú távú memória és önértékelés nem nulláról indul.',
    details: [
      `Indexelt memóriaelemek (LanceDB): ${indexedDocuments}`,
      `Knowledge graph: ${graphStats.nodes} node / ${graphStats.edges} edge / ${graphStats.lessons} tanulság`,
      `Reflection engine: ${reflectionStats.totalReflections} reflexió, self-model health = ${reflectionStats.selfModelHealth}`,
      'A következő lépés a személyes emlékek, preferenciák és workflow-tanulságok dedikált assistant sémába rendezése.',
    ],
    evidence: {
      indexedDocuments,
      graphStats,
      reflectionStats,
    },
  };

  const automationCapability: AssistantCapability = {
    id: 'computer-use',
    title: 'Computer use + workflow automation',
    status: hasRobotkez && hasWindowsBridge ? 'ready' : hasRobotkez || hasWindowsBridge ? 'partial' : 'planned',
    score: hasRobotkez && hasWindowsBridge ? 86 : hasRobotkez || hasWindowsBridge ? 60 : 25,
    summary: hasRobotkez && hasWindowsBridge
      ? 'Robotkéz és Windows bridge együtt jó alapot adnak böngésző-, fájl- és desktop-akciókhoz.'
      : 'Az automatizálási réteg részben megvan, de a teljes személyi asszisztens workflow-hoz még össze kell hangolni.',
    details: [
      hasRobotkez ? 'Robotkéz / computer-use API jelen van.' : 'Robotkéz API hiányzik.',
      hasWindowsBridge ? 'Windows Automation Bridge jelen van.' : 'Windows bridge hiányzik.',
      'A következő lépés egy approval-gated assistant action bus a veszélyes műveletekhez.',
    ],
    evidence: {
      robotkez: hasRobotkez,
      windowsBridge: hasWindowsBridge,
    },
  };

  const safetyCapability: AssistantCapability = {
    id: 'safety-guardrails',
    title: 'Guardrails + jóváhagyás + path safety',
    status: hasSafeZones && hasPermissionProfiles ? 'ready' : hasSafeZones || hasPermissionProfiles ? 'partial' : 'planned',
    score: hasSafeZones && hasPermissionProfiles ? 91 : hasSafeZones || hasPermissionProfiles ? 60 : 25,
    summary: 'A személyi asszisztenshez kritikus biztonsági alapok már megvannak: RBAC, safe zones és approval-képes orchestrator viselkedés.',
    details: [
      hasSafeZones ? 'Filesystem safe zones konfiguráció elérhető.' : 'Safe zones konfiguráció hiányzik.',
      hasPermissionProfiles ? 'Agent permission profilok elérhetők.' : 'Permission profile rendszer hiányzik.',
      'Ajánlott következő lépés: assistant-specific permission presetek (safe / elevated / admin workflow).',
    ],
    evidence: {
      safeZones: hasSafeZones,
      permissionProfiles: hasPermissionProfiles,
    },
  };

  const capabilities = [
    desktopCapability,
    modelCapability,
    voiceCapability,
    memoryCapability,
    automationCapability,
    safetyCapability,
  ];

  const overallScore = Math.round(capabilities.reduce((sum, capability) => sum + capability.score, 0) / capabilities.length);

  const architecture: AssistantArchitectureLayer[] = [
    {
      id: 'experience',
      title: 'Experience layer',
      summary: 'Modern magyar felület chat, voice, timeline és automation nézettel.',
      modules: ['src/dashboard/components/dashboard/PAIOSOrchestratorChat.tsx', 'src/dashboard/components/dashboard/RobotkezV2Chat.tsx', 'src-tauri/'],
      purpose: 'Ez lesz a felhasználó egyetlen fő belépési pontja Windows alatt.',
      nextUpgrade: 'Egységes BAS Assistant képernyőre kell összevonni a szétszórt chat/robotkez/voice nézeteket.',
    },
    {
      id: 'orchestration',
      title: 'Assistant orchestration layer',
      summary: 'UniversalOrchestratorService + AgentManager + Bifrost adja a gondolkodó és delegáló magot.',
      modules: ['src/core/universalOrchestratorService.ts', 'src/agents/AgentManager.ts', 'src/core/bifrost_gateway.ts'],
      purpose: 'Dönti el, hogy válaszol, emlékezik, delegál vagy automatikusan cselekszik.',
      nextUpgrade: 'Assistant persona/profile és explicit task-policy réteg hozzáadása.',
    },
    {
      id: 'memory',
      title: 'Memory + GraphRAG layer',
      summary: 'HybridMemory, GraphRagEngine és ReflectionEngine együtt adja a hosszú távú tanulási képességet.',
      modules: ['src/utils/rag.ts', 'src/core/graphRagEngine.ts', 'src/core/reflectionEngine.ts'],
      purpose: 'Megőrzi a személyes preferenciákat, kapcsolódó fogalmakat és korábbi tanulságokat.',
      nextUpgrade: 'Assistant-specifikus memory schema: people, projects, routines, preferences, lessons.',
    },
    {
      id: 'actions',
      title: 'Action + automation layer',
      summary: 'Robotkéz, Windows bridge és tooling biztosítja a valódi végrehajtást.',
      modules: ['src/server/routes/robotkez.ts', 'windows_bridge/wab_server.py', 'src/server/routes/voice.ts'],
      purpose: 'Képes képernyőt nézni, kattintani, gépelni, fájlokat kezelni és workflow-kat indítani.',
      nextUpgrade: 'Unified assistant action bus approval, audit trail és task rollback támogatással.',
    },
  ];

  const roadmap: AssistantRoadmapPhase[] = [
    {
      id: 'phase-1',
      title: 'Foundation MVP',
      goal: 'Egységes assistant felület és readiness-vezérelt architektúra létrehozása.',
      deliverables: [
        'Assistant blueprint API + dashboard + CLI',
        'GitHub Models primary / Ollama fallback policy',
        'Egységes assistant session kezelés',
      ],
    },
    {
      id: 'phase-2',
      title: 'Voice-first Hungarian assistant',
      goal: 'Megbízható magyar voice UX kialakítása.',
      deliverables: [
        'Local/STT pipeline (pl. faster-whisper)',
        'Női magyar TTS hang integráció',
        'Push-to-talk és folyamatos hallgatás módok',
      ],
    },
    {
      id: 'phase-3',
      title: 'Personal memory + GraphRAG',
      goal: 'Személyes memóriaséma, preferenciák és kapcsolati tudás felépítése.',
      deliverables: [
        'Assistant memory profile',
        'GraphRAG enrichment a beszélgetésekre',
        'Tanulságok mentése hosszú távra',
      ],
    },
    {
      id: 'phase-4',
      title: 'Safe computer use',
      goal: 'Valódi desktop workflow automatizálás jóváhagyásokkal.',
      deliverables: [
        'Assistant action bus',
        'Approval-gated high-risk actions',
        'Routine automation library',
      ],
    },
    {
      id: 'phase-5',
      title: 'Product polish',
      goal: 'Személyes, modern, napi használatú AI asszisztens élmény.',
      deliverables: [
        'Windows packaging',
        'Persona tuning és onboarding',
        'Home/Today dashboard nézet',
      ],
    },
  ];

  return {
    assistantName: 'Brunella Personal AI',
    targetPlatform: 'Windows desktop (Tauri + React + Node/Python hybrid)',
    generatedAt: new Date().toISOString(),
    recommendedMode: {
      primaryCloudProvider: 'github',
      localFallbackProvider: 'ollama',
      desktopShell: hasTauriShell ? 'Tauri' : 'Tauri (recommended next step)',
      recommendation: 'A legjobb megoldás nem külön új projekt, hanem a meglévő Brunella stack termékesítése: Tauri shell + PAIOS orchestration + GraphRAG memória + Robotkéz/Windows bridge.',
    },
    overallReadiness: {
      score: overallScore,
      label: resolveOverallLabel(overallScore),
      summary: `A jelenlegi Brunella kódalap ${overallScore}% körüli készenléti szinten van egy Windows-first személyi AI asszisztens MVP-hez. A legerősebb részek: model routing, memória és automation alapok. A legnagyobb hiány: végleges magyar voice stack és egységes product UX.`,
    },
    providerHealth,
    capabilities,
    architecture,
    roadmap,
    nextActions: [
      'Egységes BAS Assistant képernyő létrehozása chat + voice + automation + memory nézettel.',
      'Hungarian voice stack: faster-whisper STT + dedikált hu-HU női TTS hang.',
      'Assistant memory profile: people, preferences, projects, routines, lessons.',
      'Approval-gated assistant action bus a veszélyes desktop műveletekhez.',
    ],
  };
}
