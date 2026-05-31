const http = require('http');
const WebSocket = require('ws');
const Database = require('better-sqlite3');
require('dotenv').config();

// Configuration
const GROUP_ID = "216091408453488"; // Magyar Vállalkozók csoport
const targetUrl = `https://m.facebook.com/groups/${GROUP_ID}`;
const DB_PATH = "E:/OneDrive/Desktop/profil építés/potential_clients.db";

// Initialize Database
const db = new Database(DB_PATH);
db.prepare(`CREATE TABLE IF NOT EXISTS social_mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT,
    post_url TEXT UNIQUE,
    content TEXT,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`).run();

async function run() {
  try {
    console.log(`Facebook Group Watcher Bot indítása... URL: ${targetUrl}`);

    // 1. Create new tab via CDP
    const target = await new Promise((resolve, reject) => {
      const options = { hostname: '127.0.0.1', port: 9222, path: `/json/new?${targetUrl}`, method: 'PUT' };
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      });
      req.on('error', reject);
      req.end();
    });

    console.log(`Új lap megnyitva: ${target.id}`);
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    
    ws.on('open', async () => {
      console.log('Várakozás a Facebook betöltésére (20 másodperc)...');
      
      // Enable Runtime domain for console logs
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
      
      ws.on('message', (msg) => {
          const data = JSON.parse(msg);
          if (data.method === 'Runtime.consoleAPICalled') {
              console.log('[BROWSER]', data.params.args.map(a => a.value || a.description).join(' '));
          }
      });

      await new Promise(r => setTimeout(r, 20000));

      console.log('Szkennelés indítása...');

      // Loop monitoring
      setInterval(async () => {
        console.log(`[${new Date().toLocaleTimeString()}] DOM szkennelés...`);
        const result = await evaluateInPage(ws, `
          (() => {
            // Facebook mobile DOM selectors
            const posts = Array.from(document.querySelectorAll('article, div[role="article"]'));
            const keywords = ["weboldal", "fejlesztő", "automatizálás", "lassú", "segítség", "n8n", "ai", "mi"];
            const hits = [];

            posts.forEach(post => {
              const text = post.innerText.toLowerCase();
              if (keywords.some(kw => text.includes(kw))) {
                // Try to find post link
                const linkEl = post.querySelector('a[href*="/groups/"]');
                const link = linkEl ? linkEl.href : window.location.href;
                hits.push({ content: post.innerText.substring(0, 500), url: link });
              }
            });
            return hits;
          })()
        `);

        if (result && result.length > 0) {
          const insert = db.prepare('INSERT OR IGNORE INTO social_mentions (platform, post_url, content) VALUES (?, ?, ?)');
          result.forEach(hit => {
            try {
              const info = insert.run('facebook', hit.url, hit.content);
              if (info.changes > 0) {
                console.log('Új találat elmentve:', hit.url);
              }
            } catch (e) {
              // Ignore unique constraint errors
            }
          });
        }
      }, 60000); // 1 percenként
    });

  } catch (err) {
    console.error('Kritikus hiba:', err.message);
  }
}

async function evaluateInPage(ws, expression) {
  return new Promise((resolve) => {
    const id = Math.floor(Math.random() * 10000);
    ws.send(JSON.stringify({ 
      id, 
      method: 'Runtime.evaluate', 
      params: { expression, awaitPromise: true, returnByValue: true } 
    }));
    
    const listener = (msg) => {
      const data = JSON.parse(msg);
      if (data.id === id) {
        ws.removeListener('message', listener);
        resolve(data.result?.result?.value);
      }
    };
    ws.on('message', listener);
  });
}

run();