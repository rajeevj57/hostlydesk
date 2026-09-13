const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Initialize SQLite Database
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Create tables if they don't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room TEXT,
    department TEXT,
    items TEXT,
    status TEXT DEFAULT 'Pending',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS factsheet (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    documents TEXT
  )`);

  // Table to store structured menu items for instant guest search
  db.run(`CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_title TEXT,
    name TEXT,
    category TEXT,
    price REAL,
    description TEXT,
    icon TEXT
  )`);

  // Initialize factsheet row if empty
  db.get(`SELECT id FROM factsheet WHERE id = 1`, (err, row) => {
    if (!row) {
      const initialDocs = JSON.stringify({ menus: [] });
      db.run(`INSERT INTO factsheet (id, documents) VALUES (1, ?)`, [initialDocs]);
    }
  });
});

// --- API ROUTES ---

// 1. Get Factsheet / Active Documents & Menus
app.get('/api/factsheet', (req, res) => {
  db.get(`SELECT documents FROM factsheet WHERE id = 1`, (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    try {
      const documents = JSON.parse(row ? row.documents : '{"menus":[]}');
      res.json({ documents });
    } catch (e) {
      res.json({ documents: { menus: [] } });
    }
  });
});

// 2. Upload PDF Menu or Document
app.post('/api/upload-document', (req, res) => {
  const { title, filename } = req.body;
  if (!title || !filename) {
    return res.status(400).json({ error: 'Title and filename required' });
  }

  db.get(`SELECT documents FROM factsheet WHERE id = 1`, (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    try {
      let docs = JSON.parse(row ? row.documents : '{"menus":[]}');
      if (!docs.menus) docs.menus = [];

      docs.menus.push({ title, filename, uploadedAt: new Date().toISOString() });

      db.run(`UPDATE factsheet SET documents = ? WHERE id = 1`, [JSON.stringify(docs)], (updateErr) => {
        if (updateErr) return res.status(500).json({ error: 'Failed to update factsheet' });
        res.json({ success: true, message: 'Menu uploaded successfully' });
      });
    } catch (e) {
      res.status(500).json({ error: 'Parsing error' });
    }
  });
});

// 3. Delete Uploaded Menu / Document
app.post('/api/delete-document', (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'Filename required' });

  db.get(`SELECT documents FROM factsheet WHERE id = 1`, (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Not found' });

    try {
      let docs = JSON.parse(row.documents || '{"menus":[]}');
      docs.menus = docs.menus.filter(m => m.filename !== filename);

      db.run(`UPDATE factsheet SET documents = ? WHERE id = 1`, [JSON.stringify(docs)], (updateErr) => {
        if (updateErr) return res.status(500).json({ error: 'Database update failed' });
        res.json({ success: true });
      });
    } catch (e) {
      res.status(500).json({ error: 'Parsing error' });
    }
  });
});

// 4. Publish Structured Menu Items from Manager Dashboard
app.post('/api/upload-menu-items', (req, res) => {
  const { menuTitle, items } = req.body;
  if (!menuTitle || !items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Invalid menu data' });
  }

  db.run(`DELETE FROM menu_items WHERE menu_title = ?`, [menuTitle], (err) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    const stmt = db.prepare(`INSERT INTO menu_items (menu_title, name, category, price, description, icon) VALUES (?, ?, ?, ?, ?, ?)`);
    items.forEach(item => {
      stmt.run(menuTitle, item.name, item.category || 'General', item.price || 0, item.description || '', item.icon || '🍽️');
    });
    stmt.finalize((finalizeErr) => {
      if (finalizeErr) return res.status(500).json({ error: 'Failed to save items' });
      res.json({ success: true, message: 'Menu items published successfully' });
    });
  });
});

// 5. Fetch Menu Items for Guests
app.get('/api/food-items', (req, res) => {
  db.all(`SELECT * FROM menu_items`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch menu items' });
    res.json(rows);
  });
});

// 6. Submit Order / Service Request
app.post('/api/orders', (req, res) => {
  const { room, department, items } = req.body;
  if (!room || !department || !items) {
    return res.status(400).json({ error: 'Missing required order fields' });
  }

  const query = `INSERT INTO orders (room, department, items, status) VALUES (?, ?, ?, 'Pending')`;
  db.run(query, [room, department, items], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to save order' });
    res.json({ success: true, orderId: this.lastID });
  });
});

// 7. Fetch Pending Orders for Dashboards
app.get('/api/orders', (req, res) => {
  db.all(`SELECT * FROM orders ORDER BY timestamp DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch orders' });
    res.json(rows);
  });
});

// 8. Update Order Status
app.post('/api/orders/:id/status', (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;

  db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, orderId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to update order status' });
    res.json({ success: true });
  });
});

// --- ROUTE MAPPINGS ---
app.get('/food-menu', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/guest-menu.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`HostlyDesk server running on port ${PORT}`);
});
