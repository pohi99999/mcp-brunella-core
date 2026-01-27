import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

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
    private extensionRoot: string;

    constructor() {
        // Alapértelmezett telepítési hely: BRUNELLA_HOME vagy ~/.brunella/extensions
        const brunellaHome = process.env.BRUNELLA_HOME || path.join(os.homedir(), '.brunella');
        this.extensionRoot = path.join(brunellaHome, 'extensions');

        this.extensionPaths = [
            path.join(process.cwd(), 'extensions'),               // projekt-specifikus
            this.extensionRoot,                                  // felhasználói szint
            path.join(this.extensionRoot, 'node_modules'),       // npm prefixelt installok
        ];

        // Gondoskodunk a könyvtár létrehozásáról
        if (!fs.existsSync(this.extensionRoot)) {
            fs.mkdirSync(this.extensionRoot, { recursive: true });
        }
        this.ensurePackageJson();
    }

    public async discoverExtensions(): Promise<void> {
        const visited = new Set<string>();
        for (const extPath of this.extensionPaths) {
            if (fs.existsSync(extPath)) {
                const files = fs.readdirSync(extPath);
                for (const file of files) {
                    const fullPath = path.join(extPath, file);
                    if (fs.statSync(fullPath).isDirectory()) {
                        // Scoped packages (@scope/name) kezelése
                        if (file.startsWith('@')) {
                            const scoped = fs.readdirSync(fullPath);
                            for (const scopedPkg of scoped) {
                                const scopedPath = path.join(fullPath, scopedPkg);
                                if (fs.statSync(scopedPath).isDirectory() && !visited.has(scopedPath)) {
                                    visited.add(scopedPath);
                                    await this.loadExtensionFromDir(scopedPath);
                                }
                            }
                            continue;
                        }

                        if (!visited.has(fullPath)) {
                            visited.add(fullPath);
                            // Csomag alapú kiterjesztés (pl. index.js vagy package.json)
                            await this.loadExtensionFromDir(fullPath);
                        }
                    }
                }
            }
        }
    }

    private async loadExtensionFromDir(dirPath: string) {
        try {
            // Próbáljuk betölteni a main fájlt (pl. index.js)
            const pkgJsonPath = path.join(dirPath, 'package.json');
            let entryFiles: string[] = ['index.js'];

            if (fs.existsSync(pkgJsonPath)) {
                const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
                if (pkg?.brunella?.extension && typeof pkg.brunella.extension === 'string') {
                    entryFiles = [pkg.brunella.extension];
                } else if (Array.isArray(pkg?.brunella?.extensions)) {
                    entryFiles = pkg.brunella.extensions.filter((entry: unknown) => typeof entry === 'string');
                } else if (pkg.main) {
                    entryFiles = [pkg.main];
                }
            }

            for (const entry of entryFiles) {
                const modulePath = path.join(dirPath, entry);
                if (!fs.existsSync(modulePath)) {
                    continue;
                }

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

    public getExtensionRoot(): string {
        return this.extensionRoot;
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

    public installExtension(nameOrUrl: string): void {
        this.ensurePackageJson();
        // npm kezeli a package nevet, tarballt vagy git URL-t is
        const cmd = `npm install ${nameOrUrl} --no-fund --no-audit`;
        execSync(cmd, { stdio: 'inherit', cwd: this.extensionRoot });
    }

    public uninstallExtension(name: string): void {
        this.ensurePackageJson();
        const cmd = `npm uninstall ${name} --no-fund --no-audit`;
        execSync(cmd, { stdio: 'inherit', cwd: this.extensionRoot });
        // Maradvány könyvtárak takarítása
        const dir = path.join(this.extensionRoot, 'node_modules', name);
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }

    public updateExtension(name?: string): void {
        this.ensurePackageJson();
        const cmd = name
            ? `npm update ${name} --no-fund --no-audit`
            : 'npm update --no-fund --no-audit';
        execSync(cmd, { stdio: 'inherit', cwd: this.extensionRoot });
    }

    public summarizeLoaded(): string[] {
        return this.getExtensions().map(e => e.name);
    }

    private ensurePackageJson() {
        const pkgPath = path.join(this.extensionRoot, 'package.json');
        if (!fs.existsSync(pkgPath)) {
            const pkg = {
                name: 'brunella-extensions',
                private: true,
                version: '0.0.0',
                description: 'Brunella CLI extensions (auto-managed)'
            };
            fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
        }
    }
}
