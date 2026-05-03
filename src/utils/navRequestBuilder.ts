import { XMLBuilder } from 'fast-xml-parser';
import { getNavTimestamp, calculateRequestSignature, calculatePasswordHash } from './navSigner.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * NAV Online Számla API v3.0 Request Builder Utility
 */

const NAV_NS = 'http://schemas.nav.gov.hu/OSA/3.0/api';
const COMMON_NS = 'http://schemas.nav.gov.hu/NTCA/1.0/common';

export interface NavUserConfig {
  username: string;
  passwordHash: string;
  taxNumber: string;
  signatureKey: string;
}

export interface NavRequestHeader {
  requestId: string;
  timestamp: string;
  requestSignature: string;
}

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  suppressEmptyNode: true,
});

/**
 * Creates a standard NAV API request header.
 */
export function createHeader(config: NavUserConfig): { header: any; user: any } {
  const requestId = `BRU-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 20)}`;
  const timestamp = getNavTimestamp();
  const requestSignature = calculateRequestSignature(requestId, timestamp, config.signatureKey);

  return {
    header: {
      'common:requestId': requestId,
      'common:timestamp': new Date().toISOString(),
      'common:requestSignature': {
        '#text': requestSignature,
        '@_cryptoType': 'SHA3-512',
      },
      'common:headerVersion': '1.0',
      'common:advisoryEmails': [],
    },
    user: {
      'common:login': config.username,
      'common:passwordHash': {
        '#text': config.passwordHash,
        '@_cryptoType': 'SHA-512',
      },
      'common:taxNumber': config.taxNumber,
    },
  };
}

/**
 * Builds a TokenExchangeRequest XML.
 */
export function buildTokenExchangeRequest(config: NavUserConfig): string {
  const { header, user } = createHeader(config);

  const request = {
    TokenExchangeRequest: {
      '@_xmlns:common': COMMON_NS,
      '@_xmlns': NAV_NS,
      header,
      user,
      software: {
        'common:softwareId': 'BRUNELLA-AGENT-SYSTEM-01',
        'common:softwareName': 'Brunella Agent System',
        'common:softwareOperation': 'LOCAL_SOFTWARE',
        'common:softwareMainVersion': '2.4.0',
        'common:softwareDevName': 'Pohánka Péter',
        'common:softwareDevContact': 'peter@pohankaestarsa.com',
        'common:softwareDevCountryCode': 'HU',
        'common:softwareDevTaxNumber': config.taxNumber,
      },
    },
  };

  return builder.build(request);
}

/**
 * Builds a QueryInvoiceDataRequest XML.
 */
export function buildQueryInvoiceDataRequest(
  config: NavUserConfig, 
  params: { invoiceNumber: string }
): string {
  const { header, user } = createHeader(config);

  const request = {
    QueryInvoiceDataRequest: {
      '@_xmlns:common': COMMON_NS,
      '@_xmlns': NAV_NS,
      header,
      user,
      page: 1,
      invoiceQueryParams: {
        invoiceNumber: params.invoiceNumber,
      },
    },
  };

  return builder.build(request);
}
