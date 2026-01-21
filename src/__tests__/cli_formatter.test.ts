import { formatToolsTable, formatToolsJson } from '../utils/cli_formatter';

describe('CLI Formatter', () => {
    const mockTools = [
        {
            name: 'test_tool',
            description: 'A test tool description',
            inputSchema: {
                type: 'object',
                properties: {
                    arg1: { type: 'string' }
                }
            }
        },
        {
            name: 'another_tool',
            description: 'Another description',
            inputSchema: { type: 'object' }
        }
    ];

    describe('formatToolsTable', () => {
        it('should return a string containing tool names', () => {
            const output = formatToolsTable(mockTools);
            expect(output).toContain('test_tool');
            expect(output).toContain('another_tool');
        });

        it('should return a string containing descriptions', () => {
            const output = formatToolsTable(mockTools);
            expect(output).toContain('A test tool description');
            expect(output).toContain('Another description');
        });

        it('should use cli-table3 characters (checking for border parts)', () => {
            const output = formatToolsTable(mockTools);
            // cli-table3 default chars often include ─ │ ┌ ┐ └ ┘
            expect(output).toMatch(/[─│┌┐└┘]/);
        });
        
        it('should handle empty list gracefully', () => {
             const output = formatToolsTable([]);
             expect(output).toContain('No tools available');
        });
    });

    describe('formatToolsJson', () => {
        it('should return valid JSON string', () => {
            const output = formatToolsJson(mockTools);
            const parsed = JSON.parse(output);
            expect(parsed).toEqual(mockTools);
        });

        it('should be indented (pretty printed)', () => {
            const output = formatToolsJson(mockTools);
            expect(output).toContain('\n'); 
            expect(output).toContain('  ');
        });
    });
});
