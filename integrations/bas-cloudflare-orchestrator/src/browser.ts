// Cloudflare Browser Rendering + Stagehand Interface
export async function handleBrowserTask(request: Request, env: any) {
  const data: any = await request.json();
  const { message, sessionId, action } = data;

  try {
    // 1. Browser Rendering indítása
    // @ts-ignore
    const browser = await env.BROWSER.render();
    const page = await browser.newPage();

    let aiResponse = "";
    let screenshot = "";

    if (action === 'screenshot') {
      if (data.url) await page.goto(data.url);
      const screenshotBuffer = await page.screenshot();
      screenshot = btoa(String.fromCharCode(...new Uint8Array(screenshotBuffer)));
      aiResponse = `Képernyőkép elkészült: ${page.url()}`;
    } else {
      // Itt a Stagehand-szerű observe/act logika jönne (Workers AI-val)
      // Egyelőre egy alap Playwright-stílusú végrehajtó
      if (message.startsWith('http')) {
        await page.goto(message);
        aiResponse = `Navigáltam ide: ${message}`;
      } else {
        // AI alapú keresés/interakció (Placeholder)
        aiResponse = `Értelmeztem a kérést: "${message}". A felhős vezérlés aktív.`;
      }
      
      const screenshotBuffer = await page.screenshot({ fullPage: false });
      screenshot = btoa(String.fromCharCode(...new Uint8Array(screenshotBuffer)));
    }

    await browser.close();

    return new Response(JSON.stringify({
      response: aiResponse,
      screenshot: screenshot,
      sessionId: sessionId || `cf_session_${Date.now()}`,
      url: page.url()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
