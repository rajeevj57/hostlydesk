const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Database Setup (Supabase / PostgreSQL)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for secure cloud connections like Supabase
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to Supabase database', err.stack);
    } else {
        console.log('Connected to Supabase PostgreSQL database.');
        release();
        initializeTables();
    }
});

// Initialize required database tables if they don't exist
async function initializeTables() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS requests (
                id SERIAL PRIMARY KEY,
                hotel_id TEXT,
                room TEXT,
                guest_name TEXT,
                service_type TEXT,
                department TEXT,
                details TEXT,
                status TEXT DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS departments (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS department_services (
                id SERIAL PRIMARY KEY,
                department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                price NUMERIC DEFAULT 0
            )
        `);
        console.log('Database tables verified/created successfully.');
    } catch (err) {
        console.error('Error initializing tables:', err);
    }
}

// API: Get services list for the guest portal (fallback list)
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

// API: Get Departments
app.get('/api/departments', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM departments ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// API: Get Department Services / Menu Items
app.get('/api/department-services', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM department_services ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// API: Post Orders
app.post('/api/orders', async (req, res) => {
    const { room, department, items } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO requests (room, department, details) VALUES ($1, $2, $3) RETURNING *',
            [room, department, items]
        );
        res.json({ success: true, order: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save order' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
