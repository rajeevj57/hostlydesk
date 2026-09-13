const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads (PDF, CSV)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database connection error:', err.message);
  else console.log('Connected to SQLite database.');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room TEXT,
    department TEXT,
    items TEXT,
    status TEXT DEFAULT 'Pending',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_title TEXT,
    name TEXT,
    category TEXT,
    price REAL,
    description TEXT,
    icon TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS factsheet (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    documents TEXT
  )`);

  db.get(`SELECT id FROM factsheet WHERE id = 1`, (err, row) => {
    if (!row) {
      const initialDocs = JSON.stringify({ menus: [] });
      db.run(`INSERT INTO factsheet (id, documents) VALUES (1, ?)`, [initialDocs]);
    }
  });
});

// Admin Factsheet / Document Routes with Real File Upload
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

app.post('/api/upload-document', upload.single('menuFile'), (req, res) => {
  const title = req.body.title;
  const file = req.file;

  if (!title || !file) {
    return res.status(400).json({ error: 'Title and file are required' });
  }

  db.get(`SELECT documents FROM factsheet WHERE id = 1`, (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    try {
      let docs = JSON.parse(row ? row.documents : '{"menus":[]}');
      if (!docs.menus) docs.menus = [];

      docs.menus.push({
        title,
        filename: file.originalname,
        path: `/uploads/${file.filename}`,
        uploadedAt: new Date().toISOString()
      });

      db.run(`UPDATE factsheet SET documents = ? WHERE id = 1`, [JSON.stringify(docs)], (updateErr) => {
        if (updateErr) return res.status(500).json({ error: 'Failed to update factsheet' });
        res.json({ success: true, message: 'Document uploaded successfully' });
      });
    } catch (e) {
      res.status(500).json({ error: 'Parsing error' });
    }
  });
});

// Save Structured Menu Items with Categories
app.post('/api/upload-menu-items', (req, res) => {
  const { menuTitle, items } = req.body;
  if (!menuTitle || !items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Invalid menu data' });
  }

  db.run(`DELETE FROM menu_items WHERE menu_title = ?`, [menuTitle], (err) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    const stmt = db.prepare(`INSERT INTO menu_items (menu_title, name, category, price, description, icon) VALUES (?, ?, ?, ?, ?, ?)`);
    items.forEach(item => {
      stmt.run(menuTitle, item.name, item.category || 'Main Course', item.price || 0, item.description || '', item.icon || '🍽️');
    });
    stmt.finalize((finalizeErr) => {
      if (finalizeErr) return res.status(500).json({ error: 'Failed to save items' });
      res.json({ success: true, message: 'Menu items published successfully' });
    });
  });
});

// Fetch Menu Items for Guest Search
app.get('/api/food-items', (req, res) => {
  db.all(`SELECT * FROM menu_items`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch items' });
    res.json(rows);
  });
});

// Orders APIs
app.post('/api/orders', (req, res) => {
  const { room, department, items } = req.body;
  if (!room || !department || !items) return res.status(400).json({ error: 'Missing fields' });

  db.run(`INSERT INTO orders (room, department, items, status) VALUES (?, ?, ?, 'Pending')`, [room, department, items], function(err) {
    if (err) return res.status(500).json({ error: 'Failed' });
    res.json({ success: true, orderId: this.lastID });
  });
});

app.get('/api/orders', (req, res) => {
  db.all(`SELECT * FROM orders ORDER BY timestamp DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed' });
    res.json(rows);
  });
});

app.post('/api/orders/:id/status', (req, res) => {
  db.run(`UPDATE orders SET status = ? WHERE id = ?`, [req.body.status, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Failed' });
    res.json({ success: true });
  });
});

app.get('/food-menu', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/guest-menu.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
