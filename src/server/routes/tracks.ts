/**
 * Tracks API Routes
 *
 * Endpoints for track management and TODO tracking
 */

import { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import {
  parseTrackTodos,
  toggleTodoInContent,
  findTodoLineNumber,
  type TrackTodoView,
} from '../../utils/trackTodoParser.js';

const TRACKS_DIR = path.join(process.cwd(), 'conductor', 'tracks');

export function createTracksRoutes(): Router {
  const router = Router();

  /**
   * GET /api/v1/tracks/todos/active
   * Get TODO summaries for all active tracks
   */
  router.get('/todos/active', async (req, res) => {
    try {
      const trackDirs = await fs.readdir(TRACKS_DIR);
      const summaries = [];

      for (const dir of trackDirs) {
        const metaPath = path.join(TRACKS_DIR, dir, 'meta.json');
        const trackPath = path.join(TRACKS_DIR, dir, 'track.md');

        try {
          const metaContent = await fs.readFile(metaPath, 'utf-8');
          const meta = JSON.parse(metaContent);

          // Only include active/in_progress tracks
          if (!['active', 'in_progress'].includes(meta.status)) {
            continue;
          }

          // Try to read track.md for TODO parsing
          let todoView: TrackTodoView | null = null;
          try {
            await fs.access(trackPath);
            const content = await fs.readFile(trackPath, 'utf-8');
            todoView = parseTrackTodos(content, dir);
          } catch {
            // track.md doesn't exist, skip
            continue;
          }

          if (todoView && todoView.todos.length > 0) {
            summaries.push({
              trackId: dir,
              title: todoView.trackTitle,
              progress: todoView.progress,
              completedCount: todoView.todos.filter(t => t.completed).length,
              totalCount: todoView.todos.length,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch {
          // Skip invalid tracks
        }
      }

      return res.json({ tracks: summaries });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[TracksRoutes] Error getting active TODO summaries:', message);
      return res.status(500).json({ error: 'Failed to get active tracks', details: message });
    }
  });

  /**
   * GET /api/v1/tracks/:id/todos
   * Get TODO checklist from track.md
   */
  router.get('/:id/todos', async (req, res) => {
    try {
      const { id } = req.params;

      // Security: validate track ID (no path traversal)
      if (!isValidTrackId(id)) {
        return res.status(400).json({ error: 'Invalid track ID' });
      }

      const trackPath = path.join(TRACKS_DIR, id, 'track.md');

      // Check if track.md exists
      try {
        await fs.access(trackPath);
      } catch {
        return res.status(404).json({ error: 'Track not found' });
      }

      // Read and parse track.md
      const content = await fs.readFile(trackPath, 'utf-8');
      const todoView = parseTrackTodos(content, id);

      // Return in TrackTodosResponse format
      const completedCount = todoView.todos.filter(t => t.completed).length;
      return res.json({
        success: true,
        trackId: todoView.trackId,
        title: todoView.trackTitle,
        todos: todoView.todos,
        progress: todoView.progress,
        completedCount,
        totalCount: todoView.todos.length,
        updatedAt: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[TracksRoutes] Error getting TODOs:', message);
      return res.status(500).json({ error: 'Failed to get TODOs', details: message });
    }
  });

  /**
   * PATCH /api/v1/tracks/:id/todos/:todoId
   * Toggle TODO checkbox state
   */
  router.patch('/:id/todos/:todoId', async (req, res) => {
    try {
      const { id, todoId } = req.params;

      // Security: validate track ID
      if (!isValidTrackId(id)) {
        return res.status(400).json({ error: 'Invalid track ID' });
      }

      const trackPath = path.join(TRACKS_DIR, id, 'track.md');

      // Check if track.md exists
      try {
        await fs.access(trackPath);
      } catch {
        return res.status(404).json({ error: 'Track not found' });
      }

      // Read content
      let content = await fs.readFile(trackPath, 'utf-8');

      // Find TODO line number
      const lineNumber = findTodoLineNumber(content, todoId);

      // Toggle checkbox
      content = toggleTodoInContent(content, lineNumber);

      // Write back to file
      await fs.writeFile(trackPath, content, 'utf-8');

      // Parse updated content
      const updatedView = parseTrackTodos(content, id);

      // Return in TrackTodosResponse format
      const completedCount = updatedView.todos.filter(t => t.completed).length;
      const response = {
        success: true,
        trackId: updatedView.trackId,
        title: updatedView.trackTitle,
        todos: updatedView.todos,
        progress: updatedView.progress,
        completedCount,
        totalCount: updatedView.todos.length,
        updatedAt: new Date().toISOString(),
      };

      // Emit WebSocket event for real-time updates
      // (will be implemented when WebSocket is set up)
      // io?.emit('track:todo:updated', { trackId: id, todoView: response });

      return res.json(response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[TracksRoutes] Error toggling TODO:', message);
      return res.status(500).json({ error: 'Failed to toggle TODO', details: message });
    }
  });

  /**
   * GET /api/v1/tracks
   * List all tracks with basic metadata
   */
  router.get('/', async (req, res) => {
    try {
      const trackDirs = await fs.readdir(TRACKS_DIR);
      const tracks = [];

      for (const dir of trackDirs) {
        const metaPath = path.join(TRACKS_DIR, dir, 'meta.json');
        try {
          const metaContent = await fs.readFile(metaPath, 'utf-8');
          const meta = JSON.parse(metaContent);
          tracks.push({
            id: dir,
            name: meta.name || dir,
            status: meta.status || 'unknown',
            priority: meta.priority || 'medium',
            progress: meta.progress || 0,
          });
        } catch {
          // Skip if meta.json doesn't exist or is invalid
        }
      }

      return res.json({ tracks });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[TracksRoutes] Error listing tracks:', message);
      return res.status(500).json({ error: 'Failed to list tracks', details: message });
    }
  });

  return router;
}

/**
 * Validate track ID (prevent path traversal)
 */
function isValidTrackId(id: string): boolean {
  // Only allow alphanumeric, dash, underscore
  return /^[a-zA-Z0-9_-]+$/.test(id);
}
