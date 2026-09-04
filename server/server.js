const express = require('express');
const https = require('https');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

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

const hotels = {};

app.post('/api/hotels', upload.fields([
  { name: 'menuPdf', maxCount: 1 },
  { name: 'factSheetPdf', maxCount: 1 }
]), (req, res) => {
  try {
    const { hotelId, hotelName, wifiName, wifiPassword, frontOfficeChatId, housekeepingChatId, kitchenChatId } = req.body;

    if (!hotelId) {
      return res.status(400).json({ success: false, message: 'Hotel ID is required.' });
    }

    if (!hotels[hotelId]) {
      hotels[hotelId] = {};
    }

    if (hotelName) hotels[hotelId].hotelName = hotelName;
    if (wifiName) hotels[hotelId].wifiName = wifiName;
    if (wifiPassword) hotels[hotelId].wifiPassword = wifiPassword;
    if (frontOfficeChatId) hotels[hotelId].frontOfficeChatId = frontOfficeChatId;
    if (housekeepingChatId) hotels[hotelId].housekeepingChatId = housekeepingChatId;
    if (kitchenChatId) hotels[hotelId].kitchenChatId = kitchenChatId;

    // Capture uploaded PDF URLs directly from Cloudinary output
    if (req.files && req.files.menuPdf && req.files.menuPdf[0]) {
      hotels[hotelId].menuPdfUrl = req.files.menuPdf[0].path;
    }
    if (req.files && req.files.factSheetPdf && req.files.factSheetPdf[0]) {
      hotels[hotelId].factSheetUrl = req.files.factSheetPdf[0].path;
    }

    res.json({ success: true, message: 'Hotel updated successfully!', hotel: hotels[hotelId] });
  } catch (err) {
    console.error("Error updating hotel:", err);
    res.status(500).json({ success: false, message: 'Server error updating hotel data.' });
  }
});

app.get('/api/hotels/:hotelId', (req, res) => {
  const hotel = hotels[req.params.hotelId];
  if (!hotel) {
    return res.status(404).json({ success: false, message: 'Hotel not found.' });
  }
  res.json({ success: true, hotel });
});

app.post('/api/requests', (req, res) => {
  const { hotelId, room, items, department } = req.body;

  if (!hotelId || !hotels[hotelId]) {
    return res.status(400).json({ success: false, message: 'Invalid hotel configuration.' });
  }

  const hotel = hotels[hotelId];
  const itemsList = Array.isArray(items) ? items.join(', ') : items;

  let targetChatId = hotel.frontOfficeChatId;

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
      console.error('Telegram error:', e);
    });

    telegramReq.write(postData);
    telegramReq.end();
  }

  res.json({ success: true, message: 'Request received!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
