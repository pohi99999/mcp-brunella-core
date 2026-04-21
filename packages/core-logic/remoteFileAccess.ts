/**
 * Remote File Access
 * Phase 3: Mobile, Voice & Deep PAIOS Integration
 *
 * Provides scoped, sandboxed read/write file operations for remote sessions.
 * All paths are validated against the allowed base directory to prevent
 * path traversal attacks (OWASP A01 — Broken Access Control).
 *
 * Allowed base: process.cwd() + /files/remote/
 */

import fs from 'fs';
import path from 'path';
import { logInfo, logError } from '@packages/utils/logger.js';
import { remoteEventBridge } from './remoteEventBridge.js';
import type {
  RemoteFileReadRequest,
  RemoteFileReadResponse,
  RemoteFileWriteRequest,
  RemoteFileWriteResponse,
} from './types/remote.js';

const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB read cap

/** Resolves and validates the safe path. Throws if traversal is detected. */
function resolveSafePath(baseDir: string, userPath: string): string {
  // Strip any absolute prefix or leading slashes to keep path relative
  const sanitized = userPath.replace(/\.\./g, '').replace(/^[/\\]+/, '');
  const resolved = path.resolve(baseDir, sanitized);

  if (!resolved.startsWith(path.resolve(baseDir))) {
    throw new Error(`Path traversal detected: '${userPath}'`);
  }
  return resolved;
}

/** Returns the sandbox base directory, creating it if needed. */
function getBaseDir(): string {
  const dir = path.join(process.cwd(), 'files', 'remote');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Read a file from the remote sandbox.
 * Scoped to: <cwd>/files/remote/
 */
export function remoteReadFile(req: RemoteFileReadRequest): RemoteFileReadResponse {
  const base = getBaseDir();
  const safe = resolveSafePath(base, req.path);

  if (!fs.existsSync(safe)) {
    throw new Error(`File not found: '${req.path}'`);
  }

  const stat = fs.statSync(safe);
  if (!stat.isFile()) {
    throw new Error(`Not a file: '${req.path}'`);
  }
  if (stat.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File too large (max ${MAX_FILE_SIZE_BYTES} bytes): '${req.path}'`);
  }

  const content = fs.readFileSync(safe, 'utf8');
  logInfo('RemoteFileAccess', `Read sessionId=${req.sessionId} path=${req.path}`);

  remoteEventBridge.publish({
    type: 'file:read',
    source: 'RemoteFileAccess',
    sessionId: req.sessionId,
    payload: { path: req.path, size: stat.size },
  });

  return {
    path: req.path,
    content,
    encoding: 'utf8',
    size: stat.size,
    readAt: Date.now(),
  };
}

/**
 * Write a file into the remote sandbox.
 * Scoped to: <cwd>/files/remote/
 */
export function remoteWriteFile(req: RemoteFileWriteRequest): RemoteFileWriteResponse {
  const base = getBaseDir();
  const safe = resolveSafePath(base, req.path);

  // Ensure parent directory exists
  const dir = path.dirname(safe);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const buffer = Buffer.from(req.content, 'utf8');
  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Content too large (max ${MAX_FILE_SIZE_BYTES} bytes)`);
  }

  fs.writeFileSync(safe, req.content, 'utf8');
  logInfo('RemoteFileAccess', `Write sessionId=${req.sessionId} path=${req.path} bytes=${buffer.byteLength}`);

  remoteEventBridge.publish({
    type: 'file:write',
    source: 'RemoteFileAccess',
    sessionId: req.sessionId,
    payload: { path: req.path, bytesWritten: buffer.byteLength },
  });

  return {
    path: req.path,
    bytesWritten: buffer.byteLength,
    writtenAt: Date.now(),
  };
}

/**
 * List files in the remote sandbox root (non-recursive, top-level only).
 */
export function remoteListFiles(): string[] {
  const base = getBaseDir();
  try {
    return fs.readdirSync(base).filter(f => {
      const full = path.join(base, f);
      return fs.statSync(full).isFile();
    });
  } catch (e: unknown) {
    logError('RemoteFileAccess', `List failed: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

