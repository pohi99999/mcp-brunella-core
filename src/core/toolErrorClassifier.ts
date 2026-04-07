export enum ToolErrorType {
  RETRYABLE = 'RETRYABLE',
  RATE_LIMITED = 'RATE_LIMITED',
  AUTH_FAILED = 'AUTH_FAILED',
  BAD_INPUT = 'BAD_INPUT',
  NOT_FOUND = 'NOT_FOUND',
  POLICY_BLOCKED = 'POLICY_BLOCKED',
  UNKNOWN = 'UNKNOWN',
}

export interface ToolErrorDescriptor {
  type: ToolErrorType;
  message: string;
  retryable: boolean;
  retryDelayMs?: number;
  statusCode?: number;
  operatorActionRequired: boolean;
  planRevision: string;
}

function readStatusCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const record = error as Record<string, unknown>;
  const candidates = [record.status, record.statusCode, record.code];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === 'string') {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function readMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null && typeof (error as Record<string, unknown>).message === 'string') {
    return String((error as Record<string, unknown>).message);
  }
  return String(error);
}

export function classifyToolError(error: unknown): ToolErrorDescriptor {
  const message = readMessage(error);
  const statusCode = readStatusCode(error);
  const normalized = message.toLowerCase();

  if (statusCode === 429 || /rate limit|too many requests/.test(normalized)) {
    return {
      type: ToolErrorType.RATE_LIMITED,
      message,
      statusCode,
      retryable: true,
      retryDelayMs: 5_000,
      operatorActionRequired: false,
      planRevision: 'A szolgáltatás rate limitbe ütközött; várni kell, majd újra próbálni.',
    };
  }

  if (statusCode === 401 || statusCode === 403 || /unauthorized|forbidden|auth|token expired|permission denied/.test(normalized)) {
    return {
      type: ToolErrorType.AUTH_FAILED,
      message,
      statusCode,
      retryable: false,
      operatorActionRequired: true,
      planRevision: 'A hitelesítés vagy jogosultság hibás; operátori beavatkozás vagy új credential kell.',
    };
  }

  if (statusCode === 400 || /bad request|invalid input|invalid argument|validation/.test(normalized)) {
    return {
      type: ToolErrorType.BAD_INPUT,
      message,
      statusCode,
      retryable: false,
      operatorActionRequired: false,
      planRevision: 'A tool paraméterei hibásak; a következő körben módosított bemenet kell.',
    };
  }

  if (statusCode === 404 || /not found|does not exist|missing resource/.test(normalized)) {
    return {
      type: ToolErrorType.NOT_FOUND,
      message,
      statusCode,
      retryable: false,
      operatorActionRequired: false,
      planRevision: 'A kért erőforrás nem található; alternatív célpont vagy fallback erőforrás kell.',
    };
  }

  if (/blocked|not allowed|allowlist|policy|safe.?zone|forbidden command/.test(normalized)) {
    return {
      type: ToolErrorType.POLICY_BLOCKED,
      message,
      statusCode,
      retryable: false,
      operatorActionRequired: false,
      planRevision: 'A művelet policy vagy safe-zone miatt tiltott; másik eszköz vagy engedélyezett útvonal kell.',
    };
  }

  if (
    statusCode === 500 ||
    statusCode === 502 ||
    statusCode === 503 ||
    statusCode === 504 ||
    /timeout|timed out|econnreset|econnrefused|network|temporary|transient/.test(normalized)
  ) {
    return {
      type: ToolErrorType.RETRYABLE,
      message,
      statusCode,
      retryable: true,
      retryDelayMs: 1_000,
      operatorActionRequired: false,
      planRevision: 'Átmeneti szolgáltatáshiba történt; a stratégia rövid késleltetés utáni ismétlést kíván.',
    };
  }

  return {
    type: ToolErrorType.UNKNOWN,
    message,
    statusCode,
    retryable: false,
    operatorActionRequired: false,
    planRevision: 'Ismeretlen tool-hiba történt; újratervezés előtt több megfigyelés vagy fallback szükséges.',
  };
}

export function formatToolObservation(descriptor: ToolErrorDescriptor): string {
  const status = descriptor.statusCode ? `HTTP ${descriptor.statusCode}` : descriptor.type;
  return `${status}: ${descriptor.message} | retryable=${descriptor.retryable} | revision=${descriptor.planRevision}`;
}