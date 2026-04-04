import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PythonWorkersPanel from './PythonWorkersPanel';

describe('PythonWorkersPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads worker availability from the v1 status endpoint', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'success',
        workers: [
          { name: 'ocr', available: true },
          { name: 'scraper', available: false },
          { name: 'lancedb-batch', available: true },
        ],
      }),
    } as Response);

    render(<PythonWorkersPanel />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/python-workers/status');
    });

    expect((await screen.findAllByText('OCR Worker')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Web Scraper').length).toBeGreaterThan(0);
    expect(screen.getAllByText('LanceDB Batch').length).toBeGreaterThan(0);
  });

  it('submits OCR runs to the v1 worker endpoint', async () => {
    const fetchMock = vi.spyOn(global, 'fetch');
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          workers: [{ name: 'ocr', available: true }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { text: 'hello world' },
        }),
      } as Response);

    render(<PythonWorkersPanel />);

    await screen.findAllByText('OCR Worker');
    fireEvent.change(screen.getByPlaceholderText('data/invoice.png'), {
      target: { value: 'data/test.png' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Run OCR/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/v1/python-workers/ocr',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
  });
});
