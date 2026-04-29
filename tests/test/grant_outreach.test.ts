import { describe, it, expect, vi } from 'vitest';
import { outreachService } from '@packages/core-logic/outreachService.js';
import fs from 'fs/promises';
import path from 'path';

describe('Grant-Aware Outreach Email Generation', () => {
    
    it('should generate an email with Demján Sándor Program details', async () => {
        const lead = {
            company_name: 'Teszt Gyár Kft',
            icebreaker_text: 'Nagyon tetszett a legutóbbi innovációjuk a gyártósoron.',
            demo_url: 'https://demo.brunella.ai/preview/mfg-123'
        };

        const email = await outreachService.generateGrantOutreachEmail(lead, 'demjan-sandor-2026');
        
        expect(email).toContain('Teszt Gyár Kft');
        expect(email).toContain('Demján Sándor Program');
        expect(email).toContain('90%-os');
        expect(email).toContain('mfg-123');
    });

    it('should fallback to default grant if ID not found', async () => {
        const lead = { company_name: 'Small Shop' };
        const email = await outreachService.generateGrantOutreachEmail(lead, 'non-existent-grant');
        
        expect(email).toContain('Small Shop');
        // Should contain the first grant from the list (Demján Sándor)
        expect(email).toContain('Demján Sándor Program');
    });
});
