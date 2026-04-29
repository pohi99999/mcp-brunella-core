import { Router } from 'express';
import { SignJWT, jwtVerify } from 'jose';
import { logInfo, logError, logDebug } from '@packages/utils/logger.js';
import { ensureError } from '@packages/utils/ensureError.js';

interface TestUser {
  email: string;
  password: string;
  role: string;
}

// WARNING: test-only credentials — PSALES_TEST_USERS must never contain real passwords
function getTestUsers(): TestUser[] {
  try {
    return JSON.parse(process.env.PSALES_TEST_USERS ?? '[]') as TestUser[];
  } catch (error: unknown) {
    logDebug('PSalesAuth', `Unable to parse PSALES_TEST_USERS: ${ensureError(error).message}`);
    return [];
  }
}

function getSecret(): Uint8Array {
  const secret = process.env.PSALES_JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'PSALES_JWT_SECRET environment variable must be set in production. Refusing to start with a weak fallback.',
      );
    }
    // Development-only fallback — never use in production
    return new TextEncoder().encode('dev-secret-change-in-production');
  }
  return new TextEncoder().encode(secret);
}

export function createPSalesAuthRoutes(): Router {
  const router = Router();

  // POST /login
  router.post('/login', async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ error: 'email és password kötelező' });
    }

    const users = getTestUsers();
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
      logInfo('PSalesAuth', `Sikertelen bejelentkezés: ${email}`);
      return res.status(401).json({ error: 'Érvénytelen email vagy jelszó' });
    }

    try {
      const token = await new SignJWT({ email: user.email, role: user.role })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('8h')
        .sign(getSecret());

      logInfo('PSalesAuth', `Sikeres bejelentkezés: ${email} (${user.role})`);
      return res.json({ token, email: user.email, role: user.role });
    } catch (e: unknown) {
      const normalized = ensureError(e);
      logError('PSalesAuth', `JWT hiba: ${normalized.message}`, normalized);
      return res.status(500).json({ error: 'Token generálás sikertelen' });
    }
  });

  // POST /verify
  router.post('/verify', async (req, res) => {
    const { token } = req.body as { token?: string };

    if (!token) {
      return res.status(400).json({ error: 'token kötelező', valid: false });
    }

    try {
      const { payload } = await jwtVerify(token, getSecret());
      const email = typeof payload['email'] === 'string' ? payload['email'] : undefined;
      const role = typeof payload['role'] === 'string' ? payload['role'] : undefined;
      if (!email || !role) {
        return res.status(401).json({ valid: false, error: 'Érvénytelen token tartalom' });
      }
      return res.json({ valid: true, email, role });
    } catch (error: unknown) {
      logDebug('PSalesAuth', `Token verification failed: ${ensureError(error).message}`);
      return res.status(401).json({ valid: false, error: 'Érvénytelen vagy lejárt token' });
    }
  });

  return router;
}
