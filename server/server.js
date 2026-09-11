const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Menu Item Prices for Backend Calculation
const itemPrices = { 1: 150, 2: 100, 3: 250, 4: 350, 5: 550 };

function calculateOrderTotal(body) {
  if (body.total && !isNaN(body.total)) return Number(body.total);
  if (body.amount && !isNaN(body.amount)) return Number(body.amount);
  let total = 0;
  if (body.items) {
    if (typeof body.items === 'object') {
      for (let [id, qty] of Object.entries(body.items)) {
        const numericId = parseInt(id);
        if (itemPrices[numericId] && typeof qty === 'number') {
          total += itemPrices[numericId] * qty;
        }
      }
    }
  }
  return total;
}

// Safe Database Initialization
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

// API Endpoint for Creating Orders
app.post('/api/orders', (req, res) => {
  const room = req.body.room || req.query.room || 'DEMO101';
  const items = req.body.items ? JSON.stringify(req.body.items) : JSON.stringify(req.body);
  const total = calculateOrderTotal(req.body);

  if (!db) {
    return res.json({ success: true, ok: true, id: Date.now(), orderId: Date.now(), total: total, amount: total });
  }

  const query = `INSERT INTO orders (room, items) VALUES (?, ?)`;
  db.run(query, [room, items], function(err) {
    if (err) {
      console.error('Order insert failed:', err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, ok: true, id: this.lastID, orderId: this.lastID, total: total, amount: total });
  });
});

// API Endpoint for Food Orders
app.post('/api/food-order', (req, res) => {
  const room = req.body.room || req.query.room || 'DEMO101';
  const items = req.body.items ? JSON.stringify(req.body.items) : JSON.stringify(req.body);
  const total = calculateOrderTotal(req.body);

  if (!db) {
    return res.json({ success: true, ok: true, id: Date.now(), orderId: Date.now(), total: total, amount: total });
  }

  const query = `INSERT INTO orders (room, items) VALUES (?, ?)`;
  db.run(query, [room, items], function(err) {
    if (err) {
      console.error('Order insert failed:', err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, ok: true, id: this.lastID, orderId: this.lastID, total: total, amount: total });
  });
});

// API Endpoint for Guest Requests
app.post('/api/requests', (req, res) => {
  const room = req.body.room || req.query.room || 'DEMO101';
  const { requestType, notes } = req.body;
  const itemSummary = requestType ? `${requestType}: ${notes || ''}` : JSON.stringify(req.body);

  if (!db) {
    return res.json({ success: true, id: Date.now() });
  }

  const query = `INSERT INTO orders (room, items) VALUES (?, ?)`;
  db.run(query, [room, itemSummary], function(err) {
    if (err) {
      console.error('Request insert failed:', err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, id: this.lastID });
  });
});

app.listen(PORT, () => {
  console.log(`HostlyDesk server running on port ${PORT}`);
});
