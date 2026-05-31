const http = require('http');
const WebSocket = require('ws');

// Configuration
const keywords = ["CEO", "Owner", "tulajdonos", "ügyvezető"];
const keyword = process.argv[2] || keywords[Math.floor(Math.random() * keywords.length)];
const encodedKeyword = encodeURIComponent(keyword);
// Hozzáadva: &network=%5B"S"%5D (S = Second degree connection) hogy biztosan legyen "Connect" gomb
const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodedKeyword}&network=%5B%22S%22%5D&origin=FACETED_SEARCH`;
const MAX_REQUESTS = 15; // Biztonsági korlát a tervnek megfelelően

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
        console.log(`[${i+1}/${MAX_REQUESTS}] Célpont keresése és kapcsolódás...`);
        
        const result = await evaluateInPage(ws, `
          (async () => {
            // Scroll down a bit to load more results
            window.scrollBy(0, 300);
            await new Promise(r => setTimeout(r, 1000));

            // Find all buttons and links
            const buttons = Array.from(document.querySelectorAll('button, a'));
            
            // Filter to find a valid Connect button
            let connectButton = buttons.find(b => {
              const text = b.innerText.trim();
              const isConnect = ['Összekapcsolás', 'Connect', 'Kapcsolatfelvétel', 'Kapcsolatépítés', 'Társítom'].includes(text);
              const notProcessed = !b.hasAttribute('data-bot-processed');
              return isConnect && notProcessed;
            });
            
            if (!connectButton) {
                // Try to find "More" button in the same entry if possible, or any "More"
                const moreButton = buttons.find(b => b.innerText.includes('More') || b.innerText.includes('Továbbiak'));
                if (moreButton) {
                    moreButton.click();
                    await new Promise(r => setTimeout(r, 1000));
                    // Re-scan buttons after click
                    const newButtons = Array.from(document.querySelectorAll('button, a'));
                    connectButton = newButtons.find(b => b.innerText.includes('Connect') || b.innerText.includes('Összekapcsolás'));
                }
            }

            if (!connectButton) return { status: 'not_found' };
            
            // Mark as processed
            connectButton.setAttribute('data-bot-processed', 'true');
            
            // Get name
            const container = connectButton.closest('.entity-result__item');
            const name = container?.querySelector('.entity-result__title-text a')?.innerText.split('\\n')[0] || "Partner";
            
            connectButton.click();
            await new Promise(r => setTimeout(r, 2000));
            
            // Click "Add a note"
            const addNoteButton = Array.from(document.querySelectorAll('button')).find(b => 
              b.innerText.includes('Megjegyzés hozzáadása') || 
              b.innerText.includes('Add a note')
            );
            
            if (addNoteButton) {
               addNoteButton.click();
               await new Promise(r => setTimeout(r, 2000));
               
               const textArea = document.querySelector('textarea[name="message"]');
               if (textArea) {
                  const firstName = name.split(' ')[0];
                  const message = "Szia " + firstName + "! Látom, a profilod alapján fantasztikus munkát végzel az építőiparban. Mi a Pohánka & Társánál KKV-k folyamatait gyorsítjuk fel MI ügynökökkel. Szívesen követném a munkásságodat! Üdv, Péter";
                  
                  // Simulate typing
                  textArea.value = message;
                  textArea.dispatchEvent(new Event('input', { bubbles: true }));
                  await new Promise(r => setTimeout(r, 1000));
                  
                  // Find Send button
                  const sendButton = Array.from(document.querySelectorAll('button')).find(b => 
                    b.innerText.includes('Küldés') || 
                    b.innerText.includes('Send')
                  );
                  
                  if (sendButton) {
                    sendButton.click(); // Most már élesítve
                    return { status: 'sent', name, message };
                  }
               }
            }
            
            return { status: 'failed', name };
          })()
        `);
        
        console.log('Eredmény:', JSON.stringify(result, null, 2));
        
        if (result.status === 'prepared') {
           console.log(`>>> ELŐKÉSZÍTVE: ${result.name} számára.`);
           // In a real automated run, we would click Send.
           // For now, I'll stop to let the user see it in the browser if they want.
        }
        
        await new Promise(r => setTimeout(r, 5000)); // Delay between requests
      }
      
      console.log('LinkedIn Bot lefutott.');
      // process.exit(0);
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