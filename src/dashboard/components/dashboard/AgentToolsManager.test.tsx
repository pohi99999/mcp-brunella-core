import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { AgentToolsManager } from './AgentToolsManager';

describe('AgentToolsManager', () => {
  it('renders safely with empty defaults when no props are provided', async () => {
    render(<AgentToolsManager />);

    expect(screen.getByText(/Agent Tool Kezelő/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('get_server_status')).toBeInTheDocument();
    });
  });
});
