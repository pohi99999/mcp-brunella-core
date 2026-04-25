import { fileURLToPath } from 'url';
import path from 'path';

/**
 * PathResolver - Dinamikus útvonal feloldó a monorepohoz.
 * Segít elkerülni a 'path drift' problémákat a process.cwd() használata helyett.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// A packages/utils/pathResolver.ts helyzetéből adódóan a gyökér két szinttel feljebb van
export const PROJECT_ROOT = path.resolve(__dirname, '../../');

/**
 * Felold egy relatív útvonalat a projekt gyökeréhez képest abszolút útvonallá.
 * @param relative A projekt gyökeréhez képest megadott relatív útvonal.
 * @returns Abszolút útvonal a fájlrendszeren.
 */
export const resolvePath = (relative: string): string => {
  return path.resolve(PROJECT_ROOT, relative);
};
