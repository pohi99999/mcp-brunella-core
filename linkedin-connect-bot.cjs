const http = require('http');
const WebSocket = require('ws');
require('dotenv').config();
const { GoogleGenAI } = require("@google/genai");

// Configuration
const keywords = ["CEO", "Owner", "tulajdonos", "ügyvezető"];
const keyword = process.argv[2] || keywords[Math.floor(Math.random() * keywords.length)];
const encodedKeyword = encodeURIComponent(keyword);
// Hozzáadva: &network=%5B"S"%5D (S = Second degree connection) hogy biztosan legyen "Connect" gomb
const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodedKeyword}&network=%5B%22S%22%5D&origin=FACETED_SEARCH`;
const MAX_REQUESTS = 15; // Biztonsági korlát a tervnek megfelelően

const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

async function generateLinkedInMessage(name, company) {
  try {
    const firstName = name.split(' ')[0];
    const prompt = `Írj egy rövid (max 250 karakter), profi, de közvetlen LinkedIn kapcsolódási üzenetet ${firstName} részére.
A cége: ${company}.
Én: Pohánka Péter, a Pohánka & Társától.
Cél: KKV folyamatok automatizálása MI-vel, 0 manuális adatrögzítés.
Stílus: Segítőkész, nem nyomulós értékesítői, inkább szakmai érdeklődés.
Csak az üzenet szövegét add vissza.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (e) {
    console.error('AI message generation failed:', e.message);
    return `Szia ${name.split(' ')[0]}! Látom, a profilod alapján nagyszerű munkát végzel. Mi a Pohánka & Társánál KKV folyamatok automatizálásával foglalkozunk. Szívesen kapcsolódnék! Üdv, Péter`;
  }
}

async function run() {
  try {
    console.log(`LinkedIn Connect Bot indítása... Kulcsszó: "${keyword}"`);

    // 1. Create new tab via CDP
    const target = await new Promise((resolve, reject) => {
      const options = { hostname: '127.0.0.1', port: 9222, path: `/json/new?${searchUrl}`, method: 'PUT' };
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
      console.log('Várakozás a LinkedIn betöltésére (10 másodperc)...');
      await new Promise(r => setTimeout(r, 10000));

      // Execute automation logic in a loop
      for (let i = 0; i < MAX_REQUESTS; i++) {
        console.log(`[${i+1}/${MAX_REQUESTS}] Célpont keresése...`);
        
        const prospectInfo = await evaluateInPage(ws, `
          (() => {
            window.scrollBy(0, 300);
            const buttons = Array.from(document.querySelectorAll('button, a'));
            let connectButton = buttons.find(b => {
              const text = b.innerText.trim();
              return ['Összekapcsolás', 'Connect', 'Kapcsolatfelvétel', 'Kapcsolatépítés', 'Társítom'].includes(text) && !b.hasAttribute('data-bot-processed');
            });
            
            if (!connectButton) return null;
            
            const container = connectButton.closest('.entity-result__item');
            const name = container?.querySelector('.entity-result__title-text a')?.innerText.split('\\n')[0] || "Partner";
            const company = container?.querySelector('.entity-result__primary-subtitle')?.innerText || "Vállalkozás";
            
            return { name, company, buttonUid: Math.random().toString(36).substr(2, 9) };
          })()
        `);

        if (!prospectInfo) {
          console.log('Nincs több Connect gomb ezen az oldalon.');
          break;
        }

        console.log(`AI üzenet generálása: ${prospectInfo.name} (${prospectInfo.company})...`);
        const message = await generateLinkedInMessage(prospectInfo.name, prospectInfo.company);
        console.log(`Generált üzenet: "${message}"`);

        const result = await evaluateInPage(ws, `
          (async () => {
            const buttons = Array.from(document.querySelectorAll('button, a'));
            const connectButton = buttons.find(b => {
               const text = b.innerText.trim();
               return ['Összekapcsolás', 'Connect', 'Kapcsolatfelvétel', 'Kapcsolatépítés', 'Társítom'].includes(text) && !b.hasAttribute('data-bot-processed');
            });

            if (!connectButton) return { status: 'error' };
            connectButton.setAttribute('data-bot-processed', 'true');
            connectButton.click();
            await new Promise(r => setTimeout(r, 2000));
            
            const addNoteButton = Array.from(document.querySelectorAll('button')).find(b => 
              b.innerText.includes('Megjegyzés hozzáadása') || b.innerText.includes('Add a note')
            );
            
            if (addNoteButton) {
               addNoteButton.click();
               await new Promise(r => setTimeout(r, 2000));
               
               const textArea = document.querySelector('textarea[name="message"]');
               if (textArea) {
                  textArea.value = \`${message}\`;
                  textArea.dispatchEvent(new Event('input', { bubbles: true }));
                  await new Promise(r => setTimeout(r, 1000));
                  
                  const sendButton = Array.from(document.querySelectorAll('button')).find(b => 
                    b.innerText.includes('Küldés') || b.innerText.includes('Send')
                  );
                  
                  if (sendButton) {
                    sendButton.click();
                    return { status: 'sent', name: \`${prospectInfo.name}\` };
                  }
               }
            }
            return { status: 'failed' };
          })()
        `);
        
        console.log('Eredmény:', JSON.stringify(result, null, 2));
        await new Promise(r => setTimeout(r, 8000 + Math.random() * 5000)); // Véletlenszerűbb késleltetés
      }
      
      console.log('LinkedIn Bot lefutott.');
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