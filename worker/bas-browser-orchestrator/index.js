export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/chat') {
      return handleChat(request, env);
    }

    if (url.pathname === '/screenshot') {
      return handleScreenshot(request, env);
    }

    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }

    return new Response('Not found', { status: 404 });
  }
};

async function handleChat(request, env) {
  const data = await request.json();
  const { message, sessionId } = data;

  const browser = await env.BROWSER.render();
  const page = await browser.newPage();

  const aiResponse = await processMessage(message, env, page);

  const screenshot = await page.screenshot({ fullPage: false });

  await browser.close();

  return new Response(JSON.stringify({
    response: aiResponse,
    screenshot: screenshot.toString('base64'),
    sessionId
  }), {
    headers: { 'Content-Type': 'application/json' }
  });

}

async function handleScreenshot(request, env) {
  const browser = await env.BROWSER.render();
  const page = await browser.newPage();

  const screenshot = await page.screenshot({ fullPage: false });
  await browser.close();

  return new Response(screenshot, {
    headers: { 'Content-Type': 'image/png' }
  });

}

async function processMessage(message, env, page) {
  const actions = await page.observe(message);

  for (const action of actions) {
    await page.act(action);
  }

  return `Készítettem: ${message}`;
}
