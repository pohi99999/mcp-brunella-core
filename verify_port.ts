
import express from 'express';
import { createServer } from 'http';

const app = express();
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', source: 'minimal_verification' });
});

const server = createServer(app);
server.listen(3005, () => {
    console.log("MINIMAL SERVER RUNNING ON 3005");
});
setTimeout(() => process.exit(0), 10000);
