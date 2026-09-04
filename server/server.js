const express = require('express');
const https = require('https');
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

// Upload buffer to Cloudinary ensuring .pdf extension remains in public_id
const uploadToCloudinary = (fileBuffer, folder, filename) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: 'raw',
        public_id: `${filename}.pdf`, // Force .pdf extension on stored filename
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

    // Upload Menu PDF to Cloudinary if provided
    if (req.files && req.files.menuPdf && req.files.menuPdf[0]) {
      const menuFile = req.files.menuPdf[0];
      const menuUpload = await uploadToCloudinary(menuFile.buffer, `hostlydesk/${hotelId}`, 'menu');
      hotels[hotelId].menuPdfUrl = sanitizeUrl(menuUpload.secure_url);
    }

    // Upload Fact Sheet PDF to Cloudinary if provided
    if (req.files && req.files.factSheetPdf && req.files.factSheetPdf[0]) {
      const factFile = req.files.factSheetPdf[0];
      const factUpload = await uploadToCloudinary(factFile.buffer, `hostlydesk/${hotelId}`, 'factsheet');
      hotels[hotelId].factSheetUrl = sanitizeUrl(factUpload.secure_url);
    }

    res.json({ success: true, message: 'Hotel setup updated successfully!', hotel: hotels[hotelId] });
  } catch (err) {
    console.error("Error saving hotel settings:", err);
    res.status(500).json({ success: false, message: 'Server error processing upload.' });
  }
});

// 5. API: GET HOTEL DETAILS FOR GUEST PAGE
app.get('/api/hotels/:hotelId', (req, res) => {
  const hotel = hotels[req.params.hotelId];
  if (!hotel) {
    return res.status(404).json({ success: false, message: 'Hotel profile not found in memory.' });
  }
  res.json({ success: true, hotel });
});

// 6. API: DYNAMIC DEPARTMENT ROUTING TO TELEGRAM
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

// 7. START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running smoothly on port ${PORT}`);
});
