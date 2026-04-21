import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const { verifyRemoteTokenMock } = vi.hoisted(() => ({
  verifyRemoteTokenMock: vi.fn(),
}));

vi.mock('../src/security/remoteAuth.js', () => ({
  verifyRemoteToken: verifyRemoteTokenMock,
}));

type MiddlewareModule = typeof import('../src/server/middleware.js');

function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    socket: { remoteAddress: '203.0.113.10' },
    ip: '203.0.113.10',
    ...overrides,
  } as unknown as Request;
}

function createResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };

  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);

  return response as unknown as Response;
}

describe('requireOperatorAccess', () => {
  let requireOperatorAccess: MiddlewareModule['requireOperatorAccess'];
  let isLoopbackRequest: MiddlewareModule['isLoopbackRequest'];

  beforeEach(async () => {
    vi.resetModules();
    verifyRemoteTokenMock.mockReset();
    delete process.env.BRUNELLA_API_KEY;

    ({ requireOperatorAccess, isLoopbackRequest } = await import('../src/server/middleware.js'));
  });

  it('allows valid remote bearer tokens and stores remote claims on the request', () => {
    const claims = { sub: 'operator-1', scope: 'operator' };
    verifyRemoteTokenMock.mockReturnValue({ valid: true, claims });

    const request = createRequest({
      headers: {
        authorization: 'Bearer signed.jwt.token',
      },
    });
    const response = createResponse();
    const next = vi.fn() as NextFunction;

    requireOperatorAccess(request, response, next);

    expect(verifyRemoteTokenMock).toHaveBeenCalledWith('signed.jwt.token');
    expect((request as Request & { remoteUser?: unknown }).remoteUser).toEqual(claims);
    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('rejects invalid remote bearer tokens for non-loopback requests', () => {
    verifyRemoteTokenMock.mockReturnValue({ valid: false, claims: null });

    const request = createRequest({
      headers: {
        authorization: 'Bearer invalid.jwt.token',
      },
    });
    const response = createResponse();
    const next = vi.fn() as NextFunction;

    requireOperatorAccess(request, response, next);

    expect(verifyRemoteTokenMock).toHaveBeenCalledWith('invalid.jwt.token');
    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Unauthorized'),
      }),
    );
  });

  it('treats IPv6 loopback requests as trusted local access', () => {
    const request = createRequest({
      socket: { remoteAddress: '::1' } as Request['socket'],
      ip: '::1',
    });
    const response = createResponse();
    const next = vi.fn() as NextFunction;

    requireOperatorAccess(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('normalizes IPv4-mapped loopback addresses as loopback', () => {
    const request = createRequest({
      socket: { remoteAddress: '::ffff:127.0.0.1' } as Request['socket'],
      ip: '::ffff:127.0.0.1',
    });

    expect(isLoopbackRequest(request)).toBe(true);
  });
});
