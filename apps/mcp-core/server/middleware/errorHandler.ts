/**
 * Global Error Handler Middleware
 * 
 * Centralizes error handling for all Express routes.
 * Converts AppError instances to JSON responses with proper status codes.
 * 
 * Usage: Mount AFTER all routes in web.ts
 * ```typescript
 * app.use(globalErrorHandler);
 * ```
 * 
 * @author Brunella Core Team
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '@packages/utils/AppError.js';
import { ensureError } from '@packages/utils/ensureError.js';
import { logError } from '@packages/utils/logger.js';

/**
 * Standard error response format
 */
interface ErrorResponse {
  error: string;
  code?: string;
  statusCode: number;
  requestId?: string;
  stack?: string;
}

/**
 * Global error handling middleware
 * 
 * - AppError instances: converted to JSON with proper statusCode
 * - Other errors: logged and returned as 500
 * - Development mode: includes stack trace
 */
export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // AppError handling
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      error: err.message,
      code: err.code,
      statusCode: err.statusCode,
      requestId: (req as unknown as Record<string, unknown>)['id'] as string | undefined
    };

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development') {
      response.stack = err.stack;
    }

    logError('ErrorHandler', `[${err.statusCode}] ${err.message}${err.code ? ` (${err.code})` : ''}`);
    res.status(err.statusCode).json(response);
    return;
  }

  // Unknown error handling
  const normalized = ensureError(err);
  const response: ErrorResponse = {
    error: 'Internal Server Error',
    statusCode: 500,
    requestId: (req as unknown as Record<string, unknown>)['id'] as string | undefined
  };

  // Development mode: expose actual error
  if (process.env.NODE_ENV === 'development') {
    response.error = normalized.message;
    response.stack = normalized.stack;
  }

  logError('ErrorHandler', `Unhandled error: ${normalized.message}`, normalized);
  res.status(500).json(response);
}

/**
 * Async route handler wrapper
 * 
 * Wraps async route handlers to automatically catch rejected promises
 * and pass them to the error middleware.
 * 
 * Usage:
 * ```typescript
 * app.get('/route', asyncHandler(async (req, res) => {
 *   const data = await someAsyncOperation();
 *   res.json(data);
 * }));
 * ```
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
