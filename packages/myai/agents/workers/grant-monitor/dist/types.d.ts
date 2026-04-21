/**
 * Grant Monitor Worker Types
 * Defines interfaces for grant data, funding opportunities, and storage
 */
export interface Grant {
    id: string;
    title: string;
    agency: string;
    description: string;
    fundingAmount: number;
    deadline: string;
    url: string;
    source: 'grants-gov' | 'nsf' | 'doi' | 'nih' | 'custom';
    discoveredAt: string;
    category: string;
    eligibility: string[];
    tags: string[];
}
export interface GrantQueryResult {
    success: boolean;
    count: number;
    grants: Grant[];
    timestamp: string;
    source: string;
}
export interface D1Result<T = any> {
    success: boolean;
    error?: string;
    results?: T[];
    data?: T;
}
export interface GrantStoreResult {
    id: string;
    storedAt: string;
    status: 'success' | 'error';
    message?: string;
}
export interface CronTrigger {
    cron: string;
    trigger: {
        request: Request;
    };
}
export interface WorkerEnv {
    DB: any;
    ENVIRONMENT: 'production' | 'development';
    LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
}
export interface GrantSearchQuery {
    keyword?: string;
    agency?: string;
    minAmount?: number;
    maxAmount?: number;
    category?: string;
    limit?: number;
    offset?: number;
}
export interface GrantFeedItem {
    grantId: string;
    title: string;
    deadline: string;
    fundingAmount: number;
    relevanceScore: number;
}
export interface CacheEntry<T> {
    data: T;
    cachedAt: string;
    expiresAt: string;
}
