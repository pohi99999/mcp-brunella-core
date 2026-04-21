import { describe, it, expect } from 'vitest';
import { parseTrackTodos, toggleTodoInContent, findTodoLineNumber, } from '../src/utils/trackTodoParser.js';
describe('TrackTodoParser', () => {
    const sampleTrackMd = `# Track: Test Track

**Status:** active

## Implementation Plan

- [ ] Task 1
- [x] Task 2 (completed)
- [ ] Task 3
  - [ ] Subtask 3.1
- [X] Task 4 (uppercase X)

## Other Content

Some other content here.
`;
    describe('parseTrackTodos', () => {
        it('should parse track title', () => {
            const result = parseTrackTodos(sampleTrackMd, 'test-track');
            expect(result.trackTitle).toBe('Track: Test Track');
        });
        it('should parse track status', () => {
            const result = parseTrackTodos(sampleTrackMd, 'test-track');
            expect(result.status).toBe('active');
        });
        it('should parse all checkboxes', () => {
            const result = parseTrackTodos(sampleTrackMd, 'test-track');
            expect(result.todos).toHaveLength(5);
        });
        it('should correctly identify completed state', () => {
            const result = parseTrackTodos(sampleTrackMd, 'test-track');
            expect(result.todos[0].completed).toBe(false); // [ ]
            expect(result.todos[1].completed).toBe(true); // [x]
            expect(result.todos[2].completed).toBe(false); // [ ]
            expect(result.todos[3].completed).toBe(false); // [ ] (subtask)
            expect(result.todos[4].completed).toBe(true); // [X] (uppercase)
        });
        it('should calculate progress correctly', () => {
            const result = parseTrackTodos(sampleTrackMd, 'test-track');
            // 2 completed out of 5 = 40%
            expect(result.progress).toBe(40);
        });
        it('should generate stable IDs', () => {
            const result1 = parseTrackTodos(sampleTrackMd, 'test-track');
            const result2 = parseTrackTodos(sampleTrackMd, 'test-track');
            expect(result1.todos[0].id).toBe(result2.todos[0].id);
        });
        it('should handle empty content', () => {
            const result = parseTrackTodos('', 'test-track');
            expect(result.todos).toHaveLength(0);
            expect(result.progress).toBe(0);
        });
    });
    describe('toggleTodoInContent', () => {
        it('should toggle unchecked to checked', () => {
            const result = toggleTodoInContent(sampleTrackMd, 7);
            expect(result).toContain('- [x] Task 1');
        });
        it('should toggle checked to unchecked', () => {
            const result = toggleTodoInContent(sampleTrackMd, 8);
            expect(result).toContain('- [ ] Task 2 (completed)');
        });
        it('should preserve indentation', () => {
            const result = toggleTodoInContent(sampleTrackMd, 10);
            expect(result).toContain('  - [x] Subtask 3.1');
        });
        it('should throw error for invalid line number', () => {
            expect(() => toggleTodoInContent(sampleTrackMd, 999)).toThrow('Invalid line number');
        });
        it('should throw error for non-checkbox line', () => {
            expect(() => toggleTodoInContent(sampleTrackMd, 1)).toThrow('No checkbox found');
        });
    });
    describe('findTodoLineNumber', () => {
        it('should find correct line number by ID', () => {
            const parsed = parseTrackTodos(sampleTrackMd, 'test-track');
            const firstTodoId = parsed.todos[0].id;
            const lineNumber = findTodoLineNumber(sampleTrackMd, firstTodoId);
            expect(lineNumber).toBe(7);
        });
        it('should throw error for non-existent ID', () => {
            expect(() => findTodoLineNumber(sampleTrackMd, 'invalid-id')).toThrow('TODO not found');
        });
    });
});
