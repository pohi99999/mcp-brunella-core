/**
 * SystemBlueprint – Software Genesis Protocol séma
 * Track: software_genesis_protocol_20260216 – Phase 1
 *
 * Glass Box: A ArchitectAgent által generált applikáció struktúra leíró.
 * Validált JSON schema – minden Genesis futtatás kiindulási pontja.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Alapvető enum-ok
// ─────────────────────────────────────────────────────────────────────────────

export type TechStack =
  | "react" | "vue" | "angular" | "nextjs" | "remix"       // Frontend
  | "express" | "fastapi" | "django" | "nestjs" | "hono"   // Backend
  | "postgresql" | "mongodb" | "sqlite" | "lancedb"        // DB
  | "typescript" | "python" | "go" | "java"                 // Language
  | "docker" | "cloudflare" | "vercel" | "azure"           // Infra
  | string;                                                   // Egyedi

export type AppLayer = "frontend" | "backend" | "database" | "infra" | "ai" | "mobile";

export type ModuleStatus =
  | "planned"      // Csak le van tervezve
  | "scaffolded"   // Váz generálva
  | "in_progress"  // Fejlesztés alatt
  | "testing"      // Tesztelés
  | "done";        // Kész

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type DeployTarget =
  | "cloudflare_workers" | "cloudflare_pages"
  | "vercel" | "netlify"
  | "azure_functions" | "azure_static_web_app"
  | "docker_compose" | "kubernetes"
  | "local_only";

// ─────────────────────────────────────────────────────────────────────────────
// Modul struktúra
// ─────────────────────────────────────────────────────────────────────────────

export interface BlueprintModule {
  id: string;
  name: string;
  layer: AppLayer;
  description: string;
  tech_stack: TechStack[];
  dependencies: string[];        // Más modul id-k amire épül
  files_to_generate: string[];   // Generálandó fájlok listája
  prompts: string[];             // Az ügynöknek adandó promptok
  status: ModuleStatus;
  estimated_hours: number;
  risk: RiskLevel;
  acceptance_criteria: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Követelmény interjú
// ─────────────────────────────────────────────────────────────────────────────

export interface RequirementInterview {
  app_name: string;
  goal: string;                   // Mit kell az appnak elérnie?
  target_users: string;           // Ki fogja használni?
  primary_language: string;       // Felhasználói felület nyelve: "hu" | "en"
  scale: "personal" | "small_team" | "enterprise";
  deadline?: string;              // ISO date
  budget?: "low" | "medium" | "high";
  must_haves: string[];           // Kötelező funkciók
  nice_to_haves: string[];        // Opcionális funkciók
  known_constraints: string[];    // Platformkorlátok, licensz, stb.
  existing_integrations: string[]; // Meglévő rendszerek amivel össze kell kötni
}

// ─────────────────────────────────────────────────────────────────────────────
// Fő SystemBlueprint
// ─────────────────────────────────────────────────────────────────────────────

// Blueprint types read for GenesisOrchestrator implementation
export interface SystemBlueprint {
  id: string;
  version: string;              // pl. "1.0.0"
  created_at: string;           // ISO datetime
  updated_at: string;

  // Alapinfo
  app_name: string;
  description: string;
  interview: RequirementInterview;

  // Architektúra
  architecture_style:
    | "monolith"
    | "microservices"
    | "serverless"
    | "hybrid"
    | "event_driven";
  modules: BlueprintModule[];
  deploy_targets: DeployTarget[];

  // Elvárások
  non_functional_requirements: {
    performance: string;
    security: string;
    scalability: string;
    accessibility: string;
    observability: string;
  };

  // AI ügynök kijelöltek
  agent_assignments: {
    module_id: string;
    agent_name: string;
    phase: number;
  }[];

  // QA kapuk
  qa_gates: {
    phase: number;
    gate_name: string;
    criteria: string[];
    evaluator_agent: string;
  }[];

  // Validáció
  is_approved: boolean;            // Emberi jóváhagyás megvan-e
  approved_by?: string;
  approval_notes?: string;
  confidence_score: number;        // 0.0 – 1.0 (AI megbízhatóság az blueprint teljességéről)

  // Hiányzó adatok – amikre rá kell kérdezni
  missing_inputs: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Interjú kör (clarification loop)
// ─────────────────────────────────────────────────────────────────────────────

export interface InterviewQuestion {
  id: string;
  category: "scope" | "tech" | "users" | "constraints" | "integrations";
  question: string;
  is_required: boolean;
  answer?: string;
}

export interface InterviewSession {
  session_id: string;
  started_at: string;
  questions: InterviewQuestion[];
  answers_complete: boolean;
  blueprint_draft?: Partial<SystemBlueprint>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SpecDocument – Software Genesis Protocol Phase 2
// SpecWriterAgent generálja BlueprintModule-ökből
// ─────────────────────────────────────────────────────────────────────────────

export interface ModuleTask {
  id: string;                     // pl. "frontend_01_task_2"
  description: string;            // Emberi olvasható feladat leírás
  prompt_template: string;        // DeveloperAgent-nek szóló prompt
  estimated_minutes: number;
  assigned_agent: string;         // pl. "DeveloperAgent"
  dependencies: string[];         // Más task id-k
  acceptance_criteria: string[];  // Elfogadási kritériumok
}

export interface FileManifestEntry {
  path: string;             // pl. "src/components/Dashboard.tsx"
  description: string;
  tech: TechStack;
}

export interface ModuleSpec {
  module_id: string;
  module_name: string;
  layer: AppLayer;
  summary: string;
  tasks: ModuleTask[];
  file_manifest: FileManifestEntry[];
  total_estimated_minutes: number;
  assigned_agents: string[];
  generated_at: string;
}

export interface AgentTaskQueueItem {
  priority: number;              // Alacsonyabb = magasabb prioritás
  module_id: string;
  task_id: string;
  agent: string;
  prompt: string;
  estimated_minutes: number;
}

export interface SpecDocument {
  blueprint_id: string;
  app_name: string;
  generated_at: string;
  module_specs: ModuleSpec[];
  dependency_order: string[];          // Modul ID-k topológiai sorrendben
  total_tasks: number;
  total_estimated_hours: number;
  agent_task_queue: AgentTaskQueueItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ArchitectAgent kimenet
// ─────────────────────────────────────────────────────────────────────────────

export interface GenesisResult {
  blueprint: SystemBlueprint;
  interview_session: InterviewSession;
  next_agent_tasks: {
    agent: string;
    task: string;
    module_id: string;
    priority: number;
  }[];
  estimated_total_hours: number;
  generated_at: string;
}
