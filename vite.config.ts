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