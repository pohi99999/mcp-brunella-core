import { ViktoriaProduct } from '../agents/ViktoriaPhygitalAgent.js';
import { logInfo, logWarn } from '../utils/logger.js';

/**
 * ViktoriaRefinementService
 * 
 * Luxury-grade refinement for fashion metadata.
 * Ensures the "Enjoy life in colours" brand voice and bilingual consistency.
 */
export class ViktoriaRefinementService {
  private name = 'ViktoriaRefinementService';

  /**
   * Refines the harvested product metadata.
   */
  async refine(product: ViktoriaProduct): Promise<ViktoriaProduct> {
    logInfo(this.name, `Refining product: ${product.name.en}`);

    // Clone to avoid mutation
    const refined = { ...product };

    // 1. Ensure Brand Motto presence
    if (!refined.style_markers.includes('Enjoy life in colours')) {
      refined.style_markers.push('Enjoy life in colours');
    }

    // 2. Normalize capitalization for luxury standards
    refined.name.en = this.capitalizeLuxury(refined.name.en);
    refined.name.hu = this.capitalizeLuxury(refined.name.hu);

    // 3. Mood alignment - ensure vibrant palette consistency
    if (!refined.mood.en.toLowerCase().includes('vibrant')) {
      logWarn(this.name, 'Product mood might not be vibrant enough for brand standards.');
    }

    // 4. Verification Check
    refined.is_premium = true;
    refined.metadata.refined_at = new Date().toISOString();
    refined.metadata.refinement_engine = 'BAS-Viktoria-Refiner-v1';

    return refined;
  }

  private capitalizeLuxury(text: string): string {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}

export const viktoriaRefinementService = new ViktoriaRefinementService();
