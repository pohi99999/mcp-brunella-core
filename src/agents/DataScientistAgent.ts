import { PythonShell } from '../utils/pythonShell.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('data-scientist.log');

export class DataScientistAgent {
    private pythonShell: PythonShell;
    private initialized: boolean = false;

    constructor() {
        this.pythonShell = new PythonShell();
    }

    private async init() {
        if (this.initialized) return;
        try {
            await this.pythonShell.start();
            await this.pythonShell.loadScript('myai/refiner_logic.py');
            this.initialized = true;
            logger.log("DataScientistAgent initialized with refiner logic.", 'info');
        } catch (error) {
            logger.log(`Failed to initialize DataScientistAgent: ${error}`, 'error');
            throw error;
        }
    }

    /**
     * Refines raw data using the Python Refiner logic.
     * @param rawContent The text to process.
     * @param source Source identifier (e.g. 'user', 'web').
     * @returns Refined JSON object or null if dropped/error.
     */
    async refineData(rawContent: string, source: string = 'unknown') {
        await this.init();
        logger.log(`Adattisztítás megkezdése forrásból: ${source}`);

        const payload = {
            content: rawContent,
            source: source
        };

        try {
            // Using the global 'refiner' instance created in the python script
            const pythonCommand = `print(json.dumps(refiner.process_data(${JSON.stringify(payload)})))`;
            const result = await this.pythonShell.execute(pythonCommand);

            // Attempt to parse result
            try {
                // The result string might contain newlines or whitespace
                const cleanedResult = result.trim();
                const parsedData = JSON.parse(cleanedResult);

                if (parsedData) {
                    logger.log("Sikeres zajszűrés.", 'info');
                    return parsedData;
                } else {
                    logger.log("Az adat zajnak minősült vagy hiba történt (null return).", 'warn');
                    return null;
                }
            } catch (parseError) {
                logger.log(`Hiba a válasz parse-olásakor: ${result}`, 'error');
                return null;
            }

        } catch (error) {
            logger.log(`Hiba az adattisztítás során: ${error}`, 'error');
            return null;
        }
    }
    
    async stop() {
        this.pythonShell.stop();
    }
}
