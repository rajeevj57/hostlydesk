const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 10000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// PostgreSQL Connection Pool using Supabase Pooler (Transaction port 6543)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Test database connection and auto-create all required tables on startup
pool.query('SELECT NOW()', async (err, res) => {
    if (err) {
        console.error('Error connecting to Supabase database:', err.message);
    } else {
        console.log('Successfully connected to Supabase database at:', res.rows[0].now);
        
        try {
            // 1. Create menus table if it doesn't exist
            await pool.query(`
                CREATE TABLE IF NOT EXISTS menus (
                    id SERIAL PRIMARY KEY,
                    title TEXT NOT NULL,
                    content TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);

            // 2. Create departments table if it doesn't exist
            await pool.query(`
                CREATE TABLE IF NOT EXISTS departments (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);

            console.log('All database tables verified/created successfully.');
        } catch (tableErr) {
            console.error('Error creating database tables:', tableErr.message);
        }
    }
});

// Configure Multer for file uploads with a 10MB limit
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } 
});

// --- ROUTE 1: Upload and parse menu files ---
app.post('/api/upload', upload.single('menuFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const documentTitle = req.body.documentTitle || 'Untitled Menu';
        const filePath = req.file.path;

        let fileContent = '';
        try {
            fileContent = fs.readFileSync(filePath, 'utf8');
        } catch (e) {
            fileContent = 'Binary file uploaded successfully.';
        }

        const queryText = 'INSERT INTO menus (title, content, created_at) VALUES ($1, $2, NOW()) RETURNING id';
        const values = [documentTitle, fileContent.substring(0, 5000)];
        
        const dbResult = await pool.query(queryText, values);

        fs.unlinkSync(filePath);

        res.status(200).json({ 
            success: true, 
            message: 'Menu uploaded and saved successfully!',
            menuId: dbResult.rows[0].id 
        });

    } catch (error) {
        console.error('Error processing upload:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- ROUTE 2: Create custom department or service ---
app.post('/api/departments', async (req, res) => {
    try {
        const { departmentName } = req.body;
        if (!departmentName) {
            return res.status(400).json({ error: 'Department name is required.' });
        }

        const queryText = 'INSERT INTO departments (name, created_at) VALUES ($1, NOW()) RETURNING id';
        const dbResult = await pool.query(queryText, [departmentName]);

        res.status(200).json({ 
            success: true, 
            message: 'Department created successfully!',
            departmentId: dbResult.rows[0].id 
        });
    } catch (error) {
        console.error('Error creating department:', error);
        res.status(500).json({ error: error.message });
    }
});

const server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Increase server timeout to 5 minutes to prevent network timeouts
server.setTimeout(300000);
