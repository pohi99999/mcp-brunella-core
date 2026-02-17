export type PropertyType = 'Apartment' | 'House' | 'Commercial' | 'Land' | 'Industrial' | 'Other';
export type PropertyCondition = 'New' | 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Renovation Required';

export interface PropertyAsset {
  id: string;
  address: string;
  type: PropertyType;
  condition: PropertyCondition;
  features: Array<{ name: string; value: string }>;
  images: string[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface PropertyValuation {
  id: string;
  propertyId: string;
  valuationDate: string;
  estimatedValue: number;
  currency: string;
  confidenceScore: number;
  range: {
    min: number;
    max: number;
  };
  comparables: string[];
  marketAnalysis: {
    trends: string[];
    demandLevel: 'High' | 'Medium' | 'Low';
    supplyLevel: 'High' | 'Medium' | 'Low';
    priceTrend: 'Rising' | 'Stable' | 'Falling';
  };
  methodology: string;
  notes?: string;
}
