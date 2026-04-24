import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: 'apps/dashboard',
  publicDir: '../../public',
  server: {
    host: true,
    allowedHosts: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
  build: {
    outDir: '../../build/public',
    emptyOutDir: true,
    // Performance Optimization (Phase 6)
    rollupOptions: {
      output: {
        /**
         * Manual chunk splitting — function form, matching on the resolved file path.
         * Uses a helper that normalises slashes so this works on Windows too.
         */
        manualChunks(id) {
          // Normalise backslashes (Windows) to forward slashes for matching
          const nid = id.replace(/\\/g, '/');

          // React core — smallest chunk, cached longest
          if (/node_modules\/(react|react-dom|scheduler)\//.test(nid)) {
            return 'vendor-react';
          }
          // Framer Motion / motion
          if (/node_modules\/(framer-motion|motion|motion-utils)\//.test(nid)) {
            return 'vendor-motion';
          }
          // Socket.io runtime (~200 kB)
          if (/node_modules\/(socket\.io-client|engine\.io-client|@socket\.io|xmlhttprequest-ssl)\//.test(nid)) {
            return 'vendor-socket';
          }
          // Charts / D3 (~300 kB)
          if (/node_modules\/(recharts|d3-[^/]+|d3)\//.test(nid)) {
            return 'vendor-charts';
          }
          // Icons — tree-shaken but still large
          if (/node_modules\/(lucide-react|@phosphor-icons)\//.test(nid)) {
            return 'vendor-icons';
          }
          // Radix UI primitives + shadcn utilities
          if (/node_modules\/(@radix-ui|cmdk|vaul)\//.test(nid)) {
            return 'vendor-ui';
          }
        },
        // Optimize chunk naming for cache busting
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    // Compression & minification (esbuild is built-in, no extra package needed)
    minify: 'esbuild',
    // Source maps for debugging (disable in production for smaller size)
    sourcemap: false,
    // Chunk size warning threshold
    chunkSizeWarningLimit: 1000, // 1MB warning
  },
  plugins: [
    react(),
    tailwindcss(),
    // createIconImportProxy() as PluginOption,
    // sparkPlugin() as PluginOption,
  ],
  optimizeDeps: {
    include: [],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'apps/dashboard'),
      '@packages': path.resolve(__dirname, 'packages'),
      'events': path.resolve(__dirname, 'packages/utils/events-shim.ts')
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
  },
});