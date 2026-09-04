const express = require('express');
const path = require('path');
const https = require('https');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. CLOUDINARY CONFIGURATION
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'hostlydesk_uploads',
    resource_type: 'auto'
  }
});
const upload = multer({ storage: storage });

// 2. MIDDLEWARE & STATIC FILES
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// In-memory store
const hotels = {};

// STAGE 1: HOTEL SETUP
app.post('/api/hotels', (req, res) => {
  const { hotelId, hotelName, frontOfficeChatId, housekeepingChatId, kitchenChatId } = req.body;
  if (!hotelId || !hotelName) {
    return res.status(400).json({ success: false, message: 'Hotel ID and Name are required.' });
  }

  hotels[hotelId] = {
    ...(hotels[hotelId] || {}),
    hotelId,
    hotelName,
    frontOfficeChatId,
    housekeepingChatId,
    kitchenChatId
  };

  res.json({ success: true, hotel: hotels[hotelId] });
});

// STAGE 2: UPLOAD MENUS & CONTENT
app.post('/api/hotels/content', upload.fields([
  { name: 'menuPdf', maxCount: 1 },
  { name: 'factSheetPdf', maxCount: 1 }
]), (req, res) => {
  const { hotelId, wifiName, wifiPassword, nearbyPlaces } = req.body;

  if (!hotelId || !hotels[hotelId]) {
    return res.status(400).json({ success: false, message: 'Please complete Stage 1 first.' });
  }

  const menuFileUrl = req.files?.['menuPdf']?.[0]?.path;
  const factSheetFileUrl = req.files?.['factSheetPdf']?.[0]?.path;

  hotels[hotelId] = {
    ...hotels[hotelId],
    wifiName: wifiName || '',
    wifiPassword: wifiPassword || '',
    nearbyPlaces: nearbyPlaces || '',
    menuPdfUrl: menuFileUrl || hotels[hotelId].menuPdfUrl || '',
    factSheetUrl: factSheetFileUrl || hotels[hotelId].factSheetUrl || ''
  };

  res.json({ success: true, message: 'Content published permanently!', hotel: hotels[hotelId] });
});

// GET HOTEL DETAILS FOR GUEST INTERFACE
app.get('/api/hotels/:hotelId', (req, res) => {
  const { hotelId } = req.params;
  if (hotels[hotelId]) {
    return res.json({ success: true, hotel: hotels[hotelId] });
  }
  res.status(404).json({ success: false, message: 'Hotel profile not found.' });
});

// HANDLE GUEST SERVICE REQUESTS
app.post('/api/requests', (req, res) => {
  const { hotelId, room, items } = req.body;

  if (!hotelId || !hotels[hotelId]) {
    return res.status(400).json({ success: false, message: 'Invalid hotel configuration.' });
  }

  const hotel = hotels[hotelId];
  const itemsList = Array.isArray(items) ? items.join(', ') : items;
  const messageText = `🛎️ *New Guest Request*\n\n🏨 *Hotel:* ${hotel.hotelName}\n🚪 *Room:* ${room || 'Unassigned'}\n📋 *Items:* ${itemsList}`;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = hotel.frontOfficeChatId || hotel.housekeepingChatId;

  if (botToken && chatId) {
    const postData = JSON.stringify({
      chat_id: chatId,
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

  res.json({ success: true, message: 'Request received!' });
});

// SERVE ADMIN DASHBOARD
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`HostlyDesk Server running live on Render port ${PORT}`);
});
