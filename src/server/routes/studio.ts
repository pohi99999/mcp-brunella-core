import { Router } from 'express';
import { saveStudioProject, getStudioProjects, updateProjectStatus } from '../../utils/db.js';
import { agentManager } from '../../agents/AgentManager.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

export function createStudioRoutes(): Router {
    const router = Router();

    router.get('/projects', async (req, res) => {
        try {
            const projects = await getStudioProjects();
            res.json({ success: true, projects });
        } catch (e: any) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    router.post('/projects', async (req, res) => {
        try {
            const { name, description, tech_stack } = req.body;
            const id = uuidv4();
            const rootDir = path.join(process.cwd(), 'data', 'studio', id);

            await fs.mkdir(rootDir, { recursive: true });

            const project = { id, name, description, tech_stack, root_dir: rootDir, status: 'ideation' };
            await saveStudioProject(project);

            // Trigger Orchestrator to start the development swarm
            agentManager.queueTask(
                `Hozd létre a(z) ${name} alkalmazást. Technológia: ${tech_stack}. Leírás: ${description}`, 
                'orchestrator', 
                { projectId: id, studioMode: true, rootDir }
            );

            res.json({ success: true, project });
        } catch (e: any) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    router.post('/projects/:id/iterate', async (req, res) => {
        try {
            const { instruction } = req.body;
            const projectId = req.params.id;
            
            // Get project details from DB
            const projects = await getStudioProjects();
            const project = projects.find((p: any) => p.id === projectId) as any;

            if (!project) {
                return res.status(404).json({ success: false, error: 'Project not found' });
            }

            updateProjectStatus(projectId, 'coding');

            // Trigger Orchestrator for iteration
            agentManager.queueTask(
                `MODOSÍTÁS: ${instruction} a(z) ${project.name} projektben. Tartsd meg a meglévő funkciókat, de alkalmazd a változtatást.`, 
                'orchestrator', 
                { projectId, studioMode: true, rootDir: project.root_dir, isIteration: true }
            );

            res.json({ success: true, message: 'Iteration started' });
        } catch (e: any) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    return router;
}
