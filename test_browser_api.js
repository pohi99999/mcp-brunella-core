/**
 * Quick test of CloudflareBrowserAPI with Global key authentication
 */
import { CloudflareBrowserAPI } from './build/utils/browserRendering.js';

async function testBrowserAPI() {
    try {
        console.log('🧪 Testing CF Browser Rendering API with Global key...');
        
        // Manually set environment variables for test
        process.env.CF_GLOBAL_API_KEY = '3d477d3095d6174dd1f904c710c22763f7655';
        process.env.CF_EMAIL = 'peterpohankapersonal@gmail.com';
        process.env.CLOUDFLARE_ACCOUNT_ID = '1bf6118df97f0e12f3592a89d90deb1e';
        
        const api = new CloudflareBrowserAPI();
        
        // Test screenshot endpoint (least likely to hit complex rate limits)
        console.log('📸 Testing /screenshot endpoint...');
        const result = await api.screenshot({ 
            url: 'https://httpbin.org/html',
            screenshotOptions: { 
                type: 'png',
                fullPage: false
            },
            viewport: { width: 800, height: 600 }
        });
        
        console.log('✅ Screenshot result:', {
            success: result.success,
            mimeType: result.mimeType,
            size: result.size ? `${result.size} bytes` : 'N/A',
            browserMs: result.browserMs,
            executionTime: result.executionTime,
            error: result.error
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testBrowserAPI();