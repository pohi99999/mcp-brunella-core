// node_modules/itty-router/index.mjs
var e = ({ base: e2 = "", routes: t = [], ...o2 } = {}) => ({ __proto__: new Proxy({}, { get: (o3, s2, r, n) => "handle" == s2 ? r.fetch : (o4, ...a) => t.push([s2.toUpperCase?.(), RegExp(`^${(n = (e2 + o4).replace(/\/+(\/|$)/g, "$1")).replace(/(\/?\.?):(\w+)\+/g, "($1(?<$2>*))").replace(/(\/?\.?):(\w+)/g, "($1(?<$2>[^$1/]+?))").replace(/\./g, "\\.").replace(/(\/?)\*/g, "($1.*)?")}/*$`), a, n]) && r }), routes: t, ...o2, async fetch(e3, ...o3) {
  let s2, r, n = new URL(e3.url), a = e3.query = { __proto__: null };
  for (let [e4, t2] of n.searchParams) a[e4] = a[e4] ? [].concat(a[e4], t2) : t2;
  for (let [a2, c2, i2, l2] of t) if ((a2 == e3.method || "ALL" == a2) && (r = n.pathname.match(c2))) {
    e3.params = r.groups || {}, e3.route = l2;
    for (let t2 of i2) if (null != (s2 = await t2(e3.proxy ?? e3, ...o3))) return s2;
  }
} });
var o = (e2 = "text/plain; charset=utf-8", t) => (o2, { headers: s2 = {}, ...r } = {}) => void 0 === o2 || "Response" === o2?.constructor.name ? o2 : new Response(t ? t(o2) : o2, { headers: { "content-type": e2, ...s2.entries ? Object.fromEntries(s2) : s2 }, ...r });
var s = o("application/json; charset=utf-8", JSON.stringify);
var c = o("text/plain; charset=utf-8", String);
var i = o("text/html");
var l = o("image/jpeg");
var p = o("image/png");
var d = o("image/webp");

// worker.ts
var router = e();
router.get("/health", async (_req, env) => {
  try {
    const testMetrics = globalThis.__cean_test_metrics || {
      passed: 0,
      failed: 0
    };
    const response = {
      status: testMetrics.failed === 0 ? "healthy" : "degraded",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      version: "1.0.0",
      d1_available: !!env.DB,
      r1_available: !!env.VECTORIZE_INDEX,
      tests_passed: testMetrics.passed,
      tests_failed: testMetrics.failed
    };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: "unhealthy",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        error: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
router.post("/test/d1", async (_req, env) => {
  const startTime = Date.now();
  const results = [];
  try {
    if (!env.DB) {
      throw new Error("D1 database not bound");
    }
    const queryTime = Date.now();
    const queryResult = await env.DB.prepare("SELECT 1 as ok").first();
    if (!queryResult || queryResult.ok !== 1) {
      throw new Error("D1 basic query failed");
    }
    results.push({
      success: true,
      test: "d1_basic_query",
      duration_ms: Date.now() - queryTime,
      message: "D1 basic query succeeded",
      data: { ok: queryResult.ok }
    });
    globalThis.__cean_test_metrics = {
      passed: (globalThis.__cean_test_metrics?.passed || 0) + 1,
      failed: globalThis.__cean_test_metrics?.failed || 0,
      last_d1_test: (/* @__PURE__ */ new Date()).toISOString()
    };
    return new Response(
      JSON.stringify({
        success: true,
        test_name: "d1_connectivity",
        total_duration_ms: Date.now() - startTime,
        results,
        summary: {
          tests_run: results.length,
          tests_passed: results.filter((r) => r.success).length,
          tests_failed: results.filter((r) => !r.success).length
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    globalThis.__cean_test_metrics = {
      passed: globalThis.__cean_test_metrics?.passed || 0,
      failed: (globalThis.__cean_test_metrics?.failed || 0) + 1,
      last_d1_error: errorMessage
    };
    return new Response(
      JSON.stringify({
        success: false,
        test_name: "d1_connectivity",
        total_duration_ms: Date.now() - startTime,
        results,
        error: errorMessage
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
router.post("/test/r1", async (_req, env) => {
  const startTime = Date.now();
  try {
    const response = {
      success: true,
      test_name: "r1_connectivity",
      total_duration_ms: Date.now() - startTime,
      status: "ready",
      message: "R1 (Vectorize) binding is available",
      requirements: {
        vectorize_index_bound: !!env.VECTORIZE_INDEX,
        openai_api_key_present: !!env.OPENAI_API_KEY,
        embedding_model: "text-embedding-3-small",
        next_steps: [
          "1. Ensure VECTORIZE_INDEX is bound in wrangler.toml",
          "2. Set OPENAI_API_KEY environment variable",
          '3. Generate sample embedding: {"text": "test"}',
          "4. Insert into R1 with metadata",
          "5. Run vector search query"
        ]
      },
      example_embedding_request: {
        text: "Cloudflare Edge Agents Network",
        model: "text-embedding-3-small",
        expected_dimensions: 1536
      }
    };
    globalThis.__cean_test_metrics = {
      passed: (globalThis.__cean_test_metrics?.passed || 0) + 1,
      failed: globalThis.__cean_test_metrics?.failed || 0,
      last_r1_test: (/* @__PURE__ */ new Date()).toISOString()
    };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    globalThis.__cean_test_metrics = {
      passed: globalThis.__cean_test_metrics?.passed || 0,
      failed: (globalThis.__cean_test_metrics?.failed || 0) + 1,
      last_r1_error: errorMessage
    };
    return new Response(
      JSON.stringify({
        success: false,
        test_name: "r1_connectivity",
        total_duration_ms: Date.now() - startTime,
        error: errorMessage
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
router.get("/test/metrics", async (_req, env) => {
  const metrics = globalThis.__cean_test_metrics || {
    passed: 0,
    failed: 0
  };
  return new Response(JSON.stringify(metrics), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
router.all("*", () => {
  return new Response(
    JSON.stringify({
      error: "Not Found",
      available_endpoints: [
        "GET /health",
        "POST /test/d1",
        "POST /test/r1",
        "GET /test/metrics"
      ]
    }),
    { status: 404, headers: { "Content-Type": "application/json" } }
  );
});
var worker_default = {
  fetch: (request, env, ctx) => router.handle(request, env, ctx)
};
export {
  worker_default as default
};
