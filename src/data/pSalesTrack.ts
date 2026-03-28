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
  progress: 25,
  architectureDoc: "conductor/tracks/P-Sales20260327/architecture.md",
  currentFocus: "Phase 2: Standalone alkalmazás",
  nextReadyStep: "Telepíthető csomagolási stratégia és deployment útvonal kialakítása",
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
      status: "active",
      summary: "A BAS dashboard Enterprise részébe illeszkedő panel és gyors áttekintő nézet.",
      checkpoints: [
        "Enterprise navigation entry és panel helye",
        "Intake, checklist és státusz nézetek",
        "Kutatási riport és stratégia nézetek",
        "Approval modal és workflow állapotok",
      ],
    },
    {
      id: "phase-2",
      title: "Phase 2: Standalone alkalmazás",
      status: "active",
      summary: "Külön telepíthető app shell, saját branding és deployment útvonal.",
      checkpoints: [
        "Különálló app shell és entrypoint",
        "Telepíthető csomagolási stratégia",
        "Saját branding és onboarding",
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
      status: "pending",
      summary: "A jóváhagyott terv végrehajtása, naplózása és újratervezése.",
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
      status: "pending",
      summary: "R2, D1, Workers és opcionális állapotkezelési réteg a standalone útvonalhoz.",
      checkpoints: [
        "R2 dokumentumtárolás",
        "D1 metaadat és workflow state",
        "Workers edge API / auth / routing",
        "KV vagy Durable Objects, ha szükséges",
      ],
    },
  ],
};
