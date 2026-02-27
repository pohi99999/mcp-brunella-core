/**
 * fix_n8n_credentials.mjs
 * Javítja a 3 n8n workflow credentials-ét.
 * Futtatás: node scripts/fix_n8n_credentials.mjs
 */

const BASE_URL = "https://n8n-latest-fulv.onrender.com";
const EMAIL = "peterpohankapersonal@gmail.com";
const PASSWORD = "Iszapfalo2026";

// Ismert, MŰKÖDŐ credential-ök
const CREDS = {
  telegram: { id: "lEp8aDHGJcOoUhAT", name: "Telegram account 4" },
  airtable: { id: "t3s4iIzriLpZ6Fm2", name: "Airtable account" },
  anthropic: { id: "yM09CryA22onxqaD", name: "Anthropic account" },
  openai:    { id: "iv4njAa5h0In856r", name: "OpenAi account" },
  googleCal: { id: "T7rdOEVKDmnSjlCl", name: "Google Calendar account" },
};

const TELEGRAM_ADMIN_CHAT_ID = "7544590867";

// ──────────────────────────────────────────────
// HTTP helpers
// ──────────────────────────────────────────────

// Cookie store a session-based autentikációhoz
let sessionCookie = "";

async function apiPost(path, body) {
  const headers = { "Content-Type": "application/json" };
  if (sessionCookie) headers["Cookie"] = sessionCookie;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  // Cookie mentés login után
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    sessionCookie = setCookie.split(";")[0];
  }
  return res.json();
}

async function apiGet(path) {
  const headers = {};
  if (sessionCookie) headers["Cookie"] = sessionCookie;
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  return res.json();
}

async function apiPatch(path, body) {
  const headers = { "Content-Type": "application/json" };
  if (sessionCookie) headers["Cookie"] = sessionCookie;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiPostActivate(path) {
  const headers = { "Content-Type": "application/json" };
  if (sessionCookie) headers["Cookie"] = sessionCookie;
  const res = await fetch(`${BASE_URL}${path}`, { method: "POST", headers });
  return res.json();
}

// ──────────────────────────────────────────────
// Login
// ──────────────────────────────────────────────

async function login() {
  console.log("🔐 Bejelentkezés (/rest/login)...");
  const data = await apiPost("/rest/login", { emailOrLdapLoginId: EMAIL, password: PASSWORD });
  if (!sessionCookie && !data?.id) throw new Error("Login sikertelen: " + JSON.stringify(data));
  console.log(`✅ Bejelentkezve: ${data?.firstName} ${data?.lastName} (${data?.role})`);
  return sessionCookie;
}

// ──────────────────────────────────────────────
// Activate helper
// ──────────────────────────────────────────────

async function activateWorkflow(workflowId) {
  const res = await apiPostActivate(`/rest/workflows/${workflowId}/activate`);
  if (res?.active === true || res?.data?.active === true) {
    console.log(`   ✅ Aktiválva (${workflowId})`);
  } else {
    console.log(`   ⚠️  Aktiválás eredménye:`, JSON.stringify(res).slice(0, 200));
  }
  return res;
}

// ──────────────────────────────────────────────
// Deep replace credentials in nodes
// ──────────────────────────────────────────────

function fixTelegramCredentials(nodes, oldIds) {
  let changed = 0;
  for (const node of nodes) {
    if (node.credentials?.telegramApi) {
      if (oldIds.includes(node.credentials.telegramApi.id)) {
        console.log(`   → Node "${node.name}": Telegram cred csere (${node.credentials.telegramApi.id} → ${CREDS.telegram.id})`);
        node.credentials.telegramApi = { id: CREDS.telegram.id, name: CREDS.telegram.name };
        changed++;
      }
    }
  }
  return changed;
}

function replaceTelegramChatIdInParams(nodes) {
  let changed = 0;
  const envPattern = /\$env\.TELEGRAM_ADMIN_CHAT_ID/g;
  for (const node of nodes) {
    const paramStr = JSON.stringify(node.parameters || {});
    if (paramStr.includes("TELEGRAM_ADMIN_CHAT_ID")) {
      // Replace all occurrences of the env var expression with literal chat ID
      node.parameters = JSON.parse(
        paramStr.replace(envPattern, TELEGRAM_ADMIN_CHAT_ID)
      );
      console.log(`   → Node "${node.name}": $env.TELEGRAM_ADMIN_CHAT_ID → ${TELEGRAM_ADMIN_CHAT_ID}`);
      changed++;
    }
    // Also check for literal chatId parameter
    if (node.parameters?.chatId === "$env.TELEGRAM_ADMIN_CHAT_ID") {
      node.parameters.chatId = TELEGRAM_ADMIN_CHAT_ID;
      console.log(`   → Node "${node.name}": chatId literal csere`);
      changed++;
    }
  }
  return changed;
}

// ──────────────────────────────────────────────
// FELADAT 1: Error Monitoring
// ──────────────────────────────────────────────

async function task1_errorMonitoring() {
  const WF_ID = "EtFz9Kg-BmAJ1gRPibY5_";
  console.log("\n══════════════════════════════════════════");
  console.log("FELADAT 1: Error Monitoring – Telegram credentials javítása");
  console.log(`Workflow ID: ${WF_ID}`);
  console.log("══════════════════════════════════════════");

  // GET
  console.log("📥 GET workflow...");
  const wf = await apiGet(`/rest/workflows/${WF_ID}`);
  if (!wf?.id && !wf?.data?.id) {
    console.log("❌ GET sikertelen:", JSON.stringify(wf).slice(0, 300));
    return;
  }
  console.log(`✅ Workflow megkapva: "${wf.name || wf.data?.name}"`);

  // A workflow adatok néha .data-ban vannak
  const wfData = wf.id ? wf : wf.data;
  const nodes = wfData.nodes || [];
  console.log(`   ${nodes.length} node található`);

  // Javítás: törött Telegram credential-ök cseréje + hiányzók hozzáadása
  const brokenIds = ["Jafu0dE4mQA9mVNh", "eQdxjzcA37E1WlOX"];
  const credChanged = fixTelegramCredentials(nodes, brokenIds);
  const chatChanged = replaceTelegramChatIdInParams(nodes);

  // Credential nélküli Telegram node-okhoz is adjuk hozzá
  let addedCount = 0;
  for (const node of nodes) {
    const type = node.type || "";
    if (type === "n8n-nodes-base.telegram" || type === "n8n-nodes-base.telegramTrigger") {
      if (!node.credentials?.telegramApi?.id) {
        console.log(`   → Node "${node.name}": Telegram credential hozzáadása (hiányzott)`);
        node.credentials = node.credentials || {};
        node.credentials.telegramApi = { id: CREDS.telegram.id, name: CREDS.telegram.name };
        // Chat ID beállítása ha hiányzik
        if (node.parameters && !node.parameters.chatId && type === "n8n-nodes-base.telegram") {
          node.parameters.chatId = TELEGRAM_ADMIN_CHAT_ID;
        }
        addedCount++;
      }
    }
    // Airtable - Error Log credential hozzáadása
    if (node.name === "Airtable - Error Log" && !node.credentials?.airtableTokenApi?.id) {
      console.log(`   → Node "${node.name}": Airtable credential hozzáadása`);
      node.credentials = node.credentials || {};
      node.credentials.airtableTokenApi = { id: CREDS.airtable.id, name: CREDS.airtable.name };
      addedCount++;
    }
  }

  console.log(`   Credential csere: ${credChanged} | Hozzáadás: ${addedCount} | Chat ID csere: ${chatChanged} node`);

  if (credChanged === 0 && chatChanged === 0) {
    console.log("   ℹ️  Nem kellett változtatni (lehet már korábban javítva volt)");
  }

  // PATCH
  console.log("📤 PATCH workflow...");
  const patchBody = {
    name: wfData.name,
    nodes: wfData.nodes,
    connections: wfData.connections,
    settings: wfData.settings,
    staticData: wfData.staticData,
  };
  const patchResult = await apiPatch(`/rest/workflows/${WF_ID}`, patchBody);
  if (patchResult?.id || patchResult?.data?.id) {
    console.log("✅ PATCH sikeres");
  } else {
    console.log("⚠️  PATCH eredmény:", JSON.stringify(patchResult).slice(0, 300));
  }

  // Aktiválás
  console.log("🔁 Aktiválás ellenőrzése...");
  const isActive = wfData.active;
  console.log(`   Jelenlegi állapot: ${isActive ? "AKTÍV" : "INAKTÍV"}`);
  if (!isActive) {
    await activateWorkflow(WF_ID);
  } else {
    console.log("   ℹ️  Már aktív, nincs szükség aktiválásra");
  }
}

// ──────────────────────────────────────────────
// FELADAT 2: Google Calendar → Airtable
// ──────────────────────────────────────────────

async function task2_calendarAirtable() {
  const WF_ID = "jvlzg6daJWKA-YMmClZ8a";
  console.log("\n══════════════════════════════════════════");
  console.log("FELADAT 2: Google Calendar → Airtable Szinkron javítása");
  console.log(`Workflow ID: ${WF_ID}`);
  console.log("══════════════════════════════════════════");

  console.log("📥 GET workflow...");
  const wf = await apiGet(`/rest/workflows/${WF_ID}`);
  if (!wf?.id && !wf?.data?.id) {
    console.log("❌ GET sikertelen:", JSON.stringify(wf).slice(0, 300));
    return;
  }

  const wfData = wf.id ? wf : wf.data;
  const nodes = wfData.nodes || [];
  console.log(`✅ Workflow megkapva: "${wfData.name}" | ${nodes.length} node`);

  for (const node of nodes) {
    const name = node.name || "";

    // Airtable - Szabadság Rögzítés
    if (name.toLowerCase().includes("szabadság rögzítés") || name.toLowerCase().includes("szabadsag rogzites")) {
      console.log(`   → Node "${name}": Airtable javítás`);
      node.parameters = node.parameters || {};
      node.parameters.application = { value: "appByeASBkMYnktx8", mode: "id" };
      node.parameters.table = { value: "SZABADSAGOK", mode: "name" };
      node.credentials = node.credentials || {};
      node.credentials.airtableTokenApi = { id: CREDS.airtable.id, name: CREDS.airtable.name };
    }

    // Airtable - Munkaidő Szabadnap
    if (name.toLowerCase().includes("munkaidő") || name.toLowerCase().includes("munkaid")) {
      console.log(`   → Node "${name}": Airtable javítás`);
      node.parameters = node.parameters || {};
      node.parameters.application = { value: "appByeASBkMYnktx8", mode: "id" };
      node.parameters.table = { value: "Munkaidő Nyilvantartas", mode: "name" };
      node.credentials = node.credentials || {};
      node.credentials.airtableTokenApi = { id: CREDS.airtable.id, name: CREDS.airtable.name };
    }

    // Telegram - Vezet. Értesítés
    if (name.toLowerCase().includes("telegram") && (name.toLowerCase().includes("vezet") || name.toLowerCase().includes("értesítés") || name.toLowerCase().includes("ertesites"))) {
      console.log(`   → Node "${name}": Telegram javítás`);
      node.parameters = node.parameters || {};
      node.parameters.chatId = TELEGRAM_ADMIN_CHAT_ID;
      node.credentials = node.credentials || {};
      node.credentials.telegramApi = { id: CREDS.telegram.id, name: CREDS.telegram.name };
    }

    // Google Calendar Trigger
    if (node.type === "n8n-nodes-base.googleCalendarTrigger" || name.toLowerCase().includes("google calendar")) {
      if (!node.credentials?.googleCalendarOAuth2Api?.id || node.credentials.googleCalendarOAuth2Api.id === "") {
        console.log(`   → Node "${name}": Google Calendar credential hozzáadása`);
        node.credentials = node.credentials || {};
        node.credentials.googleCalendarOAuth2Api = { id: CREDS.googleCal.id, name: CREDS.googleCal.name };
      } else {
        console.log(`   → Node "${name}": Google Calendar credential már be van kötve (${node.credentials.googleCalendarOAuth2Api.id})`);
      }
    }
  }

  console.log("📤 PATCH workflow...");
  const patchBody = {
    name: wfData.name,
    nodes: wfData.nodes,
    connections: wfData.connections,
    settings: wfData.settings,
    staticData: wfData.staticData,
  };
  const patchResult = await apiPatch(`/rest/workflows/${WF_ID}`, patchBody);
  if (patchResult?.id || patchResult?.data?.id) {
    console.log("✅ PATCH sikeres");
  } else {
    console.log("⚠️  PATCH eredmény:", JSON.stringify(patchResult).slice(0, 300));
  }

  console.log("🔁 Aktiválás...");
  const isActive = wfData.active;
  console.log(`   Jelenlegi állapot: ${isActive ? "AKTÍV" : "INAKTÍV"}`);
  if (!isActive) {
    await activateWorkflow(WF_ID);
  } else {
    console.log("   ℹ️  Már aktív");
  }
}

// ──────────────────────────────────────────────
// FELADAT 3: Hangvezérlés
// ──────────────────────────────────────────────

async function task3_hangvezерles() {
  const WF_ID = "a1F4hiiermPcSL0PE_t_P";
  console.log("\n══════════════════════════════════════════");
  console.log("FELADAT 3: Hangvezérlés – OpenAI + Telegram credentials");
  console.log(`Workflow ID: ${WF_ID}`);
  console.log("══════════════════════════════════════════");

  console.log("📥 GET workflow...");
  const wf = await apiGet(`/rest/workflows/${WF_ID}`);
  if (!wf?.id && !wf?.data?.id) {
    console.log("❌ GET sikertelen:", JSON.stringify(wf).slice(0, 300));
    return;
  }

  const wfData = wf.id ? wf : wf.data;
  const nodes = wfData.nodes || [];
  console.log(`✅ Workflow megkapva: "${wfData.name}" | ${nodes.length} node`);

  for (const node of nodes) {
    const name = node.name || "";
    const type = node.type || "";

    // Speech-to-Text (Whisper) – openAi típusú node
    if (name.toLowerCase().includes("speech") && name.toLowerCase().includes("text") ||
        name.toLowerCase().includes("whisper")) {
      console.log(`   → Node "${name}": OpenAI credential bekötés`);
      node.credentials = node.credentials || {};
      node.credentials.openAiApi = { id: CREDS.openai.id, name: CREDS.openai.name };
    }

    // Text-to-Speech (TTS) – openAi típusú node
    if ((name.toLowerCase().includes("text") && name.toLowerCase().includes("speech")) ||
        name.toLowerCase().includes("tts")) {
      console.log(`   → Node "${name}": OpenAI credential bekötés`);
      node.credentials = node.credentials || {};
      node.credentials.openAiApi = { id: CREDS.openai.id, name: CREDS.openai.name };
    }

    // Minden openAi típusú node-ra (fallback)
    if (type.toLowerCase().includes("openai") || type.toLowerCase().includes("openAi")) {
      if (!node.credentials?.openAiApi) {
        console.log(`   → Node "${name}" (${type}): OpenAI credential hozzáadása`);
        node.credentials = node.credentials || {};
        node.credentials.openAiApi = { id: CREDS.openai.id, name: CREDS.openai.name };
      }
    }

    // Telegram Trigger
    if (type === "n8n-nodes-base.telegramTrigger" || name.toLowerCase().includes("telegram trigger")) {
      console.log(`   → Node "${name}": Telegram Trigger credential`);
      node.credentials = node.credentials || {};
      node.credentials.telegramApi = { id: CREDS.telegram.id, name: CREDS.telegram.name };
    }

    // Hangüzenet Küldése / Telegram send
    if (name.toLowerCase().includes("hangüzenet") || name.toLowerCase().includes("hanguzenet") ||
        (type.toLowerCase().includes("telegram") && !type.toLowerCase().includes("trigger") && name.toLowerCase().includes("küld"))) {
      console.log(`   → Node "${name}": Telegram Send credential`);
      node.credentials = node.credentials || {};
      node.credentials.telegramApi = { id: CREDS.telegram.id, name: CREDS.telegram.name };
    }

    // Minden Telegram node credential nélkül
    if (type === "n8n-nodes-base.telegram" || type === "n8n-nodes-base.telegramTrigger") {
      if (!node.credentials?.telegramApi?.id || node.credentials.telegramApi.id === "") {
        console.log(`   → Node "${name}" (${type}): Telegram credential hozzáadása`);
        node.credentials = node.credentials || {};
        node.credentials.telegramApi = { id: CREDS.telegram.id, name: CREDS.telegram.name };
      }
    }
  }

  console.log("📤 PATCH workflow...");
  const patchBody = {
    name: wfData.name,
    nodes: wfData.nodes,
    connections: wfData.connections,
    settings: wfData.settings,
    staticData: wfData.staticData,
  };
  const patchResult = await apiPatch(`/rest/workflows/${WF_ID}`, patchBody);
  if (patchResult?.id || patchResult?.data?.id) {
    console.log("✅ PATCH sikeres");
  } else {
    console.log("⚠️  PATCH eredmény:", JSON.stringify(patchResult).slice(0, 300));
  }

  // FELADAT 3: NE aktiválja (bekötési lánc még hibás)
  console.log("ℹ️  Aktiválás KIHAGYVA (feladat spec szerint: bekötési lánc még hibás)");
}

// ──────────────────────────────────────────────
// Részletes node-lista kiírás (debug)
// ──────────────────────────────────────────────

async function debugListNodes(workflowId, label) {
  const wf = await apiGet(`/rest/workflows/${workflowId}`);
  const wfData = wf.id ? wf : wf.data;
  const nodes = wfData?.nodes || [];
  console.log(`\n[DEBUG] ${label} – ${nodes.length} node:`);
  for (const n of nodes) {
    const credIds = Object.entries(n.credentials || {})
      .map(([k, v]) => `${k}:${v?.id || "?"}`)
      .join(", ") || "(nincs)";
    console.log(`  [${n.type}] "${n.name}" | creds: ${credIds}`);
  }
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  n8n Credential Javító Script             ║");
  console.log("╚══════════════════════════════════════════╝");

  try {
    await login();
  } catch (err) {
    console.error("❌ Login hiba:", err.message);
    process.exit(1);
  }

  // Opcionális: DEBUG mode (node lista)
  const debug = process.argv.includes("--debug");

  if (debug) {
    await debugListNodes("EtFz9Kg-BmAJ1gRPibY5_", "FELADAT 1 – Error Monitoring");
    await debugListNodes("jvlzg6daJWKA-YMmClZ8a", "FELADAT 2 – Calendar/Airtable");
    await debugListNodes("a1F4hiiermPcSL0PE_t_P", "FELADAT 3 – Hangvezérlés");
    return;
  }

  await task1_errorMonitoring();
  await task2_calendarAirtable();
  await task3_hangvezерles();

  console.log("\n══════════════════════════════════════════");
  console.log("✅ Minden feladat befejezve!");
  console.log("══════════════════════════════════════════");
  console.log("\nEllenőrzéshez futtasd:");
  console.log("  node scripts/fix_n8n_credentials.mjs --debug");
}

main().catch(err => {
  console.error("Fatális hiba:", err);
  process.exit(1);
});
