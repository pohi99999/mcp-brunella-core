import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import {
  generateVideoAgent,
  getVideoStatus,
  listAssets,
  listAvatars,
  retrieveShareableVideoUrl,
  uploadAssetFromPath,
} from '../server/services/heygenService.js';
import { logError, logInfo } from '../utils/logger.js';

function asText(result: unknown): string {
  return JSON.stringify(result, null, 2);
}

export async function heygenGenerateVideoHandler(params: {
  prompt: string;
  avatar_id?: string;
  duration_sec?: number;
  orientation?: 'portrait' | 'landscape';
  asset_ids?: string[];
  callback_id?: string;
  callback_url?: string;
}): Promise<{ success: boolean; videoId?: string; response?: unknown; error?: string }> {
  try {
    const result = await generateVideoAgent({
      prompt: params.prompt,
      config: {
        avatar_id: params.avatar_id,
        duration_sec: params.duration_sec,
        orientation: params.orientation,
      },
      files: Array.isArray(params.asset_ids) ? params.asset_ids.map((asset_id) => ({ asset_id })) : undefined,
      callback_id: params.callback_id,
      callback_url: params.callback_url,
    });

    return { success: true, videoId: result.videoId, response: result.response };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logError('HeygenTool', message);
    return { success: false, error: message };
  }
}

export async function heygenVideoStatusHandler(params: {
  video_id: string;
}): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    const result = await getVideoStatus(params.video_id);
    return { success: true, result };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logError('HeygenTool', message);
    return { success: false, error: message };
  }
}

export async function heygenShareUrlHandler(params: {
  video_id: string;
}): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    const result = await retrieveShareableVideoUrl(params.video_id);
    return { success: true, result };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logError('HeygenTool', message);
    return { success: false, error: message };
  }
}

export async function heygenListAvatarsHandler(): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    const result = await listAvatars();
    return { success: true, result };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logError('HeygenTool', message);
    return { success: false, error: message };
  }
}

export async function heygenListAssetsHandler(): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    const result = await listAssets();
    return { success: true, result };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logError('HeygenTool', message);
    return { success: false, error: message };
  }
}

export async function heygenUploadAssetHandler(params: {
  file_path: string;
  content_type?: string;
}): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    const result = await uploadAssetFromPath(params.file_path, { contentType: params.content_type });
    return { success: true, result };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logError('HeygenTool', message);
    return { success: false, error: message };
  }
}

export function registerHeygenTools(server: McpServer): void {
  logInfo('HeygenTool', 'Registering HeyGen video agent tools.');

  server.tool(
    'heygen_generate_video_agent',
    'Generates a HeyGen Video Agent video from a one-shot prompt. Optional avatar, duration, orientation, asset refs, and callback settings are supported.',
    {
      prompt: z.string().min(1),
      avatar_id: z.string().optional(),
      duration_sec: z.number().int().min(5).optional(),
      orientation: z.enum(['portrait', 'landscape']).optional(),
      asset_ids: z.array(z.string()).optional(),
      callback_id: z.string().optional(),
      callback_url: z.string().url().optional(),
    },
    async (args) => {
      const result = await heygenGenerateVideoHandler(args);
      return {
        isError: !result.success,
        content: [{ type: 'text' as const, text: asText(result.success ? result : result) }],
      };
    },
  );

  server.tool(
    'heygen_video_status',
    'Gets the current processing status and URLs for a HeyGen video by video ID.',
    {
      video_id: z.string().min(1),
    },
    async (args) => {
      const result = await heygenVideoStatusHandler(args);
      return {
        isError: !result.success,
        content: [{ type: 'text' as const, text: asText(result.success ? result.result : result) }],
      };
    },
  );

  server.tool(
    'heygen_share_url',
    'Generates a public, shareable HeyGen URL for an existing video.',
    {
      video_id: z.string().min(1),
    },
    async (args) => {
      const result = await heygenShareUrlHandler(args);
      return {
        isError: !result.success,
        content: [{ type: 'text' as const, text: asText(result.success ? result.result : result) }],
      };
    },
  );

  server.tool(
    'heygen_list_avatars',
    'Lists available HeyGen avatars and talking photos.',
    {},
    async () => {
      const result = await heygenListAvatarsHandler();
      return {
        isError: !result.success,
        content: [{ type: 'text' as const, text: asText(result.success ? result.result : result) }],
      };
    },
  );

  server.tool(
    'heygen_list_assets',
    'Lists uploaded HeyGen assets that can be referenced by the video agent.',
    {},
    async () => {
      const result = await heygenListAssetsHandler();
      return {
        isError: !result.success,
        content: [{ type: 'text' as const, text: asText(result.success ? result.result : result) }],
      };
    },
  );

  server.tool(
    'heygen_upload_asset',
    'Uploads a local file into HeyGen as a reusable asset.',
    {
      file_path: z.string().min(1),
      content_type: z.string().optional(),
    },
    async (args) => {
      const result = await heygenUploadAssetHandler(args);
      return {
        isError: !result.success,
        content: [{ type: 'text' as const, text: asText(result.success ? result.result : result) }],
      };
    },
  );
}
