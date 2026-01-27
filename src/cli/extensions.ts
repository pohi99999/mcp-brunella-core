import fs from 'fs';
import path from 'path';
import os from 'os';

export interface Extension {
    name: string;
    description: string;
    version: string;
    activate: (context: any) => Promise<void>;
    deactivate?: () => Promise<void>;
}

export class ExtensionManager {
    private extensions: Map<string, Extension> = new Map();
    private extensionPaths: string[];

    constructor() {
        this.extensionPaths = [
            path.join(process.cwd(), 'extensions'),
            path.join(os.homedir(), '.gemini', 'extensions')
        ];
    }

    public async discoverExtensions(): Promise<void> {
        for (const extPath of this.extensionPaths) {
            if (fs.existsSync(extPath)) {
                const files = fs.readdirSync(extPath);
                for (const file of files) {
                    const fullPath = path.join(extPath, file);
                    if (fs.statSync(fullPath).isDirectory()) {
                        // Csomag alapú kiterjesztés (pl. index.js vagy package.json)
                        await this.loadExtensionFromDir(fullPath);
                    }
                }
            }
        }
    }

    private async loadExtensionFromDir(dirPath: string) {
        try {
            // Próbáljuk betölteni a main fájlt (pl. index.js)
            // Itt egyszerűsítünk: feltételezzük, hogy van egy index.js vagy a package.json megmondja
            const pkgJsonPath = path.join(dirPath, 'package.json');
            let mainFile = 'index.js';

            if (fs.existsSync(pkgJsonPath)) {
                const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
                if (pkg.main) {
                    mainFile = pkg.main;
                }
            }

            const modulePath = path.join(dirPath, mainFile);
            if (fs.existsSync(modulePath)) {
                 // Dinamikus import (működnie kell TS-node-dal és lefordítva is)
                 const extensionModule = await import(modulePath);
                 
                 // Feltételezzük, hogy a modul exportál egy 'extension' objektumot vagy default exportot ami megfelel az interfésznek
                 const extension: Extension = extensionModule.default || extensionModule.extension;

                 if (extension && typeof extension.activate === 'function') {
                     this.extensions.set(extension.name, extension);
                     console.log(`Extension loaded: ${extension.name} v${extension.version}`);
                 }
            }
        } catch (error) {
            console.error(`Failed to load extension from ${dirPath}:`, error);
        }
    }

    public getExtensions(): Extension[] {
        return Array.from(this.extensions.values());
    }

    public async activateExtension(name: string, context: any) {
        const ext = this.extensions.get(name);
        if (ext) {
            await ext.activate(context);
        }
    }
}
