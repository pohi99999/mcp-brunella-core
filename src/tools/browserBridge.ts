import { spawn } from 'child_process';
import path from 'path';

// Konfiguráció
const PYTHON_PATH = process.env.PYTHON_PATH || 'python'; // Vagy a venv útvonala!
const WORKER_SCRIPT = path.join(process.cwd(), 'myai', 'browser_worker.py');

interface BrowserResult {
    status: 'success' | 'error';
    data: { result?: string };
    message?: string;
}

export async function runBrowserTask(taskOrPayload: string | object): Promise<string> {
    return new Promise((resolve, reject) => {
        // Bemeneti adatok JSON-be csomagolva
        const inputArgs = typeof taskOrPayload === 'string' 
            ? JSON.stringify({ task: taskOrPayload, apiKey: process.env.GOOGLE_API_KEY })
            : JSON.stringify({ ...taskOrPayload, apiKey: process.env.GOOGLE_API_KEY });

        const pythonProcess = spawn(PYTHON_PATH, [WORKER_SCRIPT, inputArgs]);

        let outputData = '';
        let errorData = '';

        // Adatgyűjtés a Python kimenetéről
        pythonProcess.stdout.on('data', (data) => {
            outputData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorData += data.toString();
        });

        // Folyamat lezárása
        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`Browser Worker Hiba (Exit Code ${code}):`, errorData);
                return reject(new Error(`A robotkéz hibára futott: ${errorData || 'Ismeretlen hiba'}`));
            }

            try {
                // Megpróbáljuk megtalálni az utolsó érvényes JSON blokkot a kimenetben
                const lines = outputData.trim().split('\n');
                let jsonResult = null;
                
                for (let i = lines.length - 1; i >= 0; i--) {
                    try {
                        const line = lines[i].trim();
                        if (line.startsWith('{') && line.endsWith('}')) {
                            const parsed = JSON.parse(line);
                            if (parsed && typeof parsed === 'object' && 'status' in parsed) {
                                jsonResult = parsed;
                                break;
                            }
                        }
                    } catch (e) {
                        continue;
                    }
                }

                if (!jsonResult) {
                    throw new Error(`Nem található érvényes JSON válasz a kimenetben. Nyers kimenet: ${outputData}`);
                }

                const result: BrowserResult = jsonResult;
                
                if (result.status === 'success') {
                    resolve(result.data.result || "Sikeres, de nincs szöveges válasz.");
                } else {
                    reject(new Error(result.message));
                }
            } catch (e: any) {
                reject(new Error(`Nem sikerült értelmezni a Python választ: ${e.message}`));
            }
        });
    });
}