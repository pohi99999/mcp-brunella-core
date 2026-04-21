import { logInfo, logWarn } from '@packages/utils/logger.js';
import dns from 'dns/promises';

export type EmailValidationResult = 'valid' | 'invalid' | 'catch-all' | 'unknown';

/**
 * Validates an email address using Regex and DNS MX record check.
 * Can be extended to use Hunter.io or ZeroBounce APIs.
 */
export async function validateEmail(email: string): Promise<EmailValidationResult> {
    if (!email || !email.includes('@')) {
        return 'invalid';
    }

    // 1. Basic Regex Check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return 'invalid';
    }

    // 2. DNS MX Record Check
    const domain = email.split('@')[1];
    try {
        const mxRecords = await dns.resolveMx(domain);
        if (!mxRecords || mxRecords.length === 0) {
            logWarn("EmailValidator", `No MX records found for domain: ${domain}`);
            return 'invalid';
        }
    } catch (err) {
        logWarn("EmailValidator", `DNS lookup failed for domain ${domain}: ${err}`);
        return 'invalid';
    }

    // 3. Hunter.io / ZeroBounce Integration (Placeholder)
    // If API key is present in process.env, use it here.
    if (process.env.HUNTER_API_KEY) {
        logInfo("EmailValidator", `Using Hunter.io API for ${email}`);
        // Implementation here...
    }

    return 'valid';
}

