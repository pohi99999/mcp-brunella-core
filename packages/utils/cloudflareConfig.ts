export function normalizeCloudflareBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

type CloudflareScope = 'bas' | 'personal';

function pickFirstEnv(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim().replace(/^"|"$/g, '');
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return undefined;
}

export function getCloudflareAccountId(scope: CloudflareScope = 'bas'): string | undefined {
  return scope === 'personal'
    ? pickFirstEnv(
      process.env.CF_PERSONAL_ACCOUNT_ID,
      process.env.CLOUDFLARE_PERSONAL_ACCOUNT_ID,
      process.env.CLOUDFLARE_ACCOUNT_ID,
      process.env.CF_ACCOUNT_ID,
      process.env.CF_BAS_ACCOUNT_ID,
    )
    : pickFirstEnv(
      process.env.CF_BAS_ACCOUNT_ID,
      process.env.CLOUDFLARE_ACCOUNT_ID,
      process.env.CF_ACCOUNT_ID,
      process.env.CF_PERSONAL_ACCOUNT_ID,
    );
}

export function getCloudflareApiToken(scope: CloudflareScope = 'bas'): string | undefined {
  return scope === 'personal'
    ? pickFirstEnv(
      process.env.CF_PERSONAL_API_TOKEN,
      process.env.CLOUDFLARE_PERSONAL_API_TOKEN,
      process.env.CLOUDFLARE_API_TOKEN,
      process.env.CF_API_TOKEN,
      process.env.CF_TOKEN,
    )
    : pickFirstEnv(
      process.env.CF_BAS_API_TOKEN,
      process.env.CLOUDFLARE_API_TOKEN,
      process.env.CF_API_TOKEN,
      process.env.CF_TOKEN,
    );
}

export function getBasCloudflareAccountId(): string | undefined {
  return getCloudflareAccountId('bas');
}

export function getBasCloudflareApiToken(): string | undefined {
  return getCloudflareApiToken('bas');
}

export function getPersonalCloudflareAccountId(): string | undefined {
  return getCloudflareAccountId('personal');
}

export function getPersonalCloudflareApiToken(): string | undefined {
  return getCloudflareApiToken('personal');
}

export function getCloudflareAuthHeaders(contentType = true): Record<string, string> {
  const headers: Record<string, string> = {};

  if (contentType) {
    headers['Content-Type'] = 'application/json';
  }

  const apiToken = getBasCloudflareApiToken();
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

export function getCeanApiKey(): string | undefined {
  const value = process.env.CEAN_API_KEY;
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().replace(/^"|"$/g, '')
    : undefined;
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
      'https://cean-orchestrator.iam-dd1.workers.dev',
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