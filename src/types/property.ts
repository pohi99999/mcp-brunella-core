/**
 * Property Types – Real Estate Sales Campaign
 * Track: real_estate_sales_campaign_20260216 – Phase 1
 *
 * Tükrözi a Python myai/core/vision_worker.py Pydantic modelljeit.
 */

// ── Alapvető enum-ok ─────────────────────────────────────────────────────────

export type PropertyType =
  | 'apartment' | 'house' | 'land' | 'commercial' | 'industrial' | 'storage' | 'other'
  // Legacy (backward-compat)
  | 'Apartment' | 'House' | 'Commercial' | 'Land' | 'Industrial' | 'Other';

export type PropertyCondition = 'New' | 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Renovation Required';

export type OcrQuality = 'good' | 'medium' | 'poor' | 'unknown';

export type ValuationRecommendation = 'BUY' | 'HOLD' | 'INVESTIGATE' | 'PASS';

// ── Közmű ────────────────────────────────────────────────────────────────────

export interface PropertyUtilities {
  electricity: boolean;
  gas: boolean;
  water: boolean;
  sewage: boolean;
  internet: boolean;
  notes?: string;
}

// ── Cím ──────────────────────────────────────────────────────────────────────

export interface PropertyAddress {
  country: string;       // ISO-2, pl. "HU"
  zip_code: string;
  city: string;
  street: string;
  house_number: string;
  floor?: string;
  formatted: string;     // Emberi olvasásra kész formátum
}

// ── Fő PropertyAsset ─────────────────────────────────────────────────────────

export interface PropertyAsset {
  id: string;
  source_file: string;
  extracted_at: string;   // ISO datetime

  // Azonosítók
  hrsz: string;
  ownership_id?: string;
  land_registry_number?: string;

  // Típus
  property_type: PropertyType;
  sub_type?: string;

  // Méret
  area_sqm?: number;
  lot_size_sqm?: number;
  rooms?: number;
  floors?: number;
  floor_level?: number;

  // Cím (nested)
  address: PropertyAddress;

  // Közmű
  utilities: PropertyUtilities;

  // Pénzügy
  asking_price_eur?: number;
  estimated_value_eur?: number;
  price_per_sqm_eur?: number;

  // Jogi státusz
  legal_status?: string;
  encumbrances: string[];

  // Építési adatok
  year_built?: number;
  last_renovation?: number;
  energy_class?: string;   // pl. "BB", "CC"

  // Leírás, nyers szöveg
  description?: string;
  notes?: string;
  raw_text?: string;

  // Minőség
  confidence: number;       // 0.0 – 1.0
  ocr_quality: OcrQuality;

  // Legacy (backward-compat)
  condition?: PropertyCondition;
  features?: Array<{ name: string; value: string }>;
  images?: string[];
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

// ── Vision Worker kérés / válasz ─────────────────────────────────────────────

export interface VisionRequest {
  file_path: string;
  mock?: boolean;
  output_format?: 'json' | 'markdown';
  language?: string;
}

export interface VisionResponse {
  success: boolean;
  file_path: string;
  asset?: PropertyAsset;
  raw_text?: string;
  error?: string;
  duration_seconds: number;
}

// ── Értékelés ────────────────────────────────────────────────────────────────

export interface PropertyValuation {
  // v2 – sales campaign
  asset_id?: string;
  hrsz?: string;
  asking_price_eur?: number;
  estimated_value_eur?: number;
  price_per_sqm_eur?: number;
  recommendation?: ValuationRecommendation;
  reasoning?: string;
  comparables_count?: number;
  valuation_date?: string;

  // Legacy (backward-compat)
  id?: string;
  propertyId?: string;
  valuationDate?: string;
  estimatedValue?: number;
  currency?: string;
  confidenceScore?: number;
  confidence?: number;
  range?: { min: number; max: number };
  comparables?: string[];
  marketAnalysis?: {
    trends: string[];
    demandLevel: 'High' | 'Medium' | 'Low';
    supplyLevel: 'High' | 'Medium' | 'Low';
    priceTrend: 'Rising' | 'Stable' | 'Falling';
  };
  methodology?: string;
  notes?: string;
}

// ── PropertyAnalystAgent kimenet ──────────────────────────────────────────────

export interface PropertyAnalysisResult {
  asset: PropertyAsset;
  valuation?: PropertyValuation;
  comparable_properties?: PropertyAsset[];
  market_summary?: string;
  action_items?: string[];
  generated_at: string;
}

// ── CRM Lead ─────────────────────────────────────────────────────────────────

export interface PropertyLead {
  id: string;
  asset_id: string;
  company_name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  source: string;         // "linkedin", "ceginfo", "manual"
  status: 'new' | 'contacted' | 'responded' | 'rejected' | 'closed';
  notes?: string;
  created_at: string;
  updated_at: string;
}
