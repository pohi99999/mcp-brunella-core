import fs from 'fs';

const filePath = 'src/server/routes/cloudflare.ts';
const content = fs.readFileSync(filePath, 'utf8');

const targetStart = 'workers.map(async (worker): Promise<WorkerAuditResult> => {';
const targetEnd = '        }),'; // Correctly identify the end of the map function

const startIdx = content.indexOf(targetStart);
if (startIdx === -1) {
    console.error('Could not find start index');
    process.exit(1);
}

const endIdx = content.indexOf('      );', startIdx) + 8;
if (endIdx === -1) {
    console.error('Could not find end index');
    process.exit(1);
}

const partToReplace = content.substring(startIdx, endIdx);

const replacement = `workers.map(async (worker): Promise<WorkerAuditResult> => {
          if (!worker.url) {
            return {
              ...worker,
              status: "unknown",
              error: "URL not configured",
            };
          }

          return await checkWorkerHealth(worker);
        }),
      );`;

const newContent = content.replace(partToReplace, replacement);
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully fixed src/server/routes/cloudflare.ts');
