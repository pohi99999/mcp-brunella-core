import { describe, expect, it } from 'vitest';
import { resolveAgentExport } from '@packages/agents/agentLoader.js';

class DefaultAgentMock {
  constructor(_config?: Record<string, unknown>) {}
}

class NamedAgentMock {
  constructor(_config?: Record<string, unknown>) {}
}

class FallbackAgentMock {
  constructor(_config?: Record<string, unknown>) {}
}

describe('resolveAgentExport', () => {
  it('prefers the configured named class export when available', () => {
    const resolved = resolveAgentExport(
      {
        default: DefaultAgentMock,
        NamedAgentMock,
      },
      'NamedAgentMock',
    );

    expect(resolved.AgentClass).toBe(NamedAgentMock);
    expect(resolved.exportName).toBe('NamedAgentMock');
    expect(resolved.strategy).toBe('class-name');
  });

  it('falls back to default export when configured class export is missing', () => {
    const resolved = resolveAgentExport(
      {
        default: DefaultAgentMock,
      },
      'MissingAgent',
    );

    expect(resolved.AgentClass).toBe(DefaultAgentMock);
    expect(resolved.exportName).toBe('default');
    expect(resolved.strategy).toBe('default');
  });

  it('uses the first constructable named export when no default export exists', () => {
    const resolved = resolveAgentExport(
      {
        helper: 'not-a-class',
        FallbackAgentMock,
      },
      'MissingAgent',
    );

    expect(resolved.AgentClass).toBe(FallbackAgentMock);
    expect(resolved.exportName).toBe('FallbackAgentMock');
    expect(resolved.strategy).toBe('first-constructable');
  });

  it('throws a diagnostic error when no constructable export exists', () => {
    expect(() =>
      resolveAgentExport(
        {
          helper: 'nope',
          metadata: { ok: true },
        },
        'BrokenAgent',
      ),
    ).toThrowError(
      /No constructable agent export found\. Expected class export: BrokenAgent\. Available exports: helper, metadata/,
    );
  });
});