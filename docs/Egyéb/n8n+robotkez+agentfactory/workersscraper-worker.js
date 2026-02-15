export default {
  async fetch(request) {
    const url = new URL(request.url).searchParams.get("target");
    if (!url) return new Response("Add meg a target URL-t!", { status: 400 });

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Brunella-Scraper-Bot/1.0'
            }
        });
        let text = await response.text();

        // Simple cleanup: Remove scripts, styles, and comments
        text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gim, "");
        text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gim, "");
        text = text.replace(/<!--[\s\S]*?-->/g, "");
        
        // Remove generic tags to save tokens
        text = text.replace(/<[^>]+>/g, " "); 
        text = text.replace(/\s+/g, " ").trim();

        return new Response(JSON.stringify({ cleaned_text: text }), {
          headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  },
};