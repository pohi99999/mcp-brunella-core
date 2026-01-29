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
        this.pythonShell = new PythonShell('myai/refiner_logic.py');
        this.logger = new Logger('data-scientist.log');
    }

    async execute(task: string, context?: any): Promise<any> {
        this.logger.info(`Processing task: ${task}`);

        if (task.startsWith("refine:")) {
            const rawContent = context?.content;
            const source = context?.source || "unknown";
            
            if (!rawContent) {
                return { status: "error", error: "No content provided for refinement." };
            }

            // A PythonShell wrapperbe olyan kódot küldünk, ami importálja a refinert
            const pythonCode = `
from myai.refiner_logic import refiner
payload = {"content": context.get("content"), "source": context.get("source")}
result = refiner.process_data(payload)
if result:
    print(json.dumps(result))
else:
    print(json.dumps({"status": "REJECTED"}))
`;
            
            try {
                const resultStr = await this.pythonShell.run(pythonCode, { content: rawContent, source });
                return JSON.parse(resultStr);
            } catch (e: any) {
                return { status: "error", error: e.message };
            }
        }

        return { status: "error", error: "Unknown task." };
    }
}