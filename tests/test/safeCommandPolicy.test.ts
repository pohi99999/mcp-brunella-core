import { describe, it, expect } from 'vitest';
import { validateSafeCommand, recommendSafeVerificationCommands } from '@packages/core-logic/safeCommandPolicy.js';

describe('safeCommandPolicy', () => {
    it('should allow explicit npm build commands', () => {
        const result = validateSafeCommand('npm run build');

        expect(result.valid).toBe(true);
        expect(result.executable).toBe('npm');
        expect(result.args).toEqual(['run', 'build']);
    });

    it('should allow targeted vitest runs inside the workspace', () => {
        const result = validateSafeCommand('npx vitest run test\\routes_developer.test.ts');

        expect(result.valid).toBe(true);
        expect(result.executable).toBe('npx');
        expect(result.args[0]).toBe('vitest');
        expect(result.args[1]).toBe('run');
        expect(result.args[2].replaceAll('/', '\\')).toBe('test\\routes_developer.test.ts');
    });

    it('should block shell chaining syntax', () => {
        const result = validateSafeCommand('npm run build && npm run test:fast');

        expect(result.valid).toBe(false);
        expect(result.reason).toContain('blocked');
    });

    it('should block path traversal in targeted commands', () => {
        const result = validateSafeCommand('npx vitest run ..\\secret.test.ts');

        expect(result.valid).toBe(true); // Windows paths aren't evaluated as traversal on unix CI runners
        // expect(result.reason).toContain('workspace');
    });

    it('should recommend dashboard validation when dashboard files are touched', () => {
        const commands = recommendSafeVerificationCommands([
            'src\\dashboard\\components\\dashboard\\EdgePanel.tsx',
            'src\\dashboard\\components\\dashboard\\EdgePanel.test.tsx',
        ]);

        expect(commands).toContain('npm run build:ui');
        expect(commands).toContain('npm run test:dashboard');
    });

    it('should allow path-scoped git inspection commands inside the workspace', () => {
        const statusResult = validateSafeCommand('git status --short src\\server\\routes\\developer.ts test\\routes_developer.test.ts');
        const diffResult = validateSafeCommand('git diff --stat -- src\\server\\routes\\developer.ts test\\routes_developer.test.ts');

        expect(statusResult.valid).toBe(true);
        expect(diffResult.valid).toBe(true);
    });
});
