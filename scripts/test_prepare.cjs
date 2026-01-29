/**
 * Prepares the test environment before running tests.
 * Ensures test_build and logs directories exist; no-op if already present.
 */
const fs = require('fs');
const path = require('path');
const cwd = process.cwd();
const testBuild = path.join(cwd, 'test_build');
const logsDir = path.join(cwd, 'logs');
if (!fs.existsSync(testBuild)) fs.mkdirSync(testBuild, { recursive: true });
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
