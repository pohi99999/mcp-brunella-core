/**
 * src/core/knowledgeSuperstructure.ts
 *
 * A Knowledge Superstructure komponens: 
 * A meglévő LanceDB / RAG vektor store fölé épülő réteg, amely
 * kontextuális hidakat képez és szemantikus következtetéseket von le.
 */

import { logInfo, logError } from '@packages/utils/logger.js';

export interface SemanticConcept {
  id: string;
  name: string;
  description: string;
  relatedConceptIds: string[];
  abstractionLevel: number;
}

export class KnowledgeSuperstructure {
  private concepts: Map<string, SemanticConcept> = new Map();

  constructor() {
    logInfo('KnowledgeSuperstructure initialized');
  }

  public addConcept(concept: SemanticConcept): void {
    this.concepts.set(concept.id, concept);
    logInfo('KnowledgeSuperstructure', `Added concept: ${concept.name} at abstraction level ${concept.abstractionLevel}`);
  }

  public getConcept(id: string): SemanticConcept | undefined {
    return this.concepts.get(id);
  }

  /**
   * Következtető motor: Keres egy utat két koncepció között a gráfban.
   */
  public findSemanticBridge(startId: string, targetId: string, maxDepth: number = 3): string[] | null {
    const visited = new Set<string>();
    const queue: { currentId: string; path: string[] }[] = [{ currentId: startId, path: [startId] }];

    while (queue.length > 0) {
      const { currentId, path } = queue.shift()!;

      if (path.length > maxDepth) {
        continue;
      }

      if (currentId === targetId) {
        return path;
      }

      visited.add(currentId);

      const concept = this.concepts.get(currentId);
      if (concept) {
        for (const relatedId of concept.relatedConceptIds) {
          if (!visited.has(relatedId)) {
            queue.push({ currentId: relatedId, path: [...path, relatedId] });
          }
        }
      }
    }

    return null;
  }

  /**
   * Absztrakciós emelés: Magasabb szintű fogalmak keresése, amik hivatkoznak egy adott fogalomra.
   */
  public synthesizeAbstraction(conceptId: string): SemanticConcept[] {
    const higherConcepts: SemanticConcept[] = [];
    const baseConcept = this.concepts.get(conceptId);

    if (!baseConcept) return [];

    const values = Array.from(this.concepts.values());
    for (const concept of values) {
      if (
        concept.abstractionLevel > baseConcept.abstractionLevel &&
        concept.relatedConceptIds.includes(conceptId)
      ) {
        higherConcepts.push(concept);
      }
    }

    return higherConcepts;
  }
}

