export function normalizeBrowserEndpoint(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Resolves the browser CDP/ACP endpoint used by Browser Copilot and edge browser tooling.
 *
 * Priority order:
 * 1. CLOUDFLARE_TUNNEL_BROWSER_URL – remote browser tunnel exposed through Cloudflare
 * 2. CHROME_ACP_URL / BROWSER_ACP_URL – explicit local or remote ACP endpoint
 * 3. localhost fallback – developer workstation default
 */
export function resolveBrowserCopilotEndpoint(): string {
  return normalizeBrowserEndpoint(
    process.env.CLOUDFLARE_TUNNEL_BROWSER_URL ||
      process.env.CHROME_ACP_URL ||
      process.env.BROWSER_ACP_URL ||
      "http://localhost:9315",
  );
}
