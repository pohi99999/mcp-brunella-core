import { describe, it, expect } from 'vitest';

describe('Input Sanitization & Validation', () => {
    // Helper: simulate what an agent input parser should do
    function sanitizeInput(input: string): { valid: boolean; sanitized: string; reason?: string } {
        // Empty input
        if (!input || input.trim().length === 0) {
            return { valid: false, sanitized: '', reason: 'Üres bemenet — nincs mit feldolgozni' };
        }

        // Maximum length check (100K chars)
        const MAX_INPUT_LENGTH = 100_000;
        if (input.length > MAX_INPUT_LENGTH) {
            return { valid: false, sanitized: input.slice(0, MAX_INPUT_LENGTH), reason: `Bemenet túl hosszú (${input.length} > ${MAX_INPUT_LENGTH})` };
        }

        // Shell injection patterns
        const shellPatterns = [
            /`[^`]*`/g,             // backtick execution
            /\$\([^)]*\)/g,         // $() subshell
            /;\s*(rm|del|format|shutdown|kill|dd)\b/gi, // destructive commands after semicolon
            /\|\s*(rm|del|format)\b/gi,  // pipe to destructive
        ];
        let sanitized = input;
        for (const pattern of shellPatterns) {
            sanitized = sanitized.replace(pattern, '[SANITIZED]');
        }

        // SQL injection patterns
        const sqlPatterns = [
            /;\s*DROP\s+TABLE/gi,
            /;\s*DELETE\s+FROM/gi,
            /;\s*UPDATE\s+.*SET/gi,
            /'\s*OR\s+'1'\s*=\s*'1/gi,
            /UNION\s+SELECT/gi,
        ];
        for (const pattern of sqlPatterns) {
            sanitized = sanitized.replace(pattern, '[SQL_SANITIZED]');
        }

        return { valid: true, sanitized };
    }

    it('should reject empty input', () => {
        const result = sanitizeInput('');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Üres');
    });

    it('should reject whitespace-only input', () => {
        const result = sanitizeInput('   \n\t  ');
        expect(result.valid).toBe(false);
    });

    it('should reject input exceeding 100K characters', () => {
        const longInput = 'a'.repeat(100_001);
        const result = sanitizeInput(longInput);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('túl hosszú');
        expect(result.sanitized.length).toBe(100_000);
    });

    it('should accept normal task descriptions', () => {
        const normalInputs = [
            'Írj Unit tesztet a file.ts-hez',
            'Keress információt a React 19 újdonságokról',
            'Generálj egy REST API-t Express-szel',
            'Futtasd le a build-et és ellenőrizd a hibákat',
        ];

        for (const input of normalInputs) {
            const result = sanitizeInput(input);
            expect(result.valid).toBe(true);
            expect(result.sanitized).toBe(input); // No changes needed
        }
    });

    it('should sanitize shell injection attempts', () => {
        const injections = [
            '`rm -rf /`',
            'hello; rm -rf /',
            'task | rm something',
            'test $(shutdown -h now)',
        ];

        for (const input of injections) {
            const result = sanitizeInput(input);
            expect(result.valid).toBe(true); // Accepted but sanitized
            expect(result.sanitized).toContain('[SANITIZED]');
            expect(result.sanitized).not.toContain('rm -rf');
        }
    });

    it('should sanitize SQL injection attempts', () => {
        const injections = [
            "'; DROP TABLE audit_log; --",
            "' OR '1'='1",
            "1 UNION SELECT * FROM users",
            "; DELETE FROM tasks WHERE 1=1",
        ];

        for (const input of injections) {
            const result = sanitizeInput(input);
            expect(result.sanitized).toContain('[SQL_SANITIZED]');
        }
    });

    it('should allow code-like content that looks similar to injection', () => {
        const codeContent = [
            'CREATE TABLE users (id INT, name TEXT)',          // normal SQL
            'console.log("hello; world")',                      // semicolon in string
            "const x = 'test'",                                // normal quotes
        ];

        for (const input of codeContent) {
            const result = sanitizeInput(input);
            expect(result.valid).toBe(true);
        }
    });

    it('should handle Hungarian characters correctly', () => {
        const result = sanitizeInput('Árvíztűrő tükörfúrógép — ez egy teszt ékezetes bemenet');
        expect(result.valid).toBe(true);
        expect(result.sanitized).toContain('Árvíztűrő');
    });

    it('should handle JSON-like input', () => {
        const jsonInput = JSON.stringify({ task: 'generate', file: 'test.ts', options: { verbose: true } });
        const result = sanitizeInput(jsonInput);
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe(jsonInput);
    });
});

describe('Agent Response Schema Validation', () => {
    interface AgentResponse {
        status: 'success' | 'error' | 'delegated';
        result?: unknown;
        error?: string;
        data?: unknown;
    }

    function validateAgentResponse(response: unknown): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (typeof response !== 'object' || response === null) {
            return { valid: false, errors: ['Response is not an object'] };
        }

        const resp = response as Record<string, unknown>;

        if (!resp.status || !['success', 'error', 'delegated'].includes(resp.status as string)) {
            errors.push(`Invalid status: ${resp.status} (expected: success|error|delegated)`);
        }

        if (resp.status === 'error' && !resp.error && !resp.message) {
            errors.push('Error response missing error/message field');
        }

        return { valid: errors.length === 0, errors };
    }

    it('should validate correct success response', () => {
        const result = validateAgentResponse({ status: 'success', result: 'done' });
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('should validate correct error response', () => {
        const result = validateAgentResponse({ status: 'error', error: 'Something failed' });
        expect(result.valid).toBe(true);
    });

    it('should reject missing status field', () => {
        const result = validateAgentResponse({ result: 'no status' });
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('Invalid status');
    });

    it('should reject non-object responses', () => {
        expect(validateAgentResponse(null).valid).toBe(false);
        expect(validateAgentResponse('just a string').valid).toBe(false);
        expect(validateAgentResponse(42).valid).toBe(false);
    });

    it('should reject error response without error message', () => {
        const result = validateAgentResponse({ status: 'error' });
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('missing error/message');
    });

    it('should accept delegated status', () => {
        const result = validateAgentResponse({ status: 'delegated', data: { target: 'Developer' } });
        expect(result.valid).toBe(true);
    });
});
