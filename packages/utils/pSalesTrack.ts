export type PSalesPhaseStatus = "completed" | "active" | "pending";

export interface PSalesPhase {
  id: string;
  title: string;
  status: PSalesPhaseStatus;
  summary: string;
  checkpoints: string[];
}

export interface PSalesDocumentBucket {
  title: string;
  examples: string[];
}

export interface PSalesIntakeData {
  documentBuckets: PSalesDocumentBucket[];
  surveyQuestions: string[];
  outputs: string[];
}

export interface PSalesResearchData {
  sourceTypes: string[];
  comparableCriteria: string[];
  valuationOutputs: string[];
  riskFlags: string[];
  reportSections: string[];
  questions: string[];
}

export interface PSalesStrategyData {
  channelOptions: string[];
  targetSegments: string[];
  approvalSteps: string[];
  executionPaths: string[];
  reportSections: string[];
  questions: string[];
}

export interface PSalesExecutionData {
  executionModes: string[];
  statusMilestones: string[];
  feedbackLoops: string[];
  auditTrail: string[];
  reportSections: string[];
  questions: string[];
}

export interface PSalesCloudflareDecisionData {
  recommendedPath: string;
  storageOptions: string[];
  runtimeOptions: string[];
  hostingOptions: string[];
  decisionCriteria: string[];
  openQuestions: string[];
}

export interface PSalesStandaloneData {
  brandPromise: string;
  onboardingSteps: string[];
  installGuidance: string[];
  tenantNotes: string[];
}

export interface PSalesTrackData {
  trackId: string;
  title: string;
  status: "active";
  progress: number;
  architectureDoc: string;
  currentFocus: string;
  nextReadyStep: string;
  surfaces: string[];
  agents: string[];
  cloudflare: string[];
  intake: PSalesIntakeData;
  research: PSalesResearchData;
  strategy: PSalesStrategyData;
  execution: PSalesExecutionData;
  cloudflareDecision: PSalesCloudflareDecisionData;
  standalone: PSalesStandaloneData;
  phases: PSalesPhase[];
}

export function formatPSalesPhaseStatus(status: PSalesPhaseStatus): string {
  switch (status) {
    case "completed":
      return "Befejezve";
    case "active":
      return "Aktív";
    default:
      return "Várólistán";
  }
}

export const pSalesTrack: PSalesTrackData = {
  trackId: "P-Sales20260327",
  title: "P-Sales20260327",
  status: "active",
  progress: 100,
  architectureDoc: "conductor/tracks/P-Sales20260327/architecture.md",
  currentFocus: "Phase 2: Alap auth modell",
  nextReadyStep: "Alap auth és tenant-konfiguráció finomítása",
  surfaces: [
    "BAS enterprise dashboard modul",
    "Külön telepíthető standalone alkalmazás",
    "Cloudflare edge/backend opció",
  ],
  agents: [
    "Felmérő ügynök",
    "Kutató / értékelő ügynök",
    "Stratégia-tervező ügynök",
    "Értékesítő ügynök",
  ],
  cloudflare: [
    "R2 dokumentum tárolás",
    "D1 workflow és metaadat réteg",
    "Workers edge API / auth / routing",
    "KV vagy Durable Objects, ha szükséges",
  ],
  intake: {
    documentBuckets: [
      {
        title: "Tulajdoni és jogi iratok",
        examples: [
          "Tulajdoni lap",
          "földhivatali bejegyzések",
          "társasházi vagy alapító dokumentumok",
        ],
      },
      {
        title: "Telek- és területadatok",
        examples: [
          "helyszínrajz",
          "mérési vázrajz",
          "telekhatár és besorolási információk",
        ],
      },
      {
        title: "Műszaki és közmű dokumentumok",
        examples: [
          "műszaki leírás",
          "közműkapcsolódási adatok",
          "energetikai vagy használatbavételi iratok",
        ],
      },
      {
        title: "Terhek, korlátozások és használati jogok",
        examples: [
          "jelzálog",
          "haszonélvezet",
          "szolgalom",
        ],
      },
    ],
    surveyQuestions: [
      "Milyen típusú ingatlanról van szó, és mi a fő értékesítési cél?",
      "Mely dokumentumok állnak már rendelkezésre, és mi hiányzik?",
      "Van-e teher, korlátozás, bérleti jog vagy közös tulajdon?",
      "Gyors eladás, optimális ár vagy célzott vevő a fontosabb?",
    ],
    outputs: [
      "Hiánylista és kockázati jelzések",
      "Felmérési státusz",
      "Ingatlanprofil",
      "Következő ügynöki feladatok",
    ],
  },
  research: {
    sourceTypes: [
      "Ingatlanportálok aktuális és archív hirdetései",
      "Korábbi lezárt tranzakciók és nyilvános referenciák",
      "Helyi piaci indikátorok és települési környezet",
      "Jogi / szabályozási háttér és besorolási információk",
    ],
    comparableCriteria: [
      "azonos vagy hasonló település / övezet",
      "telekméret, beépíthetőség és hasznosíthatóság",
      "közműellátottság és megközelíthetőség",
      "terhek, korlátozások és piaci likviditás",
    ],
    valuationOutputs: [
      "konzervatív értéksáv",
      "célár / ajánlati ár",
      "gyorseladási ár",
      "vevői szegmens és érdeklődői profil",
    ],
    riskFlags: [
      "hiányos vagy ellentmondásos dokumentáció",
      "jogilag tisztázatlan terhek / korlátozások",
      "alacsony összehasonlítható tranzakciószám",
      "piaci volatilitás és hosszú értékesítési ciklus",
    ],
    reportSections: [
      "források és bizonyítékok",
      "komparatív elemzés",
      "értéktartomány és ajánlott ársáv",
      "kockázatok és feltételezések",
      "következő stratégiai lépés",
    ],
    questions: [
      "Mekkora a kívánt eladási időhorizont?",
      "Van-e minimálisan elfogadható ár vagy célár?",
      "Mely összehasonlító tényezők a legfontosabbak?",
      "Mely adatforrások tekinthetők hitelesnek a döntéshez?",
    ],
  },
  strategy: {
    channelOptions: [
      "Ingatlanportálra feltöltés",
      "Célzott kampány befektetői vagy fejlesztői körnek",
      "Teaser alapú érdeklődőgyűjtés",
      "Direkt megkeresés döntéshozóknak",
    ],
    targetSegments: [
      "Befektetők és fejlesztők",
      "Ipari / logisztikai vásárlók",
      "Helyi döntéshozók és céges vevők",
      "Portálon aktív keresők",
    ],
    approvalSteps: [
      "A rendszer először stratégiai ajánlást készít, majd felhasználói jóváhagyást kér.",
      "Csak jóváhagyás után indulhat külső publikálás vagy direkt megkeresés.",
      "Az első végrehajtási lépések a választott csatornához igazodnak.",
    ],
    executionPaths: [
      "Portál-feltöltés és hirdetési csomag",
      "Teaser / érdeklődői előszűrés",
      "Célzott outreach és személyes megkeresés",
      "Kombinált multi-channel akcióterv",
    ],
    reportSections: [
      "csatorna mix",
      "célcsoport és döntéshozói kör",
      "approval gate",
      "első végrehajtási lépések",
    ],
    questions: [
      "Mely csatornát preferálod első körben?",
      "Milyen gyorsan indulhat a publikálás?",
      "Van-e kizárt vevői szegmens vagy csatorna?",
      "Mennyi kontrollt szeretnél az első outreach előtt?",
    ],
  },
  execution: {
    executionModes: [
      "Portál publikálás és hirdetési csomag",
      "Teaser alapú érdeklődőgyűjtés",
      "Célzott outreach és direkt megkeresés",
      "Kombinált multi-channel végrehajtás",
    ],
    statusMilestones: [
      "jóváhagyott terv",
      "aktivált csatorna",
      "lead / érdeklődő beérkezett",
      "követés és újratervezés",
      "ajánlat vagy zárás",
    ],
    feedbackLoops: [
      "lead minőség visszajelzés",
      "csatorna teljesítmény mérés",
      "replan trigger a felhasználótól",
      "audit alapú állapotfrissítés",
    ],
    auditTrail: [
      "publikálási időpontok",
      "outreach események",
      "változtatási és approval napló",
      "követési és zárási események",
    ],
    reportSections: [
      "csatorna státusz",
      "lead pipeline",
      "audit log",
      "replan pontok",
    ],
    questions: [
      "Mely csatornák aktívak most?",
      "Milyen lead minőség esetén álljon meg a flow?",
      "Mekkora audit részletességre van szükség?",
      "Mikor kell újratervezni a végrehajtást?",
    ],
  },
  cloudflareDecision: {
    recommendedPath:
      "R2 + D1 + Workers a nyilvános standalone útvonalhoz; KV / Durable Objects csak rövid életű koordinációhoz.",
    storageOptions: [
      "R2 dokumentum tárolásra",
      "D1 workflow és metaadat rétegnek",
      "KV vagy Durable Objects rövid életű állapothoz",
    ],
    runtimeOptions: [
      "Workers edge API / auth / routing",
      "Edge-hosted preview és staging útvonalak",
    ],
    hostingOptions: [
      "Public standalone frontend Cloudflare Pages vagy Workers-hosted route alatt",
      "BAS backendhez illesztett edge gateway",
    ],
    decisionCriteria: [
      "nyilvános telepíthető út szükséges-e",
      "kell-e külön preview / staging",
      "igényel-e rövid életű koordinált állapotot",
      "maradhat-e az auth és routing a BAS oldalon",
    ],
    openQuestions: [
      "Lesz-e több-tenant vagy több ügyfél támogatás?",
      "Kell-e külön publikus landing és intake flow?",
      "A dokumentumokat teljesen edge-en akarjuk-e tárolni?",
      "Melyik állapotnak kell hosszabb életűnek lennie?",
    ],
  },
  standalone: {
    brandPromise: "Letisztult, modern, installálható shell az ingatlan- és iparterület-értékesítési workflow-hoz.",
    onboardingSteps: [
      "Ingatlan dokumentáció feltöltése és alapadatok megadása",
      "Felmérő ügynök hiánylistája és kérdésköre",
      "Kutatási és stratégiai riport jóváhagyása",
    ],
    installGuidance: [
      "PWA manifest és service worker a telepíthető shellhez",
      "Docker image és nginx fallback a deploymenthez",
      "Későbbi Cloudflare Pages / Workers útvonal",
    ],
    tenantNotes: [
      "Branding projekt- vagy ügyfélszinten átadható",
      "Későbbi több-tenant konfigurációhoz készít elő teret",
    ],
  },
  phases: [
    {
      id: "phase-0",
      title: "Phase 0: Architektúra és szállítási modell",
      status: "completed",
      summary: "A shared core, a három delivery surface és a Cloudflare opciók tisztázva.",
      checkpoints: [
        "Közös domain-core és agent szerepkörök",
        "Három szállítási réteg felelősségi határai",
        "Shared core és UI shell szétválasztása",
        "architecture.md formális output",
      ],
    },
    {
      id: "phase-1",
      title: "Phase 1: Enterprise dashboard integráció",
      status: "completed",
      summary: "A BAS dashboard Enterprise részébe illeszkedő intake, research és strategy panel.",
      checkpoints: [
        "Enterprise navigation entry és panel helye",
        "Intake, checklist és státusz nézetek",
        "Kutatási riport és értékelési nézetek",
        "Stratégia és approval flow",
      ],
    },
    {
      id: "phase-2",
      title: "Phase 2: Standalone alkalmazás",
      status: "active",
      summary: "Külön telepíthető app shell, installálható PWA csomag, branding/onboarding és auth váz.",
      checkpoints: [
        "Különálló app shell és entrypoint",
        "PWA manifest, service worker és Docker image",
        "Saját branding és onboarding",
        "Alap auth modell",
        "Jövőbeli több-ügyfél használat",
      ],
    },
    {
      id: "phase-3",
      title: "Phase 3: Intake és felmérő ügynök",
      status: "pending",
      summary: "Dokumentumfeltöltés, hiánylista és ingatlantípus-alapú ellenőrzés.",
      checkpoints: [
        "Dokumentumfeltöltési folyam",
        "Kötelező iratok generálása ingatlantípus szerint",
        "Felmérő ügynök kérdező és ellenőrző logika",
        "Hiánylista és teljességjelző",
      ],
    },
    {
      id: "phase-4",
      title: "Phase 4: Kutató és értékelő ügynök",
      status: "pending",
      summary: "Piaci összehasonlítás, értéktartomány és kutatási riport.",
      checkpoints: [
        "Internetes kutatási források",
        "Hasonló ingatlanok múltbeli eladásai",
        "Értéktartomány és kockázati jelzések",
        "Kutatási riport referenciákkal",
      ],
    },
    {
      id: "phase-5",
      title: "Phase 5: Stratégia és akcióterv",
      status: "pending",
      summary: "Értékesítési csatornák, kampányok és döntéshozói megkeresések megtervezése.",
      checkpoints: [
        "Stratégia-tervező ügynök",
        "Csatornaajánlat és teaser opciók",
        "Döntéshozói és targetlista javaslat",
        "Jóváhagyási kapu és összefoglaló",
      ],
    },
    {
      id: "phase-6",
      title: "Phase 6: Értékesítési végrehajtás",
      status: "completed",
      summary: "A jóváhagyott terv végrehajtási flow-ja, audit és visszajelzés modellje.",
      checkpoints: [
        "Jóváhagyott terv végrehajtási flow-ja",
        "Csatornánkénti státusz- és eredménykövetés",
        "Felhasználói visszajelzés és újratervezési pontok",
        "Záró riport és audit napló",
      ],
    },
    {
      id: "phase-7",
      title: "Phase 7: Cloudflare opció",
      status: "completed",
      summary: "R2, D1, Workers és az edge delivery / public standalone opció kiválasztva.",
      checkpoints: [
        "R2 dokumentumtárolás",
        "D1 metaadat és workflow state",
        "Workers edge API / auth / routing",
        "KV vagy Durable Objects, ha szükséges",
      ],
    },
  ],
};
