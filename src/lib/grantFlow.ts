export interface GrantProfileForm {
  companyName: string;
  teaorCode: string;
  employeeCount: number;
  annualRevenue: number;
  location: string;
  projectDescription: string;
}

export interface GrantOpportunityDetails {
  title: string;
  source: string;
  sourceUrl: string;
  deadline: string;
  fundingAmount: number;
  currency: string;
  description: string;
  publishedAt: string;
}

export interface GrantMatch {
  grant: GrantOpportunityDetails;
  matchScore: number;
  matchReasons: string[];
  warnings?: string[];
}

export interface GrantDeadline {
  title: string;
  deadline: string;
  daysRemaining: number;
}

export interface GrantDraftSection {
  title: string;
  content: string;
}

export interface GrantApplicationDraft {
  title: string;
  sections: GrantDraftSection[];
  companyName?: string;
}

export interface GrantWatcherPayload {
  grants: Array<{
    title: string;
    deadline: string;
    fundingAmount: number;
    isEligible: boolean;
  }>;
  upcomingDeadlines: GrantDeadline[];
  applicationDraft?: GrantApplicationDraft;
  eligibleGrants: GrantMatch[];
  stats: {
    totalFound: number;
    eligible: number;
    avgMatchScore: number;
  };
  summaryDocUrl?: string;
}

export interface GrantWatcherAgentResponse {
  status: 'success' | 'error';
  message?: string;
  error?: string;
  data?: GrantWatcherPayload;
}

export const DEFAULT_GRANT_PROFILE: GrantProfileForm = {
  companyName: 'Iszapfaló Kft.',
  teaorCode: '7210',
  employeeCount: 1,
  annualRevenue: 165800000,
  location: 'Pest',
  projectDescription:
    'Iszapkezelési, mederdiagnosztikai és vízminőség-javító K+F pilot a körforgásos újrahasznosításra fókuszálva.',
};

export function buildGrantTask(profile: GrantProfileForm, grantId?: string): string {
  const payload: Record<string, unknown> = {
    companyName: profile.companyName.trim(),
    teaorCode: profile.teaorCode.trim(),
    employeeCount: profile.employeeCount,
    annualRevenue: profile.annualRevenue,
    location: profile.location.trim(),
    projectDescription: profile.projectDescription.trim(),
  };

  if (grantId?.trim()) {
    payload.grantId = grantId.trim();
  }

  return JSON.stringify(payload);
}

export function formatGrantAmount(amount: number, currency: string = 'HUF'): string {
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
