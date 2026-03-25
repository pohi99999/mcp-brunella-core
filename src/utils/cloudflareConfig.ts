export function normalizeCloudflareBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export function getCloudflareApiToken(): string | undefined {
  const candidates = [
    process.env.CLOUDFLARE_API_TOKEN,
    process.env.CF_API_TOKEN,
    process.env.CF_TOKEN,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim().replace(/^"|"$/g, '');
    }
  }

  return undefined;
}

export function getCeanApiKey(): string | undefined {
  const value = process.env.CEAN_API_KEY;
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().replace(/^"|"$/g, '')
    : undefined;
}

export function getCloudflareAuthHeaders(contentType = true): Record<string, string> {
  const headers: Record<string, string> = {};

  if (contentType) {
    headers['Content-Type'] = 'application/json';
  }

  const apiToken = getCloudflareApiToken();
  const ceanApiKey = getCeanApiKey();

  if (apiToken) {
    headers.Authorization = `Bearer ${apiToken}`;
    headers['X-BAS-API-Key'] = apiToken;
  }

  if (ceanApiKey) {
    headers['X-CEAN-API-Key'] = ceanApiKey;
  }

  return headers;
}

export function getCloudflareOrchestratorUrl(): string {
  return normalizeCloudflareBaseUrl(
    process.env.CLOUDFLARE_D1_WORKER_URL ||
      process.env.CLOUDFLARE_WORKER_URL ||
      'https://cean-orchestrator.iam-dd1.workers.dev',
  );
}

export function getCloudflareChatSyncUrl(): string {
  return normalizeCloudflareBaseUrl(
    process.env.CLOUDFLARE_CHAT_SYNC_URL ||
      process.env.CLOUDFLARE_CHAT_URL ||
      process.env.CLOUDFLARE_WORKER_URL ||
      'https://bas-orchestrator.peterpohankapersonal.workers.dev',
  );
}

export function getCloudflareChatBaseUrls(): string[] {
  const candidates = [
    process.env.CLOUDFLARE_CHAT_SYNC_URL,
    process.env.CLOUDFLARE_CHAT_URL,
    process.env.CLOUDFLARE_WORKER_URL,
    process.env.CLOUDFLARE_D1_WORKER_URL,
    'https://llm-chat-app-template.iam-dd1.workers.dev',
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => normalizeCloudflareBaseUrl(value));

  return [...new Set(candidates)];
}