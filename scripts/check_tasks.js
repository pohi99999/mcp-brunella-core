import Database from 'better-sqlite3';
const db = new Database('F:/[ACTIVE]_mcp-brunella-core/logs/brunella.db');
const tasks = db.prepare('SELECT * FROM tasks').all();
console.log(JSON.stringify(tasks, null, 2));
