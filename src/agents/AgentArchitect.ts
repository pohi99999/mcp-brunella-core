import fs from 'fs';
import path from 'path';
import { logInfo, logError } from '../utils/logger.js';
import { generateResponse } from '../core/llm_client.js';
import { agentManager } from './AgentManager.js';
import { DynamicAgent } from './DynamicAgent.js';

export interface CreateAgentRequest {
    name: string;
    role: string;
    description: string;
    capabilities: string[];
    triggers: string[];
    systemPrompt?: string;
}

export class AgentArchitect {
    /**
     * Új ügynök létrehozása: TOML mentése, registry frissítése és regisztráció
     */
    static async createAgent(req: CreateAgentRequest): Promise<{ success: boolean; message: string }> {
        logInfo('AgentArchitect', `Új ügynök tervezése: ${req.name}`);

        try {
            const safeName = req.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const tomlFileName = `${safeName}.toml`;
            const tomlPath = path.join(process.cwd(), 'myai', 'agents', tomlFileName);
            const registryPath = path.join(process.cwd(), 'src', 'agents', 'registry.json');

            // 1. System Prompt generálása ha nincs megadva
            let systemPrompt = req.systemPrompt;
            if (!systemPrompt) {
                logInfo('AgentArchitect', `System Prompt generálása a következőhöz: ${req.role}`);
                const generationPrompt = `
                Feladat: Írj egy profi System Promptot egy MI ügynök számára.
                Név: ${req.name}
                Szerepkör: ${req.role}
                Leírás: ${req.description}
                Képességek: ${req.capabilities.join(', ')}
                
                A prompt legyen strukturált, használjon Role, Objective és Constraints szekciókat.
                Magyarul válaszolj. Csak a prompt szövegét add vissza, semmi mást.
                `;
                systemPrompt = await generateResponse(generationPrompt);
            }

            // 2. TOML tartalom összeállítása
            const tomlContent = `name = "${safeName}"
displayName = "${req.role}"
description = "${req.description}"
systemPrompt = """
${systemPrompt.replace(/"/g, '\\"')}
"""
capabilities = [${req.capabilities.map(c => `"${c}"`).join(', ')}]
triggers = [${req.triggers.map(t => `"${t}"`).join(', ')}]
query = "\${task}"
`;

            // 3. TOML mentése
            fs.writeFileSync(tomlPath, tomlContent);
            logInfo('AgentArchitect', `TOML elmentve: ${tomlPath}`);

            // 4. Registry frissítése (Source és Build is)
            const registryPaths = [
                path.join(process.cwd(), 'src', 'agents', 'registry.json'),
                path.join(process.cwd(), 'build', 'agents', 'registry.json')
            ];

            for (const rPath of registryPaths) {
                if (!fs.existsSync(rPath)) continue;

                try {
                    const registryContent = fs.readFileSync(rPath, 'utf-8');
                    const registry = JSON.parse(registryContent);

                    // Ellenőrizzük, létezik-e már
                    const existingIndex = registry.agents.findIndex((a: any) => a.name === safeName);
                    const agentEntry = {
                        name: safeName,
                        title: req.role,
                        description: req.description,
                        class: "DynamicAgent",
                        module: "./agents/DynamicAgent",
                        config: {
                            tomlPath: `myai/agents/${tomlFileName}`
                        },
                        capabilities: req.capabilities,
                        triggers: req.triggers,
                        category: "generated",
                        status: "active",
                        tags: ["generated", ...req.capabilities]
                    };

                    if (existingIndex >= 0) {
                        registry.agents[existingIndex] = agentEntry;
                    } else {
                        registry.agents.push(agentEntry);
                    }

                    fs.writeFileSync(rPath, JSON.stringify(registry, null, 2));
                    logInfo('AgentArchitect', `Registry frissítve: ${rPath}`);
                } catch (err: any) {
                    logError('AgentArchitect', `Hiba a registry frissítésekor (${rPath}): ${err.message}`);
                }
            }

            // 5. Azonnali regisztráció az AgentManagerbe
            // Keresünk egy definíciót a példányosításhoz (a legfrissebbet használjuk)
            const finalAgentEntry = {
                name: safeName,
                title: req.role,
                description: req.description,
                class: "DynamicAgent",
                module: "./agents/DynamicAgent",
                config: {
                    tomlPath: `myai/agents/${tomlFileName}`
                },
                capabilities: req.capabilities,
                triggers: req.triggers,
                category: "generated",
                status: "active",
                tags: ["generated", ...req.capabilities]
            };

            const newAgent = new DynamicAgent(finalAgentEntry.config);
            // Kézzel beállítjuk az AgentManager által is elvárt mezőket
            (newAgent as any).name = safeName;
            (newAgent as any).description = req.description;
            (newAgent as any).role = req.role;

            agentManager.registerAgent(newAgent);

            return { 
                success: true, 
                message: `A(z) ${req.name} ügynök sikeresen létrehozva és aktiválva.` 
            };

        } catch (error: any) {
            logError('AgentArchitect', `Hiba az ügynök létrehozásakor: ${error.message}`);
            return { success: false, message: error.message };
        }
    }
}
