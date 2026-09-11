const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Database Setup & Table Creation
let db = null;
try {
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const sqlite3 = require('sqlite3').verbose();
  const dbFile = path.join(dataDir, 'hostlydesk.db');
  db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
      console.error('Database connection error:', err.message);
    } else {
      console.log('Connected to the SQLite database.');
      // Create orders table if it doesn't exist
      db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room TEXT,
        items TEXT,
        status TEXT DEFAULT 'Pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
    }
  });
} catch (e) {
  console.error('SQLite initialization failed:', e.message);
}

// Page Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/kitchen', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/food-menu.html'));
});

// API Endpoint for Getting Orders/Requests
app.get('/api/orders', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not available' });
  db.all('SELECT * FROM orders ORDER BY id DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// API Endpoint for Creating Orders
app.post('/api/orders', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not available' });
  const { room, items } = req.body;
  const query = `INSERT INTO orders (room, items) VALUES (?, ?)`;
  db.run(query, [room, JSON.stringify(items)], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ success: true, orderId: this.lastID });
    }
  });
});

// API Endpoint for Guest Requests (Housekeeping, Front Office, etc.)
app.post('/api/requests', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not available' });
  const { room, requestType, notes } = req.body;
  const itemSummary = requestType ? `${requestType}: ${notes || ''}` : JSON.stringify(req.body);
  const query = `INSERT INTO orders (room, items) VALUES (?, ?)`;
  db.run(query, [room, itemSummary], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ success: true, id: this.lastID });
    }
  });
});

app.listen(PORT, () => {
  console.log(`HostlyDesk server running on port ${PORT}`);
});
