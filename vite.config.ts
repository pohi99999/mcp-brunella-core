import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: 'src/dashboard',
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
        // Manual chunk splitting for better caching
        manualChunks: {
          // Vendor chunk: React ecosystem
          'vendor-react': ['react', 'react-dom'],
          // Vendor chunk: UI libraries
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tooltip', '@radix-ui/react-slot'],
          // Vendor chunk: Charts & visualization
          'vendor-charts': ['recharts', 'react-grid-layout'],
          // Vendor chunk: Icons
          'vendor-icons': ['lucide-react'],
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
    include: ['react-grid-layout', 'react-grid-layout/legacy'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/dashboard')
    }
  },
});