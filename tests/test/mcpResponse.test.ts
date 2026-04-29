import { describe, expect, it } from 'vitest';
import { mcpCatch } from '@packages/utils/mcpResponse.js';

describe('mcpCatch', () => {
  it('normalizes string errors into readable responses', () => {
    const response = mcpCatch('boom', 'demo-tool');

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('[demo-tool] boom');
  });

  it('normalizes object-like errors using message', () => {
    const response = mcpCatch({ message: 'structured boom' }, 'demo-tool');

    expect(response.content[0].text).toContain('structured boom');
  });
});
