import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ToolDiscoveryPanel from './ToolDiscoveryPanel';

describe('ToolDiscoveryPanel', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('normalizes missing numeric stats without crashing', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          {
            id: 'tool-1',
            name: 'memory-sync',
            version: '1.0.0',
            totalCalls: 3,
          },
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalTools: 1,
          totalCalls: 3,
        }),
      });

    render(<ToolDiscoveryPanel />);

    await waitFor(() => {
      expect(screen.getByText('memory-sync')).toBeInTheDocument();
      expect(screen.getAllByText('0ms').length).toBeGreaterThan(0);
    });
  });
});
