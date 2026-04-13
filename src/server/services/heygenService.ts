import { readFile } from 'fs/promises';

import { ensureError } from '../../utils/ensureError.js';
import { logError, logInfo } from '../../utils/logger.js';

const MODULE = 'HeygenService';
const DEFAULT_BASE_URL = 'https://api.heygen.com';
const SUCCESS_CODE = 100;

export type HeygenOrientation = 'portrait' | 'landscape';

export interface HeygenVideoConfig {
  avatar_id?: string;
  duration_sec?: number;
  orientation?: HeygenOrientation;
}

export interface HeygenGenerateVideoAgentInput {
  prompt: string;
  config?: HeygenVideoConfig;
  files?: Array<{ asset_id: string }>;
  callback_id?: string;
  callback_url?: string;
}

export interface HeygenGenerateVideoAgentResult {
  videoId: string;
  response: HeygenApiEnvelope<{ video_id?: string }>;
}

export interface HeygenVideoStatusResult {
  videoId: string;
  status: string;
  videoUrl?: string | null;
  videoUrlCaption?: string | null;
  thumbnailUrl?: string | null;
  captionUrl?: string | null;
  gifUrl?: string | null;
  duration?: number | null;
  callbackId?: string | null;
  createdAt?: number | null;
  error?: unknown;
  response: HeygenApiEnvelope<Record<string, unknown>>;
}

export interface HeygenShareUrlResult {
  videoId: string;
  shareUrl: string;
  response: HeygenApiEnvelope<string | { url?: string }>;
}

export interface HeygenAvatarListResult {
  avatars: unknown[];
  talkingPhotos: unknown[];
  response: HeygenApiEnvelope<{ avatars?: unknown[]; talking_photos?: unknown[] }>;
}

export interface HeygenAssetListResult {
  assets: unknown[];
  total?: number;
  token?: string;
  response: HeygenApiEnvelope<{ assets?: unknown[]; total?: number; token?: string }>;
}

export interface HeygenUploadAssetResult {
  assetId: string;
  name?: string;
  fileType?: string;
  url?: string;
  response: HeygenApiEnvelope<Record<string, unknown>>;
}

interface HeygenApiEnvelope<T> {
  code?: number;
  data?: T;
  message?: string | null;
  msg?: string | null;
  error?: unknown;
}

interface HeygenRequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined>;
  json?: unknown;
  body?: BodyInit;
  contentType?: string;
}

function getHeygenApiKey(): string {
  const apiKey = process.env.HEYGEN_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('HeyGen API key is not configured. Set HEYGEN_API_KEY in .env.');
  }

  return apiKey;
}

function getHeygenBaseUrl(): string {
  return (process.env.HEYGEN_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function buildHeygenUrl(pathname: string, query?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(pathname, `${getHeygenBaseUrl()}/`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) {
      continue;
    }

    const text = String(value).trim();
    if (text.length === 0) {
      continue;
    }

    url.searchParams.set(key, text);
  }

  return url.toString();
}

function toJsonBody(value: unknown): string {
  return JSON.stringify(value, (_key, entry) => (entry === undefined ? undefined : entry));
}

function safeMessage(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message.trim();
    }
  }

  return '';
}

function buildHeygenError(operation: string, status: number, envelope: HeygenApiEnvelope<unknown> | null, rawText: string): Error {
  const envelopeMessage = safeMessage(envelope?.message) || safeMessage(envelope?.msg) || safeMessage(envelope?.error);
  const details = envelopeMessage || rawText.slice(0, 400).trim();
  return new Error(`${operation} failed (${status})${details ? `: ${details}` : ''}`);
}

async function heygenRequest<T>(operation: string, path: string, options: HeygenRequestOptions = {}): Promise<HeygenApiEnvelope<T>> {
  const url = buildHeygenUrl(path, options.query);
  const headers: Record<string, string> = {
    'x-api-key': getHeygenApiKey(),
  };

  let body: BodyInit | undefined;
  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = toJsonBody(options.json);
  } else if (options.body !== undefined) {
    body = options.body;
    if (options.contentType) {
      headers['Content-Type'] = options.contentType;
    }
  }

  logInfo(MODULE, `${operation} -> ${url}`);
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body,
  });

  const rawText = await response.text();
  let parsed: HeygenApiEnvelope<T>;
  try {
    parsed = rawText.trim().length > 0 ? JSON.parse(rawText) as HeygenApiEnvelope<T> : {};
  } catch {
    throw new Error(`${operation} returned non-JSON response (${response.status}): ${rawText.slice(0, 400)}`);
  }

  if (!response.ok) {
    throw buildHeygenError(operation, response.status, parsed, rawText);
  }

  if (typeof parsed.code === 'number' && parsed.code !== SUCCESS_CODE) {
    throw buildHeygenError(operation, parsed.code, parsed, rawText);
  }

  return parsed;
}

function getResponseData<T>(envelope: HeygenApiEnvelope<T>): T {
  if (envelope.data === undefined || envelope.data === null) {
    throw new Error('HeyGen response did not include a data payload.');
  }

  return envelope.data;
}

function pickString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function guessContentType(filePath: string): string {
  const normalized = filePath.toLowerCase();

  if (normalized.endsWith('.mp4')) return 'video/mp4';
  if (normalized.endsWith('.mov')) return 'video/quicktime';
  if (normalized.endsWith('.webm')) return 'video/webm';
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
  if (normalized.endsWith('.gif')) return 'image/gif';
  if (normalized.endsWith('.wav')) return 'audio/wav';
  if (normalized.endsWith('.mp3')) return 'audio/mpeg';

  return 'application/octet-stream';
}

export async function generateVideoAgent(
  input: HeygenGenerateVideoAgentInput,
): Promise<HeygenGenerateVideoAgentResult> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new Error('HeyGen prompt is required.');
  }

  const envelope = await heygenRequest<{ video_id?: string }>('Generate HeyGen video agent', '/v1/video_agent/generate', {
    method: 'POST',
    json: {
      prompt,
      config: input.config,
      files: input.files,
      callback_id: input.callback_id,
      callback_url: input.callback_url,
    },
  });

  const data = getResponseData(envelope);
  const videoId = pickString((data as { video_id?: unknown }).video_id);
  if (!videoId) {
    throw new Error('HeyGen generate response did not include a video_id.');
  }

  return {
    videoId,
    response: envelope,
  };
}

export async function getVideoStatus(videoId: string): Promise<HeygenVideoStatusResult> {
  const normalizedVideoId = videoId.trim();
  if (!normalizedVideoId) {
    throw new Error('HeyGen video ID is required.');
  }

  const envelope = await heygenRequest<Record<string, unknown>>('Get HeyGen video status', '/v1/video_status', {
    method: 'GET',
    query: { video_id: normalizedVideoId },
  });

  const data = getResponseData(envelope);
  return {
    videoId: normalizedVideoId,
    status: pickString(data.status) ?? 'unknown',
    videoUrl: pickString(data.video_url),
    videoUrlCaption: pickString(data.video_url_caption),
    thumbnailUrl: pickString(data.thumbnail_url),
    captionUrl: pickString(data.caption_url),
    gifUrl: pickString(data.gif_url),
    duration: typeof data.duration === 'number' ? data.duration : null,
    callbackId: pickString(data.callback_id) ?? null,
    createdAt: typeof data.created_at === 'number' ? data.created_at : null,
    error: data.error ?? null,
    response: envelope,
  };
}

export async function retrieveShareableVideoUrl(videoId: string): Promise<HeygenShareUrlResult> {
  const normalizedVideoId = videoId.trim();
  if (!normalizedVideoId) {
    throw new Error('HeyGen video ID is required.');
  }

  const envelope = await heygenRequest<string | { url?: string }>('Retrieve HeyGen shareable video URL', '/v1/video/share', {
    method: 'POST',
    json: { video_id: normalizedVideoId },
  });

  const data = getResponseData(envelope);
  const shareUrl = typeof data === 'string' ? data : pickString(data.url);
  if (!shareUrl) {
    throw new Error('HeyGen share response did not include a share URL.');
  }

  return {
    videoId: normalizedVideoId,
    shareUrl,
    response: envelope,
  };
}

export async function listAvatars(): Promise<HeygenAvatarListResult> {
  const envelope = await heygenRequest<{ avatars?: unknown[]; talking_photos?: unknown[] }>('List HeyGen avatars', '/v2/avatars', {
    method: 'GET',
  });

  const data = getResponseData(envelope);
  return {
    avatars: Array.isArray(data.avatars) ? data.avatars : [],
    talkingPhotos: Array.isArray(data.talking_photos) ? data.talking_photos : [],
    response: envelope,
  };
}

export async function listAssets(): Promise<HeygenAssetListResult> {
  const envelope = await heygenRequest<{ assets?: unknown[]; total?: number; token?: string }>('List HeyGen assets', '/v1/asset/list', {
    method: 'GET',
  });

  const data = getResponseData(envelope);
  return {
    assets: Array.isArray(data.assets) ? data.assets : [],
    total: typeof data.total === 'number' ? data.total : undefined,
    token: pickString(data.token),
    response: envelope,
  };
}

export async function uploadAssetFromPath(
  filePath: string,
  options: { contentType?: string } = {},
): Promise<HeygenUploadAssetResult> {
  const normalizedFilePath = filePath.trim();
  if (!normalizedFilePath) {
    throw new Error('HeyGen asset file path is required.');
  }

  const content = await readFile(normalizedFilePath);
  const envelope = await heygenRequest<Record<string, unknown>>('Upload HeyGen asset', '/v1/asset', {
    method: 'POST',
    body: content,
    contentType: options.contentType ?? guessContentType(normalizedFilePath),
  });

  const data = getResponseData(envelope);
  const assetId = pickString(data.id);
  if (!assetId) {
    throw new Error('HeyGen upload response did not include an asset id.');
  }

  return {
    assetId,
    name: pickString(data.name),
    fileType: pickString(data.file_type),
    url: pickString(data.url),
    response: envelope,
  };
}

export function getHeygenHealth(): { configured: boolean; baseUrl: string; endpoints: string[] } {
  return {
    configured: Boolean(process.env.HEYGEN_API_KEY?.trim()),
    baseUrl: getHeygenBaseUrl(),
    endpoints: [
      '/v1/video_agent/generate',
      '/v1/video_status',
      '/v1/video/share',
      '/v2/avatars',
      '/v1/asset/list',
      '/v1/asset',
    ],
  };
}

export function formatHeygenError(error: unknown): string {
  const normalized = ensureError(error);
  return normalized.message;
}

export default {
  generateVideoAgent,
  getVideoStatus,
  retrieveShareableVideoUrl,
  listAvatars,
  listAssets,
  uploadAssetFromPath,
  getHeygenHealth,
};
