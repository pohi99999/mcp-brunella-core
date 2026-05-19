const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');
const path = require('path');

async function run() {
  try {
    const leadsPath = path.join(__dirname, 'scraped_leads.json');
    if (!fs.existsSync(leadsPath)) {
      console.error('Nincs scraped_leads.json fájl. Futtasd előbb a scraper-t!');
      process.exit(1);
    }

    const leads = JSON.parse(fs.readFileSync(leadsPath, 'utf8'));
    console.log(`Audit indítása ${leads.length} leadre...`);

    const auditResults = [];

    // Process leads sequentially to be safe with CDP
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      console.log(`[${i+1}/${leads.length}] Auditálás: ${lead.website}`);

      try {
        const report = await performLightAudit(lead.website);
        auditResults.push({
          ...lead,
          audit: report
        });
      } catch (err) {
        console.error(`Hiba az audit során (${lead.website}):`, err.message);
        auditResults.push({
          ...lead,
          audit: { status: 'error', message: err.message }
        });
      }
      
      // Small delay between audits
      await new Promise(r => setTimeout(r, 2000));
    }

    const outputPath = path.join(__dirname, 'audited_leads.json');
    fs.writeFileSync(outputPath, JSON.stringify(auditResults, null, 2));
    console.log(`\nAudit kész! Eredmények elmentve ide: ${outputPath}`);
    process.exit(0);

  } catch (err) {
    console.error('Kritikus hiba:', err.message);
    process.exit(1);
  }
}

async function performLightAudit(url) {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Create tab
      const target = await new Promise((res, rej) => {
        const options = { hostname: '127.0.0.1', port: 9222, path: `/json/new?${url}`, method: 'PUT' };
        const req = http.request(options, (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => res(JSON.parse(data)));
        });
        req.on('error', rej);
        req.end();
      });

      const ws = new WebSocket(target.webSocketDebuggerUrl);
      let timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Timeout during audit'));
      }, 30000);

      ws.on('open', () => {
        // Wait for load
        setTimeout(() => {
          const expression = `
            (() => {
              const performance = window.performance.getEntriesByType('navigation')[0];
              const loadTime = performance ? performance.duration : -1;
              const hasDescription = !!document.querySelector('meta[name="description"]');
              const isMobileFriendly = !!document.querySelector('meta[name="viewport"]');
              const title = document.title;
              
              return {
                title,
                loadTimeMs: Math.round(loadTime),
                hasDescription,
                isMobileFriendly,
                score: (hasDescription ? 30 : 0) + (isMobileFriendly ? 30 : 0) + (loadTime < 3000 ? 40 : 10)
              };
            })()
          `;
          ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
        }, 8000); // Wait 8s for slow sites
      });

      ws.on('message', (msg) => {
        const data = JSON.parse(msg);
        if (data.id === 1) {
          clearTimeout(timeout);
          const result = data.result?.result?.value || { status: 'failed' };
          
          // Close tab after audit
          http.get(`http://127.0.0.1:9222/json/close/${target.id}`, () => {
             ws.close();
             resolve(result);
          });
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

run();