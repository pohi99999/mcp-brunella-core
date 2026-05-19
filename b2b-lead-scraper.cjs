const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');
const path = require('path');

// Command line argument for search query
const query = process.argv[2] || "könyvelő iroda magyarország";
const encodedQuery = encodeURIComponent(query);
const searchUrl = `https://www.google.hu/search?q=${encodedQuery}&num=30`; // Get up to 30 results

async function run() {
  try {
    console.log(`B2B Lead Scraper indítása... Keresés: "${query}"`);

    // 1. Create a new tab in the running Chrome instance using PUT
    const target = await new Promise((resolve, reject) => {
      const options = {
        hostname: '127.0.0.1',
        port: 9222,
        path: `/json/new?${searchUrl}`,
        method: 'PUT'
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      });
      req.on('error', reject);
      req.end();
    });

    console.log(`Új lap megnyitva: ${target.id}`);
    
    // 2. Connect via WebSocket
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    
    ws.on('open', async () => {
      // Wait a bit for the page to render fully
      console.log('Várakozás a Google találatok betöltésére (5 másodperc)...');
      await new Promise(r => setTimeout(r, 5000));

      const expression = `
        (() => {
          const results = [];
          // If on cookie consent page, we might not have div.g
          const title = document.title;
          
          // Find all H3 elements (titles in Google Search)
          const titles = document.querySelectorAll('h3');
          
          titles.forEach(titleEl => {
            // Find the closest anchor tag that wraps or is sibling to this title
            const linkEl = titleEl.closest('a');
            
            if (linkEl) {
              const url = linkEl.href;
              const resultTitle = titleEl.innerText;
              
              // Basic filtering
              if (url.startsWith('http') && !url.includes('google.com') && !url.includes('facebook.com')) {
                results.push({
                  name: resultTitle,
                  website: url,
                  query: "${query}",
                  scraped_at: new Date().toISOString()
                });
              }
            }
          });
          
          return { pageTitle: title, leads: results };
        })();
      `;

      ws.send(JSON.stringify({ 
        id: 1, 
        method: 'Runtime.evaluate', 
        params: { expression, returnByValue: true } 
      }));
    });

    ws.on('message', (msg) => {
      const data = JSON.parse(msg);
      if (data.id === 1) {
        if (data.result && data.result.result && data.result.result.value) {
          const { pageTitle, leads } = data.result.result.value;
          console.log('Page title:', pageTitle);
          console.log('\nSikeresen kigyűjtve ' + leads.length + ' db lead!');
          
          // 3. Save to JSON file
          const outputPath = path.join(__dirname, 'scraped_leads.json');
          
          // If file exists, append to it, else create new
          let existingLeads = [];
          if (fs.existsSync(outputPath)) {
            existingLeads = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
          }
          
          // Merge avoiding exact duplicate URLs
          const merged = [...existingLeads];
          leads.forEach(newLead => {
            if (!merged.find(l => l.website === newLead.website)) {
              merged.push(newLead);
            }
          });

          fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2));
          console.log(`Leadek elmentve ide: ${outputPath} (Összesen: ${merged.length} db)`);
        } else {
          console.error('Hiba az értékelés során vagy nincsenek találatok:', data);
        }
        process.exit(0);
      }
    });

  } catch (err) {
    console.error('Kritikus hiba:', err.message);
    process.exit(1);
  }
}

run();