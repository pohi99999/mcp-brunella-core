
export interface PropertyFeature {
  name: string;
  value: string | number | boolean;
  description?: string;
}

export type PropertyType = 
  | 'Apartment'
  | 'House'
  | 'Commercial'
  | 'Land'
  | 'Industrial'
  | 'Other';

export type PropertyCondition = 
  | 'New'
  | 'Excellent'
  | 'Good'
  | 'Fair'
  | 'Poor'
  | 'Renovation Required';

export interface ComparableProperty {
  id?: string;
  address: string;
  price: number;
  soldDate?: string; // ISO 8601
  type: PropertyType;
  condition: PropertyCondition;
  features: PropertyFeature[];
  distance?: number; // Distance in meters
}

export interface MarketAnalysis {
  trends: string[];
  demandLevel: 'High' | 'Medium' | 'Low';
  supplyLevel: 'High' | 'Medium' | 'Low';
  averageDaysOnMarket?: number;
  priceTrend: 'Rising' | 'Stable' | 'Falling';
}

export interface PropertyValuation {
  id: string;
  propertyId: string;
  valuationDate: string; // ISO 8601
  estimatedValue: number;
  currency: string;
  confidenceScore: number; // 0-1
  range: {
    min: number;
    max: number;
  };
  comparables: ComparableProperty[];
  marketAnalysis: MarketAnalysis;
  methodology: string;
  notes?: string;
}

export interface PropertyAsset {
  id: string;
  address: string;
  type: PropertyType;
  condition: PropertyCondition;
  features: PropertyFeature[];
  images?: string[]; // URLs or paths
  valuations?: PropertyValuation[];
  metadata?: Record<string, unknown>;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface PropertyAnalysisResult {
  asset: PropertyAsset;
  valuation: PropertyValuation;
  rawAnalysis?: string; // The raw LLM/Vision output
  embedding?: number[]; // For vector search
}
