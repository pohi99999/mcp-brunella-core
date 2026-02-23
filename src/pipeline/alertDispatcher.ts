import { socketService } from '../server/SocketService.js';
import { logInfo, logError } from '../utils/logger.js';

export interface BuyAlert {
    id: string;
    title: string;
    priceEur: number;
    estimatedValueEur: number;
    discountPct: number;
    score: number;
    source: string;
    url: string;
    timestamp: string;
    category: string;
}

/**
 * AlertDispatcher - Központi riasztás-kezelő egység.
 * Feladata a profit-lehetőségek (BUY ajánlások) szűrése és továbbítása a UI felé.
 */
class AlertDispatcher {
    private readonly TAG = 'AlertDispatcher';

    /**
     * Új "BUY" ajánlat érkezésekor hívandó.
     * @param alert Az ajánlat adatai
     */
    async dispatchBuyAlert(alert: BuyAlert): Promise<void> {
        logInfo(this.TAG, `Új profit-lehetőség: ${alert.title} @ ${alert.priceEur} EUR (${alert.discountPct}% diszkont)`);

        try {
            // 1. Küldés Socket.IO-n keresztül a Dashboardnak
            socketService.emit('machine:alert', {
                ...alert,
                type: 'BUY_RECOMMENDATION',
                severity: alert.score > 0.8 ? 'critical' : 'warning'
            });

            // 2. Rendszernapló bejegyzés
            socketService.broadcastLog(
                `🔥 PROFIT OPPORTUNITY: ${alert.title} found on ${alert.source}. Est. Profit: ${alert.estimatedValueEur - alert.priceEur} EUR`,
                alert.score > 0.8 ? 'success' : 'info',
                this.TAG
            );

            // TODO: Itt lehetne bekötni a NotificationService-t (Email/Slack)
            
        } catch (error) {
            logError(this.TAG, `Hiba a riasztás kiküldése során: ${error}`);
        }
    }

    /**
     * Machine Hunter eredmények tömeges feldolgozása
     */
    async processHunterResults(results: any): Promise<void> {
        if (!results || !results.top_buys || !Array.isArray(results.top_buys)) {
            return;
        }

        for (const buy of results.top_buys) {
            await this.dispatchBuyAlert({
                id: buy.listing_id,
                title: buy.title,
                priceEur: buy.price_eur,
                estimatedValueEur: buy.estimated_value_eur,
                discountPct: buy.discount_pct,
                score: buy.arbitrage_score,
                source: results.sources_used[0] || 'unknown',
                url: '', // A listing-ből kinyerhető ha benne van
                timestamp: buy.generated_at,
                category: 'industrial_machine'
            });
        }
    }
}

export const alertDispatcher = new AlertDispatcher();
