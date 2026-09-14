const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Multer setup for handling file uploads temporarily
const upload = multer({ dest: 'uploads/' });

// Database Setup (Supabase / PostgreSQL)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
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

// API: Upload and Parse Master Document (PDF / CSV) with Full Error Trace
app.post('/api/upload-document', upload.single('menuFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded.' });
        }

        let extractedText = '';
        const filePath = req.file.path;

        try {
            if (req.file.mimetype === 'application/pdf' || req.file.originalname.endsWith('.pdf')) {
                const dataBuffer = fs.readFileSync(filePath);
                const pdfData = await pdfParse(dataBuffer);
                extractedText = pdfData.text || '';
            } else {
                extractedText = fs.readFileSync(filePath, 'utf8');
            }
        } catch (parseErr) {
            console.error('PDF library read error:', parseErr);
            return res.status(500).json({ success: false, error: 'PDF Parse Error: ' + parseErr.toString() });
        } finally {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        if (!extractedText || extractedText.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Could not extract text from this PDF.' });
        }

        // Ensure "Kitchen / F&B" department exists to hold menu items
        let deptResult = await pool.query("SELECT id FROM departments WHERE name = 'Kitchen / F&B'");
        let deptId;
        if (deptResult.rows.length === 0) {
            const newDept = await pool.query("INSERT INTO departments (name) VALUES ('Kitchen / F&B') RETURNING id");
            deptId = newDept.rows[0].id;
        } else {
            deptId = deptResult.rows[0].id;
        }

        const lines = extractedText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
        let parsedCount = 0;

        for (const line of lines) {
            if (line.length < 60 && !line.toLowerCase().includes('page') && !line.includes('http')) {
                const existing = await pool.query(
                    'SELECT id FROM department_services WHERE department_id = $1 AND LOWER(name) = LOWER($2)',
                    [deptId, line]
                );
                if (existing.rows.length === 0) {
                    await pool.query(
                        'INSERT INTO department_services (department_id, name, price) VALUES ($1, $2, $3)',
                        [deptId, line, 0]
                    );
                    parsedCount++;
                }
            }
        }

        res.json({ success: true, message: `File uploaded and ${parsedCount} items parsed successfully!` });
    } catch (err) {
        console.error('Upload general error details:', err);
        res.status(500).json({ success: false, error: 'Database/Server Error: ' + err.toString() });
    }
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

// API: Create Department
app.post('/api/departments', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await pool.query('INSERT INTO departments (name) VALUES ($1) RETURNING *', [name]);
        res.json({ success: true, department: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Department already exists or database error.' });
    }
});

// API: Get Department Services with Department Names for Admin Table
app.get('/api/department-services', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT ds.id, ds.name, ds.price, d.name AS department_name, ds.department_id 
            FROM department_services ds
            JOIN departments d ON ds.department_id = d.id
            ORDER BY ds.id ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// API: Add Manual Service
app.post('/api/department-services', async (req, res) => {
    const { department_id, name, price } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO department_services (department_id, name, price) VALUES ($1, $2, $3) RETURNING *',
            [department_id, name, price || 0]
        );
        res.json({ success: true, service: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to add service' });
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
