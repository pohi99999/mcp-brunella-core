#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";
import { createN8nClient, getClientConfig, handleApiError, truncateIfNeeded, } from "./services/n8nClient.js";
const server = new McpServer({
    name: "n8n-mcp-server",
    version: "1.0.0",
});
// ─────────────────────────────────────────────
// Segédfüggvény: API kliens – minden hívásnál frissen olvassa a config-ot
// ─────────────────────────────────────────────
function client() {
    return createN8nClient(getClientConfig());
}
// ─────────────────────────────────────────────
// Közös Zod sémák
// ─────────────────────────────────────────────
var ResponseFormat;
(function (ResponseFormat) {
    ResponseFormat["MARKDOWN"] = "markdown";
    ResponseFormat["JSON"] = "json";
})(ResponseFormat || (ResponseFormat = {}));
const PaginationSchema = z.object({
    limit: z.number().int().min(1).max(100).default(20)
        .describe("Visszaadott elemek maximális száma (1–100, alapértelmezett: 20)"),
    cursor: z.string().optional()
        .describe("Lapozáshoz: az előző válasz nextCursor értéke"),
    response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
        .describe("Kimenet formátuma: 'markdown' (olvasható) vagy 'json' (gépi feldolgozáshoz)"),
});
// ─────────────────────────────────────────────
// ESZKÖZ 1: Workflow-ok listázása
// ─────────────────────────────────────────────
server.registerTool("n8n_list_workflows", {
    title: "n8n Workflow-ok listázása",
    description: `Visszaadja az n8n példányban lévő workflow-ok listáját lapozhatóan.

Visszaadott mezők: id, name, active, createdAt, updatedAt, tagek.

Args:
  - limit (number): Max visszaadott elem száma 1–100 (alapértelmezett: 20)
  - cursor (string): Lapozáshoz használt kurzor (az előző válasz nextCursor értéke)
  - active (boolean): Ha true, csak aktív workflow-okat ad vissza; ha false, csak inaktívakat
  - name (string): Szűrés workflow neve alapján (részleges egyezés)
  - response_format ('markdown'|'json'): Kimenet formátuma (alapértelmezett: 'markdown')

Returns:
  Workflow-ok listája lapozással. A nextCursor mezőt add meg cursor paraméterként a következő laphoz.

Példa: n8n_list_workflows({active: true}) → összes aktív workflow`,
    inputSchema: z.object({
        ...PaginationSchema.shape,
        active: z.boolean().optional()
            .describe("Ha megadva: true = csak aktív, false = csak inaktív workflow-ok"),
        name: z.string().optional()
            .describe("Szűrés workflow neve alapján (részleges szöveg egyezés)"),
    }),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
    },
}, async (params) => {
    try {
        const queryParams = { limit: params.limit };
        if (params.cursor)
            queryParams["cursor"] = params.cursor;
        if (params.active !== undefined)
            queryParams["active"] = params.active;
        if (params.name)
            queryParams["name"] = params.name;
        const res = await client().get("/workflows", { params: queryParams });
        const workflows = res.data.data ?? [];
        const nextCursor = res.data.nextCursor;
        if (workflows.length === 0) {
            return { content: [{ type: "text", text: "Nincs workflow a megadott szűrőkkel." }] };
        }
        const structured = {
            count: workflows.length,
            has_more: Boolean(nextCursor),
            next_cursor: nextCursor,
            workflows: workflows.map((w) => ({
                id: w.id,
                name: w.name,
                active: w.active,
                created_at: w.createdAt,
                updated_at: w.updatedAt,
                tags: w.tags?.map((t) => t.name) ?? [],
            })),
        };
        let text;
        if (params.response_format === ResponseFormat.JSON) {
            text = JSON.stringify(structured, null, 2);
        }
        else {
            const lines = [
                `## n8n Workflow-ok (${workflows.length} db${nextCursor ? ", több is van" : ""})`,
                "",
            ];
            for (const w of structured.workflows) {
                const status = w.active ? "✅ Aktív" : "⏸ Inaktív";
                const tags = w.tags.length ? ` [${w.tags.join(", ")}]` : "";
                lines.push(`- **${w.name}** (id: \`${w.id}\`) — ${status}${tags}`);
            }
            if (nextCursor)
                lines.push("", `*Következő lap: cursor = \`${nextCursor}\`*`);
            text = lines.join("\n");
        }
        return {
            content: [{ type: "text", text: truncateIfNeeded(text, "Szűkítsd a lekérdezést a name vagy active paraméterekkel.") }],
            structuredContent: structured,
        };
    }
    catch (err) {
        return { isError: true, content: [{ type: "text", text: handleApiError(err) }] };
    }
});
// ─────────────────────────────────────────────
// ESZKÖZ 2: Egyedi workflow lekérése
// ─────────────────────────────────────────────
server.registerTool("n8n_get_workflow", {
    title: "n8n Workflow részletei",
    description: `Visszaadja egy adott workflow teljes részleteit, beleértve a node-okat és összeköttetéseket.

Args:
  - workflow_id (string): A workflow egyedi azonosítója
  - response_format ('markdown'|'json'): Kimenet formátuma (alapértelmezett: 'markdown')

Returns:
  Workflow neve, állapota, létrehozás/módosítás dátuma, node-ok listája és összeköttetések.

Példa: n8n_get_workflow({workflow_id: "abc123"})`,
    inputSchema: z.object({
        workflow_id: z.string().min(1).describe("A workflow egyedi azonosítója"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
            .describe("Kimenet formátuma"),
    }),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
    },
}, async (params) => {
    try {
        const res = await client().get(`/workflows/${params.workflow_id}`);
        const w = res.data;
        const nodes = Array.isArray(w.nodes) ? w.nodes : [];
        const structured = {
            id: w.id,
            name: w.name,
            active: w.active,
            created_at: w.createdAt,
            updated_at: w.updatedAt,
            tags: w.tags?.map((t) => t.name) ?? [],
            node_count: nodes.length,
            nodes: nodes.map((n) => ({
                name: n.name ?? "?",
                type: n.type ?? "?",
                disabled: n.disabled ?? false,
            })),
        };
        let text;
        if (params.response_format === ResponseFormat.JSON) {
            text = JSON.stringify(structured, null, 2);
        }
        else {
            const lines = [
                `## ${w.name}`,
                "",
                `- **ID**: \`${w.id}\``,
                `- **Állapot**: ${w.active ? "✅ Aktív" : "⏸ Inaktív"}`,
                `- **Létrehozva**: ${new Date(w.createdAt).toLocaleString("hu-HU")}`,
                `- **Módosítva**: ${new Date(w.updatedAt).toLocaleString("hu-HU")}`,
            ];
            if (structured.tags.length)
                lines.push(`- **Tagek**: ${structured.tags.join(", ")}`);
            lines.push("", `### Node-ok (${nodes.length} db)`, "");
            for (const n of structured.nodes) {
                const dis = n.disabled ? " *(disabled)*" : "";
                lines.push(`- **${n.name}** — \`${n.type}\`${dis}`);
            }
            text = lines.join("\n");
        }
        return {
            content: [{ type: "text", text: truncateIfNeeded(text) }],
            structuredContent: structured,
        };
    }
    catch (err) {
        return { isError: true, content: [{ type: "text", text: handleApiError(err) }] };
    }
});
// ─────────────────────────────────────────────
// ESZKÖZ 3: Workflow aktiválása
// ─────────────────────────────────────────────
server.registerTool("n8n_activate_workflow", {
    title: "n8n Workflow aktiválása",
    description: `Aktivál egy adott n8n workflow-t (elindítja a triggereit).

Args:
  - workflow_id (string): Az aktiválandó workflow azonosítója

Returns:
  Megerősítés az aktiválásról, a workflow aktuális állapotával.

Figyelem: Csak akkor aktiválható, ha a workflow rendelkezik triggerrel.`,
    inputSchema: z.object({
        workflow_id: z.string().min(1).describe("Az aktiválandó workflow azonosítója"),
    }),
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
    },
}, async (params) => {
    try {
        const res = await client().post(`/workflows/${params.workflow_id}/activate`);
        const w = res.data;
        return {
            content: [{
                    type: "text",
                    text: `✅ Workflow aktiválva: **${w.name}** (\`${w.id}\`) — Állapot: ${w.active ? "aktív" : "inaktív"}`,
                }],
            structuredContent: { id: w.id, name: w.name, active: w.active },
        };
    }
    catch (err) {
        return { isError: true, content: [{ type: "text", text: handleApiError(err) }] };
    }
});
// ─────────────────────────────────────────────
// ESZKÖZ 4: Workflow deaktiválása
// ─────────────────────────────────────────────
server.registerTool("n8n_deactivate_workflow", {
    title: "n8n Workflow deaktiválása",
    description: `Deaktiválja az adott n8n workflow-t (leállítja a triggereit).

Args:
  - workflow_id (string): A deaktiválandó workflow azonosítója

Returns:
  Megerősítés a deaktiválásról.`,
    inputSchema: z.object({
        workflow_id: z.string().min(1).describe("A deaktiválandó workflow azonosítója"),
    }),
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
    },
}, async (params) => {
    try {
        const res = await client().post(`/workflows/${params.workflow_id}/deactivate`);
        const w = res.data;
        return {
            content: [{
                    type: "text",
                    text: `⏸ Workflow deaktiválva: **${w.name}** (\`${w.id}\`) — Állapot: ${w.active ? "aktív" : "inaktív"}`,
                }],
            structuredContent: { id: w.id, name: w.name, active: w.active },
        };
    }
    catch (err) {
        return { isError: true, content: [{ type: "text", text: handleApiError(err) }] };
    }
});
// ─────────────────────────────────────────────
// ESZKÖZ 5: Workflow törlése
// ─────────────────────────────────────────────
server.registerTool("n8n_delete_workflow", {
    title: "n8n Workflow törlése",
    description: `Véglegesen törli a megadott workflow-t az n8n-ből.

FIGYELEM: Ez a művelet visszafordíthatatlan! A workflow és minden hozzá tartozó adat elvész.

Args:
  - workflow_id (string): A törlendő workflow azonosítója

Returns:
  Megerősítés a törlésről.`,
    inputSchema: z.object({
        workflow_id: z.string().min(1).describe("A törlendő workflow azonosítója"),
    }),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
    },
}, async (params) => {
    try {
        const res = await client().delete(`/workflows/${params.workflow_id}`);
        const w = res.data;
        return {
            content: [{
                    type: "text",
                    text: `🗑️ Workflow törölve: **${w.name}** (\`${w.id}\`)`,
                }],
            structuredContent: { id: w.id, name: w.name, deleted: true },
        };
    }
    catch (err) {
        return { isError: true, content: [{ type: "text", text: handleApiError(err) }] };
    }
});
// ─────────────────────────────────────────────
// ESZKÖZ 6: Végrehajtások listázása
// ─────────────────────────────────────────────
server.registerTool("n8n_list_executions", {
    title: "n8n Végrehajtások listázása",
    description: `Visszaadja az n8n workflow végrehajtások (executions) listáját lapozhatóan.

Args:
  - limit (number): Max visszaadott elem száma 1–100 (alapértelmezett: 20)
  - cursor (string): Lapozáshoz használt kurzor
  - workflow_id (string): Szűrés egy adott workflow ID alapján
  - status ('running'|'success'|'error'|'waiting'|'canceled'): Szűrés státusz alapján
  - include_data (boolean): Ha true, a végrehajtás adatait is visszaadja (lassabb)
  - response_format ('markdown'|'json'): Kimenet formátuma

Returns:
  Végrehajtások listája időrendben csökkenő sorrendben.

Példa: n8n_list_executions({workflow_id: "abc123", status: "error"}) → hibás futások`,
    inputSchema: z.object({
        ...PaginationSchema.shape,
        workflow_id: z.string().optional()
            .describe("Szűrés: csak ennél a workflow ID-nál lévő végrehajtások"),
        status: z.enum(["running", "success", "error", "waiting", "canceled"]).optional()
            .describe("Szűrés végrehajtás státusza alapján"),
        include_data: z.boolean().default(false)
            .describe("Ha true, a teljes végrehajtási adatot is visszaadja (alapértelmezett: false)"),
    }),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
    },
}, async (params) => {
    try {
        const queryParams = {
            limit: params.limit,
            includeData: params.include_data,
        };
        if (params.cursor)
            queryParams["cursor"] = params.cursor;
        if (params.workflow_id)
            queryParams["workflowId"] = params.workflow_id;
        if (params.status)
            queryParams["status"] = params.status;
        const res = await client().get("/executions", { params: queryParams });
        const executions = res.data.data ?? [];
        const nextCursor = res.data.nextCursor;
        if (executions.length === 0) {
            return { content: [{ type: "text", text: "Nincs végrehajtás a megadott szűrőkkel." }] };
        }
        const structured = {
            count: executions.length,
            has_more: Boolean(nextCursor),
            next_cursor: nextCursor,
            executions: executions.map((e) => ({
                id: e.id,
                workflow_id: e.workflowId,
                workflow_name: e.workflowData?.name,
                status: e.status,
                mode: e.mode,
                started_at: e.startedAt,
                stopped_at: e.stoppedAt,
                finished: e.finished,
            })),
        };
        let text;
        if (params.response_format === ResponseFormat.JSON) {
            text = JSON.stringify(structured, null, 2);
        }
        else {
            const statusIcon = {
                success: "✅", error: "❌", running: "🔄", waiting: "⏳", canceled: "🚫",
            };
            const lines = [
                `## n8n Végrehajtások (${executions.length} db${nextCursor ? ", több is van" : ""})`,
                "",
            ];
            for (const e of structured.executions) {
                const icon = statusIcon[e.status] ?? "❓";
                const started = e.started_at ? new Date(e.started_at).toLocaleString("hu-HU") : "?";
                const name = e.workflow_name ? `**${e.workflow_name}**` : `workflow: ${e.workflow_id}`;
                lines.push(`- ${icon} \`${e.id}\` — ${name} — ${e.mode} — ${started}`);
            }
            if (nextCursor)
                lines.push("", `*Következő lap: cursor = \`${nextCursor}\`*`);
            text = lines.join("\n");
        }
        return {
            content: [{ type: "text", text: truncateIfNeeded(text, "Szűkítsd a workflow_id vagy status paraméterekkel.") }],
            structuredContent: structured,
        };
    }
    catch (err) {
        return { isError: true, content: [{ type: "text", text: handleApiError(err) }] };
    }
});
// ─────────────────────────────────────────────
// ESZKÖZ 7: Egyedi végrehajtás részletei
// ─────────────────────────────────────────────
server.registerTool("n8n_get_execution", {
    title: "n8n Végrehajtás részletei",
    description: `Visszaadja egy adott végrehajtás (execution) teljes részleteit, beleértve a node-ok kimenetét.

Args:
  - execution_id (string): A végrehajtás egyedi azonosítója
  - include_data (boolean): Ha true, a node-ok teljes adatát is visszaadja (alapértelmezett: false)
  - response_format ('markdown'|'json'): Kimenet formátuma

Returns:
  Végrehajtás állapota, kezdési/befejezési ideje, hibák részletei, node-ok eredményei.

Példa: n8n_get_execution({execution_id: "123", include_data: true}) → hibás node azonosítása`,
    inputSchema: z.object({
        execution_id: z.string().min(1).describe("A végrehajtás egyedi azonosítója"),
        include_data: z.boolean().default(false)
            .describe("Ha true, a node-ok teljes adatát is visszaadja"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
            .describe("Kimenet formátuma"),
    }),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
    },
}, async (params) => {
    try {
        const res = await client().get(`/executions/${params.execution_id}`, {
            params: { includeData: params.include_data },
        });
        const e = res.data;
        const structured = {
            id: e.id,
            workflow_id: e.workflowId,
            workflow_name: e.workflowData?.name,
            status: e.status,
            mode: e.mode,
            started_at: e.startedAt,
            stopped_at: e.stoppedAt,
            finished: e.finished,
            retry_of: e.retryOf,
            data: params.include_data ? e.data : undefined,
        };
        let text;
        if (params.response_format === ResponseFormat.JSON) {
            text = JSON.stringify(structured, null, 2);
        }
        else {
            const statusIcon = {
                success: "✅", error: "❌", running: "🔄", waiting: "⏳", canceled: "🚫",
            };
            const icon = statusIcon[e.status] ?? "❓";
            const lines = [
                `## Végrehajtás \`${e.id}\``,
                "",
                `- **Állapot**: ${icon} ${e.status}`,
                `- **Workflow**: ${e.workflowData?.name ?? e.workflowId}`,
                `- **Mód**: ${e.mode}`,
                `- **Kezdés**: ${e.startedAt ? new Date(e.startedAt).toLocaleString("hu-HU") : "—"}`,
                `- **Befejezés**: ${e.stoppedAt ? new Date(e.stoppedAt).toLocaleString("hu-HU") : "—"}`,
            ];
            if (e.retryOf)
                lines.push(`- **Újrapróbálás (retry of)**: \`${e.retryOf}\``);
            if (params.include_data && e.data) {
                lines.push("", "### Végrehajtási adatok", "", "```json", JSON.stringify(e.data, null, 2), "```");
            }
            text = lines.join("\n");
        }
        return {
            content: [{ type: "text", text: truncateIfNeeded(text, "Próbáld include_data: false beállítással.") }],
            structuredContent: structured,
        };
    }
    catch (err) {
        return { isError: true, content: [{ type: "text", text: handleApiError(err) }] };
    }
});
// ─────────────────────────────────────────────
// ESZKÖZ 8: Végrehajtás leállítása
// ─────────────────────────────────────────────
server.registerTool("n8n_stop_execution", {
    title: "n8n Végrehajtás leállítása",
    description: `Leállít egy jelenleg futó n8n végrehajtást.

Args:
  - execution_id (string): A leállítandó végrehajtás azonosítója

Returns:
  Megerősítés a leállításról.

Megjegyzés: Csak 'running' vagy 'waiting' állapotú végrehajtás állítható le.`,
    inputSchema: z.object({
        execution_id: z.string().min(1).describe("A leállítandó végrehajtás azonosítója"),
    }),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
    },
}, async (params) => {
    try {
        const res = await client().post(`/executions/${params.execution_id}/stop`);
        const e = res.data;
        return {
            content: [{
                    type: "text",
                    text: `🛑 Végrehajtás leállítva: \`${e.id}\` — Állapot: ${e.status}`,
                }],
            structuredContent: { id: e.id, status: e.status },
        };
    }
    catch (err) {
        return { isError: true, content: [{ type: "text", text: handleApiError(err) }] };
    }
});
// ─────────────────────────────────────────────
// ESZKÖZ 9: Végrehajtás törlése
// ─────────────────────────────────────────────
server.registerTool("n8n_delete_execution", {
    title: "n8n Végrehajtás törlése",
    description: `Törli a megadott végrehajtást az n8n adatbázisból.

Args:
  - execution_id (string): A törlendő végrehajtás azonosítója

Returns:
  Megerősítés a törlésről.`,
    inputSchema: z.object({
        execution_id: z.string().min(1).describe("A törlendő végrehajtás azonosítója"),
    }),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
    },
}, async (params) => {
    try {
        const res = await client().delete(`/executions/${params.execution_id}`);
        const e = res.data;
        return {
            content: [{
                    type: "text",
                    text: `🗑️ Végrehajtás törölve: \`${e.id}\``,
                }],
            structuredContent: { id: e.id, deleted: true },
        };
    }
    catch (err) {
        return { isError: true, content: [{ type: "text", text: handleApiError(err) }] };
    }
});
// ─────────────────────────────────────────────
// ESZKÖZ 10: Credentials listázása (név + típus, titkos adatok NÉLKÜL)
// ─────────────────────────────────────────────
server.registerTool("n8n_list_credentials", {
    title: "n8n Hitelesítő adatok listázása",
    description: `Listázza az n8n-ben tárolt hitelesítő adatokat (csak neveket és típusokat — titkos adatokat NEM ad vissza).

Args:
  - limit (number): Max visszaadott elem száma 1–100 (alapértelmezett: 20)
  - cursor (string): Lapozáshoz
  - name (string): Szűrés neve alapján
  - response_format ('markdown'|'json'): Kimenet formátuma

Returns:
  Credential-ök listája: id, name, type, createdAt, updatedAt. Jelszavak/tokenek NEM szerepelnek.`,
    inputSchema: z.object({
        ...PaginationSchema.shape,
        name: z.string().optional().describe("Szűrés credential neve alapján"),
    }),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
    },
}, async (params) => {
    try {
        const queryParams = { limit: params.limit };
        if (params.cursor)
            queryParams["cursor"] = params.cursor;
        if (params.name)
            queryParams["name"] = params.name;
        const res = await client().get("/credentials", { params: queryParams });
        const creds = res.data.data ?? [];
        const nextCursor = res.data.nextCursor;
        if (creds.length === 0) {
            return { content: [{ type: "text", text: "Nincs tárolt credential." }] };
        }
        const structured = {
            count: creds.length,
            has_more: Boolean(nextCursor),
            next_cursor: nextCursor,
            credentials: creds.map((c) => ({
                id: c.id,
                name: c.name,
                type: c.type,
                created_at: c.createdAt,
                updated_at: c.updatedAt,
            })),
        };
        let text;
        if (params.response_format === ResponseFormat.JSON) {
            text = JSON.stringify(structured, null, 2);
        }
        else {
            const lines = [
                `## n8n Hitelesítő adatok (${creds.length} db)`,
                "",
            ];
            for (const c of structured.credentials) {
                lines.push(`- **${c.name}** — \`${c.type}\` (id: \`${c.id}\`)`);
            }
            if (nextCursor)
                lines.push("", `*Következő lap: cursor = \`${nextCursor}\`*`);
            text = lines.join("\n");
        }
        return {
            content: [{ type: "text", text: truncateIfNeeded(text) }],
            structuredContent: structured,
        };
    }
    catch (err) {
        return { isError: true, content: [{ type: "text", text: handleApiError(err) }] };
    }
});
// ─────────────────────────────────────────────
// ESZKÖZ 11: Tagek listázása
// ─────────────────────────────────────────────
server.registerTool("n8n_list_tags", {
    title: "n8n Tag-ek listázása",
    description: `Visszaadja az n8n-ben definiált összes workflow taget.

Args:
  - limit (number): Max visszaadott elem 1–100 (alapértelmezett: 50)
  - cursor (string): Lapozáshoz
  - response_format ('markdown'|'json'): Kimenet formátuma

Returns:
  Tagek listája: id, name, létrehozás dátuma.`,
    inputSchema: z.object({
        limit: z.number().int().min(1).max(100).default(50)
            .describe("Max visszaadott tag száma"),
        cursor: z.string().optional().describe("Lapozáshoz"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
            .describe("Kimenet formátuma"),
    }),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
    },
}, async (params) => {
    try {
        const queryParams = { limit: params.limit };
        if (params.cursor)
            queryParams["cursor"] = params.cursor;
        const res = await client().get("/tags", { params: queryParams });
        const tags = res.data.data ?? [];
        const nextCursor = res.data.nextCursor;
        if (tags.length === 0) {
            return { content: [{ type: "text", text: "Nincs definiált tag." }] };
        }
        const structured = {
            count: tags.length,
            has_more: Boolean(nextCursor),
            next_cursor: nextCursor,
            tags: tags.map((t) => ({ id: t.id, name: t.name, created_at: t.createdAt })),
        };
        let text;
        if (params.response_format === ResponseFormat.JSON) {
            text = JSON.stringify(structured, null, 2);
        }
        else {
            const lines = [`## n8n Tag-ek (${tags.length} db)`, ""];
            for (const t of structured.tags) {
                lines.push(`- **${t.name}** (id: \`${t.id}\`)`);
            }
            text = lines.join("\n");
        }
        return {
            content: [{ type: "text", text }],
            structuredContent: structured,
        };
    }
    catch (err) {
        return { isError: true, content: [{ type: "text", text: handleApiError(err) }] };
    }
});
// ─────────────────────────────────────────────
// ESZKÖZ 12: Webhook trigger
// ─────────────────────────────────────────────
server.registerTool("n8n_trigger_webhook", {
    title: "n8n Webhook trigger",
    description: `Küld egy HTTP kérést egy n8n webhook URL-re a workflow elindításához.
Ez az általános módszer a workflow-ok külső triggereléséhez (szemben az API-alapú futtatással).

Args:
  - webhook_path (string): A webhook path (pl. "my-webhook" vagy teljes URL)
  - method ('GET'|'POST'|'PUT'|'DELETE'): HTTP metódus (alapértelmezett: 'POST')
  - data (object): A webhook-nak küldendő JSON adat
  - headers (object): Egyedi HTTP fejlécek

Returns:
  A webhook válasza.

Példa: n8n_trigger_webhook({webhook_path: "brunella-task", data: {task: "analyze"}})`,
    inputSchema: z.object({
        webhook_path: z.string().min(1)
            .describe("Webhook path (pl. 'my-hook') vagy teljes URL (pl. 'http://localhost:5678/webhook/my-hook')"),
        method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("POST")
            .describe("HTTP metódus (alapértelmezett: POST)"),
        data: z.record(z.unknown()).optional()
            .describe("A webhooknak küldendő JSON adat"),
        headers: z.record(z.string()).optional()
            .describe("Egyedi HTTP fejlécek"),
    }),
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
    },
}, async (params) => {
    try {
        const config = getClientConfig();
        const url = params.webhook_path.startsWith("http")
            ? params.webhook_path
            : `${config.baseUrl}/webhook/${params.webhook_path}`;
        const res = await axios({
            method: params.method,
            url,
            data: params.data,
            headers: {
                "Content-Type": "application/json",
                ...params.headers,
            },
            timeout: 30000,
        });
        const responseText = typeof res.data === "string" ? res.data : JSON.stringify(res.data, null, 2);
        return {
            content: [{
                    type: "text",
                    text: `✅ Webhook válasz (${res.status}):\n\n${truncateIfNeeded(responseText)}`,
                }],
            structuredContent: { status: res.status, data: res.data },
        };
    }
    catch (err) {
        return { isError: true, content: [{ type: "text", text: handleApiError(err) }] };
    }
});
// ─────────────────────────────────────────────
// Szerver indítása
// ─────────────────────────────────────────────
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write("[n8n-mcp-server] Elindult — n8n MCP szerver készen áll\n");
}
main().catch((err) => {
    process.stderr.write(`[n8n-mcp-server] Hiba az indításkor: ${err}\n`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map