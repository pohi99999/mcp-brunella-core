const http = require('http');
const s = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('MINIMAL OK');
});
s.listen(3000, () => console.log('Minimal server on 3000'));
