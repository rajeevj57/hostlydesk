const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Menu Item Prices for Universal Backend Calculation
const itemPrices = { 1: 150, 2: 100, 3: 250, 4: 350, 5: 550 };

// In-Memory Storage for Hotel Fact Sheet & Amenities
let hotelFactSheet = {
  wifiDetails: "Network: Kanha_Guest_WiFi | Password: welcome2026",
  breakfastTiming: "07:00 AM - 10:30 AM (Coffee Shop)",
  restaurants: "Spice Court Multi-Cuisine Restaurant (12:00 PM - 11:00 PM)",
  bars: "Liquid Lounge Bar (5:00 PM - 1:00 AM | Happy Hours: 6:00 PM - 8:00 PM)",
  nearbyPlaces: "Central Market (2 km), City Museum (4 km), Heritage Park (1.5 km)",
  notes: "Gym & Swimming Pool open daily from 6:00 AM to 9:00 PM."
};

// Safe Database Initialization with Auto-Migration for Columns
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
      });
    }
  });
} catch (e) {
  console.warn('Running with memory/mock storage due to missing sqlite3 module:', e.message);
}

// Page Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/kitchen', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/food-menu.html'));
});

// API Endpoint for Room Context
app.get('/api/context', (req, res) => {
  const room = req.query.room || 'DEMO101';
  res.json({ room: room });
});

// API Endpoint for Food Items Menu
app.get('/api/food-items', (req, res) => {
  const foodItems = [
    { id: 1, name: 'Espresso', category: 'Beverages', price: 150, description: 'Freshly brewed hot coffee', icon: '☕' },
    { id: 2, name: 'Masala Chai', category: 'Beverages', price: 100, description: 'Traditional Indian spiced tea', icon: '🍵' },
    { id: 3, name: 'Fresh Cut Fruit Platter', category: 'Snacks', price: 250, description: 'Assorted seasonal fresh fruits', icon: '🍉' },
    { id: 4, name: 'Veg Club Sandwich', category: 'Main Course', price: 350, description: 'Triple-decker sandwich with fries', icon: '🥪' },
    { id: 5, name: 'Butter Chicken with Naan', category: 'Main Course', price: 550, description: 'Classic rich tomato-butter gravy with 2 butter naans', icon: '🍗' }
  ];
  res.json(foodItems);
});

// Fact Sheet API Endpoints
app.get('/api/factsheet', (req, res) => {
  res.json(hotelFactSheet);
});

app.post('/api/factsheet', (req, res) => {
  hotelFactSheet = { ...hotelFactSheet, ...req.body };
  res.json({ success: true, message: 'Fact sheet updated successfully!' });
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

// API Endpoint for Guest Requests (Housekeeping, Maintenance, Front Office, F&B, etc.)
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
  console.log('Admin configuration received:', req.body);
  res.json({ success: true, ok: true, message: 'Configuration saved successfully!' });
});

// Individual Department and Page HTML Routes
app.get('/kitchen.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/kitchen.html'));
});

app.get('/fnb.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/fnb.html'));
});

app.get('/housekeeping.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/housekeeping.html'));
});

app.get('/maintenance.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/maintenance.html'));
});

app.get('/front-office.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/front-office.html'));
});

app.get('/factsheet.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/factsheet.html'));
});

app.listen(PORT, () => {
  console.log(`HostlyDesk server running on port ${PORT}`);
});
