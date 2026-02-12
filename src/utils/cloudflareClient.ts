import axios from 'axios';

export interface CloudflareTaskResponse {
    success: boolean;
    taskId: string;
    type: string;
    result?: any;
    message: string;
}

export class CloudflareClient {
    private baseUrl: string;

    constructor(url?: string) {
        this.baseUrl = url || process.env.CLOUDFLARE_WORKER_URL || 'https://bas-orchestrator.iam-dd1.workers.dev';
    }

    async submitTask(instruction: string, context: Record<string, any> = {}): Promise<CloudflareTaskResponse> {
        try {
            const response = await axios.post<CloudflareTaskResponse>(`${this.baseUrl}/task`, {
                instruction,
                context
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 60000 // A kódgenerálás eltarthat egy ideig
            });

            return response.data;
        } catch (error: any) {
            const message = error.response?.data?.error || error.message;
            throw new Error(`Cloudflare submission failed: ${message}`);
        }
    }

    async checkStatus(taskId: string): Promise<any> {
        try {
            const response = await axios.get(`${this.baseUrl}/status/${taskId}`);
            return response.data;
        } catch (error: any) {
            throw new Error(`Status check failed: ${error.message}`);
        }
    }

    async fetchHistory(limit: number = 20): Promise<any> {
        try {
            const response = await axios.get(`${this.baseUrl}/history?limit=${limit}`);
            return response.data;
        } catch (error: any) {
            throw new Error(`History fetch failed: ${error.message}`);
        }
    }
}

export const cloudflareClient = new CloudflareClient();
