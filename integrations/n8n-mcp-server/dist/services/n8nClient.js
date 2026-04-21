import axios, { AxiosError } from "axios";
export const CHARACTER_LIMIT = 25000;
export function createN8nClient(config) {
    const client = axios.create({
        baseURL: `${config.baseUrl}/api/v1`,
        timeout: 30000,
        headers: {
            "X-N8N-API-KEY": config.apiKey,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    });
    return client;
}
export function getClientConfig() {
    const baseUrl = process.env.N8N_BASE_URL || "http://localhost:5678";
    const apiKey = process.env.N8N_API_KEY;
    if (!apiKey) {
        throw new Error("N8N_API_KEY nincs beállítva. Állítsd be a N8N_API_KEY környezeti változót. " +
            "Az API kulcsot az n8n Settings > n8n API menüpontban találod.");
    }
    return { baseUrl, apiKey };
}
export function handleApiError(error) {
    if (error instanceof AxiosError) {
        if (error.message.includes("N8N_API_KEY"))
            return error.message;
        if (error.response) {
            switch (error.response.status) {
                case 401:
                    return "Hiba: Érvénytelen API kulcs. Ellenőrizd az N8N_API_KEY értékét.";
                case 403:
                    return "Hiba: Hozzáférés megtagadva. Az API kulcsnak nincs jogosultsága ehhez a művelethez.";
                case 404:
                    return "Hiba: Az erőforrás nem található. Ellenőrizd az azonosítót.";
                case 409:
                    return "Hiba: Konfliktus – az erőforrás már létezik vagy aktív állapotban van.";
                case 422: {
                    const detail = error.response.data?.message || JSON.stringify(error.response.data);
                    return `Hiba: Érvénytelen adatok: ${detail}`;
                }
                case 429:
                    return "Hiba: Túl sok kérés (rate limit). Várj egy kicsit, majd próbáld újra.";
                case 500:
                    return "Hiba: n8n belső szerverhiba. Ellenőrizd az n8n naplókat.";
                default:
                    return `Hiba: Az n8n API kérés ${error.response.status} státuszkóddal sikertelen: ${JSON.stringify(error.response.data)}`;
            }
        }
        if (error.code === "ECONNREFUSED") {
            return `Hiba: Nem sikerült kapcsolódni az n8n-hez (${error.config?.baseURL}). Ellenőrizd, hogy fut-e az n8n, és az N8N_BASE_URL helyes-e.`;
        }
        if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
            return "Hiba: Időtúllépés (30s). Az n8n szerver nem válaszolt időben.";
        }
    }
    return `Hiba: ${error instanceof Error ? error.message : String(error)}`;
}
export function truncateIfNeeded(text, context) {
    if (text.length <= CHARACTER_LIMIT)
        return text;
    const msg = context
        ? `\n\n[Tartalom csonkítva ${text.length} → ${CHARACTER_LIMIT} karakterre. ${context}]`
        : `\n\n[Tartalom csonkítva ${text.length} → ${CHARACTER_LIMIT} karakterre. Használj szűrőket a részletek megtekintéséhez.]`;
    return text.slice(0, CHARACTER_LIMIT - msg.length) + msg;
}
//# sourceMappingURL=n8nClient.js.map