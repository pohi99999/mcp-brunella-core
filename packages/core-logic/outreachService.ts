import fs from 'fs/promises';
import path from 'path';
import { logInfo, logError } from '@packages/utils/logger.js';
import nodemailer from 'nodemailer';

interface OutreachAccount {
    id: string;
    user: string;
    pass: string;
    host: string;
    port: number;
    daily_limit: number;
    sent_today: number;
    last_sent_at: string | null;
}

interface OutreachConfig {
    accounts: OutreachAccount[];
    global_settings: any;
}

const CONFIG_PATH = path.join(process.cwd(), 'config', 'outreach_accounts.json');

export class OutreachService {
    private config: OutreachConfig | null = null;

    async loadConfig() {
        try {
            const data = await fs.readFile(CONFIG_PATH, 'utf-8');
            this.config = JSON.parse(data);
        } catch (err) {
            logError("OutreachService", `Failed to load config: ${err}`);
        }
    }

    async saveConfig() {
        if (!this.config) return;
        try {
            await fs.writeFile(CONFIG_PATH, JSON.stringify(this.config, null, 4));
        } catch (err) {
            logError("OutreachService", `Failed to save config: ${err}`);
        }
    }

    private checkDailyReset() {
        if (!this.config) return;
        const today = new Date().toISOString().split('T')[0];
        
        for (const account of this.config.accounts) {
            if (account.last_sent_at) {
                const lastDate = account.last_sent_at.split('T')[0];
                if (lastDate !== today) {
                    account.sent_today = 0;
                }
            }
        }
    }

    async getNextAccount(): Promise<OutreachAccount | null> {
        await this.loadConfig();
        if (!this.config) return null;

        this.checkDailyReset();

        const available = this.config.accounts
            .filter(a => a.sent_today < a.daily_limit)
            .sort((a, b) => a.sent_today - b.sent_today);

        if (available.length === 0) {
            logError("OutreachService", "No accounts available under daily limit!");
            return null;
        }

        return available[0];
    }

    async markAsSent(accountId: string) {
        if (!this.config) return;
        
        const account = this.config.accounts.find(a => a.id === accountId);
        if (account) {
            account.sent_today += 1;
            account.last_sent_at = new Date().toISOString();
            await this.saveConfig();
            logInfo("OutreachService", `Account ${account.user} count updated: ${account.sent_today}/${account.daily_limit}`);
        }
    }

    /**
     * Generates a grant-aware outreach email.
     */
    async generateGrantOutreachEmail(lead: any, grantId: string = 'demjan-sandor-2026'): Promise<string> {
        const grantsData = await fs.readFile(path.join(process.cwd(), 'config', 'grants_2026.json'), 'utf-8');
        const { grants } = JSON.parse(grantsData);
        const grant = grants.find((g: any) => g.id === grantId) || grants[0];

        return `Tisztelt ${lead.company_name}!

${lead.icebreaker_text || 'Érdeklődéssel figyelem az Önök piaci tevékenységét.'}

Szeretném figyelmükbe ajánlani, hogy a Brunella AI Agent System bevezetése most a ${grant.name} keretében akár ${grant.support_rate}-os vissza nem térítendő támogatással is megvalósítható.

Készítettem Önöknek egy rövid, személyre szabott bemutatót, amely az Önök üzleti folyamataira reflektál:
${lead.demo_url || 'https://demo.brunella.ai/preview/generic'}

Amennyiben érdekli Önöket a technológia és a finanszírozási lehetőség, szívesen állok rendelkezésre egy rövid egyeztetésre.

Üdvözlettel,
${process.env.OUTREACH_SENDER_NAME || 'Pohánka Péter'}
Brunella AI Team`;
    }

    /**
     * Sends an outreach email using rotating SMTP accounts.
     */
    async sendEmail(to: string, subject: string, body: string): Promise<boolean> {
        const account = await this.getNextAccount();
        if (!account) {
            logError("OutreachService", `Cannot send email to ${to}: No available accounts.`);
            return false;
        }

        logInfo("OutreachService", `Sending email to ${to} via ${account.user}...`);

        const transporter = nodemailer.createTransport({
            host: account.host,
            port: account.port,
            secure: account.port === 465,
            auth: {
                user: account.user,
                pass: account.pass
            }
        });

        try {
            await transporter.sendMail({
                from: `"${process.env.OUTREACH_SENDER_NAME || 'Pohánka Péter'}" <${account.user}>`,
                to,
                subject,
                text: body, // Plain text is better for cold emails in 2026
                // html: `<div>${body.replace(/\n/g, '<br>')}</div>`
            });

            await this.markAsSent(account.id);
            logInfo("OutreachService", `Email successfully sent to ${to}`);
            return true;
        } catch (err: any) {
            logError("OutreachService", `Failed to send email to ${to}: ${err.message}`);
            return false;
        }
    }
}

export const outreachService = new OutreachService();


