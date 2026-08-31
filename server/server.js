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

function isAdmin(req) {
  return req.headers['x-admin-password'] === ADMIN_PASSWORD;
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
    if (p === '/api/context' && req.method === 'GET') {
      const rooms = store.readJSON(store.ROOMS_FILE);
      const token = url.searchParams.get('room') || 'DEMO101';
      const ctx = rooms[token] || rooms['DEMO101'];
      return sendJSON(res, 200, ctx);
    }

    if (p === '/api/rooms' && req.method === 'GET') {
      const rooms = store.readJSON(store.ROOMS_FILE);
      const tokens = Object.keys(rooms).filter(t => t !== 'DEMO101').sort((a, b) => Number(a) - Number(b));
      return sendJSON(res, 200, tokens);
    }

    if (p === '/api/menu-items' && req.method === 'GET') {
      return sendJSON(res, 200, store.getMenuItems());
    }
    if (p === '/api/info' && req.method === 'GET') {
      return sendJSON(res, 200, store.getInfoItems());
    }
    if (p === '/api/guide' && req.method === 'GET') {
      return sendJSON(res, 200, store.getGuide());
    }
    if (p === '/api/food-items' && req.method === 'GET') {
      return sendJSON(res, 200, store.getFoodItems());
    }

    if (p === '/api/admin/login' && req.method === 'POST') {
      const body = await readBody(req);
      if (body.password === ADMIN_PASSWORD) return sendJSON(res, 200, { ok: true });
      return sendJSON(res, 401, { ok: false, error: 'Wrong password' });
    }

    if (p === '/api/admin/menu-items' && req.method === 'POST') {
      if (!isAdmin(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
      const body = await readBody(req);
      if (!Array.isArray(body)) return sendJSON(res, 400, { error: 'Expected an array' });
      store.writeJSON(store.MENU_ITEMS_FILE, body);
      return sendJSON(res, 200, { ok: true });
    }

    if (p === '/api/admin/info' && req.method === 'POST') {
      if (!isAdmin(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
      const body = await readBody(req);
      if (!Array.isArray(body)) return sendJSON(res, 400, { error: 'Expected an array' });
      store.writeJSON(store.INFO_ITEMS_FILE, body);
      return sendJSON(res, 200, { ok: true });
    }

    if (p === '/api/admin/guide' && req.method === 'POST') {
      if (!isAdmin(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
      const body = await readBody(req);
      if (!Array.isArray(body)) return sendJSON(res, 400, { error: 'Expected an array' });
      store.writeJSON(store.GUIDE_FILE, body);
      return sendJSON(res, 200, { ok: true });
    }

    if (p === '/api/admin/food-items' && req.method === 'POST') {
      if (!isAdmin(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
      const body = await readBody(req);
      if (!Array.isArray(body)) return sendJSON(res, 400, { error: 'Expected an array' });
      store.writeJSON(store.FOOD_ITEMS_FILE, body);
      return sendJSON(res, 200, { ok: true });
    }

    // ---- Admin: list all rooms with current guest names (for check-in screen) ----
    if (p === '/api/admin/rooms' && req.method === 'GET') {
      if (!isAdmin(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
      const rooms = store.readJSON(store.ROOMS_FILE);
      const list = Object.keys(rooms)
        .filter(t => t !== 'DEMO101')
        .sort((a, b) => Number(a) - Number(b))
        .map(token => rooms[token]);
      return sendJSON(res, 200, list);
    }

    // ---- Admin: check a guest into a room (sets their name on that room) ----
    if (p === '/api/admin/checkin' && req.method === 'POST') {
      if (!isAdmin(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
      const body = await readBody(req);
      const { room, guestName, checkoutTime } = body;
      if (!room || !guestName) return sendJSON(res, 400, { error: 'room and guestName are required' });

      const rooms = store.readJSON(store.ROOMS_FILE);
      if (!rooms[room]) return sendJSON(res, 400, { error: 'Unknown room number' });
      rooms[room].guestName = guestName;
      if (checkoutTime) rooms[room].checkoutTime = checkoutTime;
      store.writeJSON(store.ROOMS_FILE, rooms);
      return sendJSON(res, 200, { ok: true });
    }

    // ---- Admin: check a guest out (resets the room back to default) ----
    if (p === '/api/admin/checkout' && req.method === 'POST') {
      if (!isAdmin(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
      const body = await readBody(req);
      const { room } = body;
      if (!room) return sendJSON(res, 400, { error: 'room is required' });

      const rooms = store.readJSON(store.ROOMS_FILE);
      if (!rooms[room]) return sendJSON(res, 400, { error: 'Unknown room number' });
      rooms[room].guestName = 'Guest';
      rooms[room].checkoutTime = '11:00 AM';
      store.writeJSON(store.ROOMS_FILE, rooms);
      return sendJSON(res, 200, { ok: true });
    }

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

      const menuItems = store.getMenuItems();
      const byDept = {};
      for (const { id, qty } of items) {
        const menuItem = menuItems.find(m => m.id === id);
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

    // ---- API: guest places a food order (itemized, with prices) ----
    if (p === '/api/food-order' && req.method === 'POST') {
      const body = await readBody(req);
      const { room, items } = body;
      if (!room || !Array.isArray(items) || items.length === 0) {
        return sendJSON(res, 400, { error: 'room and items are required' });
      }

      const foodItems = store.getFoodItems();
      let total = 0;
      const lines = [];
      for (const { id, qty } of items) {
        const dish = foodItems.find(f => f.id === id);
        if (!dish || !qty) continue;
        const lineTotal = dish.price * qty;
        total += lineTotal;
        lines.push(`${qty}x ${dish.name} — ₹${lineTotal}`);
      }
      if (lines.length === 0) return sendJSON(res, 400, { error: 'No valid items' });

      const orders = store.readJSON(store.FOOD_ORDERS_FILE);
      const record = {
        id: randomUUID(),
        room,
        items,
        total,
        status: 'new',
        createdAt: new Date().toISOString(),
      };
      orders.push(record);
      store.writeJSON(store.FOOD_ORDERS_FILE, orders);

      await notifyDepartment('kitchen',
        `🍽️ New food order — Room ${room}\n${lines.join('\n')}\n\nTotal: ₹${total}\nOrder ID: ${record.id.slice(0, 8)}`);

      return sendJSON(res, 200, { ok: true, id: record.id, total });
    }

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

    if (req.method === 'GET') {
      return serveStatic(req, res, p);
    }

    sendJSON(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    sendJSON(res, 500, { error: 'Server error' });
  }
});

server.listen(PORT, () => {
  console.log(`HostlyDesk server running: http://localhost:${PORT}`);
  console.log(`Guest menu:     http://localhost:${PORT}/menu.html?room=DEMO101`);
  console.log(`Food menu:      http://localhost:${PORT}/food-menu.html?room=DEMO101`);
  console.log(`Pre-check-in:   http://localhost:${PORT}/precheckin.html`);
  console.log(`Admin panel:    http://localhost:${PORT}/admin.html`);
});
