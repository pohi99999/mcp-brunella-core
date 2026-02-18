/**
 * Grants.gov API Integration
 * Fetches funding opportunities from Grants.gov
 *
 * API Documentation: https://www.grants.gov/web/grants/xml-extract.html
 * XML Extract endpoint provides grant opportunities in RSS format
 */
import { GrantQueryResult } from '../types.js';
export declare class GrantsGovSource {
    /**
     * Fetch grants from Grants.gov API
     * In production, this would call the actual Grants.gov API
     */
    fetchGrants(keywords?: string): Promise<GrantQueryResult>;
    /**
     * Search for specific funding opportunities
     */
    searchGrants(query: {
        keyword?: string;
        agency?: string;
        fundingMin?: number;
    }): Promise<GrantQueryResult>;
}
