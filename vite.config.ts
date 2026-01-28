import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: 'src/dashboard',
  publicDir: '../../public',
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
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/dashboard')
    }
  },
});