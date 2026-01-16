import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { google } from 'googleapis';
import { getGoogleAuth } from '../utils/googleAuth.js';

export function registerGoogleWorkspaceTools(server: McpServer) {
    
    // GMAIL: List Messages
    server.tool(
        "gmail_list_messages",
        "Lists recent emails from Gmail.",
        {
            maxResults: z.number().default(10),
        },
        async ({ maxResults }) => {
            try {
                const auth = await getGoogleAuth();
                const gmail = google.gmail({ version: 'v1', auth });
                const res = await gmail.users.messages.list({ userId: 'me', maxResults });
                
                const messages = res.data.messages || [];
                const details = await Promise.all(messages.map(async (msg) => {
                    const m = await gmail.users.messages.get({ userId: 'me', id: msg.id! });
                    return {
                        id: msg.id,
                        snippet: m.data.snippet,
                        from: m.data.payload?.headers?.find(h => h.name === 'From')?.value
                    };
                }));

                return {
                    content: [{ type: "text", text: JSON.stringify(details, null, 2) }]
                };
            } catch (e: any) {
                return { isError: true, content: [{ type: "text", text: `Gmail Error: ${e.message}` }] };
            }
        }
    );

    // CALENDAR: List Events
    server.tool(
        "calendar_list_events",
        "Lists upcoming events from Google Calendar.",
        {
            maxResults: z.number().default(10),
        },
        async ({ maxResults }) => {
            try {
                const auth = await getGoogleAuth();
                const calendar = google.calendar({ version: 'v3', auth });
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
            } catch (e: any) {
                return { isError: true, content: [{ type: "text", text: `Calendar Error: ${e.message}` }] };
            }
        }
    );
}
