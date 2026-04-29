/**
 * TTS (Text-to-Speech) API Routes
 *
 * Provides Nova voice TTS for Brunella's responses
 */

import { Router } from 'express';
import { textToSpeech, VoiceOption, TTSModel } from '@packages/utils/tts.js';
import { logInfo, logError } from '@packages/utils/logger.js';
import { loadPaiosConfig } from '@packages/utils/paiosConfig.js';
import { ensureError } from '@packages/utils/ensureError.js';

export function createTTSRoutes(): Router {
  const router = Router();

  /**
   * POST /api/tts
   *
   * Generate speech audio from text
   *
   * Body:
   * {
   *   "text": "Hello world",
   *   "voice": "nova",      // optional: alloy, echo, fable, onyx, nova, shimmer
   *   "model": "tts-1",     // optional: tts-1, tts-1-hd
   *   "speed": 1.0          // optional: 0.25 to 4.0
   * }
   *
   * Response: audio/mpeg (MP3 blob)
   */
  router.post('/', async (req, res) => {
    try {
      const { text, voice, model, speed } = req.body;
      const voiceDefaults = loadPaiosConfig().voice;

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        res.status(400).json({
          error: 'Invalid request: "text" is required and must be a non-empty string'
        });
        return;
      }

      logInfo('TTS API', `Request: "${text.slice(0, 50)}..." (voice: ${voice || voiceDefaults.response_voice})`);

      const audioBlob = await textToSpeech(text, {
        voice: (voice as VoiceOption | undefined) ?? voiceDefaults.response_voice,
        model: (model as TTSModel | undefined) ?? voiceDefaults.tts_model,
        speed: speed ? parseFloat(speed) : voiceDefaults.speed,
      });

      // Convert Blob to Buffer for Express response
      const arrayBuffer = await audioBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', buffer.length.toString());
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.send(buffer);

      logInfo('TTS API', `Response sent: ${buffer.length} bytes`);
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('TTS API', `Error: ${normalized.message}`, normalized);
      res.status(500).json({
        error: normalized.message || 'TTS generation failed'
      });
    }
  });

  /**
   * GET /api/tts/voices
   *
   * List available voices
   */
  router.get('/voices', (req, res) => {
    res.json({
      voices: [
        { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
        { id: 'echo', name: 'Echo', description: 'Male, clear' },
        { id: 'fable', name: 'Fable', description: 'British, expressive' },
        { id: 'onyx', name: 'Onyx', description: 'Deep male voice' },
        { id: 'nova', name: 'Nova', description: 'Female, warm and sultry (Brunella default) 🎙️' },
        { id: 'shimmer', name: 'Shimmer', description: 'Soft female voice' },
      ],
      models: [
        { id: 'tts-1', name: 'Standard', description: 'Fast, lower quality' },
        { id: 'tts-1-hd', name: 'HD', description: 'Slower, higher quality' },
      ],
      default: {
        ...loadPaiosConfig().voice,
      }
    });
  });

  return router;
}
