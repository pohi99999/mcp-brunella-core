import { IAgent } from './types.js';
import { PythonShell } from '../utils/pythonShell.js';
import { Logger } from '../utils/logger.js';

export class DataScientistAgent implements IAgent {
    name = "DataScientist";
    role = "Refiner";
    description = "Cleans, structures, and validates raw data using Python logic.";
    capabilities = ["clean_text", "extract_entities", "validate_data"];
    
    private pythonShell: PythonShell;
    private logger: Logger;

    constructor() {
        // We use an interactive shell or just execute commands.
        // Note: PythonShell ctor usually takes a script path to start,
        // but here we might want to just run snippets or keep the logic loaded.
        // Assuming PythonShell handles 'myai/refiner_logic.py' by starting it.
        // However, refiner_logic.py defines a class and instance, it doesn't run a loop by itself unless designed to.
        // We will use the 'run' method which typically sends code to stdin or executes a script.
        // To be safe and compatible with the previous 'browser_worker' pattern,
        // we'll rely on the shell's ability to execute the import and call.
        this.pythonShell = new PythonShell('interactive_stub.py'); // Use a generic entry or rely on run()
        this.logger = new Logger('data-scientist.log');
    }

    async execute(task: string, context?: any): Promise<any> {
        this.logger.info(`Processing task: ${task}`);

        if (task.startsWith("refine:")) {
            return this.refineData(context?.content, context?.source);
        }

        return { status: "error", error: "Unknown task." };
    }

    /**
     * Nyers adat feldolgozása és zajmentesítése
     */
    async refineData(rawContent: string, source: string = "unknown") {
        this.logger.info(`Adattisztítás megkezdése forrásból: ${source}`);

        if (!rawContent) {
            return { status: "error", error: "No content provided." };
        }

        const payload = {
            content: rawContent,
            source: source
        };

        try {
            // A Python script 'process_data' metódusának hívása
            // We need to ensure json is imported in the shell context
            const code = `
import json
import sys
# Ensure myai is in path if needed, usually it is relative to cwd
sys.path.append('.')
from myai.refiner_logic import refiner

payload = ${JSON.stringify(payload)}
result = refiner.process_data(payload)
print(json.dumps(result))
`;
            const result = await this.pythonShell.run(code);
            
            // The result might contain extra logs if not strictly controlled,
            // but PythonShell.run usually captures stdout.
            // We try to find the last JSON object.
            const lines = result.trim().split('\n');
            const lastLine = lines[lines.length - 1];

            let cleanedData;
            try {
                cleanedData = JSON.parse(lastLine);
            } catch {
                // Fallback: try parsing the whole output if it's just JSON
                cleanedData = JSON.parse(result);
            }

            if (cleanedData && cleanedData.status !== 'dropped' && cleanedData.status !== 'error') {
                this.logger.info("Sikeres zajszűrés. Adat továbbítva.");
                return cleanedData;
            } else {
                this.logger.warn(`Adat eldobva vagy hiba: ${cleanedData?.reason || cleanedData?.error}`);
                return cleanedData;
            }
        } catch (error: any) {
            this.logger.error(`Hiba az adattisztítás során: ${error}`);
            return { status: "error", error: error.message };
        }
    }
}