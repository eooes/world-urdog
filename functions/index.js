/**
 * SHIN SEKAI — WebSocket room server as Firebase Cloud Functions (2nd gen)
 *
 * Deploy:
 *   cd functions && npm install && cd ..
 *   npx firebase deploy --only functions
 *
 * The function upgrades plain HTTP requests to WebSocket connections using
 * the shared room engine from server-core.js.
 */
const { onRequest } = require('firebase-functions/v2/https');
const { attachUpgrade } = require('./server-core.js');

exports.ws = onRequest(
  {
    invoker: 'public',
    memory: '256MiB',
    cpu: 1,
    region: 'asia-southeast1',
    minInstances: 0,
    maxInstances: 5,
    timeoutSeconds: 540,
  },
  (req, res) => {
    const upgrade = req.headers.upgrade;
    if (upgrade && upgrade.toLowerCase() === 'websocket') {
      // Hand the raw socket to the WebSocket engine
      attachUpgrade(req, req.socket, Buffer.alloc(0));
      req.socket.resume?.();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('SHIN SEKAI room server — connect with WebSocket');
  },
);

// Health check endpoint
exports.health = onRequest(
  { invoker: 'public', region: 'asia-southeast1' },
  (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  },
);
