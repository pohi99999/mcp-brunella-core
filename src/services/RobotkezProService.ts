/**
 * RobotkezProService - Bridge to the Python Action Server
 */
export class RobotkezProService {
    private static instance: RobotkezProService;
    private baseUrl: string = 'http://localhost:8090';

    public static getInstance(): RobotkezProService {
        if (!RobotkezProService.instance) {
            RobotkezProService.instance = new RobotkezProService();
        }
        return RobotkezProService.instance;
    }

    async sendTask(task: string) {
        try {
            const response = await fetch(`${this.baseUrl}/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ task })
            });
            return await response.json();
        } catch (error) {
            console.error('RobotkezProService error:', error);
            return { status: 'error', message: String(error) };
        }
    }

    async navigate(url: string) {
        try {
            const response = await fetch(`${this.baseUrl}/navigate?url=${encodeURIComponent(url)}`, {
                method: 'POST'
            });
            return await response.json();
        } catch (error) {
            console.error('RobotkezProService navigate error:', error);
            return { status: 'error', message: String(error) };
        }
    }
}
