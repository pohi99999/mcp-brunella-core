/**
 * AppError - Egyedi hibaosztály strukturált hibakezeléshez
 * 
 * Használat:
 * ```typescript
 * throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
 * throw new AppError('Invalid input', 400);
 * ```
 * 
 * @author Brunella Core Team
 * @version 1.0.0
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    isOperational: boolean = true
  ) {
    super(message);
    
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    
    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * JSON reprezentáció (API válaszokhoz)
   */
  toJSON(): Record<string, unknown> {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode
    };
  }

  /**
   * Factory method gyakori hibákhoz
   */
  static badRequest(message: string, code?: string): AppError {
    return new AppError(message, 400, code || 'BAD_REQUEST');
  }

  static unauthorized(message: string = 'Unauthorized', code?: string): AppError {
    return new AppError(message, 401, code || 'UNAUTHORIZED');
  }

  static forbidden(message: string = 'Forbidden', code?: string): AppError {
    return new AppError(message, 403, code || 'FORBIDDEN');
  }

  static notFound(message: string, code?: string): AppError {
    return new AppError(message, 404, code || 'NOT_FOUND');
  }

  static conflict(message: string, code?: string): AppError {
    return new AppError(message, 409, code || 'CONFLICT');
  }

  static internal(message: string = 'Internal Server Error', code?: string): AppError {
    return new AppError(message, 500, code || 'INTERNAL_ERROR');
  }
}
