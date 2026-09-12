const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Ensure data & uploads directories exist
const dataDir = path.join(__dirname, '../data');
const uploadsDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Serve uploaded documents statically so links work correctly
app.use('/uploads', express.static(uploadsDir));

// Storage for Fact Sheet and Dynamic Menus List
let hotelDocuments = {
  factsheet: 'None uploaded yet',
  menus: [
    { id: 1, title: 'Main Restaurant Menu', filename: 'Default_Menu.pdf' }
  ]
};

let uploadedMenuInventory = [
  { id: 1, name: 'Espresso', category: 'Beverages', price: 150, description: 'Freshly brewed hot coffee', icon: '☕' }
];

// Safe Database Initialization
let db = null;
try {
  const sqlite3 = require('sqlite3').verbose();
  const dbFile = path.join(dataDir, 'hostlydesk.db');
  db = new sqlite3.Database(dbFile, (err) => {
    if (!err) {
      db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room TEXT,
          items TEXT,
          department TEXT DEFAULT 'housekeeping',
          status TEXT DEFAULT 'Pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        db.run(`ALTER TABLE orders ADD COLUMN department TEXT DEFAULT 'housekeeping'`, () => {});
        db.run(`ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'Pending'`, () => {});

        db.run(`CREATE TABLE IF NOT EXISTS menu_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          category TEXT,
          price REAL,
          description TEXT,
          icon TEXT DEFAULT '🍽️'
        )`, () => {});
      });
    }
  });
} catch (e) {
  console.log('Running on fallback memory storage.');
}

// Page Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/kitchen', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/kitchen.html'));
});

app.get('/food-menu', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/food-menu.html'));
});

app.get('/factsheet.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/factsheet.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// API Endpoints
app.get('/api/context', (req, res) => {
  res.json({ room: req.query.room || '305' });
});

app.get('/api/food-items', (req, res) => {
  if (!db) return res.json(uploadedMenuInventory);
  db.all('SELECT * FROM menu_items ORDER BY id DESC', [], (err, rows) => {
    if (err || !rows || rows.length === 0) {
      res.json(uploadedMenuInventory);
    } else {
      res.json(rows);
    }
  });
});

app.post('/api/orders', (req, res) => {
  const room = req.body.room || req.query.room || '305';
  const department = req.body.department || 'housekeeping';
  const items = typeof req.body.items === 'object' ? JSON.stringify(req.body.items) : req.body.items;

  if (!db) {
    return res.json({ success: true, id: Date.now() });
  }

  const query = `INSERT INTO orders (room, items, department) VALUES (?, ?, ?)`;
  db.run(query, [room, items, department], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, id: this.lastID });
  });
});

app.get('/api/orders', (req, res) => {
  if (!db) return res.json([]);
  db.all('SELECT * FROM orders ORDER BY id DESC', [], (err, rows) => {
    res.json(rows || []);
  });
});

app.post('/api/orders/:id/status', (req, res) => {
  if (!db) return res.json({ success: true });
  db.run(`UPDATE orders SET status = ? WHERE id = ?`, [req.body.status, req.params.id], function(err) {
    res.json({ success: true, updated: this.changes });
  });
});

app.get('/api/factsheet', (req, res) => {
  res.json({
    wifiDetails: "Network: Hotel_Guest_WiFi | Password: welcome2026",
    documents: hotelDocuments
  });
});

app.post('/api/upload-factsheet', (req, res) => {
  hotelDocuments.factsheet = req.body.filename || 'FactSheet.pdf';
  res.json({ success: true });
});

app.post('/api/add-menu', (req, res) => {
  const { title, filename } = req.body;
  hotelDocuments.menus.push({ id: Date.now(), title: title || 'Menu', filename: filename || 'Menu.pdf' });
  res.json({ success: true, menus: hotelDocuments.menus });
});

// Explicit host binding for Render stability
app.listen(PORT, '0.0.0.0', () => {
  console.log(`HostlyDesk server running on port ${PORT}`);
});
