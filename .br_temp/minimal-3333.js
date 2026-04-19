const http = require('http');
const s = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('MINIMAL OK port 3333');
});
s.listen(3333, () => console.error('Minimal server listening on 3333'));
