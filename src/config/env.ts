import dotenv from 'dotenv';
import path from 'path';

const root = process.cwd();
const envLocal = path.join(root, '.env.local');
const env = path.join(root, '.env');

// Load .env.local first, then .env as fallback.
dotenv.config({ path: envLocal });
dotenv.config({ path: env });
