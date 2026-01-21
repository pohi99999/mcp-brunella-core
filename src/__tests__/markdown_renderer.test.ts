// Mock chalk to avoid ESM issues and verify calls
jest.mock('chalk', () => {
    const chalkMock = {
        bold: Object.assign((text: any) => `[BOLD]${text}[/BOLD]`, {
            underline: (text: any) => `[HEADER]${text}[/HEADER]`
        }),
        italic: (text: any) => `[ITALIC]${text}[/ITALIC]`,
        bgGray: (text: any) => `[CODE]${text}[/CODE]`,
    };
    return {
        __esModule: true,
        default: chalkMock
    };
});

import { renderMarkdown } from '../utils/markdown_renderer.js';

describe('Markdown Renderer', () => {
    it('should render bold text', () => {
        const input = '**bold**';
        const output = renderMarkdown(input);
        expect(output).toContain('[BOLD]bold[/BOLD]');
    });

    it('should render italic text', () => {
        const input = '*italic*';
        const output = renderMarkdown(input);
        expect(output).toContain('[ITALIC]italic[/ITALIC]');
    });

    it('should render code blocks', () => {
        const input = '```\nconst x = 1;\n```';
        const output = renderMarkdown(input);
        expect(output).toContain('[CODE]');
        expect(output).toContain('const x = 1;');
        expect(output).toContain('[/CODE]');
    });

    it('should render headers', () => {
        const input = '# Header';
        const output = renderMarkdown(input);
        expect(output).toContain('[HEADER]Header[/HEADER]');
    });
});
