export interface OutreachTemplate {
  id: string;
  name: string;
  platform: 'linkedin' | 'email' | 'instagram';
  category: 'KKV' | 'Brand';
  subject?: string;
  body: string;
  variables: string[];
}

export const outreachTemplates: OutreachTemplate[] = [
  {
    id: 'linkedin_kkv_connect_v1',
    name: 'KKV LinkedIn Connection Request',
    platform: 'linkedin',
    category: 'KKV',
    body: 'Szia {name}! Látom, hogy a {company}-nál te felelsz az értékesítésért. Építettem egy olyan AI ágensrendszert (Brunella), ami magyar B2B környezetben keres és minősít lead-eket, így csak a valódi érdeklődőkkel kell foglalkoznod. Szívesen megmutatom a logikáját, ha nyitott vagy rá!',
    variables: ['name', 'company']
  },
  {
    id: 'linkedin_brand_connect_v1',
    name: 'Brand LinkedIn Connection Request',
    platform: 'linkedin',
    category: 'Brand',
    body: 'Szia {name}! Gratulálok a {company} legutóbbi kollekciójához! Prémium márkáknak segítek AI-val automatizálni a tartalomgyártást (lásd Varga Viktória case study: heti 8 óra munka -> 20 perc). Szívesen küldök egy rövid összefoglalót a módszerről!',
    variables: ['name', 'company']
  },
  {
    id: 'email_kkv_followup_v1',
    name: 'KKV Email Follow-up',
    platform: 'email',
    category: 'KKV',
    subject: 'AI automatizáció a {company} értékesítésében?',
    body: 'Kedves {name}!

A LinkedInen már kerestelek, de gondoltam itt is jelzem: a Brunella Agent System-mel segítünk a hozzátok hasonló magyar KKV-knak automatizálni a lead-generálást és az adminisztrációt. A cél, hogy a csapatod csak az érdemi tárgyalásokra fókuszáljon.

Mikor lenne alkalmas egy 15 perces rövid demo?',
    variables: ['name', 'company']
  }
];

export function getTemplateById(id: string): OutreachTemplate | undefined {
  return outreachTemplates.find(t => t.id === id);
}

export function fillTemplate(template: OutreachTemplate, values: Record<string, string>): string {
  let result = template.body;
  template.variables.forEach(v => {
    const regex = new RegExp(`{${v}}`, 'g');
    result = result.replace(regex, values[v] || `[${v}]`);
  });
  return result;
}
