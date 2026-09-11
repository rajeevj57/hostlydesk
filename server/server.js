const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

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
    }
  });
} catch (e) {
  console.error('SQLite initialization skipped or failed:', e.message);
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/kitchen', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/food-menu.html'));
});

app.listen(PORT, () => {
  console.log(`HostlyDesk server running on port ${PORT}`);
});
