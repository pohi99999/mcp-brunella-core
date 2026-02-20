/**
 * EV Hunter & AI Research pipeline teszt
 * Ellenőrzi a fájlok és schema létezését.
 */
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
describe('EV Hunter AI Research', () => {
    it('should have integrated_research.py', () => {
        expect(existsSync(path.join(ROOT, 'myai/tools/integrated_research.py'))).toBe(true);
    });
    it('should have market_researcher.py', () => {
        expect(existsSync(path.join(ROOT, 'myai/agents/ev_hunter/market_researcher.py'))).toBe(true);
    });
    it('should have schemas.py with MarketTrend', () => {
        const schemasPath = path.join(ROOT, 'myai/schemas.py');
        expect(existsSync(schemasPath)).toBe(true);
        const content = readFileSync(schemasPath, 'utf-8');
        expect(content).toContain('MarketTrend');
    });
    it('should have mega_orchestrator.py', () => {
        expect(existsSync(path.join(ROOT, 'myai/agents/ev_hunter/mega_orchestrator.py'))).toBe(true);
    });
});
