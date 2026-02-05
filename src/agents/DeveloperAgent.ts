import { IAgent } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { globalPythonShell } from '../utils/pythonShell.js';

export class DeveloperAgent implements IAgent {
    name = "Developer";
    role = "Coder";
    description = "Generates and executes code using Python Interpreter.";
    capabilities = ["run_python", "generate_code"];

    async execute(task: string, context?: any): Promise<any> {
        const taskDesc = task.length > 80 ? task.slice(0, 77) + '...' : task;
        setAgentStatus(this.name, 'working', taskDesc);
        logInfo(this.name, `Processing task: ${task}`);

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
                logError(this.name, e.message);
                return { status: "error", error: e.message };
            } finally {
                setAgentStatus(this.name, 'idle');
            }
        }

        setAgentStatus(this.name, 'idle');
        return { 
            status: "ignored", 
            message: "Developer needs explicit 'code' in context or clear python syntax in task." 
        };
    }
}
