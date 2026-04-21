export interface CrmFollowUpLeadSnapshot {
  id: string;
  source: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  receivedAt: string;
  createdAt: string;
  assignedOwner?: string | null;
  payload?: Record<string, unknown>;
}

export interface CrmFollowUpDecision {
  score: number;
  tier: 'hot' | 'warm' | 'nurture';
  route: 'slack' | 'email';
  owner: string;
  reasons: string[];
}

export interface CrmFollowUpScheduleStep {
  step: 'd3' | 'd7' | 'd14';
  dueAt: string;
  channel: 'slack' | 'email';
  target: string;
  summary: string;
}

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
]);

function toLower(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function addDays(base: Date, days: number): string {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

function pickOwner(tier: CrmFollowUpDecision['tier'], lead: CrmFollowUpLeadSnapshot): string {
  if (lead.assignedOwner && lead.assignedOwner.trim().length > 0) {
    return lead.assignedOwner.trim();
  }

  if (tier === 'hot') {
    return 'sales-urgent';
  }

  if (!lead.email || lead.email.trim().length === 0) {
    return 'sales-nurture';
  }

  if (tier === 'warm') {
    return 'sales-standard';
  }

  return 'sales-nurture';
}

export function scoreCrmFollowUpLead(lead: CrmFollowUpLeadSnapshot): CrmFollowUpDecision {
  let score = 0;
  const reasons: string[] = [];
  const source = toLower(lead.source);
  const status = toLower(lead.status);
  const email = toLower(lead.email);
  const company = lead.company?.trim() ?? '';
  const hasEmail = email.length > 0;

  switch (source) {
    case 'referral':
    case 'partner':
      score += 30;
      reasons.push('trusted source');
      break;
    case 'demo':
    case 'demo-request':
      score += 25;
      reasons.push('demo intent');
      break;
    case 'webhook':
    case 'website':
    case 'form':
      score += 18;
      reasons.push('inbound interest');
      break;
    default:
      score += 8;
      reasons.push('baseline lead');
      break;
  }

  if (lead.email) {
    score += 15;
    reasons.push('email present');

    const emailDomain = email.split('@')[1] ?? '';
    if (FREE_EMAIL_DOMAINS.has(emailDomain)) {
      score -= 5;
      reasons.push('free email domain');
    }
  }

  if (!hasEmail) {
    reasons.push('missing email');
  }

  if (lead.phone) {
    score += 10;
    reasons.push('phone present');
  }

  if (company.length > 0) {
    score += 10;
    reasons.push('company present');
  }

  if (status === 'new' || status === 'pending') {
    score += 5;
  }

  const payload = lead.payload ?? {};
  const urgency = toLower(typeof payload.urgency === 'string' ? payload.urgency : undefined);
  const budget = typeof payload.budget === 'number' ? payload.budget : Number(payload.budget);
  const timeline = toLower(typeof payload.timeline === 'string' ? payload.timeline : undefined);

  if (urgency === 'high' || urgency === 'urgent') {
    score += 15;
    reasons.push('urgent urgency');
  }

  if (Number.isFinite(budget) && budget >= 5000) {
    score += 10;
    reasons.push('qualified budget');
  }

  if (timeline === 'this week' || timeline === 'soon' || timeline === 'immediate') {
    score += 10;
    reasons.push('short timeline');
  }

  const tier: CrmFollowUpDecision['tier'] = score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'nurture';
  const route: CrmFollowUpDecision['route'] = tier === 'hot' || !hasEmail ? 'slack' : 'email';
  const owner = pickOwner(tier, lead);

  return {
    score,
    tier,
    route,
    owner,
    reasons,
  };
}

export function buildCrmFollowUpSchedule(
  lead: CrmFollowUpLeadSnapshot,
  decision: CrmFollowUpDecision,
): CrmFollowUpScheduleStep[] {
  const base = new Date(lead.receivedAt || lead.createdAt || new Date().toISOString());
  const target = decision.route === 'email' && lead.email ? lead.email.trim() : decision.owner;

  return [
    {
      step: 'd3',
      dueAt: addDays(base, 3),
      channel: decision.route,
      target,
      summary: `D+3 ${decision.tier} follow-up`,
    },
    {
      step: 'd7',
      dueAt: addDays(base, 7),
      channel: decision.route,
      target,
      summary: `D+7 ${decision.tier} follow-up`,
    },
    {
      step: 'd14',
      dueAt: addDays(base, 14),
      channel: decision.route,
      target,
      summary: `D+14 ${decision.tier} follow-up`,
    },
  ];
}
