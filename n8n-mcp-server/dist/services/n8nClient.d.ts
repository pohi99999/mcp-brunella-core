import { AxiosInstance } from "axios";
export declare const CHARACTER_LIMIT = 25000;
export interface N8nClientConfig {
    baseUrl: string;
    apiKey: string;
}
export declare function createN8nClient(config: N8nClientConfig): AxiosInstance;
export declare function getClientConfig(): N8nClientConfig;
export declare function handleApiError(error: unknown): string;
export declare function truncateIfNeeded(text: string, context?: string): string;
//# sourceMappingURL=n8nClient.d.ts.map