/**
 * Grants.gov API Integration
 * Fetches funding opportunities from Grants.gov
 *
 * API Documentation: https://www.grants.gov/web/grants/xml-extract.html
 * XML Extract endpoint provides grant opportunities in RSS format
 */

import { Grant, GrantQueryResult } from '../types.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('GrantsGovSource');

// Simulated grants.gov data (in production, use actual API)
const SAMPLE_GRANTS: Grant[] = [
  {
    id: 'grants-gov-001',
    title: 'AI Research and Development Initiative',
    agency: 'NSF',
    description: 'Funding for advanced AI research projects focusing on inference, optimization, and safety.',
    fundingAmount: 500000,
    deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    url: 'https://www.grants.gov/search-results/search/grants/21-001',
    source: 'grants-gov',
    discoveredAt: new Date().toISOString(),
    category: 'Research',
    eligibility: ['Universities', 'Research Institutions', 'Non-profit'],
    tags: ['AI', 'LLM', 'Inference', 'Optimization'],
  },
  {
    id: 'grants-gov-002',
    title: 'Machine Learning Infrastructure Support',
    agency: 'DOE',
    description: 'Support for ML infrastructure and computing resources.',
    fundingAmount: 750000,
    deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    url: 'https://www.grants.gov/search-results/search/grants/21-002',
    source: 'grants-gov',
    discoveredAt: new Date().toISOString(),
    category: 'Infrastructure',
    eligibility: ['Government', 'Universities', 'Labs'],
    tags: ['ML', 'Computing', 'Hardware', 'Clusters'],
  },
  {
    id: 'grants-gov-003',
    title: 'Open Source Software Development Grants',
    agency: 'NSF',
    description: 'Funding for open source projects with community impact.',
    fundingAmount: 300000,
    deadline: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
    url: 'https://www.grants.gov/search-results/search/grants/21-003',
    source: 'grants-gov',
    discoveredAt: new Date().toISOString(),
    category: 'Development',
    eligibility: ['Non-profit', 'Community Organizations', 'Open Source Projects'],
    tags: ['Open Source', 'Software', 'Development', 'Community'],
  },
];

export class GrantsGovSource {
  /**
   * Fetch grants from Grants.gov API
   * In production, this would call the actual Grants.gov API
   */
  async fetchGrants(keywords?: string): Promise<GrantQueryResult> {
    try {
      logger.info('Fetching from Grants.gov', { keywords });

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // In production, call actual API:
      // const response = await fetch('https://www.grants.gov/cgi-bin/GOVDB_DUMP.cgi', {
      //   method: 'POST',
      //   body: new FormData({
      //     'is_approved': 'Y',
      //     'keyword': keywords || '',
      //     'filename': 'GrantsDB_Extract'
      //   }),
      // });

      const grants = SAMPLE_GRANTS;

      logger.info(`✅ Fetched ${grants.length} grants from Grants.gov`);

      return {
        success: true,
        count: grants.length,
        grants,
        timestamp: new Date().toISOString(),
        source: 'grants-gov',
      };
    } catch (error) {
      logger.error('Failed to fetch from Grants.gov', error);

      return {
        success: false,
        count: 0,
        grants: [],
        timestamp: new Date().toISOString(),
        source: 'grants-gov',
      };
    }
  }

  /**
   * Search for specific funding opportunities
   */
  async searchGrants(query: {
    keyword?: string;
    agency?: string;
    fundingMin?: number;
  }): Promise<GrantQueryResult> {
    try {
      logger.info('Searching Grants.gov', query);

      const grants = SAMPLE_GRANTS.filter(grant => {
        if (query.keyword) {
          const kw = query.keyword.toLowerCase();
          if (!grant.title.toLowerCase().includes(kw) && !grant.description.toLowerCase().includes(kw)) {
            return false;
          }
        }

        if (query.agency && grant.agency !== query.agency) {
          return false;
        }

        if (query.fundingMin && grant.fundingAmount < query.fundingMin) {
          return false;
        }

        return true;
      });

      logger.info(`Found ${grants.length} grants matching search criteria`);

      return {
        success: true,
        count: grants.length,
        grants,
        timestamp: new Date().toISOString(),
        source: 'grants-gov',
      };
    } catch (error) {
      logger.error('Search failed', error);

      return {
        success: false,
        count: 0,
        grants: [],
        timestamp: new Date().toISOString(),
        source: 'grants-gov',
      };
    }
  }
}
