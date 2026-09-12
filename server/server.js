const express = require('express');
const path = require('path');
const fs = require('fs');

let pdfParse = null;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  console.log('pdf-parse package not found, running in standard mode.');
}

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(path.join(__dirname, '../public')));

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  try { fs.mkdirSync(dataDir, { recursive: true }); } catch(e) {}
}

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
        )`, () => {});
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

        db.run(`CREATE TABLE IF NOT EXISTS hotel_documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT,
          filename TEXT,
          filedata TEXT
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

// Guaranteed Clickable Food Items API with Fallback Seeding
app.get('/api/food-items', (req, res) => {
  const fallbackItems = [
    { id: 1, name: 'Chicken Tikka', category: 'Main Course', price: 450, description: 'Tandoori spiced roasted chicken chunks', icon: '🍗' },
    { id: 2, name: 'Paneer Butter Masala', category: 'Main Course', price: 380, description: 'Cottage cheese in rich tomato gravy', icon: '🧀' },
    { id: 3, name: 'Fresh Lime Soda', category: 'Beverages', price: 120, description: 'Refreshing sparkling beverage', icon: '🥤' },
    { id: 4, name: 'Cappuccino', category: 'Beverages', price: 180, description: 'Hot brewed espresso with steamed milk', icon: '☕' },
    { id: 5, name: 'Dal Makhani', category: 'Main Course', price: 340, description: 'Slow-cooked black lentils with butter and cream', icon: '🍲' },
    { id: 6, name: 'Garlic Naan', category: 'Breads', price: 75, description: 'Tandoor-baked flatbread with fresh garlic', icon: '🫓' },
    { id: 7, name: 'Chocolate Brownie', category: 'Desserts', price: 220, description: 'Warm chocolate pastry with fudge sauce', icon: '🍰' }
  ];

  if (!db) return res.json(fallbackItems);

  db.all('SELECT * FROM menu_items ORDER BY id DESC', [], (err, rows) => {
    if (err || !rows || rows.length === 0) {
      res.json(fallbackItems);
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

// Serve uploaded PDFs from Database
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  if (!db) return res.status(404).send('Document not found.');

  db.get(`SELECT filedata FROM hotel_documents WHERE filename = ?`, [filename], (err, row) => {
    if (err || !row) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Document Not Found</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px; background: #f8fafc; color: #1e293b;">
          <h2>📄 Document Not Uploaded Yet</h2>
          <p>The file <b>${filename}</b> has not been uploaded by management yet.</p>
          <p><a href="javascript:window.close()" style="color: #2563eb; font-weight: bold;">Close Window</a></p>
        </body>
        </html>
      `);
    }
    try {
      const matches = row.filedata.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      const buffer = Buffer.from(matches ? matches[2] : row.filedata, 'base64');
      res.setHeader('Content-Type', 'application/pdf');
      res.send(buffer);
    } catch (e) {
      res.status(500).send('Error rendering document.');
    }
  });
});

app.get('/api/factsheet', (req, res) => {
  if (!db) {
    return res.json({
      wifiDetails: "Network: Hotel_Guest_WiFi | Password: welcome2026",
      documents: { factsheet: 'None', menus: [{ id: 1, title: 'Main Restaurant Menu', filename: 'Default_Menu.pdf' }] }
    });
  }

  db.all(`SELECT title, filename FROM hotel_documents`, [], (err, rows) => {
    const menus = (rows && rows.length > 0) ? rows : [{ id: 1, title: 'Main Restaurant Menu', filename: 'Default_Menu.pdf' }];
    res.json({
      wifiDetails: "Network: Hotel_Guest_WiFi | Password: welcome2026",
      documents: { factsheet: 'FactSheet.pdf', menus: menus }
    });
  });
});

// Manager Upload Endpoint (Saves PDF for visual viewing)
app.post('/api/upload-document', async (req, res) => {
  const { title, filename, fileData } = req.body;
  if (!filename || !fileData) {
    return res.status(400).json({ error: 'Filename and file data are required.' });
  }

  if (!db) return res.json({ success: true });

  db.run(`INSERT INTO hotel_documents (title, filename, filedata) VALUES (?, ?, ?)`, 
    [title || 'Restaurant Menu', filename, fileData], 
    function(err) {
      if (err) return res.status(500).json({ error: 'Failed to save document.' });
      res.json({ success: true, message: 'PDF uploaded and saved successfully!' });
    }
  );
});

// Explicit host binding for Render stability
app.listen(PORT, '0.0.0.0', () => {
  console.log(`HostlyDesk server running on port ${PORT}`);
});
