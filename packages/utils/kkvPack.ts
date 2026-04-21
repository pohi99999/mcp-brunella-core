export const kkvPackIds = ["finance-core", "inventory-core", "logistics-core"] as const;
export type KkvPackId = (typeof kkvPackIds)[number];

export const kkvPackDomains = ["finance", "inventory", "logistics"] as const;
export type KkvPackDomain = (typeof kkvPackDomains)[number];

export const kkvPackStatusValues = ["ready", "pilot", "partial", "blocked"] as const;
export type KkvPackStatus = (typeof kkvPackStatusValues)[number];

export const kkvPackSurfaceKinds = ["route", "cli", "dashboard", "agent", "mcp"] as const;
export type KkvPackSurfaceKind = (typeof kkvPackSurfaceKinds)[number];

export const kkvPackStatusLabels: Record<KkvPackStatus, string> = {
  ready: "Ready",
  pilot: "Pilot",
  partial: "Partial",
  blocked: "Blocked",
};

export const kkvPackDomainLabels: Record<KkvPackDomain, string> = {
  finance: "Finance",
  inventory: "Inventory",
  logistics: "Logistics",
};

export const kkvPackSurfaceKindLabels: Record<KkvPackSurfaceKind, string> = {
  route: "HTTP route",
  cli: "CLI",
  dashboard: "Dashboard",
  agent: "Agent",
  mcp: "MCP tool",
};

export interface KkvPackSurface {
  kind: KkvPackSurfaceKind;
  ref: string;
  description: string;
}

export interface KkvPackBrief {
  headline: string;
  promise: string;
  pilotScope: string;
  guardrail: string;
}

export interface KkvPackDefinition {
  id: KkvPackId;
  title: string;
  domain: KkvPackDomain;
  status: KkvPackStatus;
  score: number;
  boundary: string;
  valuePromise: string;
  targetUsers: string[];
  surfaces: KkvPackSurface[];
  contracts: string[];
  pilotCriteria: string[];
  linkedTracks: string[];
  risks: string[];
  brief: KkvPackBrief;
}

export interface KkvPackRecommendation {
  id: string;
  target: KkvPackDomain | "combined";
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  rationale: string;
  evidence: string[];
  actions: string[];
}

export interface KkvPackSnapshotSummary {
  score: number;
  status: "healthy" | "warning" | "critical";
  totalPacks: number;
  readyPacks: number;
  pilotPacks: number;
  partialPacks: number;
  blockedPacks: number;
}

export interface KkvPackSnapshot {
  checkedAt: string;
  packs: KkvPackDefinition[];
  selectedPackId: KkvPackId;
  selectedPack: KkvPackDefinition;
  summary: KkvPackSnapshotSummary;
  warnings: string[];
  recommendations: KkvPackRecommendation[];
}

export interface KkvPackResponse {
  success: true;
  snapshot: KkvPackSnapshot;
  markdown: string;
  briefMarkdown: string;
}

const KKV_PACK_DEFINITIONS: KkvPackDefinition[] = [
  {
    id: "finance-core",
    title: "Finance Core Pack",
    domain: "finance",
    status: "ready",
    score: 92,
    boundary: "Petty cash, bookkeeping, invoice lifecycle, and bank reconciliation live here. CRM lead handling stays outside this pack.",
    valuePromise: "A single cockpit for cash, invoices, reconciliation, and month-end readiness.",
    targetUsers: ["Finance ops", "Business owner", "Bookkeeper"],
    surfaces: [
      { kind: "route", ref: "/api/v1/bookkeeping/status", description: "Live bookkeeping and readiness snapshot" },
      { kind: "route", ref: "/api/v1/bookkeeping/cash-entries", description: "Cash-entry CRUD surface" },
      { kind: "route", ref: "/api/v1/invoice", description: "Invoice automation surface" },
      { kind: "route", ref: "/api/v1/finance-reconciliation", description: "Reconciliation cockpit surface" },
      { kind: "dashboard", ref: "BookkeepingWidget", description: "Operational bookkeeping widget" },
      { kind: "dashboard", ref: "HazipenztarWidget", description: "Petty-cash widget" },
      { kind: "dashboard", ref: "FinanceReconciliationPanel", description: "Reconciliation panel" },
      { kind: "cli", ref: "brunella bookkeeping", description: "Bookkeeping CLI entrypoint" },
      { kind: "cli", ref: "brunella invoice", description: "Invoice CLI entrypoint" },
    ],
    contracts: [
      "Cash entries",
      "Invoice sync",
      "Bank reconciliation",
      "Exception queue",
    ],
    pilotCriteria: [
      "Finance exceptions are visible in the cockpit.",
      "Cash and invoice flows stay isolated from CRM.",
      "Month-end readiness can be reviewed without leaving the pack layer.",
    ],
    linkedTracks: [
      "kkv_business_automation_20260408",
      "bookkeeping",
      "invoice-sync",
    ],
    risks: [
      "Bankfeed latency",
      "Invoice mismatch",
      "Manual review backlog",
    ],
    brief: {
      headline: "Finance pack for month-end control",
      promise: "Surface cash, invoices, and reconciliation in one place without widening the product boundary.",
      pilotScope: "Keep the pack read-only and cockpit-first while the underlying finance surfaces stay local.",
      guardrail: "Do not fold CRM, marketing, or sales intake into this pack.",
    },
  },
  {
    id: "inventory-core",
    title: "Inventory Core Pack",
    domain: "inventory",
    status: "ready",
    score: 90,
    boundary: "SKU master data, movements, valuation, stocktake, and reorder review live here. Finance uses the outputs, but does not own the pack.",
    valuePromise: "One view for stock health, reorder pressure, and valuation quality.",
    targetUsers: ["Inventory ops", "Warehouse owner", "Finance reviewer"],
    surfaces: [
      { kind: "route", ref: "/api/v1/inventory/status", description: "Inventory status snapshot" },
      { kind: "route", ref: "/api/v1/inventory/valuation", description: "FIFO/WAC valuation summary" },
      { kind: "route", ref: "/api/v1/inventory/pending-orders", description: "Pending purchase orders" },
      { kind: "route", ref: "/api/v1/inventory/open-stocktakes", description: "Open stocktake items" },
      { kind: "dashboard", ref: "InventoryCatalog", description: "Inventory catalog dashboard" },
      { kind: "dashboard", ref: "InventoryRadarWidget", description: "Inventory radar widget" },
      { kind: "cli", ref: "brunella inventory", description: "Inventory CLI entrypoint" },
    ],
    contracts: [
      "FIFO / WAC valuation",
      "Stock movement ledger",
      "Stocktake mismatch handling",
      "Pending order review",
    ],
    pilotCriteria: [
      "Open stocktakes are visible in the cockpit.",
      "Pending orders and valuation snapshots are easy to inspect.",
      "Inventory data stays isolated from finance execution.",
    ],
    linkedTracks: [
      "kkv_business_automation_20260408",
      "inventory_automation_20260330",
    ],
    risks: [
      "Valuation drift",
      "Stocktake backlog",
      "Supplier reorder timing",
    ],
    brief: {
      headline: "Inventory pack for stock control",
      promise: "Make reorder, valuation, and stocktake work visible without turning the pack into a generic ERP layer.",
      pilotScope: "Keep inventory surfaces productized but local until external warehouse integrations need their own track.",
      guardrail: "Do not merge this pack with finance execution or CRM lead handling.",
    },
  },
  {
    id: "logistics-core",
    title: "Logistics Core Pack",
    domain: "logistics",
    status: "pilot",
    score: 74,
    boundary: "Shipment tracking, dispatch, route optimization, and proactive notifications live here. Carrier integrations remain pluggable and outside the product boundary.",
    valuePromise: "A reusable logistics cockpit that exposes route intelligence and dispatch exceptions.",
    targetUsers: ["Logistics ops", "Dispatcher", "Operations lead"],
    surfaces: [
      { kind: "route", ref: "/api/v1/logistics", description: "Repository-local logistics route" },
      { kind: "agent", ref: "LogisticsDispatcher", description: "Shipment tracking and route optimization agent" },
      { kind: "dashboard", ref: "KKVPackCockpit", description: "Shared productization cockpit" },
      { kind: "mcp", ref: "kkv_pack_snapshot", description: "MCP snapshot for other agents and tools" },
      { kind: "cli", ref: "brunella kkv-pack brief logistics-core", description: "Pack brief from the terminal" },
    ],
    contracts: [
      "Shipment tracking",
      "Route optimization",
      "Proactive notifications",
      "Dispatch exception handling",
    ],
    pilotCriteria: [
      "Carrier dependencies stay behind the pack boundary.",
      "The cockpit can inspect the logistics pack without mutating state.",
      "Dispatch exceptions are visible before any standalone launch work begins.",
    ],
    linkedTracks: [
      "kkv_business_automation_20260408",
      "logistics_vertical_20260222",
      "logistics_vertical_repo_local_20260407",
    ],
    risks: [
      "External carrier dependency drift",
      "Route data quality",
      "Public launch scope creep",
    ],
    brief: {
      headline: "Logistics pack for dispatch visibility",
      promise: "Keep shipment, route, and notification signals together while the carrier stack stays modular.",
      pilotScope: "Treat this as a productized pilot surface until dedicated carrier integrations are isolated.",
      guardrail: "Do not widen this pack into the public launch workflow or unrelated business automations.",
    },
  },
];

function clonePackDefinition(pack: KkvPackDefinition): KkvPackDefinition {
  return {
    ...pack,
    targetUsers: [...pack.targetUsers],
    surfaces: pack.surfaces.map((surface) => ({ ...surface })),
    contracts: [...pack.contracts],
    pilotCriteria: [...pack.pilotCriteria],
    linkedTracks: [...pack.linkedTracks],
    risks: [...pack.risks],
    brief: { ...pack.brief },
  };
}

function getPackById(packId: KkvPackId): KkvPackDefinition {
  const pack = KKV_PACK_DEFINITIONS.find((entry) => entry.id === packId);
  if (!pack) {
    throw new Error(`Unknown KKV pack: ${packId}`);
  }

  return clonePackDefinition(pack);
}

function resolvePackId(value?: string): KkvPackId {
  if (!value) {
    return KKV_PACK_DEFINITIONS[0].id;
  }

  if (!kkvPackIds.includes(value as KkvPackId)) {
    throw new Error(`Unknown KKV pack: ${value}`);
  }

  return value as KkvPackId;
}

function buildSummary(packs: KkvPackDefinition[]): KkvPackSnapshotSummary {
  const counts = packs.reduce(
    (acc, pack) => {
      acc[pack.status] += 1;
      return acc;
    },
    { ready: 0, pilot: 0, partial: 0, blocked: 0 } as Record<KkvPackStatus, number>,
  );

  const score = Math.round(
    packs.reduce((total, pack) => total + pack.score, 0) / Math.max(packs.length, 1),
  );

  const status = counts.blocked > 0
    ? "critical"
    : counts.partial > 0
      ? "warning"
      : "healthy";

  return {
    score,
    status,
    totalPacks: packs.length,
    readyPacks: counts.ready,
    pilotPacks: counts.pilot,
    partialPacks: counts.partial,
    blockedPacks: counts.blocked,
  };
}

function buildWarnings(snapshot: KkvPackSnapshot): string[] {
  const warnings: string[] = [];

  if (snapshot.summary.blockedPacks > 0) {
    warnings.push("One or more packs are blocked and should not be treated as product-ready.");
  }

  if (snapshot.summary.pilotPacks > 0) {
    warnings.push("Pilot packs are intentionally local; keep external launch work in a separate track.");
  }

  if (snapshot.selectedPack.status !== "ready") {
    warnings.push(`Selected pack ${snapshot.selectedPack.id} is ${snapshot.selectedPack.status}; treat it as a bounded product brief.`);
  }

  if (warnings.length === 0) {
    warnings.push("The current pack layer is boundary-first and ready for cockpit inspection.");
  }

  return warnings;
}

function buildRecommendations(snapshot: KkvPackSnapshot): KkvPackRecommendation[] {
  const recommendations: KkvPackRecommendation[] = [
    {
      id: "keep-crm-outside-pack-boundary",
      target: "combined",
      priority: "high",
      title: "Keep the pack layer separate from CRM and launch work",
      rationale: "The pack is meant to productize the KKV backoffice, not absorb customer acquisition or external launch workflows.",
      evidence: ["CRM stays outside the finance/inventory/logistics pack boundary."],
      actions: [
        "Keep CRM-specific work in the masterplan and dedicated tracks.",
        "Do not add public launch flows to the pack cockpit.",
      ],
    },
  ];

  if (snapshot.summary.pilotPacks > 0) {
    recommendations.push({
      id: "promote-logistics-from-pilot",
      target: "logistics",
      priority: "medium",
      title: "Promote the logistics pack only after carrier boundaries are frozen",
      rationale: "The logistics pack is intentionally a pilot surface because carrier integrations are still modular.",
      evidence: ["logistics-core is marked pilot"],
      actions: [
        "Keep route and notification exceptions visible in the cockpit.",
        "Split carrier-specific launch work into a separate follow-up track when needed.",
      ],
    });
  }

  return recommendations;
}

export function listKkvPackDefinitions(): KkvPackDefinition[] {
  return KKV_PACK_DEFINITIONS.map(clonePackDefinition);
}

export function isKkvPackId(value: string): value is KkvPackId {
  return kkvPackIds.includes(value as KkvPackId);
}

export function buildKkvPackSnapshot(options: { packId?: string } = {}): KkvPackSnapshot {
  const packs = listKkvPackDefinitions();
  const selectedPackId = resolvePackId(options.packId);
  const selectedPack = getPackById(selectedPackId);
  const summary = buildSummary(packs);

  const snapshot: KkvPackSnapshot = {
    checkedAt: new Date().toISOString(),
    packs,
    selectedPackId,
    selectedPack,
    summary,
    warnings: [],
    recommendations: [],
  };

  snapshot.warnings = buildWarnings(snapshot);
  snapshot.recommendations = buildRecommendations(snapshot);

  return snapshot;
}

function renderSurfaceLines(pack: KkvPackDefinition): string[] {
  return pack.surfaces.map((surface) => `- **${kkvPackSurfaceKindLabels[surface.kind]}** \`${surface.ref}\` — ${surface.description}`);
}

function renderPackBrief(pack: KkvPackDefinition): string {
  return [
    `### ${pack.title}`,
    "",
    `- Status: **${kkvPackStatusLabels[pack.status]}** (${pack.score}/100)`,
    `- Domain: **${kkvPackDomainLabels[pack.domain]}**`,
    `- Headline: ${pack.brief.headline}`,
    `- Promise: ${pack.brief.promise}`,
    `- Pilot scope: ${pack.brief.pilotScope}`,
    `- Guardrail: ${pack.brief.guardrail}`,
    "",
    "#### Surfaces",
    "",
    ...renderSurfaceLines(pack),
  ].join("\n");
}

export function renderKkvPackMarkdown(snapshot: KkvPackSnapshot): string {
  const tableRows = snapshot.packs
    .map((pack) => `| ${pack.title} | ${kkvPackStatusLabels[pack.status]} | ${pack.score} | ${pack.boundary} |`)
    .join("\n");

  const recommendationLines = snapshot.recommendations.length > 0
    ? snapshot.recommendations
        .map((item) => `- **${item.title}** — ${item.rationale}`)
        .join("\n")
    : "- None";

  const warningLines = snapshot.warnings.length > 0
    ? snapshot.warnings.map((warning) => `- ${warning}`).join("\n")
    : "- None";

  return [
    "# KKV Pack Productization & Cockpit Definition",
    "",
    `- Checked at: **${snapshot.checkedAt}**`,
    `- Overall score: **${snapshot.summary.score}**`,
    `- Overall status: **${snapshot.summary.status}**`,
    `- Ready packs: **${snapshot.summary.readyPacks}**`,
    `- Pilot packs: **${snapshot.summary.pilotPacks}**`,
    `- Partial packs: **${snapshot.summary.partialPacks}**`,
    `- Blocked packs: **${snapshot.summary.blockedPacks}**`,
    "",
    "## Pack boundary overview",
    "",
    "| Pack | Status | Score | Boundary |",
    "| --- | --- | --- | --- |",
    tableRows,
    "",
    "## Product brief",
    "",
    `- Headline: ${snapshot.selectedPack.brief.headline}`,
    `- Promise: ${snapshot.selectedPack.brief.promise}`,
    `- Pilot scope: ${snapshot.selectedPack.brief.pilotScope}`,
    `- Guardrail: ${snapshot.selectedPack.brief.guardrail}`,
    "",
    `## Selected pack: ${snapshot.selectedPack.title}`,
    "",
    renderPackBrief(snapshot.selectedPack),
    "",
    "## Recommendations",
    "",
    recommendationLines,
    "",
    "## Warnings",
    "",
    warningLines,
  ].join("\n");
}

export function renderKkvPackBriefMarkdown(pack: KkvPackDefinition): string {
  return [
    `# ${pack.title}`,
    "",
    `- Status: **${kkvPackStatusLabels[pack.status]}** (${pack.score}/100)`,
    `- Domain: **${kkvPackDomainLabels[pack.domain]}**`,
    `- Boundary: ${pack.boundary}`,
    `- Value promise: ${pack.valuePromise}`,
    "",
    "## Target users",
    "",
    ...pack.targetUsers.map((user) => `- ${user}`),
    "",
    "## Pilot criteria",
    "",
    ...pack.pilotCriteria.map((criterion) => `- ${criterion}`),
    "",
    "## Surfaces",
    "",
    ...renderSurfaceLines(pack),
    "",
    "## Guardrail",
    "",
    pack.brief.guardrail,
  ].join("\n");
}

export function buildKkvPackResponse(options: { packId?: string } = {}): KkvPackResponse {
  const snapshot = buildKkvPackSnapshot(options);
  return {
    success: true,
    snapshot,
    markdown: renderKkvPackMarkdown(snapshot),
    briefMarkdown: renderKkvPackBriefMarkdown(snapshot.selectedPack),
  };
}
