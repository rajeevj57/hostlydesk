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

// Test database connection on startup
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Error connecting to Supabase database:', err.message);
    } else {
        console.log('Successfully connected to Supabase database at:', res.rows[0].now);
    }
});

// Configure Multer for file uploads with a 10MB limit
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } 
});

// Upload and parse route
app.post('/api/upload', upload.single('menuFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const documentTitle = req.body.documentTitle || 'Untitled Menu';
        const filePath = req.file.path;

        // Read file as a buffer to safely handle PDFs and convert to base64
        const fileBuffer = fs.readFileSync(filePath);
        const fileContent = fileBuffer.toString('base64');

        // Insert into Supabase PostgreSQL database
        const queryText = 'INSERT INTO menus (title, content, created_at) VALUES ($1, $2, NOW()) RETURNING id';
        const values = [documentTitle, fileContent];
        
        const dbResult = await pool.query(queryText, values);

        // Clean up uploaded temporary file
        fs.unlinkSync(filePath);

        res.status(200).json({ 
            success: true, 
            message: 'Menu uploaded successfully!',
            menuId: dbResult.rows[0].id 
        });

    } catch (error) {
        console.error('Error processing upload:', error);
        res.status(500).json({ error: error.message });
    }
});

const server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Increase server timeout to 5 minutes (300000ms) to prevent timeout errors on large PDF uploads
server.setTimeout(300000);
