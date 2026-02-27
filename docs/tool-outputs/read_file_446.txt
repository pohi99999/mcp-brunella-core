# Lead Mining as a Service Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrálja a RobotkezV2 webscraping és a Sales Hunter képességeit egy eladható "Lead Mining" B2B szolgáltatássá, amely validált Google Sheets listákat és egyedi "jégtörő" mondatokat generál.

**Architecture:** Új Python workereket (`google_maps_scraper.py`, `icebreaker_generator.py`) hozunk létre, amiket a `SalesHunterAgent` (vagy egy új `LeadMiningAgent`) hív meg az n8n/Orchestrator utasítására. Az eredményeket a `googleWorkspace.ts` segítségével Google Sheetbe írjuk. A Cloudflare Browser Rendering API-t használjuk a RobotkezV2 távoli, skálázható böngészési képességeihez.

**Tech Stack:** Python (Playwright/BeautifulSoup), TypeScript (BAS Agents), Google Sheets API, LLM (Gemini/OpenAI), Cloudflare Workers, Cloudflare Browser Rendering.

---

### Phase 0: Cloudflare Browser Rendering Integráció

**Cél:** A RobotkezV2 távoli, skálázható böngészési képességeinek biztosítása a Cloudflare Browser Rendering API integrálásával.

**Files:**
- Create: `worker/bas-browser-orchestrator/index.js`
- Create: `worker/bas-browser-orchestrator/wrangler.toml`
- Modify: `myai/server.py`
- Modify: `src/agents/robotkezV2.ts`
- Modify: `src/components/ChatInterface.tsx`
- Modify: `.env` (add API keys, BROWSER_CHAT_ENDPOINT, BROWSER_SCREENSHOT_ENDPOINT)

**Step 0.1: Cloudflare Worker Létrehozása és Telepítése**

**Commands:**
```bash
# Hozz létre egy új Worker-t a konkrét kóddal
# Először hozd létre az index.js fájlt a következő tartalommal:
# Fájl: worker/bas-browser-orchestrator/index.js
# Ezt írd egy új fájlba manuálisan vagy egy szövegszerkesztővel
# --- index.js tartalom START ---
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/chat') {
      return handleChat(request, env);
    }

    if (url.pathname === '/screenshot') {
      return handleScreenshot(request, env);
    }

    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }

    return new Response('Not found', { status: 404 });
  }
};

async function handleChat(request, env) {
  const data = await request.json();
  const { message, sessionId } = data;

  const browser = await env.BROWSER.render();
  const page = await browser.newPage();

  const aiResponse = await processMessage(message, env, page);

  const screenshot = await page.screenshot({ fullPage: false });

  await browser.close();

  return new Response(JSON.stringify({
    response: aiResponse,
    screenshot: screenshot.toString('base64'),
    sessionId
  }), {
    headers: { 'Content-Type': 'application/json' }
  });

}

async function handleScreenshot(request, env) {
  const browser = await env.BROWSER.render();
  const page = await browser.newPage();

  const screenshot = await page.screenshot({ fullPage: false });
  await browser.close();

  return new Response(screenshot, {
    headers: { 'Content-Type': 'image/png' }
  });

}

async function processMessage(message, env, page) {
  const actions = await page.observe(message);

  for (const action of actions) {
    await page.act(action);
  }

  return `Készítettem: ${message}`;
}
# --- index.js tartalom END ---

# Utána hozd létre a wrangler.toml fájlt a következő tartalommal:
# Fájl: worker/bas-browser-orchestrator/wrangler.toml
# Ezt írd egy új fájlba manuálisan vagy egy szövegszerkesztővel
# --- wrangler.toml tartalom START ---
name = "bas-browser-orchestrator"
main = "index.js"
compatibility_date = "2026-02-23"

[vars]
SESSION_TIMEOUT = "300"

[[browser_rendering.bindings]]
name = "BROWSER"
type = "browser_rendering"

[[ai_gateway.bindings]]
name = "AI"
type = "ai_gateway"
# --- wrangler.toml tartalom END ---

# Miután a fájlok elkészültek, deployold a Workert:
npx wrangler deploy --name bas-browser-orchestrator
```

**Step 0.2: Python Backend Frissítése**

**Files:**
- Modify: `myai/server.py`

**Content for `myai/server.py`:**
```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import base64
import asyncio
from typing import Optional
from playwright.async_api import async_playwright

app = FastAPI(title="Brunella Browser Automation")

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    screenshot: Optional[str] = None
    session_id: str

@app.post("/browser/chat", response_model=ChatResponse)
async def browser_chat(request: ChatRequest):

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        ai_response = await process_message(request.message, page)

        screenshot_bytes = await page.screenshot(full_page=False)
        screenshot_base64 = base64.b64encode(screenshot_bytes).decode('utf-8')

        await browser.close()

        return ChatResponse(
            response=ai_response,
            screenshot=screenshot_base64,
            session_id=request.session_id or f"session_{int(asyncio.get_event_loop().time())}"
        )

@app.get("/browser/screenshot")
async def browser_screenshot():

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        screenshot_bytes = await page.screenshot(full_page=False)
        await browser.close()

        return screenshot_bytes

async def process_message(message: str, page) -> str:
    actions = await page.observe(message)

    for action in actions:
        await page.act(action)

    return f"Készítettem: {message}"

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

**Step 0.3: Node.js Agent Frissítése**

**Files:**
- Modify: `src/agents/robotkezV2.ts`

**Content for `src/agents/robotkezV2.ts`:**
```javascript
import { Agent } from './agent';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

export class RobotkezV2 extends Agent {
  private chatEndpoint = process.env.BROWSER_CHAT_ENDPOINT || 'http://localhost:3000/browser/chat';
  private screenshotEndpoint = process.env.BROWSER_SCREENSHOT_ENDPOINT || 'http://localhost:3000/browser/screenshot';

  async chat(message: string, sessionId?: string): Promise<string> {
    console.log(`[RobotkezV2] Chat request: ${message}`);

    try {
      const response = await axios.post(this.chatEndpoint, {
        message,
        sessionId: sessionId || this.generateSessionId()
      });

      const data = response.data;

      if (data.screenshot) {
        await this.saveScreenshot(sessionId, data.screenshot);
      }

      return data.response;
    } catch (error) {
      console.error('[RobotkezV2] Chat error:', error);
      return 'Hiba történt a böngésző interakcióban. Kérlek próbáld újra.';
    }
  }

  async takeScreenshot(sessionId?: string): Promise<string> {
    try {
      const response = await axios.get(this.screenshotEndpoint, {
        responseType: 'arraybuffer'
      });

      const screenshot = Buffer.from(response.data, 'binary').toString('base64');
      await this.saveScreenshot(sessionId, screenshot);

      return screenshot;
    } catch (error) {
      console.error('[RobotkezV2] Screenshot error:', error);
      throw error;
    }
  }

  private async saveScreenshot(sessionId: string | undefined, screenshot: string): Promise<void> {
    const sessionDir = sessionId
      ? `data/screenshots/${sessionId}`
      : `data/screenshots/${Date.now()}`;

    // Mappa létrehozása (ha nem létezik)
    await fs.mkdir(sessionDir, { recursive: true });

    // Screenshot mentése
    const filename = `screenshot_${Date.now()}.png`;
    await fs.writeFile(
      `${sessionDir}/${filename}`,
      Buffer.from(screenshot, 'base64')
    );

    console.log(`[RobotkezV2] Screenshot mentve: ${sessionDir}/${filename}`);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

}
```
**Step 0.4: React Frontend Frissítése**

**Files:**
- Modify: `src/components/ChatInterface.tsx`

**Content for `src/components/ChatInterface.tsx`:**
```javascript
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  screenshot?: string;
}

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [screenshot, setScreenshot] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatEndpoint = process.env.REACT_APP_BROWSER_CHAT_ENDPOINT || 'http://localhost:3000/browser/chat';
  const screenshotEndpoint = process.env.REACT_APP_BROWSER_SCREENSHOT_ENDPOINT || 'http://localhost:3000/browser/screenshot';

  useEffect(() => {
    scrollToBottom();
  }, [messages, screenshot]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (messages.length > 0) {
        try {
          const response = await axios.get(screenshotEndpoint, {
            responseType: 'arraybuffer'
          });
          const base64 = Buffer.from(response.data, 'binary').toString('base64');
          setScreenshot(base64);
        } catch (error) {
          console.error('Screenshot error:', error);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages([...messages, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await axios.post(chatEndpoint, {
        message: input,
        session_id: messages.length > 0 ? messages[messages.length - 1].id : undefined
      });

      const agentMessage: Message = {
        id: response.data.session_id,
        text: response.data.response,
        sender: 'agent',
        timestamp: new Date(),
        screenshot: response.data.screenshot
      };

      setMessages([...messages, userMessage, agentMessage]);
      setScreenshot(response.data.screenshot || '');
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <div className="p-4 bg-gray-800 border-b border-gray-700">
        <h1 className="text-xl font-bold">Brunella Browser Automation</h1>
        <p className="text-sm text-gray-400">Magyar nyelvű chat és élő böngésző példány</p>
      </div>

      {screenshot && (
        <div className="p-4 bg-gray-800 border-b border-gray-700">
          <h2 className="text-sm font-semibold mb-2">Élő Böngésző Képernyő:</h2>
          <img
            src={`data:image/png;base64,${screenshot}`}
            alt="Live Browser"
            className="w-full h-auto rounded-lg border border-gray-600"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md p-3 rounded-lg ${message.sender === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}
            >
              {message.screenshot && (
                <img
                  src={`data:image/png;base64,${message.screenshot}`}
                  alt="Agent Screenshot"
                  className="w-full h-auto rounded mb-2"
                />
              )}
              <p className="text-sm">{message.text}</p>
              <span className="text-xs text-gray-400">
                {message.timestamp.toLocaleTimeString('hu-HU')}
              </span>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-700 p-3 rounded-lg">
              <span className="text-sm">Gondolkodok...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Írd meg az utasítást magyarul..."
            className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSend}
            disabled={isTyping}
            className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-600"
          >
            Küldés
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
EOF
```
**Step 0.5: AI Model Konfiguráció**
```bash
npx wrangler secret put WORKERS_AI_TOKEN # or OPENAI_API_KEY
```
**Step 0.6: Függőségek telepítése**
```bash
# Node.js csomagok
cd /path/to/brunella
npm install axios

# Python csomagok
cd myai
pip install fastapi uvicorn playwright pydantic

# Playwright böngésző telepítése
playwright install chromium
```
**Step 0.7: Szolgáltatások Indítása**
```bash
# Terminál 1: Python Backend
cd myai
python server.py

# Terminál 2: React Frontend
cd /path/to/brunella
npm run dev

# Terminál 3: Brunella CLI
brunella
```
**Step 0.8: Ellenőrzés**
```bash
http://localhost:5173
curl https://bas-browser-orchestrator.dd107933ac970dac857f27cee7a7ff46.workers.dev/health
```

### Phase 1: Google Maps Scraper Worker Létrehozása

**Files:**
- Create: `myai/workers/google_maps_scraper.py`
- Test: `test/workers/test_google_maps_scraper.py`

**Step 1: Write the failing test**

```python
# test/workers/test_google_maps_scraper.py
import pytest
from myai.workers.google_maps_scraper import scrape_businesses

@pytest.mark.asyncio
async def test_scrape_businesses_returns_data():
    results = await scrape_businesses("fogorvos Budapest", limit=2)
    assert len(results) > 0
    assert "name" in results[0]
    assert "website" in results[0]
```

**Step 2: Run test to verify it fails**

Run: `pytest test/workers/test_google_maps_scraper.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'myai.workers.google_maps_scraper'"

**Step 3: Write minimal implementation**

```python
# myai/workers/google_maps_scraper.py
import asyncio
# (A Playwright vagy API alapú mock implementáció ide kerül)
async def scrape_businesses(query: str, limit: int = 5):
    # Dummy mock implementáció a teszthez
    return [{"name": "Teszt Fogászat", "website": "http://tesztfogaszat.hu", "address": "Budapest"}]
```

**Step 4: Run test to verify it passes**

Run: `pytest test/workers/test_google_maps_scraper.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add test/workers/test_google_maps_scraper.py myai/workers/google_maps_scraper.py
git commit -m "feat(lead-mining): add initial google maps scraper worker structure"
```

### Phase 2: Icebreaker Generator Worker Létrehozása

**Files:**
- Create: `myai/workers/icebreaker_generator.py`
- Test: `test/workers/test_icebreaker_generator.py`

**Step 1: Write the failing test**

```python
# test/workers/test_icebreaker_generator.py
import pytest
from myai.workers.icebreaker_generator import generate_icebreaker

@pytest.mark.asyncio
async def test_generate_icebreaker():
    company_context = "Családi fogászat 20 éve Budapesten. Modern technológia, fájdalommentes kezelés."
    icebreaker = await generate_icebreaker(company_context)
    assert isinstance(icebreaker, str)
    assert len(icebreaker) > 10
```

**Step 2: Run test to verify it fails**

Run: `pytest test/workers/test_icebreaker_generator.py -v`
Expected: FAIL

**Step 3: Write minimal implementation**

```python
# myai/workers/icebreaker_generator.py
async def generate_icebreaker(context: str) -> str:
    # Itt az LLM hívás történik majd a valóságban
    return f"Láttam a weboldalukon, hogy {context[:20]}..."
```

**Step 4: Run test to verify it passes**

Run: `pytest test/workers/test_icebreaker_generator.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add test/workers/test_icebreaker_generator.py myai/workers/icebreaker_generator.py
git commit -m "feat(lead-mining): add icebreaker generator mock"
```

### Phase 3: LeadMiningAgent TypeScript Integráció

**Files:**
- Create: `src/agents/LeadMiningAgent.ts`
- Modify: `src/agents/registry.json`
- Test: `test/agents/LeadMiningAgent.test.ts`

**Step 1: Write the failing test**

```typescript
// test/agents/LeadMiningAgent.test.ts
import { describe, it, expect } from 'vitest';
import { LeadMiningAgent } from '../../src/agents/LeadMiningAgent';

describe('LeadMiningAgent', () => {
    it('should be defined', () => {
        const agent = new LeadMiningAgent();
        expect(agent.name).toBe('lead_mining');
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/agents/LeadMiningAgent.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/agents/LeadMiningAgent.ts
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';

export class LeadMiningAgent extends BaseAgent {
    name = "lead_mining";
    role = "Lead Mining Service";
    description = "Generates targeted B2B lead lists with icebreakers.";
    capabilities = ["lead_generation", "web_scraping", "icebreaker_generation"];

    async executeTask(context: AgentContext): Promise<AgentResult> {
        return { success: true, message: "Mock implementation", data: {} };
    }
}
```

**Step 4: Regisztráld a registry.json-ben és futtasd a tesztet**
(Update `src/agents/registry.json` with the new agent).
Run: `npm test -- test/agents/LeadMiningAgent.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agents/LeadMiningAgent.ts src/agents/registry.json test/agents/LeadMiningAgent.test.ts
git commit -m "feat(lead-mining): integrate LeadMiningAgent into registry"
```

### Phase 4: Google Sheets Export Integráció

**Files:**
- Modify: `src/agents/LeadMiningAgent.ts`

**Step 1: Implement Sheets Export Logic**
A `LeadMiningAgent.ts` `executeTask` metódusában össze kell kötni a Python workerek kimenetét a meglévő `googleWorkspace.ts` Sheets exportáló funkcióival. (Ennek a tesztelése E2E vagy mockolt Sheets API-val történik).

**Step 2: Commit**
```bash
git add src/agents/LeadMiningAgent.ts
git commit -m "feat(lead-mining): add Google Sheets export to LeadMiningAgent"
```
