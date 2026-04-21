import { describe, it, expect } from 'vitest';
import principles from '../src/data/triz_principles.json';
import matrixData from '../src/data/triz_matrix.json';

describe('TRIZ Knowledge Base', () => {
  it('should have all 40 principles', () => {
    expect(principles).toHaveLength(40);
    expect(principles[0]).toHaveProperty('id', 1);
    expect(principles[39]).toHaveProperty('id', 40);
  });

  it('should have 39 technical parameters', () => {
    expect(matrixData.parameters).toHaveLength(39);
  });

  it('should only reference existing principles in the matrix', () => {
    const principleIds = new Set(principles.map(p => p.id));
    
    Object.values(matrixData.matrix).forEach(row => {
      Object.values(row).forEach(principleList => {
        (principleList as number[]).forEach(id => {
          expect(principleIds.has(id)).toBe(true);
        });
      });
    });
  });

  it('should have valid parameter indices in the matrix keys', () => {
    const paramCount = matrixData.parameters.length;
    
    Object.keys(matrixData.matrix).forEach(key => {
      const idx = parseInt(key);
      expect(idx).toBeGreaterThanOrEqual(1);
      expect(idx).toBeLessThanOrEqual(paramCount);
    });
  });
});
