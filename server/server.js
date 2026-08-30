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

    if (p === '/api/admin/login' && req.method === 'POST') {
      const body = await readBody(req);
      if (body.password === ADMIN_PASSWORD) return sendJSON(res, 200, { ok: true });
      return sendJSON(res, 401, { ok: false, error: 'Wrong password' });
    }

    if (p === '/api/admin/menu-items' && req.method === 'POST') {
      if
