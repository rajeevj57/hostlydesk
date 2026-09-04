const express = require('express');
const https = require('https');
const http = require('http');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const path = require('path');

// 1. INITIALIZE EXPRESS APP
const app = express();

// 2. MIDDLEWARE CONFIGURATION
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// 3. CLOUDINARY CONFIGURATION
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Memory Storage for direct buffer processing
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Upload buffer to Cloudinary as raw file
const uploadToCloudinary = (fileBuffer, folder, filename) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: 'raw',
        public_id: `${filename}.pdf`,
        type: 'upload',
        access_mode: 'public'
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

// In-Memory Database
const hotels = {};

// Helper function to sanitize URLs
function sanitizeUrl(rawUrl) {
  if (!rawUrl) return '';
  let cleanUrl = rawUrl.trim();
  
  cleanUrl = cleanUrl.replace('doudinary.com', 'cloudinary.com');

  if (cleanUrl.startsWith('https//')) {
    cleanUrl = cleanUrl.replace('https//', 'https://');
  } else if (cleanUrl.startsWith('http//')) {
    cleanUrl = cleanUrl.replace('http//', 'https://');
  } else if (cleanUrl.startsWith('http://')) {
    cleanUrl = cleanUrl.replace('http://', 'https://');
  } else if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl;
  }
  
  return cleanUrl;
}

// 4. API: SAVE HOTEL CONFIGURATION
app.post('/api/hotels', upload.fields([
  { name: 'menuPdf', maxCount: 1 },
  { name: 'factSheetPdf', maxCount: 1 }
]), async (req, res) => {
  try {
    const { hotelId, hotelName, wifiName, wifiPassword, frontOfficeChatId, housekeepingChatId, kitchenChatId, menuUrl, factSheetUrl } = req.body;

    if (!hotelId) {
      return res.status(400).json({ success: false, message: 'Hotel ID is required.' });
    }

    if (!hotels[hotelId]) {
      hotels[hotelId] = {};
    }

    // Assign text configurations
    if (hotelName) hotels[hotelId].hotelName = hotelName;
    if (wifiName) hotels[hotelId].wifiName = wifiName;
    if (wifiPassword) hotels[hotelId].wifiPassword = wifiPassword;
    if (frontOfficeChatId) hotels[hotelId].frontOfficeChatId = frontOfficeChatId;
    if (housekeepingChatId) hotels[hotelId].housekeepingChatId = housekeepingChatId;
    if (kitchenChatId) hotels[hotelId].kitchenChatId = kitchenChatId;

    // Direct link input fallback
    if (menuUrl) hotels[hotelId].menuPdfUrl = sanitizeUrl(menuUrl);
    if (factSheetUrl) hotels[hotelId].factSheetUrl = sanitizeUrl(factSheetUrl);

    // Upload Menu PDF to Cloudinary if provided and route through proxy
    if (req.files && req.files.menuPdf && req.files.menuPdf[0]) {
      const menuFile = req.files.menuPdf[0];
      const menuUpload = await uploadToCloudinary(menuFile.buffer, `hostlydesk/${hotelId}`, 'menu');
      const targetCloudUrl = sanitizeUrl(menuUpload.secure_url);
      hotels[hotelId].menuPdfUrl = `/api/pdf-proxy?url=${encodeURIComponent(targetCloudUrl)}`;
    }

    // Upload Fact Sheet PDF to Cloudinary if provided and route through proxy
    if (req.files && req.files.factSheetPdf && req.files.factSheetPdf[0]) {
      const factFile = req.files.factSheetPdf[0];
      const factUpload = await uploadToCloudinary(factFile.buffer, `hostlydesk/${hotelId}`, 'factsheet');
      const targetCloudUrl = sanitizeUrl(factUpload.secure_url);
      hotels[hotelId].factSheetUrl = `/api/pdf-proxy?url=${encodeURIComponent(targetCloudUrl)}`;
    }

    res.json({ success: true, message: 'Hotel setup updated successfully!', hotel: hotels[hotelId] });
  } catch (err) {
    console.error("Error saving hotel settings:", err);
    res.status(500).json({ success: false, message: 'Server error processing upload.' });
  }
});

// 5. API: PDF PROXY ROUTE (Follows 301/302 Redirects and Forces Correct Headers)
const fetchPdfWithRedirects = (targetUrl, res) => {
  const protocol = targetUrl.startsWith('https') ? https : http;

  protocol.get(targetUrl, (stream) => {
    // Follow HTTP redirects (301, 302, 307, 308)
    if (stream.statusCode >= 300 && stream.statusCode < 400 && stream.headers.location) {
      return fetchPdfWithRedirects(stream.headers.location, res);
    }

    if (stream.statusCode !== 200) {
      return res.status(stream.statusCode).send('Failed to fetch remote PDF stream.');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="menu.pdf"');
    stream.pipe(res);
  }).on('error', (err) => {
    console.error('Error proxying PDF stream:', err);
    res.status(500).send('Error streaming PDF file.');
  });
};

app.get('/api/pdf-proxy', (req, res) => {
  const pdfUrl = req.query.url;
  if (!pdfUrl) {
    return res.status(400).send('Missing PDF URL parameter.');
  }

  fetchPdfWithRedirects(pdfUrl, res);
});

// 6. API: GET HOTEL DETAILS FOR GUEST PAGE
app.get('/api/hotels/:hotelId', (req, res) => {
  const hotel = hotels[req.params.hotelId];
  if (!hotel) {
    return res.status(404).json({ success: false, message: 'Hotel profile not found in memory.' });
  }
  res.json({ success: true, hotel });
});

// 7. API: DYNAMIC DEPARTMENT ROUTING TO TELEGRAM
app.post('/api/requests', (req, res) => {
  const { hotelId, room, items, department } = req.body;

  if (!hotelId || !hotels[hotelId]) {
    return res.status(400).json({ success: false, message: 'Hotel configuration not initialized. Save settings in Admin panel first.' });
  }

  const hotel = hotels[hotelId];
  const itemsList = Array.isArray(items) ? items.join(', ') : items;

  let targetChatId = hotel.frontOfficeChatId; // Default fallback

  if (department === 'housekeeping' && hotel.housekeepingChatId) {
    targetChatId = hotel.housekeepingChatId;
  } else if (department === 'kitchen' && hotel.kitchenChatId) {
    targetChatId = hotel.kitchenChatId;
  } else if (department === 'frontoffice' && hotel.frontOfficeChatId) {
    targetChatId = hotel.frontOfficeChatId;
  }

  const messageText = `🛎️ *New ${department ? department.toUpperCase() : 'GUEST'} Request*\n\n🏨 *Hotel:* ${hotel.hotelName}\n🚪 *Room:* ${room || 'Unassigned'}\n📋 *Items:* ${itemsList}`;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (botToken && targetChatId) {
    const postData = JSON.stringify({
      chat_id: targetChatId,
      text: messageText,
      parse_mode: 'Markdown'
    });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const telegramReq = https.request(options, (telegramRes) => {
      telegramRes.on('data', () => {});
    });

    telegramReq.on('error', (e) => {
      console.error('Telegram dispatch error:', e);
    });

    telegramReq.write(postData);
    telegramReq.end();
  }

  res.json({ success: true, message: 'Request sent successfully!' });
});

// 8. START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running smoothly on port ${PORT}`);
});
