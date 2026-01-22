"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerGoogleWorkspaceTools = registerGoogleWorkspaceTools;
const zod_1 = require("zod");
const googleapis_1 = require("googleapis");
const googleAuth_js_1 = require("../utils/googleAuth.js");
function registerGoogleWorkspaceTools(server) {
    // GMAIL: List Messages
    server.tool("gmail_list_messages", "Lists recent emails from Gmail.", {
        maxResults: zod_1.z.number().default(10),
    }, async ({ maxResults }) => {
        try {
            const auth = await (0, googleAuth_js_1.getGoogleAuth)();
            const gmail = googleapis_1.google.gmail({ version: 'v1', auth });
            const res = await gmail.users.messages.list({ userId: 'me', maxResults });
            const messages = res.data.messages || [];
            const details = await Promise.all(messages.map(async (msg) => {
                const m = await gmail.users.messages.get({ userId: 'me', id: msg.id });
                return {
                    id: msg.id,
                    snippet: m.data.snippet,
                    from: m.data.payload?.headers?.find(h => h.name === 'From')?.value
                };
            }));
            return {
                content: [{ type: "text", text: JSON.stringify(details, null, 2) }]
            };
        }
        catch (e) {
            return { isError: true, content: [{ type: "text", text: `Gmail Error: ${e.message}` }] };
        }
    });
    // CALENDAR: List Events
    server.tool("calendar_list_events", "Lists upcoming events from Google Calendar.", {
        maxResults: zod_1.z.number().default(10),
    }, async ({ maxResults }) => {
        try {
            const auth = await (0, googleAuth_js_1.getGoogleAuth)();
            const calendar = googleapis_1.google.calendar({ version: 'v3', auth });
            const res = await calendar.events.list({
                calendarId: 'primary',
                timeMin: (new Date()).toISOString(),
                maxResults,
                singleEvents: true,
                orderBy: 'startTime',
            });
            const events = res.data.items || [];
            const formatted = events.map(e => ({
                summary: e.summary,
                start: e.start?.dateTime || e.start?.date,
                location: e.location
            }));
            return {
                content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }]
            };
        }
        catch (e) {
            return { isError: true, content: [{ type: "text", text: `Calendar Error: ${e.message}` }] };
        }
    });
}
