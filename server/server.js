<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hotel Fact Sheet & Menus - HostlyDesk</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f8fafc; color: #1e293b; }
        .container { max-width: 800px; margin: 0 auto; background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        h1 { font-size: 22px; margin-bottom: 5px; color: #0f172a; text-align: center; }
        .subtitle { text-align: center; color: #64748b; font-size: 14px; margin-bottom: 25px; }
        
        .section-box { background: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
        .section-title { font-weight: bold; font-size: 16px; margin-bottom: 10px; color: #334155; display: flex; align-items: center; gap: 8px; }
        
        .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
        .info-row:last-child { border-bottom: none; }
        .label { font-weight: bold; color: #475569; }
        .value { color: #1e293b; }

        .document-list { list-style: none; padding: 0; margin: 0; }
        .document-item { display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 12px 15px; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 10px; font-size: 14px; }
        
        .back-link { display: block; text-align: center; margin-top: 20px; color: #2563eb; text-decoration: none; font-weight: bold; font-size: 14px; }
        .back-link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📄 Hotel Fact Sheet & Restaurant Menus</h1>
        <div class="subtitle" id="roomSubText">Essential information and downloadable menus for your stay.</div>

        <div class="section-box">
            <div class="section-title">📶 Wi-Fi & General Connectivity</div>
            <div class="info-row">
                <span class="label">Wi-Fi Network:</span>
                <span class="value" id="wifiNet">Kanha_Guest_WiFi</span>
            </div>
            <div class="info-row">
                <span class="label">Password:</span>
                <span class="value" id="wifiPass">welcome2026</span>
            </div>
        </div>

        <div class="section-box">
            <div class="section-title">⏰ Operating Timings</div>
            <div class="info-row">
                <span class="label">Breakfast:</span>
                <span class="value">07:00 AM - 10:30 AM (Coffee Shop)</span>
            </div>
            <div class="info-row">
                <span class="label">In-Room Dining:</span>
                <span class="value">24 Hours Available</span>
            </div>
            <div class="info-row">
                <span class="label">Checkout Time:</span>
                <span class="value">11:00 AM</span>
            </div>
        </div>

        <div class="section-box">
            <div class="section-title">📁 Restaurant Menus & Fact Sheet Documents</div>
            <ul id="documentList" class="document-list">
                <li class="document-item">
                    <span><b>Main Restaurant Menu</b> (Default_Menu.pdf)</span>
                    <a href="javascript:void(0)" onclick="openDocument('Default_Menu.pdf')" style="color: #2563eb; font-weight: bold; text-decoration: none; cursor:pointer;">View Document</a>
                </li>
            </ul>
        </div>

        <a id="backPortal" href="/" class="back-link">← Back to Guest Portal</a>
    </div>

    <script>
        const urlParams = new URLSearchParams(window.location.search);
        const currentRoom = urlParams.get('room') || '305';
        document.getElementById('roomSubText').textContent = `Essential information for guests in Room ${currentRoom}.`;
        document.getElementById('backPortal').href = `/?room=${currentRoom}`;

        function openDocument(filename) {
            // Check if file exists by trying to fetch its headers first
            fetch(`/uploads/${filename}`, { method: 'HEAD' })
                .then(res => {
                    if (res.ok) {
                        window.open(`/uploads/${filename}`, '_blank');
                    } else {
                        alert(`The document "${filename}" is currently being updated by management and will be available shortly.`);
                    }
                })
                .catch(() => {
                    alert(`The document "${filename}" is not yet uploaded to the server.`);
                });
        }

        async function loadFactsheetData() {
            try {
                const res = await fetch('/api/factsheet');
                const data = await res.json();
                if (data.wifiDetails) {
                    const parts = data.wifiDetails.split('|');
                    if (parts.length >= 2) {
                        document.getElementById('wifiNet').textContent = parts[0].replace('Network:', '').trim();
                        document.getElementById('wifiPass').textContent = parts[1].replace('Password:', '').trim();
                    }
                }

                if (data.documents && data.documents.menus) {
                    const listEl = document.getElementById('documentList');
                    listEl.innerHTML = '';
                    data.documents.menus.forEach(menu => {
                        listEl.innerHTML += `
                            <li class="document-item">
                                <span><b>${menu.title}</b> (${menu.filename})</span>
                                <a href="javascript:void(0)" onclick="openDocument('${menu.filename}')" style="color: #2563eb; font-weight: bold; text-decoration: none; cursor:pointer;">View Document</a>
                            </li>
                        `;
                    });
                }
            } catch (err) {
                console.error('Failed to load factsheet info', err);
            }
        }

        loadFactsheetData();
    </script>
</body>
</html>
