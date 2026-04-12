import { Router, type Request, type Response } from 'express';
import {
  browserCopilotSessionService,
  type BrowserCopilotEnginePreference,
  type BrowserCopilotMode,
} from '../../services/BrowserCopilotSessionService.js';
import { logError, logInfo } from '../../utils/logger.js';

function isMode(value: unknown): value is BrowserCopilotMode {
  return value === 'observe' || value === 'guide' || value === 'auto';
}

function isEnginePreference(value: unknown): value is BrowserCopilotEnginePreference {
  return value === 'auto' || value === 'chrome-acp' || value === 'robotkez';
}

export function createBrowserCopilotRoutes(): Router {
  const router = Router();

  router.get('/session', async (_req: any, res: any) => {
    res.json({ success: true, session: browserCopilotSessionService.getState() });
  });

  router.post('/session/configure', async (req: any, res: any) => {
    try {
      const { mode, enginePreference, overlayEnabled } = req.body as {
        mode?: unknown;
        enginePreference?: unknown;
        overlayEnabled?: unknown;
      };

      if (mode !== undefined && !isMode(mode)) {
        return res.status(400).json({ success: false, error: 'Érvénytelen mode. Használd: observe | guide | auto.' });
      }

      if (enginePreference !== undefined && !isEnginePreference(enginePreference)) {
        return res.status(400).json({ success: false, error: 'Érvénytelen enginePreference. Használd: auto | chrome-acp | robotkez.' });
      }

      const session = await browserCopilotSessionService.configure({
        mode,
        enginePreference,
        overlayEnabled: typeof overlayEnabled === 'boolean' ? overlayEnabled : undefined,
      });

      logInfo('BrowserCopilotAPI', `Session configured: mode=${session.mode}, enginePreference=${session.enginePreference}`);
      return res.json({ success: true, session });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BrowserCopilotAPI', `configure error: ${message}`);
      return res.status(500).json({ success: false, error: message });
    }
  });

  router.post('/message', async (req: any, res: any) => {
    try {
      const { instruction } = req.body as { instruction?: unknown };
      if (typeof instruction !== 'string' || !instruction.trim()) {
        return res.status(400).json({ success: false, error: 'Hiányzó vagy üres instruction mező.' });
      }

      logInfo('BrowserCopilotAPI', `Incoming message: ${instruction.slice(0, 120)}`);
      const session = await browserCopilotSessionService.sendMessage(instruction);
      return res.json({ success: true, session });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BrowserCopilotAPI', `message error: ${message}`);
      return res.status(500).json({ success: false, error: message });
    }
  });

  router.post('/confirm', async (_req: any, res: any) => {
    try {
      const session = await browserCopilotSessionService.confirmPending();
      return res.json({ success: true, session });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BrowserCopilotAPI', `confirm error: ${message}`);
      return res.status(500).json({ success: false, error: message });
    }
  });

  router.post('/pause', async (_req: any, res: any) => {
    try {
      const session = await browserCopilotSessionService.pause();
      return res.json({ success: true, session });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BrowserCopilotAPI', `pause error: ${message}`);
      return res.status(500).json({ success: false, error: message });
    }
  });

  router.post('/resume', async (_req: any, res: any) => {
    try {
      const session = await browserCopilotSessionService.resume();
      return res.json({ success: true, session });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BrowserCopilotAPI', `resume error: ${message}`);
      return res.status(500).json({ success: false, error: message });
    }
  });

  router.post('/reset', async (_req: any, res: any) => {
    try {
      const session = browserCopilotSessionService.reset();
      return res.json({ success: true, session });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BrowserCopilotAPI', `reset error: ${message}`);
      return res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}
