import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';
import { logInfo, logError } from '@packages/utils/logger.js';
import https from 'https';
import fs from 'fs';

export type NavConfig = {
  baseUrl: string;
  apiKey?: string;
  endpointTemplate?: string; // e.g. '/invoices/{number}'
  basicAuth?: { user: string; pass: string };
  mTLS?: { certPath: string; keyPath: string; passphrase?: string };
  oauth?: { tokenUrl: string; clientId: string; clientSecret: string; scope?: string };
};

async function getOAuthToken(oauth: NonNullable<NavConfig['oauth']>): Promise<string | null> {
  try {
    const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: oauth.clientId, client_secret: oauth.clientSecret });
    if (oauth.scope) body.append('scope', oauth.scope);
    const res = await fetch(oauth.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
    if (!res.ok) {
      logError('navClient', `OAuth token fetch failed: ${res.status} ${res.statusText}`);
      return null;
    }
    const json: unknown = await res.json();
    if (typeof json === 'object' && json !== null && 'access_token' in json) {
       
      return (json as any).access_token ?? null;
    }
    return null;
  } catch (e) {
    logError('navClient', `getOAuthToken error: ${String(e)}`);
    return null;
  }
}

export async function fetchInvoiceXml(config: NavConfig, invoiceNumber: string): Promise<string | null> {
  try {
    const tpl = config.endpointTemplate || '/invoices/{number}';
    const path = tpl.replace('{number}', encodeURIComponent(invoiceNumber));
    const url = new URL(path, config.baseUrl).toString();
    const headers: Record<string, string> = { 'Accept': 'application/xml' };
    if (config.apiKey) headers['X-API-KEY'] = config.apiKey;

    // OAuth precedence over basic auth
    let agent: https.Agent | undefined;
    if (config.mTLS && config.mTLS.certPath && config.mTLS.keyPath) {
      try {
        agent = new https.Agent({ cert: fs.readFileSync(config.mTLS.certPath), key: fs.readFileSync(config.mTLS.keyPath), passphrase: config.mTLS.passphrase, rejectUnauthorized: true });
      } catch (e) {
        logError('navClient', `Failed to load mTLS cert/key: ${String(e)}`);
      }
    }

    if (config.oauth) {
      const token = await getOAuthToken(config.oauth);
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } else if (config.basicAuth) {
      const tok = Buffer.from(`${config.basicAuth.user}:${config.basicAuth.pass}`).toString('base64');
      headers['Authorization'] = `Basic ${tok}`;
    }

    logInfo('navClient', `Fetching invoice XML ${url}`);
    const res = await fetch(url, { headers, agent } as any);
    if (!res.ok) {
      logError('navClient', `NAV fetch failed: ${res.status} ${res.statusText}`);
      return null;
    }
    const xml = await res.text();
    return xml;
  } catch (e) {
    logError('navClient', `fetchInvoiceXml error: ${String(e)}`);
    return null;
  }
}

export function parseInvoiceXml(xml: string): Record<string, unknown> | null {
  try {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const json = parser.parse(xml);
    return json as Record<string, unknown>;
  } catch (e) {
    logError('navClient', `parseInvoiceXml error: ${String(e)}`);
    return null;
  }
}

