const fs = require('fs');

const file = 'src/agents/EnterpriseOrchestratorAgent.ts';
let content = fs.readFileSync(file, 'utf8');

// Add import
const importStr = "import { lanceDBClient } from '../utils/lancedb_client.js';\n";
content = content.replace("import { v4 as uuidv4 } from 'uuid';\n", "import { v4 as uuidv4 } from 'uuid';\n" + importStr);

fs.writeFileSync(file, content);
