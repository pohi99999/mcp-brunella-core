import { defineConfig } from 'vitest/config';
import fs from 'fs';
import path from 'path';

const configuredRetry = Number.parseInt(process.env.VITEST_RETRY ?? '0', 10);
const configuredHeapMb = Number.parseInt(process.env.VITEST_MAX_OLD_SPACE_SIZE ?? '6144', 10);
const rootDir = path.resolve(__dirname).replace(/\\/g, '/');

function resolveExisting(relativePath: string): string | undefined {
  const absolutePath = path.resolve(__dirname, relativePath);
  return fs.existsSync(absolutePath) ? absolutePath : undefined;
}

function resolveLegacyTestImport(source: string, importer?: string): string | undefined {
  const normalizedImporter = importer?.replace(/\\/g, '/') ?? '';

  if (source.startsWith('@apps/mcp-core/commands/')) {
    const commandFile = source.replace('@apps/mcp-core/commands/', '').replace(/\.js$/, '.ts');
    return resolveExisting(`apps/mcp-core/${commandFile}`) ?? resolveExisting(`apps/mcp-core/commands/${commandFile}`);
  }

  if (source.startsWith('@apps/mcp-core/server/services/')) {
    const serviceFile = source.replace('@apps/mcp-core/server/services/', '').replace(/\.js$/, '.ts');
    return resolveExisting(`packages/core-logic/services/${serviceFile}`) ?? resolveExisting(`src/server/services/${serviceFile}`);
  }

  if (source === '@apps/mcp-core/server/SocketService.js') {
    return resolveExisting('packages/agents/SocketService.ts');
  }

  if (source === '@packages/utils/cli-hu.js') {
    return resolveExisting('apps/mcp-core/cli-hu.ts');
  }

  if (source === './CFDispatcher.js' && normalizedImporter.endsWith('/apps/cloudflare-edge/CFDispatcher.test.ts')) {
    return resolveExisting('packages/core-logic/cloudflare/CFDispatcher.ts') ?? resolveExisting('src/cloudflare/CFDispatcher.ts');
  }

  if (source === './CFDispatchMiddleware.js' && normalizedImporter.endsWith('/apps/cloudflare-edge/CFDispatcher.test.ts')) {
    return resolveExisting('packages/core-logic/cloudflare/CFDispatchMiddleware.ts') ?? resolveExisting('src/cloudflare/CFDispatchMiddleware.ts');
  }

  if (source === './cloudflareHelpers.js' && normalizedImporter.endsWith('/apps/cloudflare-edge/CFDispatcher.test.ts')) {
    return resolveExisting('packages/core-logic/cloudflare/cloudflareHelpers.ts') ?? resolveExisting('src/cloudflare/cloudflareHelpers.ts');
  }

  if (source.startsWith('../scripts/') && normalizedImporter.includes('/tests/test/')) {
    return resolveExisting(`ops/scripts/${source.slice('../scripts/'.length)}`);
  }

  return undefined;
}

export default defineConfig({
  plugins: [
    {
      name: 'brunella-monorepo-test-resolver',
      enforce: 'pre',
      resolveId(source, importer) {
        return resolveLegacyTestImport(source, importer);
      },
    },
  ],
  test: {
    environment: 'node',
    include: ['tests/test/**/*.test.ts', 'tests/test/**/*.vitest.ts'],
    exclude: ['**/node_modules/**', '**/build/**', '**/src/dashboard/**', '**/*.e2e.test.ts', 'tests/integration/**'],
    globals: true,
    setupFiles: ['./tests/test/setup.ts'],
    testTimeout: 15000,
    fileParallelism: false,
    retry: Number.isFinite(configuredRetry) && configuredRetry > 0 ? configuredRetry : 0,
    pool: 'forks',
    poolOptions: {
      forks: {
        execArgv: [`--max-old-space-size=${configuredHeapMb}`],
        maxForks: 1,
        minForks: 1,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: [
      { find: /^@apps\/mcp-core\/commands\/(.+)\.js$/, replacement: `${rootDir}/apps/mcp-core/$1.ts` },
      { find: /^@apps\/mcp-core\/server\/services\/(.+)\.js$/, replacement: `${rootDir}/packages/core-logic/services/$1.ts` },
      { find: /^@apps\/mcp-core\/server\/SocketService\.js$/, replacement: `${rootDir}/packages/agents/SocketService.ts` },
      { find: /^@packages\/utils\/cli-hu\.js$/, replacement: `${rootDir}/apps/mcp-core/cli-hu.ts` },
      { find: '@', replacement: path.resolve(__dirname, './apps/dashboard') },
      { find: '@packages', replacement: path.resolve(__dirname, './packages') },
      { find: '@apps/mcp-core', replacement: path.resolve(__dirname, './apps/mcp-core') },
      { find: '@apps/dashboard', replacement: path.resolve(__dirname, './apps/dashboard') },
    ],
  },
});
