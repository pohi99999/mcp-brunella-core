import { IAgent } from './types.js';
import { Logger } from '../utils/logger.js';
import { globalPythonShell } from '../utils/pythonShell.js';

export class DeveloperAgent implements IAgent {
    name = "Developer";
    role = "Coder";
    description = "Generates and executes code using Python Interpreter.";
    capabilities = ["run_python", "generate_code"];
    
    private logger: Logger;

    constructor() {
        this.logger = new Logger('developer.log');
    }

    async execute(task: string, context?: any): Promise<any> {
        this.logger.info(`Processing task: ${task}`);

        // Try to find code in context or task
        let code = context?.code;
        
        // Basic extraction if code is not explicit
        if (!code && (task.includes("print(") || task.includes("import "))) {
             code = task;
        }

        if (code) {
            try {
                const result = await globalPythonShell.run(code);
                return { 
                    status: "success", 
                    output: result,
                    message: "Code executed successfully via Python API."
                };
            } catch (e: any) {
                return { status: "error", error: e.message };
            }
        }

        return { 
            status: "ignored", 
            message: "Developer needs explicit 'code' in context or clear python syntax in task." 
        };
    }
}
