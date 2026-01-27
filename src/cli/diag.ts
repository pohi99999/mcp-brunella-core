import path from 'path';
import fs from 'fs';

const configPath = path.resolve(__dirname, '..', '..', 'mcp_servers.json');
console.log('Final configPath:', configPath);
fs.writeFileSync(configPath, 'test');
console.log('Exists after write:', fs.existsSync(configPath));