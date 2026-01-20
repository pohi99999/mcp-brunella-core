import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";
import path from "path";

// import sparkPlugin from "@github/spark/spark-vite-plugin";
// import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";

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
      '@': path.resolve(process.cwd(), 'src/dashboard')
    }
  },
});