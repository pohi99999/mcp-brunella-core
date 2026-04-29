import { Router } from 'express';
import { saveStudioProject, getStudioProjects, updateProjectStatus } from '@packages/utils/db.js';
import { agentManager } from '@packages/agents/AgentManager.js';
import { studioRunner } from '@packages/utils/StudioRunner.js';
import { ensureError } from '@packages/utils/ensureError.js';
import { logWarn, logError } from '@packages/utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

interface StudioProjectRecord {
    id: string;
    name: string;
    description?: string | null;
    tech_stack?: string | null;
    root_dir: string;
    status?: string | null;
}

// ============================================================================
// Vite React scaffold — creates a minimal runnable app in rootDir
// ============================================================================

async function scaffoldViteReact(rootDir: string, opts: { name: string; description: string }) {
    const safeName = opts.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-');

    await fs.writeFile(path.join(rootDir, 'package.json'), JSON.stringify({
        name: safeName,
        version: '0.1.0',
        scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
        dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
        devDependencies: {
            vite: '^5.0.0',
            '@vitejs/plugin-react': '^4.0.0',
            '@types/react': '^18.2.0',
            '@types/react-dom': '^18.2.0',
            typescript: '^5.0.0'
        }
    }, null, 2));

    await fs.writeFile(path.join(rootDir, 'index.html'), `<!DOCTYPE html>
<html lang="hu">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${opts.name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`);

    await fs.writeFile(path.join(rootDir, 'vite.config.ts'), `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()] });
`);

    await fs.writeFile(path.join(rootDir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
            target: 'ES2020', useDefineForClassFields: true, lib: ['ES2020', 'DOM', 'DOM.Iterable'],
            module: 'ESNext', skipLibCheck: true, moduleResolution: 'bundler',
            allowImportingTsExtensions: true, resolveJsonModule: true,
            isolatedModules: true, noEmit: true, jsx: 'react-jsx', strict: true
        },
        include: ['src']
    }, null, 2));

    await fs.mkdir(path.join(rootDir, 'src'), { recursive: true });

    await fs.writeFile(path.join(rootDir, 'src', 'main.tsx'), `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`);

    await fs.writeFile(path.join(rootDir, 'src', 'App.tsx'), `import React from 'react';

export default function App() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', background: '#0a0a0a', color: '#fff', minHeight: '100vh' }}>
      <h1 style={{ color: '#7c3aed' }}>🚧 ${opts.name}</h1>
      <p style={{ color: '#888' }}>${opts.description}</p>
      <p style={{ color: '#555', fontSize: '0.8rem' }}>Az ügynökök dolgoznak a kódon...</p>
    </div>
  );
}
`);
}

// ============================================================================
// Routes
// ============================================================================

export function createStudioRoutes(): Router {
    const router = Router();

    router.get('/projects', async (req, res) => {
        try {
            const projects = await getStudioProjects();
            res.json({ success: true, projects });
        } catch (error: unknown) {
            const normalized = ensureError(error);
            logError('StudioRoutes', 'Project listing failed', normalized);
            res.status(500).json({ success: false, error: normalized.message });
        }
    });

    router.post('/projects', async (req, res) => {
        try {
            const { name, description, tech_stack } = req.body;
            if (!name) {
                return res.status(400).json({ success: false, error: 'name is required' });
            }

            const id = uuidv4();
            const rootDir = path.join(process.cwd(), 'data', 'studio', id);

            await fs.mkdir(rootDir, { recursive: true });

            // 1. Scaffold minimal Vite React app (instant, no LLM needed)
            await scaffoldViteReact(rootDir, { name, description: description || '' });

            // 2. Save project to DB
            const project = { id, name, description, tech_stack: tech_stack || 'React + Vite', root_dir: rootDir, status: 'scaffolded' };
            await saveStudioProject(project);

            // 3. Start dev server via StudioRunner (npm install + npm run dev)
            //    Fire-and-forget: studio:log and studio:ready events will be emitted to Socket.IO
            void studioRunner.startProject(id, rootDir).catch((error: unknown) => {
                const normalized = ensureError(error);
                logWarn('StudioRoutes', `Studio runner startup failed for project ${id}: ${normalized.message}`);
            });

            // 4. Trigger LLM agent swarm to generate real code into rootDir
            agentManager.queueTask(
                `Hozd létre a(z) "${name}" alkalmazást. Technológia: ${tech_stack || 'React + Vite + TypeScript'}. Leírás: ${description || ''}. A fájlokat a következő könyvtárba írj: ${rootDir}`,
                'orchestrator',
                { projectId: id, studioMode: true, rootDir }
            );

            res.json({ success: true, project });
        } catch (error: unknown) {
            const normalized = ensureError(error);
            logError('StudioRoutes', 'Project creation failed', normalized);
            res.status(500).json({ success: false, error: normalized.message });
        }
    });

    router.post('/projects/:id/iterate', async (req, res) => {
        try {
            const { instruction } = req.body;
            const projectId = req.params.id;

            const projects = await getStudioProjects() as StudioProjectRecord[];
            const project = projects.find((entry) => entry.id === projectId);

            if (!project) {
                return res.status(404).json({ success: false, error: 'Project not found' });
            }

            updateProjectStatus(projectId, 'coding');

            agentManager.queueTask(
                `MÓDOSÍTÁS: ${instruction} a(z) "${project.name}" projektben (${project.root_dir}). Tartsd meg a meglévő funkciókat, de alkalmazd a változtatást. A fájlokat a következő könyvtárba írj: ${project.root_dir}`,
                'orchestrator',
                { projectId, studioMode: true, rootDir: project.root_dir, isIteration: true }
            );

            res.json({ success: true, message: 'Iteration started' });
        } catch (error: unknown) {
            const normalized = ensureError(error);
            logError('StudioRoutes', 'Project iteration failed', normalized);
            res.status(500).json({ success: false, error: normalized.message });
        }
    });

    return router;
}
