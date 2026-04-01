# n8n MCP Szerver

MCP (Model Context Protocol) szerver az [n8n](https://n8n.io) workflow automatizálási platformhoz.
Lehetővé teszi LLM-ek számára, hogy közvetlenül kezeljék az n8n workflow-okat, végrehajtásokat és konfigurációt.

## Eszközök

| Eszköz | Leírás | Csak olvasható? |
|--------|--------|----------------|
| `n8n_list_workflows` | Workflow-ok listázása szűréssel és lapozással | ✅ |
| `n8n_get_workflow` | Egy workflow teljes részletei (node-okkal) | ✅ |
| `n8n_activate_workflow` | Workflow aktiválása | ❌ |
| `n8n_deactivate_workflow` | Workflow deaktiválása | ❌ |
| `n8n_delete_workflow` | Workflow törlése (visszafordíthatatlan!) | ❌ |
| `n8n_list_executions` | Végrehajtások listázása szűréssel | ✅ |
| `n8n_get_execution` | Egy végrehajtás részletei | ✅ |
| `n8n_stop_execution` | Futó végrehajtás leállítása | ❌ |
| `n8n_delete_execution` | Végrehajtás törlése | ❌ |
| `n8n_list_credentials` | Hitelesítő adatok listázása (titkos adatok nélkül) | ✅ |
| `n8n_list_tags` | Workflow tagek listázása | ✅ |
| `n8n_trigger_webhook` | Webhook URL triggere | ❌ |

## Telepítés

```bash
cd n8n-mcp-server
npm install
npm run build
```

## Konfiguráció

Állítsd be a következő környezeti változókat:

```env
N8N_BASE_URL=http://localhost:5678   # n8n szerver URL (alapértelmezett: http://localhost:5678)
N8N_API_KEY=your-api-key-here        # n8n API kulcs (Settings > n8n API)
```

Az n8n API kulcsot itt találod: **n8n → Settings → n8n API → Create an API key**

## Használat

### stdio módban (Claude Desktop / Copilot)

```json
{
  "mcpServers": {
    "n8n": {
      "command": "node",
      "args": ["./n8n-mcp-server/dist/index.js"],
      "env": {
        "N8N_BASE_URL": "http://localhost:5678",
        "N8N_API_KEY": "your-api-key"
      }
    }
  }
}
```

### MCP Inspector tesztelés

```bash
npm run inspector
```

## Fejlesztés

```bash
npm run dev    # TypeScript watch módban
npm run build  # Fordítás dist/ mappába
```
