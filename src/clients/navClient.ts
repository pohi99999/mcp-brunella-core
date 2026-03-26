import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';
import { logInfo, logError } from '../utils/logger.js';

export type NavConfig = {
  baseUrl: string;
  apiKey?: string;
  endpointTemplate?: string; // e.g. '/invoices/{number}'
  basicAuth?: { user: string; pass: string };
};

export async function fetchInvoiceXml(config: NavConfig, invoiceNumber: string): Promise<string | null> {
  try {
    const tpl = config.endpointTemplate || '/invoices/{number}';
    const path = tpl.replace('{number}', encodeURIComponent(invoiceNumber));
    const url = new URL(path, config.baseUrl).toString();
    const headers: Record<string, string> = { 'Accept': 'application/xml' };
    if (config.apiKey) headers['X-API-KEY'] = config.apiKey;
    if (config.basicAuth) {
      const tok = Buffer.from(`${config.basicAuth.user}:${config.basicAuth.pass}`).toString('base64');
      headers['Authorization'] = `Basic ${tok}`;
    }
    logInfo('navClient', `Fetching invoice XML ${url}`);
    const res = await fetch(url, { headers });
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
