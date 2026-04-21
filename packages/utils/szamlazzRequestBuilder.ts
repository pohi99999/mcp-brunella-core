import { XMLBuilder } from 'fast-xml-parser';

/**
 * Számlázz.hu API XML Request Builder Utility
 * Based on: https://www.szamlazz.hu/xml-leiras/
 */

export interface SzamlazzConfig {
  apiKey: string;
}

export interface InvoiceItem {
  name: string;
  quantity: number;
  unit: string;
  netUnitPrice: number;
  vatRate: string; // e.g. "27"
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
}

export interface InvoiceRequest {
  customer: {
    name: string;
    zip: string;
    city: string;
    address: string;
    email?: string;
    taxNumber?: string;
  };
  seller: {
    bankName?: string;
    bankAccount?: string;
    email?: string;
  };
  details: {
    paymentMethod: string; // e.g. "Átutalás"
    currency: string; // e.g. "HUF"
    language: string; // e.g. "hu"
    comment?: string;
    issueDate?: string;
    fulfillmentDate?: string;
    dueDate?: string;
  };
  items: InvoiceItem[];
}

const builder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
  suppressEmptyNode: true,
});

/**
 * Builds a Számlázz.hu XML agent request for invoice creation.
 */
export function buildSzamlazzInvoiceXml(config: SzamlazzConfig, data: InvoiceRequest): string {
  const request = {
    xmlszamla: {
      '@_xmlns': 'http://www.szamlazz.hu/xmlszamla',
      '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      '@_xsi:schemaLocation': 'http://www.szamlazz.hu/xmlszamla xmlszamla.xsd',
      beallitasok: {
        felhasznalo: '', // Legacy, not needed with API key
        jelszo: '',      // Legacy, not needed with API key
        szamlaagentkulcs: config.apiKey,
        eszamla: true,
        szamlaLetoltes: true,
        valaszVerzio: 2,
      },
      fejlec: {
        keltDatum: data.details.issueDate || new Date().toISOString().split('T')[0],
        teljesitesDatum: data.details.fulfillmentDate || new Date().toISOString().split('T')[0],
        fizetesiHataridoDatum: data.details.dueDate || new Date().toISOString().split('T')[0],
        fizmod: data.details.paymentMethod,
        penznem: data.details.currency,
        szamlaNyelve: data.details.language,
        megjegyzes: data.details.comment || '',
      },
      elado: {
        bank: data.seller.bankName || '',
        bankszamlaszam: data.seller.bankAccount || '',
        emailReplyto: data.seller.email || '',
        emailTargy: 'Számla értesítő',
        emailSzoveg: 'Tisztelt Partnerünk! Mellékelten küldjük a számlát.',
      },
      vevo: {
        nev: data.customer.name,
        irsz: data.customer.zip,
        telepules: data.customer.city,
        cim: data.customer.address,
        email: data.customer.email || '',
        adoszam: data.customer.taxNumber || '',
      },
      tetelek: {
        tetel: data.items.map(item => ({
          megnevezes: item.name,
          mennyiseg: item.quantity,
          mennyisegiEgyseg: item.unit,
          nettoEgysegar: item.netUnitPrice,
          afakulcs: item.vatRate,
          nettoErtek: item.netAmount,
          afaErtek: item.vatAmount,
          bruttoErtek: item.grossAmount,
        })),
      },
    },
  };

  return '<?xml version="1.0" encoding="UTF-8"?>\n' + builder.build(request);
}
