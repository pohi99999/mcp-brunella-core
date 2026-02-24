import { agentManager } from '../agents/AgentManager.js';
import { logInfo, logError } from '../utils/logger.js';
import { BuyAlert } from './alertDispatcher.js';

/**
 * SalesOutreach - Automatikus értékesítési folyamat kezelő.
 * Beköti a Machine Hunter találatait a Sales & Marketing Swarmba.
 */
class SalesOutreach {
    private readonly TAG = 'SalesOutreach';

    /**
     * Új profit-lehetőség esetén elindítja a marketing folyamatot.
     */
    async initiateOutreach(alert: BuyAlert): Promise<void> {
        logInfo(this.TAG, `Outreach folyamat indítása: ${alert.title}`);

        try {
            // 1. LÉPÉS: Sales Hunter - Kapcsolattartó keresése a forrás alapján
            const hunterTask = `Kutasd fel a(z) ${alert.source} oldalon található '${alert.title}' gép hirdetőjének elérhetőségeit. Keress cégnevet és ha lehet, email címet. URL: ${alert.url}`;
            const hunterResult: any = await agentManager.delegate('sales_hunter', hunterTask);
            
            const contactInfo = hunterResult.data || "Ismeretlen hirdető";

            // 2. LÉPÉS: Copywriter - Személyre szabott teaser email írása
            const copyTask = `Írj egy professzionális, rövid teaser emailt magyarul egy potenciális vevőnek a következő géphez: '${alert.title}'. 
            Ár: ${alert.priceEur} EUR. Becsült piaci érték: ${alert.estimatedValueEur} EUR. 
            Hangsúlyozd a profit-lehetőséget! 
            Hirdető infó: ${JSON.stringify(contactInfo)}`;
            
            const copyResult: any = await agentManager.delegate('copywriter', copyTask);
            const emailDraft = copyResult.message || copyResult.data?.content;

            // 3. LÉPÉS: Sales - Email kiküldése vagy CRM-be rögzítése
            const salesTask = `Rögzítsd a következő leadet a CRM-ben és készítsd elő a kiküldésre ezt az emailt:
            Tárgy: Profit-lehetőség: ${alert.title}
            Tartalom: ${emailDraft}`;
            
            await agentManager.delegate('sales', salesTask);

            logInfo(this.TAG, `✅ Outreach sikeresen előkészítve a következő géphez: ${alert.title}`);

        } catch (error) {
            logError(this.TAG, `Hiba az outreach folyamat során: ${error}`);
        }
    }
}

export const salesOutreach = new SalesOutreach();
