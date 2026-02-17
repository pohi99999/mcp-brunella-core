import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PropertyAnalystAgent } from '../src/agents/PropertyAnalystAgent.js';
import { globalPythonShell } from '../src/utils/pythonShell.js';
import { propertyDb } from '../src/utils/propertyDb.js';

vi.mock('../src/utils/pythonShell.js', () => ({
  globalPythonShell: {
    run: vi.fn(),
  },
}));

vi.mock('../src/utils/propertyDb.js', () => ({
  propertyDb: {
    init: vi.fn().mockResolvedValue(undefined),
    addValuation: vi.fn().mockResolvedValue(undefined),
    searchValuations: vi.fn().mockResolvedValue([]),
  },
}));

describe('PropertyAnalystAgent', () => {
  let agent: PropertyAnalystAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new PropertyAnalystAgent();
  });

  const scenarios = [
    {
      name: 'Apartment, Excellent',
      input: 'Analyze this apartment: https://example.com/apt.jpg',
      mockOutput: {
        type: 'Apartment',
        condition: 'Excellent',
        address: '123 Main St',
        features: [{ name: 'Bedrooms', value: 2 }],
        valuation: { estimatedValue: 500000, currency: 'USD', min: 480000, max: 520000, confidence: 0.9, methodology: 'AI' },
        marketAnalysis: { trends: ['Rising'], demandLevel: 'High', supplyLevel: 'Low' }
      }
    },
    {
      name: 'House, Renovation Required',
      input: 'Check this house: path/to/house.png',
      mockOutput: {
        type: 'House',
        condition: 'Renovation Required',
        address: '456 Elm St',
        features: [{ name: 'Area', value: '2000 sqft' }],
        valuation: { estimatedValue: 200000, currency: 'USD', min: 150000, max: 250000, confidence: 0.6, methodology: 'AI' },
        marketAnalysis: { trends: ['Stable'], demandLevel: 'Medium', supplyLevel: 'High' }
      }
    },
    {
      name: 'Commercial, Good',
      input: 'Analyze commercial property https://example.com/office.jpg',
      mockOutput: {
        type: 'Commercial',
        condition: 'Good',
        address: '789 Biz Ave',
        features: [{ name: 'Floors', value: 3 }],
        valuation: { estimatedValue: 1000000, currency: 'USD', min: 900000, max: 1100000, confidence: 0.8, methodology: 'Income' },
        marketAnalysis: { trends: ['Falling'], demandLevel: 'Low', supplyLevel: 'High' }
      }
    },
    {
      name: 'Land, New',
      input: 'Empty plot: https://example.com/land.jpg',
      mockOutput: {
        type: 'Land',
        condition: 'New',
        address: '0 Rural Rd',
        features: [{ name: 'Area', value: '1 acre' }],
        valuation: { estimatedValue: 50000, currency: 'USD', min: 40000, max: 60000, confidence: 0.7, methodology: 'Sales Comparison' },
        marketAnalysis: { trends: ['Stable'], demandLevel: 'Medium', supplyLevel: 'Medium' }
      }
    },
    {
      name: 'Industrial, Fair',
      input: 'Factory: https://example.com/factory.jpg',
      mockOutput: {
        type: 'Industrial',
        condition: 'Fair',
        address: '101 Ind Park',
        features: [{ name: 'Loading Docks', value: 2 }],
        valuation: { estimatedValue: 750000, currency: 'USD', min: 700000, max: 800000, confidence: 0.75, methodology: 'Cost Approach' },
        marketAnalysis: { trends: ['Rising'], demandLevel: 'High', supplyLevel: 'Medium' }
      }
    },
    {
      name: 'Other, Poor',
      input: 'Old shed: https://example.com/shed.jpg',
      mockOutput: {
        type: 'Other',
        condition: 'Poor',
        address: 'Backyard',
        features: [],
        valuation: { estimatedValue: 1000, currency: 'USD', min: 500, max: 1500, confidence: 0.4, methodology: 'Quick Estimate' },
        marketAnalysis: { trends: [], demandLevel: 'Low', supplyLevel: 'Low' }
      }
    },
    {
      name: 'Missing Valuation Data',
      input: 'Just a photo https://example.com/photo.jpg',
      mockOutput: {
        type: 'House',
        condition: 'Good',
        address: 'Unknown',
        features: [],
        valuation: {}, // Missing fields should be handled by defaults
        marketAnalysis: {}
      }
    },
    {
      name: 'High Confidence',
      input: 'Luxury condo https://example.com/lux.jpg',
      mockOutput: {
        type: 'Apartment',
        condition: 'Excellent',
        address: 'Penthouse',
        features: [{ name: 'View', value: 'Ocean' }],
        valuation: { estimatedValue: 2000000, currency: 'USD', min: 1900000, max: 2100000, confidence: 0.95, methodology: 'Market' },
        marketAnalysis: { trends: ['Booming'], demandLevel: 'High', supplyLevel: 'Low' }
      }
    },
    {
      name: 'Low Confidence',
      input: 'Blurry photo https://example.com/blur.jpg',
      mockOutput: {
        type: 'Other',
        condition: 'Fair',
        address: 'Unknown',
        features: [],
        valuation: { estimatedValue: 100000, currency: 'USD', min: 50000, max: 150000, confidence: 0.2, methodology: 'Guess' },
        marketAnalysis: { trends: [], demandLevel: 'Medium', supplyLevel: 'Medium' }
      }
    },
    {
      name: 'Currency EUR',
      input: 'Paris apartment https://example.com/paris.jpg',
      mockOutput: {
        type: 'Apartment',
        condition: 'Good',
        address: 'Paris, France',
        features: [],
        valuation: { estimatedValue: 400000, currency: 'EUR', min: 380000, max: 420000, confidence: 0.85, methodology: 'Sales' },
        marketAnalysis: { trends: ['Stable'], demandLevel: 'High', supplyLevel: 'Medium' }
      }
    }
  ];

  for (const scenario of scenarios) {
    it(`should handle scenario: ${scenario.name}`, async () => {
      vi.mocked(globalPythonShell.run).mockResolvedValue(JSON.stringify(scenario.mockOutput));
      
      // Agent initialization
      await agent.initialize();
      expect(propertyDb.init).toHaveBeenCalled();

      const result = await agent.execute(scenario.input);
      
      expect(result.status).toBe('success');
      expect(globalPythonShell.run).toHaveBeenCalled();
      expect(propertyDb.addValuation).toHaveBeenCalled();
      
      const callArgs = vi.mocked(propertyDb.addValuation).mock.calls[0];
      const valuation = callArgs[0];
      const asset = callArgs[1];
      
      expect(asset.type).toBe(scenario.mockOutput.type);
      expect(valuation.estimatedValue).toBe(scenario.mockOutput.valuation.estimatedValue || 0);
      
      // Check currency if present in mock output
      if (scenario.mockOutput.valuation.currency) {
          expect(valuation.currency).toBe(scenario.mockOutput.valuation.currency);
      }
    });
  }

  it('should return error if no image source provided', async () => {
    const result = await agent.execute('Analyze this property');
    expect(result.status).toBe('error');
    expect(result.message).toContain('No image source found');
  });

  it('should handle Python execution error', async () => {
    vi.mocked(globalPythonShell.run).mockRejectedValue(new Error('Python execution failed'));
    const result = await agent.execute('Analyze https://example.com/img.jpg');
    expect(result.status).toBe('error');
    expect(result.message).toContain('Python execution failed');
  });
  
  it('should handle JSON parse error from Python output', async () => {
      vi.mocked(globalPythonShell.run).mockResolvedValue('Not a JSON string');
      const result = await agent.execute('Analyze https://example.com/img.jpg');
      expect(result.status).toBe('error');
      expect(result.message).toContain('Failed to parse Python output');
  });
});
