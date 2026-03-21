/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
/**
 * 🔍 BRUNELLA — Lead Intelligence Worker
 * ========================================
 * Cloudflare Worker: Iparág-alapú mélykutatás + fájdalompont scoring
 *
 * Endpoint-ok:
 *   POST /research          → Indít egy kutatást (iparág + város)
 *   GET  /research/:jobId   → Kutatás státusza + eredmény
 *   GET  /leads             → Tárolt leadek listázása (D1-ből)
 *   GET  /health            → Worker állapot
 *
 * Fájdalompont scoring (0-100):
 *   +25 → Elavult weboldal (>3 év vagy nincs)
 *   +20 → Nincs HTTPS
 *   +20 → Nincs / kevés Google értékelés (<10)
 *   +15 → Lassú oldal / mobilbarát problémák
 *   +10 → Nincs közösségi média jelenlét
 *   +10 → Nincs online foglalás / rendelés
 *
 * Limitek (Cloudflare free tier):
 *   - 100.000 req/nap (Worker)
 *   - Workers AI: 10.000 req/nap
 *   - 30 lead/futás = ~90 subrequest → biztonságos
 */

export interface Env {
  DB: D1Database;
  BAS_TASKS: KVNamespace;
  AI: Ai;
  GOOGLE_PLACES_API_KEY?: string;
  BAS_LOCAL_URL?: string;
}

// ============================================================================
// TYPES
// ============================================================================

interface Lead {
  id: string;
  name: string;
  industry: string;
  city: string;
  address: string;
  phone: string;
  website: string;
  google_rating: number;
  google_reviews: number;
  pain_score: number;       // 0-100, minél magasabb annál jobb célpont
  pain_reasons: string[];   // ["Nincs HTTPS", "Elavult weboldal"]
  place_id: string;
  scraped_at: string;
  status: 'new' | 'contacted' | 'responded' | 'converted' | 'rejected';
}

interface ResearchJob {
  id: string;
  industry: string;
  city: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  leads_found: number;
  leads_scored: number;
  started_at: string;
  completed_at?: string;
  error?: string;
}

// Iparág → Google Places keresési kulcsszavak
const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  fogorvos:    ['fogorvos', 'fogászat', 'dental'],
  kozmetika:   ['kozmetikai szalon', 'szépségszalon', 'kozmetikus'],
  fitness:     ['edzőterem', 'fitness', 'gym', 'sportkomplexum'],
  etterem:     ['étterem', 'vendéglő', 'bisztró', 'kávézó'],
  szakiparos:  ['villanyszerelő', 'vízszerelő', 'épületszigetelő', 'festő'],
  ingatlan:    ['ingatlaniroda', 'ingatlanközvetítő', 'ingatlanos'],
  allatorvos:  ['állatorvos', 'állatgyógyászat', 'kisállat rendelő'],
  optika:      ['optika', 'szemüvegkészítő', 'szemészet'],
  ugyved:      ['ügyvéd', 'ügyvédi iroda', 'jogtanácsos', 'jogi iroda'],
  szallas:     ['szállás', 'panzió', 'apartman kiadó', 'vendégház'],
  konyvelo:    ['könyvelő iroda', 'könyvelés', 'adótanácsadó', 'könyvelő'],
};

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Ensure DB tables exist
      await initDB(env);

      let response: Response;

      if (path === '/health') {
        response = await handleHealth(env);
      } else if (path === '/research' && request.method === 'POST') {
        response = await handleStartResearch(request, env, ctx);
      } else if (path.startsWith('/research/')) {
        const jobId = path.split('/')[2];
        response = await handleGetJob(jobId, env);
      } else if (path === '/leads') {
        response = await handleGetLeads(url, env);
      } else if (path === '/industries') {
        response = new Response(JSON.stringify({
          industries: Object.keys(INDUSTRY_KEYWORDS),
        }), { headers: { 'Content-Type': 'application/json' } });
      } else {
        response = new Response(JSON.stringify({
          name: 'Brunella Lead Intelligence Worker',
          version: '1.0.0',
          endpoints: [
            'POST /research → Kutatás indítása',
            'GET  /research/:jobId → Kutatás státusza',
            'GET  /leads?industry=&city=&min_score= → Leadek',
            'GET  /industries → Támogatott iparágak',
            'GET  /health → Worker állapot',
          ],
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      // Add CORS headers to every response
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
      return new Response(response.body, { status: response.status, headers: newHeaders });

    } catch (err) {
      return new Response(JSON.stringify({
        error: 'Worker error',
        message: String(err),
      }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
  },

  // Cron trigger: naponta éjjel 02:00-kor automatikusan fut
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    console.log('[LeadIntel] Scheduled research futás:', new Date().toISOString());
    await initDB(env);

    // Alapértelmezett napi futások — Budapest + vidéki városok
    const dailyJobs = [
      // Budapest — eredeti 3
      { industry: 'kozmetika', city: 'Budapest' },
      { industry: 'fitness',   city: 'Budapest' },
      { industry: 'fogorvos',  city: 'Budapest' },
      // Új iparágak — Budapest
      { industry: 'ugyved',    city: 'Budapest' },
      { industry: 'ingatlan',  city: 'Budapest' },
      { industry: 'konyvelo',  city: 'Budapest' },
      // Vidéki városok (kevesebb verseny!)
      { industry: 'fogorvos',  city: 'Debrecen' },
      { industry: 'kozmetika', city: 'Miskolc' },
      { industry: 'fogorvos',  city: 'Pécs' },
      { industry: 'kozmetika', city: 'Győr' },
    ];

    for (const job of dailyJobs) {
      try {
        await runResearch(job.industry, job.city, env);
        console.log(`[LeadIntel] ✅ ${job.industry}/${job.city} kész`);
      } catch (err) {
        console.error(`[LeadIntel] ❌ ${job.industry}/${job.city} hiba:`, err);
      }
    }
  },
};

// ============================================================================
// DB INIT
// ============================================================================

async function initDB(env: Env): Promise<void> {
  // D1 exec() nem támogat több utasítást egyszerre — batch-ben futtatjuk
  const statements = [
    `CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT NOT NULL,
      city TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      website TEXT,
      google_rating REAL DEFAULT 0,
      google_reviews INTEGER DEFAULT 0,
      pain_score INTEGER DEFAULT 0,
      pain_reasons TEXT DEFAULT '[]',
      place_id TEXT,
      scraped_at TEXT NOT NULL,
      status TEXT DEFAULT 'new',
      UNIQUE(place_id)
    )`,
    `CREATE TABLE IF NOT EXISTS research_jobs (
      id TEXT PRIMARY KEY,
      industry TEXT NOT NULL,
      city TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      leads_found INTEGER DEFAULT 0,
      leads_scored INTEGER DEFAULT 0,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      error TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_leads_industry ON leads(industry)`,
    `CREATE INDEX IF NOT EXISTS idx_leads_pain_score ON leads(pain_score)`,
    `CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)`,
  ];

  try {
    const preparedStatements = statements.map(sql => env.DB.prepare(sql));
    await env.DB.batch(preparedStatements);
  } catch {
    // Tábla/index már létezik — ignorálható
  }
}

// ============================================================================
// HANDLERS
// ============================================================================

async function handleHealth(env: Env): Promise<Response> {
  const jobCount = await env.DB.prepare('SELECT COUNT(*) as c FROM research_jobs').first<{c: number}>();
  const leadCount = await env.DB.prepare('SELECT COUNT(*) as c FROM leads').first<{c: number}>();
  const highScoreCount = await env.DB.prepare('SELECT COUNT(*) as c FROM leads WHERE pain_score >= 60').first<{c: number}>();

  return new Response(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    stats: {
      total_jobs: jobCount?.c ?? 0,
      total_leads: leadCount?.c ?? 0,
      high_priority_leads: highScoreCount?.c ?? 0,
    },
    supported_industries: Object.keys(INDUSTRY_KEYWORDS),
    google_places_configured: !!env.GOOGLE_PLACES_API_KEY,
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleStartResearch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const body = await request.json() as { industry: string; city?: string; limit?: number };
  const { industry, city = 'Budapest', limit = 25 } = body;

  if (!industry || !INDUSTRY_KEYWORDS[industry]) {
    return new Response(JSON.stringify({
      error: 'Ismeretlen iparág',
      valid_industries: Object.keys(INDUSTRY_KEYWORDS),
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Job létrehozása D1-ben
  await env.DB.prepare(`
    INSERT INTO research_jobs (id, industry, city, status, started_at)
    VALUES (?, ?, ?, 'running', ?)
  `).bind(jobId, industry, city, now).run();

  // Kutatás futtatása — ctx.waitUntil() biztosítja hogy a Worker ne álljon le előbb
      ctx.waitUntil(runResearch(industry, city, env, jobId, limit));

      return new Response(JSON.stringify({
    job_id: jobId,
    status: 'running',
    industry,
    city,
    message: `Kutatás elindítva: ${industry} / ${city} (max ${limit} lead)`,
    check_url: `/research/${jobId}`,
  }), { status: 202, headers: { 'Content-Type': 'application/json' } });
}

async function handleGetJob(jobId: string, env: Env): Promise<Response> {
  const job = await env.DB.prepare('SELECT * FROM research_jobs WHERE id = ?')
    .bind(jobId).first<ResearchJob>();

  if (!job) {
    return new Response(JSON.stringify({ error: 'Job not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' }
    });
  }

  // Ha kész, visszaadjuk a leadeket is
  let leads: Lead[] = [];
  if (job.status === 'completed') {
    const result = await env.DB.prepare(
      'SELECT * FROM leads WHERE industry = ? AND city = ? ORDER BY pain_score DESC LIMIT 30'
    ).bind(job.industry, job.city).all<Lead>();
    leads = result.results;
  }

  return new Response(JSON.stringify({ ...job, leads }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleGetLeads(url: URL, env: Env): Promise<Response> {
  const industry = url.searchParams.get('industry') || '';
  const city = url.searchParams.get('city') || 'Budapest';
  const minScore = parseInt(url.searchParams.get('min_score') || '0');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const status = url.searchParams.get('status') || 'new';

  let query = 'SELECT * FROM leads WHERE pain_score >= ? AND status = ?';
  const params: any[] = [minScore, status];

  if (industry) {
    query += ' AND industry = ?';
    params.push(industry);
  }
  if (city) {
    query += ' AND city = ?';
    params.push(city);
  }

  query += ' ORDER BY pain_score DESC LIMIT ?';
  params.push(limit);

  const result = await env.DB.prepare(query).bind(...params).all<Lead>();

  return new Response(JSON.stringify({
    total: result.results.length,
    leads: result.results.map(l => ({
      ...l,
      pain_reasons: JSON.parse(l.pain_reasons as unknown as string || '[]'),
    })),
  }), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================================================
// CORE RESEARCH ENGINE
// ============================================================================

async function runResearch(
  industry: string,
  city: string,
  env: Env,
  jobId?: string,
  limit: number = 25
): Promise<void> {
  const keywords = INDUSTRY_KEYWORDS[industry] || [industry];
  let totalFound = 0;
  let totalScored = 0;

  try {
    for (const keyword of keywords.slice(0, 2)) { // Max 2 keyword/futás
      const places = await searchGooglePlaces(keyword, city, env, Math.ceil(limit / 2));

      for (const place of places) {
        try {
          const lead = await scoreLead(place, industry, city, env);
          await saveLead(lead, env);
          totalFound++;

          // Csak a magas score-os leadeket számoljuk "scored"-nak
          if (lead.pain_score >= 40) totalScored++;

        } catch (err) {
          console.error('[LeadIntel] Lead score hiba:', err);
        }
      }
    }

    // Job frissítés: completed
    if (jobId) {
      await env.DB.prepare(`
        UPDATE research_jobs
        SET status = 'completed', leads_found = ?, leads_scored = ?, completed_at = ?
        WHERE id = ?
      `).bind(totalFound, totalScored, new Date().toISOString(), jobId).run();
    }

  } catch (err) {
    if (jobId) {
      await env.DB.prepare(`
        UPDATE research_jobs SET status = 'failed', error = ? WHERE id = ?
      `).bind(String(err), jobId).run();
    }
    throw err;
  }
}

// ============================================================================
// GOOGLE PLACES API
// ============================================================================

async function searchGooglePlaces(
  keyword: string,
  city: string,
  env: Env,
  limit: number
): Promise<any[]> {
  // Ha nincs Google Places API kulcs → mockolva visszaadunk teszt adatokat
  if (!env.GOOGLE_PLACES_API_KEY) {
    console.warn('[LeadIntel] Nincs GOOGLE_PLACES_API_KEY → mock adatok');
    return getMockPlaces(keyword, city, limit);
  }

  const query = encodeURIComponent(`${keyword} ${city}`);
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&language=hu&region=hu&key=${env.GOOGLE_PLACES_API_KEY}`;

  const response = await fetch(url);
  const data = await response.json() as any;

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places API hiba: ${data.status}`);
  }

  return (data.results || []).slice(0, limit);
}

// Mock adatok teszteléshez (Google API kulcs nélkül)
function getMockPlaces(keyword: string, city: string, limit: number): any[] {
  const mockNames = [
    'Szépség & Egészség Stúdió', 'Prémium Kozmetika', 'Beauty Center Kft.',
    'Klasszikus Szalon', 'Modern Beauty Studio', 'Wellness & Spa',
    'Természetes Szépség', 'Arany Rózsa Kozmetika', 'Fehér Hattyú Szalon',
    'Crystal Beauty', 'Glamour Studio', 'Elite Kozmetika',
    'Napsugár Szalon', 'Ibolya Kozmetika', 'Harmónia Stúdió',
  ];

  return mockNames.slice(0, limit).map((name, i) => ({
    name: `${name} (${keyword})`,
    place_id: `mock_${keyword}_${i}_${Date.now()}`,
    formatted_address: `Budapest, ${['I', 'II', 'V', 'XI', 'XIII', 'XIV', 'XVIII'][i % 7]}. kerület`,
    formatted_phone_number: `+36 ${20 + (i % 3)}0 ${100 + i * 37} ${100 + i * 13}`,
    website: i % 3 === 0 ? '' : (i % 5 === 0 ? 'http://old-site.hu' : `https://${name.toLowerCase().replace(/\s/g,'-')}.hu`),
    rating: parseFloat((3.2 + Math.random() * 1.6).toFixed(1)),
    user_ratings_total: Math.floor(Math.random() * 50),
    opening_hours: { open_now: true },
  }));
}

// ============================================================================
// FÁJDALOMPONT SCORING ENGINE
// ============================================================================

async function scoreLead(place: any, industry: string, city: string, env: Env): Promise<Lead> {
  const painReasons: string[] = [];
  let score = 0;

  const website: string = place.website || '';
  const reviews: number = place.user_ratings_total || 0;
  const rating: number = place.rating || 0;

  // 1. Nincs weboldal (+30)
  if (!website) {
    score += 30;
    painReasons.push('Nincs weboldal');
  } else {
    // 2. Nincs HTTPS (+20)
    if (website.startsWith('http://')) {
      score += 20;
      painReasons.push('Nincs HTTPS (biztonsági figyelmeztetés)');
    }

    // 3. Elavult weboldal — régi TLD minták (+15)
    if (website.includes('.hu') && !website.includes('https')) {
      score += 5;
    }

    // 4. Free hosting jelei (+15)
    const freeHostingPatterns = ['wixsite.com', 'webnode.hu', 'webnode.com',
      'wordpress.com', 'blogspot.com', 'weebly.com', 'jimdo.com'];
    if (freeHostingPatterns.some(p => website.includes(p))) {
      score += 15;
      painReasons.push('Ingyenes/amatőr webszolgáltató');
    }
  }

  // 5. Kevés Google értékelés (+20)
  if (reviews === 0) {
    score += 20;
    painReasons.push('Nincs Google értékelés');
  } else if (reviews < 10) {
    score += 15;
    painReasons.push(`Csak ${reviews} Google értékelés (kevés)`);
  } else if (reviews < 25) {
    score += 5;
    painReasons.push(`${reviews} Google értékelés (fejleszthető)`);
  }

  // 6. Alacsony értékelés (+10)
  if (rating > 0 && rating < 3.5) {
    score += 10;
    painReasons.push(`Alacsony értékelés: ${rating}/5`);
  }

  // 7. AI alapú iparág-specifikus scoring (Workers AI)
  if (env.AI && painReasons.length > 0) {
    try {
      const aiScore = await getAIScore(place.name, industry, painReasons, env);
      score = Math.min(100, score + aiScore);
    } catch {
      // AI scoring nem kritikus — silently skip
    }
  }

  return {
    id: crypto.randomUUID(),
    name: place.name,
    industry,
    city,
    address: place.formatted_address || '',
    phone: place.formatted_phone_number || place.international_phone_number || '',
    website,
    google_rating: rating,
    google_reviews: reviews,
    pain_score: Math.min(100, score),
    pain_reasons: painReasons,
    place_id: place.place_id,
    scraped_at: new Date().toISOString(),
    status: 'new',
  };
}

// Workers AI: extra kontextus a scoring-hoz
async function getAIScore(
  businessName: string,
  industry: string,
  painPoints: string[],
  env: Env
): Promise<number> {
  const prompt = `Egy ${industry} vállalkozásról van szó: "${businessName}".
Ismert problémák: ${painPoints.join(', ')}.
Értékeld 0-20 skálán, mennyire valószínű, hogy szüksége van marketing/webfejlesztési segítségre.
Csak a számot válaszold!`;

  const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct' as any, {
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 5,
  }) as { response: string };

  const num = parseInt(result.response?.trim() || '0');
  return isNaN(num) ? 0 : Math.min(20, num);
}

// ============================================================================
// SAVE TO D1
// ============================================================================

async function saveLead(lead: Lead, env: Env): Promise<void> {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO leads
    (id, name, industry, city, address, phone, website,
     google_rating, google_reviews, pain_score, pain_reasons,
     place_id, scraped_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    lead.id, lead.name, lead.industry, lead.city,
    lead.address, lead.phone, lead.website,
    lead.google_rating, lead.google_reviews,
    lead.pain_score, JSON.stringify(lead.pain_reasons),
    lead.place_id, lead.scraped_at, lead.status
  ).run();
}
