import fs from 'fs';
import path from 'path';

export interface DiscoveredServer {
    name: string;
    type: 'python' | 'node';
    path: string;
}

export class DiscoveryService {
    private serverDirs: string[];

    constructor() {
        this.serverDirs = [
            path.join(process.cwd(), 'src', 'servers'),
            // Ide jöhetnek a bővítmények szerver mappái is
        ];
    }

    public async findServers(): Promise<DiscoveredServer[]> {
        const servers: DiscoveredServer[] = [];

        for (const dir of this.serverDirs) {
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const fullPath = path.join(dir, file);
                    if (file.endsWith('.py')) {
                        servers.push({
                            name: path.basename(file, '.py'),
                            type: 'python',
                            path: fullPath
                        });
                    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
                         // Node szerverek (feltételezzük, hogy a .ts fájl egy önálló szerver belépési pont)
                         // Ez nem mindig igaz, de most egyszerűsítünk
                        servers.push({
                            name: path.basename(file, '.ts'),
                            type: 'node',
                            path: fullPath
                        });
                    }
                }
            }
        }
        return servers;
    }
}
