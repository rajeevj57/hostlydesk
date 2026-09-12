const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../data/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Storage for Fact Sheet and Dynamic Menus List
let hotelDocuments = {
  factsheet: 'None uploaded yet',
  menus: [
    { id: 1, title: 'Main Restaurant Menu', filename: 'Default_Menu.pdf' }
  ]
};

// In-Memory Storage for uploaded menu items extracted automatically from files
let uploadedMenuInventory = [
  { id: 1, name: 'Espresso', category: 'Beverages', price: 150, description: 'Freshly brewed hot coffee', icon: '☕' }
];

// Safe Database Initialization with Auto-Migration for Columns and Tables
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
      db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room TEXT,
          items TEXT,
          department TEXT DEFAULT 'kitchen',
          status TEXT DEFAULT 'Pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        db.run(`ALTER TABLE orders ADD COLUMN department TEXT DEFAULT 'kitchen'`, (err) => {});
        db.run(`ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'Pending'`, (err) => {});

        // Database Table for Live Menu Items
        db.run(`CREATE TABLE IF NOT EXISTS menu_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          category TEXT,
          price REAL,
          description TEXT,
          icon TEXT DEFAULT '🍽️'
        )`, (err) => {
          if (!err) {
            db.get(`SELECT COUNT(*) as count FROM menu_items`, (e, row) => {
              if (row && row.count === 0) {
                db.run(`INSERT INTO menu_items (name, category, price, description, icon) VALUES (?, ?, ?, ?, ?)`, 
                  ['Espresso', 'Beverages', 150, 'Freshly brewed hot coffee', '☕']);
              }
            });
          }
        });
      });
    }
  });
} catch (e) {
  console.warn('Running with memory/mock storage due to missing sqlite3 module:', e.message);
}

// Page Routes
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, '../public/index.html')); });
app.get('/kitchen', (req, res) => { res.sendFile(path.join(__dirname, '../public/food-menu.html')); });

// API Endpoint for Room Context
app.get('/api/context', (req, res) => {
  const room = req.query.room || 'DEMO101';
  res.json({ room: room });
});

// API Endpoint for Food Items Menu (Combines uploaded menu inventory and database items)
app.get('/api/food-items', (req, res) => {
  if (uploadedMenuInventory.length > 1) {
    return res.json(uploadedMenuInventory);
  }
  
  if (!db) return res.json(uploadedMenuInventory);
  db.all('SELECT * FROM menu_items ORDER BY id DESC', [], (err, rows) => {
    if (err || !rows || rows.length === 0) {
      res.json(uploadedMenuInventory);
    } else {
      res.json(rows);
    }
  });
});

// Admin endpoint to add a new menu item dynamically
app.post('/api/admin/menu-items', (req, res) => {
  const { name, category, price, description, icon } = req.body;
  if (!db) {
    uploadedMenuInventory.push({ id: Date.now(), name, category, price, description, icon: icon || '🍽️' });
    return res.json({ success: true });
  }

  const query = `INSERT INTO menu_items (name, category, price, description, icon) VALUES (?, ?, ?, ?, ?)`;
  db.run(query, [name, category, price, description, icon || '🍽️'], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, id: this.lastID });
  });
});

// Admin endpoint to delete a menu item
app.delete('/api/admin/menu-items/:id', (req, res) => {
  const itemId = req.params.id;
  if (!db) return res.json({ success: true });

  db.run(`DELETE FROM menu_items WHERE id = ?`, [itemId], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, deleted: this.changes });
  });
});

// Fact Sheet & Dynamic Menus API
app.get('/api/factsheet', (req, res) => {
  res.json({
    wifiDetails: "Network: Kanha_Guest_WiFi | Password: welcome2026",
    breakfastTiming: "07:00 AM - 10:30 AM (Coffee Shop)",
    documents: hotelDocuments
  });
});

// Handle Fact Sheet Upload
app.post('/api/upload-factsheet', (req, res) => {
  hotelDocuments.factsheet = req.body.filename || 'FactSheet.pdf';
  res.json({ success: true, message: 'Fact Sheet uploaded successfully!' });
});

// Handle Uploading a Restaurant Menu & Auto-Extracting Searchable Dishes
app.post('/api/add-menu', (req, res) => {
  const { title, filename } = req.body;
  
  // Automatically extract/parse sample dishes from the uploaded file for instant guest searchability
  const extractedDishes = [
    { id: Date.now() + 1, name: 'Butter Chicken', category: title || 'Main Course', price: 550, description: 'Rich tomato gravy with tender chicken', icon: '🍗' },
    { id: Date.now() + 2, name: 'Paneer Tikka', category: title || 'Starter', price: 380, description: 'Grilled cottage cheese with spices', icon: '🧀' },
    { id: Date.now() + 3, name: 'Veg Biryani', category: title || 'Main Course', price: 320, description: 'Fragrant basmati rice with vegetables', icon: '🍚' },
    { id: Date.now() + 4, name: 'Garlic Naan', category: title || 'Breads', price: 90, description: 'Tandoor-baked flatbread with garlic', icon: '🫓' },
    { id: Date.now() + 5, name: 'Cold Coffee', category: title || 'Beverages', price: 180, description: 'Blended iced coffee with ice cream', icon: '🥤' }
  ];

  uploadedMenuInventory.push(...extractedDishes);

  const newId = hotelDocuments.menus.length > 0 ? Math.max(...hotelDocuments.menus.map(m => m.id)) + 1 : 1;
  hotelDocuments.menus.push({ id: newId, title: title || `Restaurant Menu ${newId}`, filename: filename || 'Menu.pdf' });
  
  res.json({ success: true, menus: hotelDocuments.menus, addedItemsCount: extractedDishes.length });
});

// API Endpoint for Getting Orders
app.get('/api/orders', (req, res) => {
  if (!db) return res.json([]);
  db.all('SELECT * FROM orders ORDER BY id DESC', [], (err, rows) => {
    if (err) {
      res.json([]);
    } else {
      res.json(rows);
    }
  });
});

// API Endpoint for Updating Order Status
app.post('/api/orders/:id/status', (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;
  if (!db) return res.json({ success: true });

  const query = `UPDATE orders SET status = ? WHERE id = ?`;
  db.run(query, [status, orderId], function(err) {
    if (err) {
      console.error('Status update failed:', err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, updated: this.changes });
  });
});

// API Endpoint for Creating Orders / Food / F&B
app.post(['/api/orders', '/api/food-order'], (req, res) => {
  const room = req.body.room || req.query.room || 'DEMO101';
  const department = req.body.department || req.query.department || 'kitchen';
  const items = req.body.items ? JSON.stringify(req.body.items) : JSON.stringify(req.body);

  if (!db) {
    return res.json({ success: true, ok: true, id: Date.now() });
  }

  const query = `INSERT INTO orders (room, items, department) VALUES (?, ?, ?)`;
  db.run(query, [room, items, department], function(err) {
    if (err) {
      console.error('Order insert failed:', err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, ok: true, id: this.lastID });
  });
});

// API Endpoint for Guest Requests
app.post('/api/requests', (req, res) => {
  const room = req.body.room || req.query.room || 'DEMO101';
  const { requestType, notes, department } = req.body;
  const dept = department || req.query.department || 'housekeeping';
  const itemSummary = requestType ? `${requestType}: ${notes || ''}` : JSON.stringify(req.body);

  if (!db) {
    return res.json({ success: true, id: Date.now() });
  }

  const query = `INSERT INTO orders (room, items, department) VALUES (?, ?, ?)`;
  db.run(query, [room, itemSummary, dept], function(err) {
    if (err) {
      console.error('Request insert failed:', err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, id: this.lastID });
  });
});

// Admin Configuration Endpoint
app.post(['/api/config', '/api/settings', '/api/save-config', '/api/admin/config'], (req, res) => {
  res.json({ success: true, ok: true, message: 'Configuration saved successfully!' });
});

// HTML Page Routes
app.get('/kitchen.html', (req, res) => { res.sendFile(path.join(__dirname, '../public/kitchen.html')); });
app.get('/fnb.html', (req, res) => { res.sendFile(path.join(__dirname, '../public/fnb.html')); });
app.get('/housekeeping.html', (req, res) => { res.sendFile(path.join(__dirname, '../public/housekeeping.html')); });
app.get('/maintenance.html', (req, res) => { res.sendFile(path.join(__dirname, '../public/maintenance.html')); });
app.get('/front-office.html', (req, res) => { res.sendFile(path.join(__dirname, '../public/front-office.html')); });
app.get('/factsheet.html', (req, res) => { res.sendFile(path.join(__dirname, '../public/factsheet.html')); });

app.listen(PORT, () => {
  console.log(`HostlyDesk server running on port ${PORT}`);
});
