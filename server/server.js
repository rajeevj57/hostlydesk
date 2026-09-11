const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());

// Serve static frontend files from the root 'public' folder
app.use(express.static(path.join(__dirname, '../public')));

// Database Setup (SQLite)
const dbFile = path.join(__dirname, '../data/hostlydesk.db');
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Routes pointing to the correct 'public' directory
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/kitchen', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/kitchen-dashboard.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`HostlyDesk server running on port ${PORT}`);
});
