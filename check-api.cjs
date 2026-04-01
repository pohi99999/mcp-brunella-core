const http = require('http');
http.get('http://localhost:3000/api/v1/mcp/providers', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('STATUS CODE:', res.statusCode));
}).on('error', console.error);