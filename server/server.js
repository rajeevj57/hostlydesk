const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// In-memory data store so everything works immediately without external database errors
let storedMenus = [];
let storedDepartments = [
    { id: 1, name: 'Kitchen / F&B' },
    { id: 2, name: 'Housekeeping' },
    { id: 3, name: 'Front Office' },
    { id: 4, name: 'Maintenance' }
];
let liveOrders = [];

const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } 
});

// 1. Upload & Parse Menu/Hotel Detail
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

        const newMenu = {
            id: Date.now(),
            title: documentTitle,
            content: fileContent,
            date: new Date().toLocaleTimeString()
        };

        storedMenus.unshift(newMenu);
        fs.unlinkSync(filePath);

        res.status(200).json({ success: true, message: 'Uploaded and parsed successfully!' });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 2. Create Custom Department
app.post('/api/departments', (req, res) => {
    const { departmentName } = req.body;
    if (!departmentName) return res.status(400).json({ error: 'Name required' });

    const newDept = { id: Date.now(), name: departmentName };
    storedDepartments.push(newDept);
    res.status(200).json({ success: true, message: 'Department created!', department: newDept });
});

// 3. Get Departments & Menus for Guest View
app.get('/api/data', (req, res) => {
    res.json({ success: true, menus: storedMenus, departments: storedDepartments });
});

// 4. Guest Places Order / Request (e.g., Extra Towel, AC Not Cooling, Food Items)
app.post('/api/orders', (req, res) => {
    const { roomNumber, department, items, instructions } = req.body;
    const newOrder = {
        id: Date.now(),
        roomNumber: roomNumber || '101',
        department: department || 'General',
        items: items || [],
        instructions: instructions || '',
        status: 'Pending', // Pending, In Progress, Complete
        time: new Date().toLocaleTimeString()
    };
    liveOrders.unshift(newOrder);
    res.status(200).json({ success: true, message: 'Order sent to department successfully!', order: newOrder });
});

// 5. Get Orders for Staff/Department Dashboards
app.get('/api/orders', (req, res) => {
    const deptFilter = req.query.dept;
    if (deptFilter) {
        const filtered = liveOrders.filter(o => o.department.toLowerCase().includes(deptFilter.toLowerCase()));
        return res.json({ success: true, orders: filtered });
    }
    res.json({ success: true, orders: liveOrders });
});

// 6. Update Order Status (Pending -> In Progress -> Complete)
app.post('/api/orders/status', (req, res) => {
    const { orderId, status } = req.body;
    const order = liveOrders.find(o => o.id == orderId);
    if (order) {
        order.status = status;
        return res.json({ success: true, message: 'Status updated!' });
    }
    res.status(404).json({ error: 'Order not found' });
});

// Department Dynamic Pages Route (/kitchen, /housekeeping, /frontoffice, /maintenance)
const validDepts = ['kitchen', 'housekeeping', 'frontoffice', 'maintenance', 'fnb'];
validDepts.forEach(dept => {
    app.get(`/${dept}`, (req, res) => {
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>HostlyDesk - ${dept.toUpperCase()} Dashboard</title>
                <style>
                    body { font-family: Arial, sans-serif; background: #0d1b2a; color: #fff; padding: 30px; }
                    .container { max-width: 800px; margin: 0 auto; background: #1b263b; padding: 30px; border-radius: 8px; border: 1px solid #415a77; }
                    h1 { color: #4ea8de; text-transform: uppercase; text-align: center; }
                    .order-card { background: #22223b; padding: 15px; margin-bottom: 15px; border-radius: 6px; border-left: 5px solid #4ea8de; }
                    button { padding: 6px 12px; background: #1d3557; color: #fff; border: none; border-radius: 4px; cursor: pointer; margin-right: 5px; }
                    button:hover { background: #457b9d; }
                    .status-pending { border-left-color: #e63946; }
                    .status-progress { border-left-color: #fca311; }
                    .status-complete { border-left-color: #2a9d8f; }
                    a { color: #4ea8de; display: inline-block; margin-bottom: 20px; text-decoration: none; }
                </style>
            </head>
            <body>
                <div class="container">
                    <a href="/admin.html">← Back to Admin Panel</a>
                    <h1>${dept} Department Staff View</h1>
                    <p style="text-align:center; color:#a0aec0;">Live requests and orders from guest rooms</p>
                    <div id="deptOrders">Loading live requests...</div>
                </div>
                <script>
                    async function loadDeptOrders() {
                        const res = await fetch('/api/orders?dept=${dept}');
                        const data = await res.json();
                        const container = document.getElementById('deptOrders');
                        if(data.orders.length === 0) {
                            container.innerHTML = '<p style="text-align:center; color:#a0aec0;">No pending requests from rooms currently.</p>';
                            return;
                        }
                        container.innerHTML = '';
                        data.orders.forEach(o => {
                            let borderClass = 'status-pending';
                            if(o.status === 'In Progress') borderClass = 'status-progress';
                            if(o.status === 'Complete') borderClass = 'status-complete';

                            const card = document.createElement('div');
                            card.className = 'order-card ' + borderClass;
                            card.innerHTML = \`
                                <h3>Room: \${o.roomNumber} <span style="font-size:14px; float:right; color:#a0aec0;">\${o.time}</span></h3>
                                <p><strong>Items/Requests:</strong> \${o.items.join(', ') || 'General Request'}</p>
                                <p><strong>Instructions:</strong> \${o.instructions || 'None'}</p>
                                <p><strong>Status:</strong> <span style="color: #4ea8de;">\${o.status}</span></p>
                                <div style="margin-top:10px;">
                                    <button onclick="updateStatus(\${o.id}, 'Pending')">Set Pending</button>
                                    <button onclick="updateStatus(\${o.id}, 'In Progress')">In Progress</button>
                                    <button onclick="updateStatus(\${o.id}, 'Complete')">Complete</button>
                                </div>
                            \`;
                            container.appendChild(card);
                        });
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
});

const server = app.listen(port, () => {
    console.log(`HostlyDesk running on port ${port}`);
});
server.setTimeout(300000);
