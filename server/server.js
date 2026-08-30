const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const store = require('./store');
const { notifyDepartment } = require('./telegram');

store.init();

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json',
};

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, urlPath) {
  const filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'menu.html' : urlPath);
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(filePath, (err, content) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  try {
    // ---- API: room context for the QR page ----
    if (p === '/api/context' && req.method === 'GET') {
      const rooms = store.readJSON(store.ROOMS_FILE);
      const token = url.searchParams.get('room') || 'DEMO101';
      const ctx = rooms[token] || rooms['DEMO101'];
      return sendJSON(res, 200, ctx);
    }

    // ---- API: full room list (for the admin QR code page) ----
    if (p === '/api/rooms' && req.method === 'GET') {
      const rooms = store.readJSON(store.ROOMS_FILE);
      const tokens = Object.keys(rooms).filter(t => t !== 'DEMO101').sort((a, b) => Number(a) - Number(b));
      return sendJSON(res, 200, tokens);
    }

    if (p === '/api/menu-items' && req.method === 'GET') {
      return sendJSON(res, 200, store.MENU_ITEMS);
    }

    if (p === '/api/info' && req.method === 'GET') {
      return sendJSON(res, 200, store.INFO_ITEMS);
    }

    if (p === '/api/guide' && req.method === 'GET') {
      return sendJSON(res, 200, store.LOCAL_GUIDE);
    }

    // ---- API: guest submits a visual-menu request -> routed to department ----
    if (p === '/api/request' && req.method === 'POST') {
      const body = await readBody(req);
      const { room, items } = body;
      if (!room || !Array.isArray(items) || items.length === 0) {
        return sendJSON(res, 400, { error: 'room and items are required' });
      }

      const requests = store.readJSON(store.REQUESTS_FILE);
      const record = {
        id: randomUUID(),
        room,
        items,
        status: 'new',
        createdAt: new Date().toISOString(),
      };
      requests.push(record);
      store.writeJSON(store.REQUESTS_FILE, requests);

      // Smart routing: group items by department, send one alert per department
      const byDept = {};
      for (const { id, qty } of items) {
        const menuItem = store.MENU_ITEMS.find(m => m.id === id);
        if (!menuItem) continue;
        byDept[menuItem.department] = byDept[menuItem.department] || [];
        byDept[menuItem.department].push(`${qty}x ${menuItem.label}`);
      }
      await Promise.all(Object.entries(byDept).map(([dept, lines]) =>
        notifyDepartment(dept,
          `🔔 New request — Room ${room}\n${lines.join('\n')}\n\nRequest ID: ${record.id.slice(0, 8)}`)
      ));

      return sendJSON(res, 200, { ok: true, id: record.id });
    }

    // ---- API: pre-check-in submission ----
    if (p === '/api/precheckin' && req.method === 'POST') {
      const body = await readBody(req);
      const required = ['bookingRef', 'fullName', 'phone', 'idType', 'idNumber'];
      for (const field of required) {
        if (!body[field]) return sendJSON(res, 400, { error: `${field} is required` });
      }

      const guests = store.readJSON(store.GUESTS_FILE);
      const record = { id: randomUUID(), ...body, submittedAt: new Date().toISOString() };
      guests.push(record);
      store.writeJSON(store.GUESTS_FILE, guests);

      await notifyDepartment('front_office',
        `🧾 Pre-check-in received\nName: ${body.fullName}\nBooking: ${body.bookingRef}\nPhone: ${body.phone}\nID: ${body.idType} — ${body.idNumber}`);

      return sendJSON(res, 200, { ok: true, id: record.id });
    }

    // ---- Static files (guest pages)
