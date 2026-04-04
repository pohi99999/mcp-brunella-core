/**
 * Browser Rendering Agent Worker - Edge-based RobotkezV2 & Comet
 * Uses Cloudflare Browser Rendering API
 */

interface Env {
  DB: D1Database;
  KV: KVNamespace;
  BROWSER: any; // Browser Rendering binding
  BAS_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-BAS-API-Key",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const basKeyHeader = request.headers.get("X-BAS-API-Key");
    if (env.BAS_API_KEY && basKeyHeader !== env.BAS_API_KEY) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    try {
      const { agent, task, url, action, selectors, requestId } = await request.json() as any;

      if (!env.BROWSER) {
        return Response.json({ error: "Browser Rendering binding missing" }, { status: 500, headers: corsHeaders });
      }

      // Launch browser session
      const browser = await env.BROWSER.launch();
      const page = await browser.newPage();
      
      let result: any = {};

      if (url) {
        await page.goto(url);
        
        if (action === "screenshot") {
          const screenshot = await page.screenshot();
          result.screenshot = btoa(String.fromCharCode(...new Uint8Array(screenshot)));
        }
        
        if (action === "scrape" && selectors) {
          // Perform basic scraping based on selectors
          result.data = await page.evaluate((sel: string[]) => {
            const data: Record<string, string> = {};
            sel.forEach(s => {
              const el = document.querySelector(s);
              if (el) data[s] = el.textContent || "";
            });
            return data;
          }, selectors);
        }
      }

      await browser.close();

      return Response.json({
        requestId,
        agent,
        status: "completed",
        result
      }, { headers: corsHeaders });

    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
  }
};
