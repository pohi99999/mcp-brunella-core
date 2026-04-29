/**
 * Response Formatter - Magyar nyelvű válaszok tesztelése
 */
import { describe, it, expect } from 'vitest';
import { formatAgentResponse, formatAgentResult, formatResponse, specialFormatters } from '@packages/utils/responseFormatter.js';
describe('Response Formatter - Magyar nyelvű válaszok', () => {
    describe('formatAgentResponse', () => {
        it('should format success response in Hungarian', () => {
            const response = {
                status: 'success',
                message: 'A fájl sikeresen létrehozva',
                data: { filePath: '/test/file.txt', size: 1024 }
            };
            const formatted = formatAgentResponse(response, 'TestAgent', { useEmojis: true });
            expect(formatted).toContain('🤖 **TestAgent:**');
            expect(formatted).toContain('✅');
            expect(formatted).toContain('Sikeresen végrehajtva');
            expect(formatted).toContain('A fájl sikeresen létrehozva');
        });
        it('should format error response in Hungarian', () => {
            const response = {
                status: 'error',
                error: 'Nem található a fájl'
            };
            const formatted = formatAgentResponse(response, 'TestAgent', { useEmojis: true });
            expect(formatted).toContain('🤖 **TestAgent:**');
            expect(formatted).toContain('❌');
            expect(formatted).toContain('Nem sikerült a művelet');
            expect(formatted).toContain('Nem található a fájl');
        });
        it('should format delegated response in Hungarian', () => {
            const response = {
                status: 'delegated',
                delegatedTo: 'DeveloperAgent',
                message: 'Kódírás szükséges'
            };
            const formatted = formatAgentResponse(response, 'OrchestratorAgent', { useEmojis: true });
            expect(formatted).toContain('🤖 **OrchestratorAgent:**');
            expect(formatted).toContain('🔄');
            expect(formatted).toContain('Kódírás szükséges');
        });
    });
    describe('formatAgentResult', () => {
        it('should format successful AgentResult in Hungarian', () => {
            const result = {
                success: true,
                message: 'Kód sikeresen létrehozva',
                data: {
                    filesModified: 2,
                    linesAdded: 150
                }
            };
            const formatted = formatAgentResult(result, 'DeveloperAgent', { useEmojis: true });
            expect(formatted).toContain('🤖 **DeveloperAgent:**');
            expect(formatted).toContain('✅');
            expect(formatted).toContain('Sikeresen végrehajtva');
            expect(formatted).toContain('Kód sikeresen létrehozva');
        });
        it('should format failed AgentResult in Hungarian', () => {
            const result = {
                success: false,
                message: 'A build sikertelen volt'
            };
            const formatted = formatAgentResult(result, 'DeveloperAgent', { useEmojis: true });
            expect(formatted).toContain('🤖 **DeveloperAgent:**');
            expect(formatted).toContain('❌');
            expect(formatted).toContain('Nem sikerült a művelet');
            expect(formatted).toContain('A build sikertelen volt');
        });
    });
    describe('formatResponse - Universal formatter', () => {
        it('should handle string responses', () => {
            const response = 'Ez már egy formázott magyar szöveg';
            const formatted = formatResponse(response);
            expect(formatted).toBe(response);
        });
        it('should auto-detect AgentResponse type', () => {
            const response = {
                status: 'success',
                message: 'Sikeres művelet'
            };
            const formatted = formatResponse(response, 'AutoAgent');
            expect(formatted).toContain('Sikeresen végrehajtva');
        });
        it('should auto-detect AgentResult type', () => {
            const result = {
                success: true,
                message: 'Teszt sikerült'
            };
            const formatted = formatResponse(result, 'AutoAgent');
            expect(formatted).toContain('Sikeresen végrehajtva');
        });
    });
    describe('specialFormatters', () => {
        it('should format Robotkéz responses with steps', () => {
            const result = {
                success: true,
                message: 'Google keresés végrehajtva',
                data: {
                    plan: [
                        { description: 'Navigálás: google.com', status: 'completed' },
                        { description: 'Gépelés: "AI hírek"', status: 'completed' },
                        { description: 'Enter megnyomása', status: 'completed' }
                    ],
                    completedSteps: [
                        { status: 'completed' },
                        { status: 'completed' },
                        { status: 'completed' }
                    ]
                }
            };
            const formatted = specialFormatters.robotkez(result, { useEmojis: true });
            expect(formatted).toContain('🤖 **Robotkéz V2 - Végrehajtva**');
            expect(formatted).toContain('Végrehajtott lépések');
            expect(formatted).toContain('1. ✅ Navigálás: google.com');
            expect(formatted).toContain('2. ✅ Gépelés: "AI hírek"');
            expect(formatted).toContain('3. ✅ Enter megnyomása');
            expect(formatted).toContain('3/3 lépés sikeres');
        });
        it('should format Developer responses with file changes', () => {
            const result = {
                success: true,
                message: 'Új feature implementálva',
                data: {
                    filesModified: 5,
                    linesAdded: 250,
                    linesRemoved: 80
                }
            };
            const formatted = specialFormatters.developer(result, { useEmojis: true });
            expect(formatted).toContain('👨‍💻 **Developer Agent - Kód írva**');
            expect(formatted).toContain('Új feature implementálva');
            expect(formatted).toContain('**Módosított fájlok:** 5');
            expect(formatted).toContain('**Változtatások:** +250 / -80 sor');
        });
        it('should format Researcher responses with sources', () => {
            const result = {
                success: true,
                message: 'Kutatás kész: AI trendek 2026',
                data: {
                    sources: [
                        { title: 'GitHub Trending: AI Projects', url: 'https://github.com/trending' },
                        { title: 'Hugging Face Models', url: 'https://huggingface.co' },
                        { title: 'arXiv Papers', url: 'https://arxiv.org' }
                    ]
                }
            };
            const formatted = specialFormatters.researcher(result, { useEmojis: true });
            expect(formatted).toContain('🔍 **Researcher Agent - Kutatás kész**');
            expect(formatted).toContain('Kutatás kész: AI trendek 2026');
            expect(formatted).toContain('Források (3)');
            expect(formatted).toContain('1. GitHub Trending: AI Projects');
            expect(formatted).toContain('2. Hugging Face Models');
        });
    });
    describe('Data formatting', () => {
        it('should format complex nested data', () => {
            const response = {
                status: 'success',
                message: 'Elemzés kész',
                data: {
                    metrics: {
                        totalFiles: 150,
                        linesOfCode: 12500,
                        testCoverage: 85
                    },
                    agents: ['Developer', 'Tester', 'Researcher'],
                    quality: 'good'
                }
            };
            const formatted = formatAgentResponse(response, 'AnalyzerAgent', {
                useEmojis: true,
                verbose: true
            });
            expect(formatted).toContain('Elemzés kész');
            expect(formatted).toContain('Részletek');
        });
        it('should skip internal fields (_*, thoughts, contextUsed)', () => {
            const response = {
                status: 'success',
                message: 'OK',
                data: {
                    _internal: 'should be hidden',
                    thoughts: 'internal reasoning',
                    contextUsed: ['doc1', 'doc2'],
                    result: 'visible data'
                }
            };
            const formatted = formatAgentResponse(response, 'TestAgent', {
                useEmojis: false,
                verbose: true
            });
            expect(formatted).not.toContain('_internal');
            expect(formatted).not.toContain('thoughts');
            expect(formatted).not.toContain('contextUsed');
            expect(formatted).toContain('Result'); // Keys are capitalized in formatted output
        });
    });
    describe('Emoji control', () => {
        it('should work without emojis when disabled', () => {
            const response = {
                status: 'success',
                message: 'Sikeres'
            };
            const formatted = formatAgentResponse(response, 'TestAgent', { useEmojis: false });
            expect(formatted).not.toContain('🤖');
            expect(formatted).not.toContain('✅');
            expect(formatted).toContain('**Sikeresen végrehajtva!**');
            expect(formatted).toContain('Sikeres');
        });
    });
});
