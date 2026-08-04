/**
 * SHIN SEKAI — WebSocket Room Server (standalone entry)
 * Runs the shared room engine from server-core.js on PORT (default 3030).
 *
 *   cd server && npm install && node index.js
 */
const { createServer } = require('http');
const { attachUpgrade } = require('./server-core.js');

const PORT = process.env.PORT || 3030;

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('SHIN SEKAI room server');
});

server.on('upgrade', (req, socket, head) => attachUpgrade(req, socket, head));

server.listen(PORT, () => {
  console.log(`SHIN SEKAI room server listening on ws://localhost:${PORT}`);
});
