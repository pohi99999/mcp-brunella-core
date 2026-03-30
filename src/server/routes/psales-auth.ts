import { Router } from 'express';
import { SignJWT, jwtVerify } from 'jose';
import { logInfo, logError } from '../../utils/logger.js';

interface TestUser {
  email: string;
  password: string;
  role: string;
}

function getTestUsers(): TestUser[] {
  try {
    return JSON.parse(process.env.PSALES_TEST_USERS ?? '[]') as TestUser[];
  } catch {
    return [];
  }
}

function getSecret(): Uint8Array {
  const secret = process.env.PSALES_JWT_SECRET ?? 'dev-secret-change-in-production';
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
      const error = e instanceof Error ? e.message : String(e);
      logError('PSalesAuth', `JWT hiba: ${error}`);
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
      return res.json({
        valid: true,
        email: payload['email'],
        role: payload['role']
      });
    } catch {
      return res.status(401).json({ valid: false, error: 'Érvénytelen vagy lejárt token' });
    }
  });

  return router;
}
