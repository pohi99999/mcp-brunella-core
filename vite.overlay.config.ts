import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: 'src/dashboard/overlay',
  build: {
    outDir: '../../../build/overlay',
    emptyOutDir: true,
    lib: {
      entry: 'index.tsx',
      name: 'BrunellaOverlay',
      formats: ['iife'],
      fileName: () => 'overlay.bundle.js'
    },
    rollupOptions: {
      output: {
        extend: true,
      }
    }
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/dashboard')
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  }
});
