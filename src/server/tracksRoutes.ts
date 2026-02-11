/**
 * Tracks Management API Routes
 *
 * EPP v2 Protocol: Track generation and management endpoints
 * RULE-UI3: CLI és Dashboard ugyanazon API-t használja
 * RULE-UI4: Routes külön *Routes.ts fájlokban (clean separation)
 *
 * Endpoints:
 *   POST /api/tracks/generate - Generate track from idea (3-stage LLM pipeline)
 *   GET /api/tracks - List all tracks with metadata
 *   GET /api/tracks/:trackId - Get specific track details
 */

import { Router } from 'express';
import { agentManager } from '../agents/AgentManager.js';
import { logInfo, logError } from '../utils/logger.js';
import { socketService } from './SocketService.js';
import fs from 'fs/promises';
import path from 'path';

export function createTracksRouter(): Router {
  const router = Router();

  /**
   * POST /api/tracks/generate
   * Generate EPP v2 compliant track from creative idea
   *
   * Request body:
   * {
   *   "idea": "Natural language idea (2-5 sentences, magyar OK)"
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "trackId": "track-name-20260211",
   *   "trackPath": "conductor/tracks/track-name-20260211",
   *   "preview": "# Track Title\n\n..."
   * }
   */
  router.post('/generate', async (req, res) => {
    try {
      const { idea } = req.body;

      if (!idea || typeof idea !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Missing or invalid "idea" field in request body'
        });
      }

      logInfo('TracksRoutes', `Generating track from idea: ${idea.slice(0, 60)}...`);

      // Execute SpecWriterAgent with 3-stage pipeline
      const agent = agentManager.getAgent('SpecWriter');
      if (!agent) {
        return res.status(500).json({
          success: false,
          error: 'SpecWriterAgent not registered in AgentManager'
        });
      }

      const result = await agent.execute('Generate track', {
        metadata: { idea }
      }) as {
        status: 'success' | 'error';
        data?: any;
        error?: string;
      };

      if (result.status === 'error') {
        logError('TracksRoutes', `Track generation failed: ${result.error}`);
        return res.status(500).json({
          success: false,
          error: result.error
        });
      }

      const data = result.data as any;

      // Emit WebSocket event for real-time updates
      socketService.emit('track:generated', {
        trackId: data.trackId,
        timestamp: new Date().toISOString()
      });

      logInfo('TracksRoutes', `✅ Track generated: ${data.trackId}`);

      res.json({
        success: true,
        trackId: data.trackId,
        trackPath: data.trackPath,
        trackFile: data.trackFile,
        preview: data.preview
      });
    } catch (e: any) {
      logError('TracksRoutes', `Generate endpoint error: ${e.message}`);
      res.status(500).json({
        success: false,
        error: e.message
      });
    }
  });

  /**
   * GET /api/tracks
   * List all tracks from conductor/tracks/ directory
   *
   * Response:
   * {
   *   "success": true,
   *   "tracks": [
   *     {
   *       "id": "track-name-20260211",
   *       "title": "Track Title",
   *       "priority": "P0",
   *       "progress": 0,
   *       "path": "conductor/tracks/track-name-20260211/track.md"
   *     }
   *   ]
   * }
   */
  router.get('/', async (_req, res) => {
    try {
      const agent = agentManager.getAgent('SpecWriter');
      if (!agent) {
        return res.status(500).json({
          success: false,
          error: 'SpecWriterAgent not registered'
        });
      }

      // Call listTracks() method
      const result = await (agent as any).listTracks() as {
        success: boolean;
        message: string;
        data?: { tracks: any[] };
      };

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.message
        });
      }

      const tracks = result.data?.tracks || [];

      res.json({
        success: true,
        count: tracks.length,
        tracks
      });
    } catch (e: any) {
      logError('TracksRoutes', `List endpoint error: ${e.message}`);
      res.status(500).json({
        success: false,
        error: e.message
      });
    }
  });

  /**
   * GET /api/tracks/:trackId
   * Get detailed track information (read track.md content)
   *
   * Response:
   * {
   *   "success": true,
   *   "trackId": "track-name-20260211",
   *   "content": "# Track Title\n\n...",
   *   "metadata": {
   *     "title": "Track Title",
   *     "priority": "P0",
   *     "progress": 0
   *   }
   * }
   */
  router.get('/:trackId', async (req, res) => {
    try {
      const { trackId } = req.params;

      // Read track.md file
      const trackPath = path.join(process.cwd(), 'conductor', 'tracks', trackId, 'track.md');

      let content = '';
      try {
        content = await fs.readFile(trackPath, 'utf-8');
      } catch (e: any) {
        logError('TracksRoutes', `Track not found: ${trackId}`);
        return res.status(404).json({
          success: false,
          error: `Track not found: ${trackId}`
        });
      }

      // Extract metadata from track.md (first 20 lines)
      const lines = content.split('\n').slice(0, 20);
      const title = lines.find(l => l.startsWith('# '))?.replace('# ', '').trim() || trackId;
      const priorityMatch = lines.find(l => l.includes('**Priority:**'));
      const priority = priorityMatch?.match(/P[0-2]/)?.[0] || 'P2';
      const progressMatch = lines.find(l => l.includes('**Progress:**'));
      const progress = parseInt(progressMatch?.match(/\d+/)?.[0] || '0');
      const createdMatch = lines.find(l => l.includes('**Created:**'));
      const created = createdMatch?.match(/\d{4}-\d{2}-\d{2}/)?.[0] || 'unknown';

      res.json({
        success: true,
        trackId,
        content,
        metadata: {
          title,
          priority,
          progress,
          created,
          path: trackPath
        }
      });
    } catch (e: any) {
      logError('TracksRoutes', `Get endpoint error: ${e.message}`);
      res.status(500).json({
        success: false,
        error: e.message
      });
    }
  });

  return router;
}
