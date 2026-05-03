import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { 
  buildTokenExchangeRequest, 
  buildQueryInvoiceDataRequest, 
  NavUserConfig 
} from './navRequestBuilder.js';
import { logInfo, logError, logWarn } from './logger.js';

/**
 * NAV Online Számla API v3.0 Client
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

export class NavClient {
  private baseUrl: string;
  private config: NavUserConfig;

  constructor(config: NavUserConfig, testMode = true) {
    this.config = config;
    this.baseUrl = testMode 
      ? 'https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3'
      : 'https://api.onlineszamla.nav.gov.hu/invoiceService/v3';
  }

  /**
   * Performs a token exchange to get a short-lived exchange token.
   */
  async exchangeToken(): Promise<string> {
    const xml = buildTokenExchangeRequest(this.config);
    
    try {
      logInfo('NavClient', 'Initiating token exchange...');
      const response = await axios.post(`${this.baseUrl}/tokenExchange`, xml, {
        headers: { 'Content-Type': 'application/xml' }
      });

      const result = parser.parse(response.data);
      const token = result?.TokenExchangeResponse?.encodedExchangeToken;

      if (!token) {
        throw new Error(`Token exchange failed: ${JSON.stringify(result?.TokenExchangeResponse?.result || 'Unknown error')}`);
      }

      logInfo('NavClient', 'Token exchange successful.');
      return token;
    } catch (error: any) {
      const msg = error.response?.data || error.message;
      logError('NavClient', `Token exchange error: ${msg}`);
      throw new Error(`NAV API Token Exchange Error: ${msg}`);
    }
  }

  /**
   * Queries invoice data by invoice number.
   */
  async queryInvoiceData(invoiceNumber: string): Promise<any> {
    const xml = buildQueryInvoiceDataRequest(this.config, { invoiceNumber });

    try {
      logInfo('NavClient', `Querying invoice: ${invoiceNumber}`);
      const response = await axios.post(`${this.baseUrl}/queryInvoiceData`, xml, {
        headers: { 'Content-Type': 'application/xml' }
      });

      const result = parser.parse(response.data);
      
      // Basic normalization
      if (result?.QueryInvoiceDataResponse?.result?.funcCode !== 'OK') {
        logWarn('NavClient', `Query result for ${invoiceNumber}: ${result?.QueryInvoiceDataResponse?.result?.message}`);
      }

      return result?.QueryInvoiceDataResponse;
    } catch (error: any) {
      const msg = error.response?.data || error.message;
      logError('NavClient', `Query error: ${msg}`);
      throw new Error(`NAV API Query Error: ${msg}`);
    }
  }
}
