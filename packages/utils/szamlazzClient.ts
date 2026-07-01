import axios from 'axios';
import FormData from 'form-data';
import { XMLParser } from 'fast-xml-parser';
import { buildSzamlazzInvoiceXml, InvoiceRequest, SzamlazzConfig } from './szamlazzRequestBuilder.js';
import { logInfo, logError } from './logger.js';

/**
 * Számlázz.hu Agent API Client (Node.js)
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

export interface SzamlazzResponse {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  invoiceNumber?: string;
  pdfBase64?: string;
}

export class SzamlazzClient {
  private url = 'https://www.szamlazz.hu/szamla/';
  private config: SzamlazzConfig;

  constructor(config: SzamlazzConfig) {
    this.config = config;
  }

  /**
   * Sends an invoice to Számlázz.hu using the XML Agent API.
   */
  async createInvoice(request: InvoiceRequest): Promise<SzamlazzResponse> {
    const xml = buildSzamlazzInvoiceXml(this.config, request);
    
    try {
      logInfo('SzamlazzClient', 'Sending invoice to Számlázz.hu...');
      
      const form = new FormData();
      form.append('action-xmlagentxmlfile', Buffer.from(xml), {
        filename: 'invoice.xml',
        contentType: 'application/xml',
      });

      const response = await axios.post(this.url, form, {
        headers: {
          ...form.getHeaders(),
        },
        responseType: 'arraybuffer', // PDF support requires binary response
      });

      const headers = response.headers;
      const contentType = headers['content-type'] || '';

      // Parse custom Számlázz.hu headers (case-insensitive check)
      const invoiceNumber = headers['szlahu_szamlaszam'];
      const errorCode = headers['szlahu_error_code'];
      const errorMessage = headers['szlahu_error'] ? decodeURIComponent(headers['szlahu_error'] as string) : undefined;

      if (invoiceNumber) {
        logInfo('SzamlazzClient', `Invoice created successfully: ${invoiceNumber}`);

        let pdfBase64 = undefined;
        if (String(contentType).includes('application/pdf')) {
          pdfBase64 = Buffer.from(response.data).toString('base64');
        }

        return {
          success: true,
          invoiceNumber: invoiceNumber as string,
          pdfBase64,
        };
      } else {
        const errorMsg = errorMessage || 'Ismeretlen Számlázz.hu hiba';
        logError('SzamlazzClient', `API Hiba: ${errorMsg} (${errorCode})`);
        return {
          success: false,
          errorCode: errorCode as string,
          errorMessage: errorMsg,
        };
      }


    } catch (error: any) {
      const msg = error.response?.data || error.message;
      logError('SzamlazzClient', `Request failed: ${msg}`);
      return {
        success: false,
        errorMessage: msg,
      };
    }
  }
}
