const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Large limit to handle PDF base64 uploads
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
  const { title, filename, fileData } = req.body;
  if (!title || !filename) {
    return res.status(400).json({ error: 'Title and filename required' });
  }

  db.get(`SELECT documents FROM factsheet WHERE id = 1`, (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    try {
      let docs = JSON.parse(row ? row.documents : '{"menus":[]}');
      if (!docs.menus) docs.menus = [];

      // Add new menu to array
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

// 4. Submit Order / Service Request
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

// 5. Fetch Pending Orders for Dashboards
app.get('/api/orders', (req, res) => {
  db.all(`SELECT * FROM orders ORDER BY timestamp DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch orders' });
    res.json(rows);
  });
});

// 6. Update Order Status (Fulfill/Complete)
app.post('/api/orders/:id/status', (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;

  db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, orderId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to update order status' });
    res.json({ success: true });
  });
});

// --- ROUTE REDIRECTS / CLEAN MAPPINGS ---

// Route for legacy /food-menu endpoint to serve the clean static guest menu safely
app.get('/food-menu', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/guest-menu.html'));
});

// Fallback to index.html for root client-side routing if needed
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`HostlyDesk server running on port ${PORT}`);
});
