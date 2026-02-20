/**
 * BAS Enterprise Suite - Type Definitions
 * Version: 1.0.0
 * 
 * Central type system for all 18 enterprise modules
 */

// ============================================================================
// Core Enterprise Event System
// ============================================================================

export type ModuleType = 'HR' | 'FINANCE' | 'SALES' | 'LOGISTICS' | 'INTELLIGENCE' | 'WIKI';
export type EventPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type EventStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'requires_approval';

export interface EnterpriseEvent {
  id: string;
  module: ModuleType;
  type: string;
  payload: ModulePayload;
  priority: EventPriority;
  storedInLanceDB: boolean;
  timestamp: string;
  userId?: string;
  status: EventStatus;
  assignedAgent?: string;
  executionHistory?: ExecutionStep[];
}

export interface ExecutionStep {
  timestamp: string;
  agent: string;
  action: string;
  result: 'success' | 'failure' | 'pending';
  details?: string;
}

// ============================================================================
// Module-specific Payload Types
// ============================================================================

export type ModulePayload = 
  | HRPayload 
  | FinancePayload 
  | SalesPayload 
  | LogisticsPayload 
  | IntelligencePayload
  | WikiPayload;

// ----------------------------------------------------------------------------
// HR Module Payloads
// ----------------------------------------------------------------------------

export interface HRPayload {
  type: 'recruitment' | 'conflict_analysis' | 'csr_opportunity';
  data: RecruitmentData | ConflictAnalysisData | CSROpportunityData;
}

export interface RecruitmentData {
  jobDescription: string;
  cvFiles?: string[]; // File paths
  linkedinUrls?: string[];
  requiredSkills: string[];
  experienceYears?: number;
}

export interface ConflictAnalysisData {
  threadMessages: {
    sender: string; // Anonymized
    content: string;
    timestamp: string;
    sentiment?: number; // -1 to 1
  }[];
  participants: string[];
}

export interface CSROpportunityData {
  companyLocation: string;
  companyValues: string[];
  searchRadius?: number; // Kilometers
}

// ----------------------------------------------------------------------------
// Finance Module Payloads
// ----------------------------------------------------------------------------

export interface FinancePayload {
  type: 'invoice_processing' | 'grant_eligibility' | 'procurement_negotiation';
  data: InvoiceData | GrantEligibilityData | ProcurementData;
}

export interface InvoiceData {
  invoiceNumber?: string;
  amount?: number;
  currency?: string;
  dueDate?: string;
  vendorName?: string;
  pdfPath?: string;
  extractedText?: string;
  description?: string;
}

export interface GrantEligibilityData {
  companyProfile: {
    teaorCode: string;
    employeeCount: number;
    annualRevenue: number;
    location: string;
  };
}

export interface ProcurementData {
  productCategory: string;
  currentSupplier: string;
  currentPrice: number;
  targetPriceReduction?: number; // Percentage
}

// ----------------------------------------------------------------------------
// CSR Impact Data Extension (Phase 4)
// ----------------------------------------------------------------------------

export interface CSRImpactData {
  trackingPeriod?: string; // e.g., "Q1 2026"
  officeEnergyKwh?: number;
  businessTravelKm?: number;
}

// ----------------------------------------------------------------------------
// Sales Module Payloads
// ----------------------------------------------------------------------------

export interface SalesPayload {
  type: 'lead_generation' | 'market_intel' | 'campaign_automation';
  data: LeadGenerationData | MarketIntelData | CampaignData;
}

export interface LeadGenerationData {
  industry: string;
  location: string;
  companySize: 'startup' | 'sme' | 'enterprise';
  keywords: string[];
  targetCount?: number;
}

export interface MarketIntelData {
  productCategory: string;
  competitors?: string[];
  priceRange?: { min: number; max: number };
}

export interface CampaignData {
  projectName: string;
  targetAudience: string;
  channels: ('linkedin' | 'facebook' | 'email')[];
}

// ----------------------------------------------------------------------------
// Logistics Module Payloads
// ----------------------------------------------------------------------------

export interface LogisticsPayload {
  type: 'shipment_tracking' | 'complaint_generation' | 'route_optimization';
  data: ShipmentTrackingData | ComplaintData;
}

export interface ShipmentTrackingData {
  trackingId: string;
  carrier: 'gls' | 'dpd' | 'magyar_posta' | 'other';
  expectedDelivery?: string;
}

export interface ComplaintData {
  trackingId: string;
  issueType: 'delay' | 'damage' | 'lost';
  description: string;
}

// ----------------------------------------------------------------------------
// Intelligence Module Payloads
// ----------------------------------------------------------------------------

export interface IntelligencePayload {
  type: 'competitor_analysis' | 'law_monitoring' | 'trend_detection';
  data: CompetitorData | LawMonitoringData | TrendData;
}

export interface CompetitorData {
  competitors: string[];
  metrics: ('pricing' | 'features' | 'market_share')[];
}

export interface LawMonitoringData {
  teaorCode: string;
  employeeCount: number;
  keywords: string[];
}

export interface TrendData {
  industry: string;
  timeframe: 'weekly' | 'monthly' | 'quarterly';
}

// ----------------------------------------------------------------------------
// Wiki/Knowledge Module Payloads
// ----------------------------------------------------------------------------

export interface WikiPayload {
  type: 'index_project' | 'search_knowledge' | 'archive_documents';
  data: ProjectIndexData | KnowledgeSearchData | ArchiveData;
}

export interface ProjectIndexData {
  projectFolderPath: string;
  clientName: string;
  completionDate: string;
  tags?: string[];
}

export interface KnowledgeSearchData {
  query: string;
  filters?: {
    dateRange?: { start: string; end: string };
    tags?: string[];
    clientName?: string;
  };
}

export interface ArchiveData {
  filePaths: string[];
  namingConvention?: boolean; // Apply YYYY_MM_PARTNER_TYPE pattern
}

// ============================================================================
// Agent Response Types
// ============================================================================

export interface EnterpriseAgentResponse {
  eventId: string;
  module: ModuleType;
  status: 'success' | 'failure' | 'requires_approval' | 'delegated';
  data?: unknown;
  error?: string;
  nextSteps?: string[];
  approvalRequired?: {
    reason: string;
    approvalUrl?: string;
  };
}

// ============================================================================
// LanceDB Storage Schemas
// ============================================================================

export interface MarketIntelRecord {
  id: string;
  productName: string;
  competitor: string;
  price: number;
  currency: string;
  scrapedAt: string;
  sourceUrl: string;
  embedding?: number[]; // Vector for semantic search
}

export interface LeadRecord {
  id: string;
  companyName: string;
  contactName: string;
  email?: string;
  linkedinUrl?: string;
  lastContact: string;
  status: 'new' | 'contacted' | 'negotiating' | 'closed' | 'lost';
  notes: string;
  score?: number; // 0-100 relevance score
  embedding?: number[];
}

export interface KnowledgeBaseRecord {
  id: string;
  projectName: string;
  client: string;
  completionDate: string;
  summary: string;
  filePaths: string[];
  tags: string[];
  embedding?: number[];
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  vendorName: string;
  amount: number;
  currency: string;
  dueDate: string;
  processedAt: string;
  isDuplicate: boolean;
  isAnomaly: boolean;
  sheetsRowUrl?: string;
}

// ============================================================================
// Configuration & Settings
// ============================================================================

export interface EnterpriseConfig {
  modules: {
    [key in ModuleType]: {
      enabled: boolean;
      priority: number;
      rateLimits?: {
        requestsPerHour?: number;
        requestsPerDay?: number;
      };
    };
  };
  storage: {
    lancedbPath: string;
    tempDataPath: string; // For HR/sensitive data
    encryptionEnabled: boolean;
  };
  integrations: {
    googleWorkspace?: {
      sheetsEnabled: boolean;
      gmailEnabled: boolean;
      driveEnabled: boolean;
    };
    externalAPIs?: {
      linkedinScraping: boolean;
      trackingAPIs: string[]; // ['gls', 'dpd', etc.]
    };
  };
}

// ============================================================================
// Utility Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface ApprovalRequest {
  id: string;
  eventId: string;
  module: ModuleType;
  action: string;
  description: string;
  data: unknown;
  requestedAt: string;
  expiresAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
}
