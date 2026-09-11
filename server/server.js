const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Database Setup (SQLite)
const dbFile = path.join(__dirname, 'hostlydesk.db');
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Create requests table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hotel_id TEXT,
            room TEXT,
            guest_name TEXT,
            service_type TEXT,
            department TEXT,
            details TEXT,
            status TEXT DEFAULT 'Pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// API: Get services list for the guest portal
app.get('/api/get-services', (req, res) => {
    const services = [
        { id: 'towels', name: 'Extra Towels', department: 'Housekeeping' },
        { id: 'water', name: 'Drinking Water', department: 'Housekeeping' },
        { id: 'pillow', name: 'Extra Pillow', department: 'Housekeeping' },
        { id: 'cleaning', name: 'Room Cleaning', department: 'Housekeeping' },
        { id: 'food', name: 'Order Food', department: 'Kitchen' },
        { id: 'coffee', name: 'Tea / Coffee', department: 'Kitchen' },
        { id: 'wakeup', name: 'Wake-up Call', department: 'Front Office' },
        { id: 'taxi', name: 'Book a Taxi', department: 'Front Office' },
        { id: 'checkout', name: 'Checkout Help', department: 'Front Office' }
    ];
    res.json(services);
});

// API: Submit a new request from the guest portal
app.post('/api/submit-request', (req, res) => {
    const { hotel_id, room, guest_name, service_type, department, details } = req.body;
    const query = `INSERT INTO requests (hotel_id, room, guest_name, service_type, department, details) VALUES (?, ?, ?, ?, ?, ?)`;
    
    db.run(query, [hotel_id, room, guest_name, service_type, department, details], function(err) {
        if (err) {
            console.error(err);
            res.status(500).json({ success: false, error: err.message });
        } else {
            res.json({ success: true, id: this.lastID });
        }
    });
});

// API: Fetch active requests for department dashboards
app.get('/api/requests', (req, res) => {
    const hotelId = req.query.hotel_id || 'MAURYA_SHERATON';
    db.all(`SELECT * FROM requests WHERE hotel_id = ? ORDER BY created_at DESC`, [hotelId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// API: Update request status (e.g., mark as Completed)
app.post('/api/update-status', (req, res) => {
    const { id, status } = req.body;
    db.run(`UPDATE requests SET status = ? WHERE id = ?`, [status, id], function(err) {
        if (err) {
            res.status(500).json({ success: false, error: err.message });
        } else {
            res.json({ success: true });
        }
    });
});

// Route for Guest Portal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route for Kitchen Dashboard (Points directly to kitchen-dashboard.html)
app.get('/kitchen', (req, res) => {
    res.sendFile(path.join(__dirname, 'kitchen-dashboard.html'));
});

app.listen(PORT, () => {
    console.log(`HostlyDesk server running on port ${PORT}`);
});
