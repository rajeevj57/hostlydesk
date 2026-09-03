const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const store = require('./store');
const { notifyDepartment } = require('./telegram');

store.init();

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'hostlydesk-admin';

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };
  return types[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = reqUrl.pathname;

  // Serve Multi-Tenant API Requests
  if (req.method === 'POST' && pathname === '/api/requests') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const requestData = {
          id: randomUUID(),
          hotelId: payload.hotelId || 'default-hotel',
          roomNumber: payload.roomNumber,
          guestName: payload.guestName,
          category: payload.category,
          details: payload.details,
          status: 'pending',
          createdAt: new Date().toISOString()
        };

        store.addRequest(requestData);
        notifyDepartment(requestData);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: requestData }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // Multi-Tenant Admin Requests Fetch
  if (req.method === 'GET' && pathname === '/api/requests') {
    const hotelFilter = reqUrl.searchParams.get('hotelId');
    let requests = store.getRequests();

    if (hotelFilter) {
      requests = requests.filter(r => r.hotelId === hotelFilter);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(requests));
    return;
  }

  // Multi-Tenant Hotel Management Endpoint
  if (req.method === 'POST' && pathname === '/api/hotels') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const hotel = JSON.parse(body);
        if (!hotel.id || !hotel.name) {
          throw new Error('Missing required fields');
        }
        store.saveHotel(hotel);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, hotel }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/hotels') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(store.getHotels()));
    return;
  }

  // Serve static public assets
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';

  const filePath = path.join(PUBLIC_DIR, safePath);
  serveFile(res, filePath, getContentType(filePath));
});

server.listen(PORT, () => {
  console.log(`HostlyDesk multi-tenant server running on port ${PORT}`);
});
