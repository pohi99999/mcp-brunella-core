import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@packages/utils/AppError.js';
import { globalErrorHandler, asyncHandler } from '@apps/mcp-core/server/middleware/errorHandler.js';
import { requestId, corsWhitelist } from '@apps/mcp-core/server/middleware.js';

describe('Middleware Tests', () => {
  describe('errorHandler', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let nextFunction: NextFunction;

    beforeEach(() => {
      mockRequest = {
        headers: {}
      };
      mockResponse = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
      };
      nextFunction = vi.fn();
    });

    it('should handle AppError correctly', () => {
      const error = AppError.badRequest('Invalid input', 'TEST_ERROR');
      
      globalErrorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid input',
        code: 'TEST_ERROR',
        statusCode: 400
      }));
    });

    it('should handle generic Error as 500', () => {
      const error = new Error('Database crash');
      
      globalErrorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.any(String),
        statusCode: 500
      }));
    });

    it('should include requestId in response if present on request', () => {
      const error = AppError.internal('Internal fail');
      (mockRequest as any).id = 'test-id';

      globalErrorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        requestId: 'test-id'
      }));
    });
  });

  describe('asyncHandler', () => {
    it('should catch errors from async function and pass to next()', async () => {
      const error = new Error('Async fail');
      const asyncFn = async () => {
        throw error;
      };
      
      const req = {} as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;

      const wrapped = asyncHandler(asyncFn);
      wrapped(req, res, next);

      // Wait for promise resolution
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should proceed if async function succeeds', async () => {
      const asyncFn = vi.fn().mockResolvedValue('ok');
      const req = {} as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;

      const wrapped = asyncHandler(asyncFn);
      wrapped(req, res, next);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(asyncFn).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requestId', () => {
    it('should add unique ID to request and response header', () => {
      const req = { headers: {} } as Request;
      const res = { setHeader: vi.fn() } as unknown as Response;
      const next = vi.fn() as NextFunction;

      requestId(req, res, next);

      expect((req as any).id).toBeDefined();
      expect(typeof (req as any).id).toBe('string');
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', (req as any).id);
      expect(next).toHaveBeenCalled();
    });

    it('should use existing x-request-id if provided', () => {
      const req = { headers: { 'x-request-id': 'existing-id' } } as unknown as Request;
      const res = { setHeader: vi.fn() } as unknown as Response;
      const next = vi.fn() as NextFunction;

      requestId(req, res, next);

      expect((req as any).id).toBe('existing-id');
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'existing-id');
    });
  });

  describe('corsWhitelist', () => {
    beforeEach(() => {
      process.env.CORS_ORIGINS = 'http://localhost:5173,http://localhost:3000';
    });

    it('should allow origin from whitelist', () => {
      const req = { headers: { origin: 'http://localhost:5173' }, method: 'GET' } as Request;
      const res = { setHeader: vi.fn() } as unknown as Response;
      const next = vi.fn() as NextFunction;

      corsWhitelist(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:5173');
      expect(next).toHaveBeenCalled();
    });

    it('should not set Access-Control-Allow-Origin if origin is not in whitelist', () => {
      process.env.CORS_ORIGINS = 'http://localhost:5173,http://localhost:3000';
      const req = { headers: { origin: 'http://malicious.com' }, method: 'GET' } as Request;
      const res = { setHeader: vi.fn() } as unknown as Response;
      const next = vi.fn() as NextFunction;

      corsWhitelist(req, res, next);

      const headers = (res.setHeader as any).mock.calls.map((c: any) => c[0]);
      // Should set set other headers but NOT Access-Control-Allow-Origin
      const allowOriginCall = (res.setHeader as any).mock.calls.find((c: any) => c[0] === 'Access-Control-Allow-Origin');
      expect(allowOriginCall).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should handle OPTIONS preflight', () => {
      const req = { headers: { origin: 'http://localhost:5173' }, method: 'OPTIONS' } as Request;
      const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), end: vi.fn() } as unknown as Response;
      const next = vi.fn() as NextFunction;

      corsWhitelist(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });
});
