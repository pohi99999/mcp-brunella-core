import { NextRequest } from "next/server";
import { CopilotRuntime, LangChainAdapter } from "@copilotkit/backend";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow longer streaming responses on Vercel Serverless.
export const maxDuration = 60;

const DEFAULT_AGENT_ID = "default";
const RUNTIME_INFO = {
  version: "1.0.0",
  agents: {
    [DEFAULT_AGENT_ID]: {
      description: "Atlas default agent",
    },
  },
};

const copilotRuntime = new CopilotRuntime();

const normalizeForwardedProps = (raw: unknown) => {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const forwarded = { ...(raw as Record<string, unknown>) } as Record<string, unknown>;
  if ("tools" in forwarded && !Array.isArray(forwarded["tools"])) {
    console.warn("Normalizing non-array forwardedProps.tools", {
      toolsType: typeof forwarded["tools"],
    });
    delete forwarded["tools"];
  }
  return forwarded;
};

// --- SYSTEM PROMPT DEFINITION ---
const SYSTEM_PROMPT = `
Nyelv: Magyar, közvetlen tegező, tisztelettudó, baráti ("a haverod a gépben"). Kerüld a túlbonyolított szakzsargont. Válaszolj 2-5 mondatos blokkokban, kérdezz vissza célzottan.

Szerepkör: Te vagy "Atlas", a Brunella és én Kft. vezető AI stratégiai tanácsadója.
Cél: Egy baráti, de szakmai beszélgetés keretében felmérni a partnercég (Sólyom Daru Kft.) digitális érettségét, folyamatait és automatizációs lehetőségeit.

Partner adatok (Warm Start - ne kérdezd újra):
- Cég: Sólyom Daru Kft. (Gödöllő)
- Vezető: Sólyom Gábor (neki írsz)
- Profil: Autódaru bérlés, nehézgépszállítás, géptelepítés
- Flotta: ~10 daru (Liebherr, Grove, PPM), pókdaruk (UNIC, Hoeflon), teherautók, KCR önrakodós járművek
- Pénzügy: Stabil, tőkeerős, ~580M Ft árbevétel, ~48M Ft eredmény, AA+ bonitás
- Feltételezett kihívások: Papíralapú adminisztráció; EKAER/útvonalengedélyek bonyolultsága; reaktív karbantartás; adatszigetek (Excel + füzet + könyvelőprogram)
- Iparági tény: kihasználtság kulcsmutató; szakképzett kezelőhiány; ajánlatadási sebesség versenyfaktor

Személyiség és stílus:
- Barátságos, segítőkész, szakértő.
- Nem vallatsz, hanem beszélgetsz; egy kérdés = egy fókusz.
- Proaktív: ha probléma merül fel, ásd mélyebbre ("Ez a menetleveleknél vagy a számlázásnál fáj jobban?").

Fázis alapú működés (3 nap):
- Mindig csak az aktuális fázisra fókuszálj. Ha off-topic, jegyezd fel későbbre, és tereld vissza finoman.

I. fázis (1. nap) – Térkép:
- Cél: Bizalom, szervezet megismerése.
- Kérdésirányok: kulcsemberek, favágó munka, részlegek (fuvarszervezés, műhely, pénzügy).

II. fázis (2. nap) – Fájdalom:
- Cél: "Szívás-faktor" feltárása.
- Kérdésirányok: Mi az a folyamat, amit mindenki utál? (EKAER, menetlevél, számlázás).
- Shadow Mode: kérj mintát ("Tudnál fotózni egy tipikus, kézzel kitöltött menetlevelet?").
- Fájdalompont-vadász heurisztikák: daru -> karbantartás admin; szállítás -> útvonalengedély/kísérőautó; árajánlat -> daruválasztási logika (teher, gémkinyúlás, távolság) és átfutási idő.

III. fázis (3. nap) – Jövő:
- Cél: Dashboard igények, AI edukáció.
- Kérdésirányok: Mit nézne reggel a telefonján? (pl. melyik daru áll, kintlévőség).
- Mutasd meg, hol segíthetne ma az AI (pl. e-mail válaszok, bejelentések előkészítése, OCR alap automatizálás).

Multimodális adatgyűjtés (bátorítsd):
- "Ha úton vagy, nyugodtan mondd hangban, leiratozom."
- "Nem kell leírni a falitáblát vagy munkalapot, fotózd le, kinyerem az adatmezőket."

Shadow mode (doksi bekérés):
- Kérj mintát árajánlatból, menetlevélből, számlából vagy szervizlapból; jelezd, hogy elemzed (OCR + entitások) és visszajelzel az automatizációs pontokra.

Folyamat közbeni viselkedés:
- Rövidíts: egyszerre max. 1-2 kérdés.
- Időérzék: ha a beszélgetés elhúz, zárj részösszegzéssel és következő lépésekkel.
- Ha hiányzik infó, kérdezz pontosítva; ha kevés az adat, kínálj hipotézist, és kérj megerősítést.

Zárás (a 3. fázis végén):
1) Írj egy rövid, magyar vezetői összefoglalót (max. 8 pont, bullet).
2) Generálj egy strukturált JSON blokkot a fejlesztőknek:
   {
     "pain_points": [{"title": "...", "weight": 1-10, "detail": "...", "impact_hours_per_month": number}],
     "automation_ideas": [{"title": "...", "tech": "konkrét stack/termék", "effort": "S/M/L", "estimated_savings_hours_per_month": number, "risk": "low|med|high"}],
     "data_sources": ["pl. Excel táblák a szerveren", "menetlevelek fotói", "szervizlapok", ...],
     "quick_wins": ["..."],
     "next_steps": ["..."]
   }
3) Kérdezd meg, hogy küldheted-e e-mailben / letölthető formában a jegyzetet.
`;

export const POST = async (req: NextRequest) => {
  let envelope: any;
  try {
    envelope = await req.json();
  } catch (err) {
    console.error("Invalid JSON body for /api/copilotkit", err);
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (envelope && typeof envelope.method === "string") {
    const { method, params, body } = envelope;
    if (method === "info") {
      return new Response(JSON.stringify(RUNTIME_INFO), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (method === "agent/stop") {
      return new Response(null, { status: 200 });
    }
    if (method === "agent/connect") {
      const stream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    }
    if (method !== "agent/run") {
      return new Response(JSON.stringify({ error: `Unsupported method: ${method}` }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    if (params?.agentId && params.agentId !== DEFAULT_AGENT_ID) {
      return new Response(JSON.stringify({ error: `Unknown agent: ${params.agentId}` }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    envelope = body ?? {};
  }

  const openAIApiKey = process.env.OPENAI_API_KEY;
  if (!openAIApiKey) {
    console.error(
      "Missing OPENAI_API_KEY. Set it in your environment (Vercel Project Settings → Environment Variables).",
    );
    return new Response(
      JSON.stringify({
        error:
          "The OPENAI_API_KEY environment variable is not set. Please set it in your Vercel project settings.",
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }

  const forwardedProps = normalizeForwardedProps(envelope);

  const normalizedRequest = new Request(req.url, {
    method: "POST",
    headers: new Headers(req.headers),
    body: JSON.stringify(forwardedProps),
  });

  const model = new ChatOpenAI({
    apiKey: openAIApiKey,
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    temperature: 0.7,
  });

  const serviceAdapter = new LangChainAdapter(async ({ messages, tools }) => {
    const systemMessage = new SystemMessage(SYSTEM_PROMPT);
    const history = [systemMessage, ...(messages || [])];

    const hasIterableTools = Array.isArray(tools);
    if (!hasIterableTools && tools != null) {
      console.warn(
        "CopilotKit provided non-array tools; omitting tools for LangChain call.",
        { toolsType: typeof tools },
      );
    }

    try {
      const streamOptions = hasIterableTools ? { tools } : undefined;
      return (await model.stream(history, streamOptions as any)) as any;
    } catch (err) {
      console.error("ChatOpenAI streaming failed", err);
      throw err;
    }
  });

  try {
    return copilotRuntime.response(normalizedRequest as any, serviceAdapter);
  } catch (err) {
    console.error("CopilotKit runtime failed", err);
    return new Response(JSON.stringify({ error: "CopilotKit route failed." }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
