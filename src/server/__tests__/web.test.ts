import request from 'supertest';
import { createApp } from '../web';

describe('Web Server Static Serving', () => {
    let app: any;

    beforeAll(() => {
        app = createApp();
    });

    it('should serve index.html from the root', async () => {
        const response = await request(app).get('/');
        // It might redirect or serve index.html directly
        expect([200, 301, 302]).toContain(response.status);
        if (response.status === 200) {
             expect(response.headers['content-type']).toMatch(/text\/html/);
        }
    });
});
