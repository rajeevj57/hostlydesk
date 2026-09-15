const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// PostgreSQL Connection Pool using Supabase
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Automatically create tables and ensure columns exist on startup
pool.query('SELECT NOW()', async (err, res) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to Supabase successfully.');
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS menus (
                    id SERIAL PRIMARY KEY,
                    title TEXT NOT NULL,
                    content TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS departments (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    services TEXT[],
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);
            await pool.query(`
                ALTER TABLE departments ADD COLUMN IF NOT EXISTS services TEXT[];
                ALTER TABLE departments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
            `);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS orders (
                    id SERIAL PRIMARY KEY,
                    room_number TEXT,
                    department TEXT,
                    items TEXT[],
                    instructions TEXT,
                    status TEXT DEFAULT 'Pending',
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);
            console.log('Database tables verified/updated successfully.');
        } catch (tableErr) {
            console.error('Table creation error:', tableErr.message);
        }
    }
});

const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } 
});

// 1. Upload & Parse Menu/Document
app.post('/api/upload', upload.single('menuFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const documentTitle = req.body.documentTitle || 'Hotel Service Guide';
        const filePath = req.file.path;
        const originalName = req.file.originalname.toLowerCase();

        let fileContent = '';
        if (originalName.endsWith('.pdf')) {
            const dataBuffer = fs.readFileSync(filePath);
            const parsedPdf = await pdfParse(dataBuffer);
            fileContent = parsedPdf.text;
        } else {
            fileContent = fs.readFileSync(filePath, 'utf8');
        }

        await pool.query(
            'INSERT INTO menus (title, content, created_at) VALUES ($1, $2, NOW())',
            [documentTitle, fileContent]
        );

        fs.unlinkSync(filePath);
        res.status(200).json({ success: true, message: 'Uploaded, parsed, and saved permanently!' });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete Menu Route
app.delete('/api/menus/:id', async (req, res) => {
    try {
        const menuId = req.params.id;
        await pool.query('DELETE FROM menus WHERE id = $1', [menuId]);
        res.json({ success: true, message: 'Menu deleted successfully!' });
    } catch (error) {
        console.error('Delete menu error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete Department Route
app.delete('/api/departments/:id', async (req, res) => {
    try {
        const deptId = req.params.id;
        await pool.query('DELETE FROM departments WHERE id = $1', [deptId]);
        res.json({ success: true, message: 'Department deleted successfully!' });
    } catch (error) {
        console.error('Delete department error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 2. Create Department & Services
app.post('/api/departments', async (req, res) => {
    try {
        const { departmentName, services } = req.body;
        if (!departmentName) return res.status(400).json({ error: 'Department name required' });

        const serviceList = services ? services.split(',').map(s => s.trim()).filter(Boolean) : [];

        await pool.query(
            `INSERT INTO departments (name, services, created_at) 
             VALUES ($1, $2, NOW()) 
             ON CONFLICT (name) DO UPDATE SET services = $2`,
            [departmentName, serviceList]
        );

        res.status(200).json({ success: true, message: 'Department saved permanently!' });
    } catch (error) {
        console.error('Department error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 3. Get All Menus and Departments
app.get('/api/data', async (req, res) => {
    try {
        const menuResult = await pool.query('SELECT * FROM menus ORDER BY id DESC');
        const deptResult = await pool.query('SELECT * FROM departments ORDER BY id ASC');
        
        let depts = deptResult.rows;
        if (depts.length === 0) {
            const defaults = [
                { name: 'Kitchen / F&B', services: ['Tea / Coffee', 'Starter: Soup', 'Main Course: Paneer Handi', 'Dessert: Ice Cream'] },
                { name: 'Housekeeping', services: ['Extra Towel', 'Bed Linen Change', 'Room Cleaning'] },
                { name: 'Front Office', services: ['Express Checkout', 'Wake-up Call', 'Luggage Assistance'] },
                { name: 'Maintenance', services: ['AC Not Cooling', 'Plumbing Issue', 'Electrical Repair'] }
            ];
            for (let d of defaults) {
                await pool.query(
                    `INSERT INTO departments (name, services, created_at) VALUES ($1, $2, NOW()) ON CONFLICT (name) DO NOTHING`,
                    [d.name, d.services]
                );
            }
            const refreshed = await pool.query('SELECT * FROM departments ORDER BY id ASC');
            depts = refreshed.rows;
        }

        res.json({ success: true, menus: menuResult.rows, departments: depts });
    } catch (error) {
        console.error('Data fetch error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 4. Guest Places Order
app.post('/api/orders', async (req, res) => {
    try {
        let { roomNumber, department, items, instructions } = req.body;
        
        if (!department) department = 'General';

        await pool.query(
            `INSERT INTO orders (room_number, department, items, instructions, status, created_at) 
             VALUES ($1, $2, $3, $4, 'Pending', NOW())`,
            [roomNumber || '101', department, items || [], instructions || 'None']
        );
        res.status(200).json({ success: true, message: `Request sent to ${department} successfully!` });
    } catch (error) {
        console.error('Order error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 5. Get Orders for Staff Dashboards (Exact & Case-Insensitive Match)
app.get('/api/orders', async (req, res) => {
    try {
        const deptFilter = req.query.dept || '';
        const lowerFilter = deptFilter.toLowerCase().trim();

        let query = 'SELECT * FROM orders ORDER BY id DESC';
        let values = [];

        if (lowerFilter.includes('kitchen') || lowerFilter.includes('f&b') || lowerFilter.includes('food') || lowerFilter.includes('coffee')) {
            query = "SELECT * FROM orders WHERE LOWER(department) LIKE '%kitchen%' OR LOWER(department) LIKE '%f&b%' OR LOWER(department) LIKE '%food%' ORDER BY id DESC";
        } else if (deptFilter) {
            query = 'SELECT * FROM orders WHERE LOWER(department) = LOWER($1) ORDER BY id DESC';
            values = [deptFilter.trim()];
        }

        const result = await pool.query(query, values);
        const formattedOrders = result.rows.map(o => ({
            id: o.id,
            roomNumber: o.room_number,
            department: o.department,
            items: o.items,
            instructions: o.instructions,
            status: o.status,
            time: new Date(o.created_at).toLocaleTimeString()
        }));

        res.json({ success: true, orders: formattedOrders });
    } catch (error) {
        console.error('Fetch orders error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 6. Update Order Status
app.post('/api/orders/status', async (req, res) => {
    try {
        const { orderId, status } = req.body;
        await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, orderId]);
        res.json({ success: true, message: 'Status updated!' });
    } catch (error) {
        console.error('Status update error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// ACCURATE .HTML & SHORTCUT REDIRECT ROUTES
// ==========================================
app.get('/:dept.html', (req, res) => {
    let deptKey = req.params.dept.toLowerCase().trim();
    let deptName = 'Staff';
    
    if (deptKey === 'fnb' || deptKey === 'kitchen') {
        deptName = 'Kitchen / F&B';
    } else if (deptKey === 'front-office' || deptKey === 'frontoffice') {
        deptName = 'Front Office';
    } else if (deptKey === 'housekeeping') {
        deptName = 'Housekeeping';
    } else if (deptKey === 'maintenance') {
        deptName = 'Maintenance';
    } else if (deptKey === 'spa') {
        deptName = 'SPA'; // Matches exact database casing
    } else {
        deptName = deptKey.charAt(0).toUpperCase() + deptKey.slice(1);
    }

    res.redirect(`/staff?dept=${encodeURIComponent(deptName)}`);
});

const shortcutDepts = ['kitchen', 'housekeeping', 'frontoffice', 'front-office', 'maintenance', 'fnb', 'spa', 'laundry', 'valet'];
shortcutDepts.forEach(shortcut => {
    app.get(`/${shortcut}`, (req, res) => {
        let realName = shortcut.charAt(0).toUpperCase() + shortcut.slice(1);
        if (shortcut === 'kitchen' || shortcut === 'fnb') realName = 'Kitchen / F&B';
        else if (shortcut === 'housekeeping') realName = 'Housekeeping';
        else if (shortcut === 'frontoffice' || shortcut === 'front-office') realName = 'Front Office';
        else if (shortcut === 'maintenance') realName = 'Maintenance';
        else if (shortcut === 'spa') realName = 'SPA';

        res.redirect(`/staff?dept=${encodeURIComponent(realName)}`);
    });
});

// ==========================================
// UNIVERSAL DYNAMIC STAFF DASHBOARD ROUTE
// ==========================================
app.get('/staff', (req, res) => {
    const deptName = req.query.dept || 'Staff';
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>HostlyDesk - ${deptName} Dashboard</title>
            <style>
                body { font-family: Arial, sans-serif; background: #0d1b2a; color: #fff; padding: 30px; }
                .container { max-width: 800px; margin: 0 auto; background: #1b263b; padding: 30px; border-radius: 8px; border: 1px solid #415a77; }
                h1 { color: #4ea8de; text-transform: uppercase; text-align: center; }
                .order-card { background: #22223b; padding: 15px; margin-bottom: 15px; border-radius: 6px; border-left: 5px solid #4ea8de; }
                button { padding: 6px 12px; background: #1d3557; color: #fff; border: none; border-radius: 4px; cursor: pointer; margin-right: 5px; }
                button:hover { background: #457b9d; }
                a { color: #4ea8de; display: inline-block; margin-bottom: 20px; text-decoration: none; }
            </style>
        </head>
        <body>
            <div class="container">
                <a href="/admin.html">← Back to Admin Panel</a>
                <h1 id="deptTitle">${deptName} Dashboard</h1>
                <div id="deptOrders">Listening for orders...</div>
            </div>
            <script>
                const urlParams = new URLSearchParams(window.location.search);
                const currentDept = urlParams.get('dept') || 'Kitchen / F&B';
                document.getElementById('deptTitle').textContent = currentDept + ' Dashboard';

                async function loadDeptOrders() {
                    try {
                        const res = await fetch('/api/orders?dept=' + encodeURIComponent(currentDept));
                        const data = await res.json();
                        const container = document.getElementById('deptOrders');
                        if(!data.orders || data.orders.length === 0) {
                            container.innerHTML = '<p style="text-align:center; color:#a0aec0;">No pending requests from rooms currently.</p>';
                            return;
                        }
                        container.innerHTML = '';
                        data.orders.forEach(o => {
                            const card = document.createElement('div');
                            card.className = 'order-card';
                            card.innerHTML = \`
                                <h3>Room: <b>\${o.roomNumber}</b> <span style="font-size:14px; float:right; color:#a0aec0;">\${o.time}</span></h3>
                                <p><strong>Department:</strong> \${o.department}</p>
                                <p><strong>Items/Services:</strong> \${o.items.join(', ')}</p>
                                <p><strong>Instructions:</strong> \${o.instructions}</p>
                                <p><strong>Status:</strong> <span style="color: #4ea8de;">\${o.status}</span></p>
                                <div style="margin-top:10px;">
                                    <button onclick="updateStatus(\${o.id}, 'Pending')">Pending</button>
                                    <button onclick="updateStatus(\${o.id}, 'In Progress')">In Progress</button>
                                    <button onclick="updateStatus(\${o.id}, 'Complete')">Complete</button>
                                </div>
                            \`;
                            container.appendChild(card);
                        });
                    } catch (err) {
                        console.error('Polling error:', err);
                    }
                }
                async function updateStatus(id, status) {
                    await fetch('/api/orders/status', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ orderId: id, status: status })
                    });
                    loadDeptOrders();
                }
                setInterval(loadDeptOrders, 3000);
                loadDeptOrders();
            </script>
        </body>
        </html>
    `);
});

const server = app.listen(port, () => {
    console.log(`HostlyDesk running on port ${port}`);
});
server.setTimeout(300000);
