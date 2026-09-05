const express = require('express');
const https = require('https');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// 1. INITIALIZE EXPRESS APP
const app = express();

// 2. MIDDLEWARE CONFIGURATION
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// 3. SUPABASE CONFIGURATION
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Memory Storage for buffer uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Helper: Upload file buffer directly to Supabase Storage
const uploadToSupabase = async (fileBuffer, filePath, mimeType) => {
  const { data, error } = await supabase.storage
    .from('hostlydesk-files')
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: true // Overwrites file if updated by hotel
    });

  if (error) throw error;

  // Retrieve clean public URL for browser viewing
  const { data: publicUrlData } = supabase.storage
    .from('hostlydesk-files')
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
};

// In-Memory Database
const hotels = {};

// Helper: Sanitize URLs
function sanitizeUrl(rawUrl) {
  if (!rawUrl) return '';
  let cleanUrl = rawUrl.trim();
  
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

    // Upload Menu PDF to Supabase Storage
    if (req.files && req.files.menuPdf && req.files.menuPdf[0]) {
      const menuFile = req.files.menuPdf[0];
      const menuPath = `${hotelId}/menu.pdf`;
      const publicUrl = await uploadToSupabase(menuFile.buffer, menuPath, 'application/pdf');
      hotels[hotelId].menuPdfUrl = publicUrl;
    }

    // Upload Fact Sheet PDF to Supabase Storage
    if (req.files && req.files.factSheetPdf && req.files.factSheetPdf[0]) {
      const factFile = req.files.factSheetPdf[0];
      const factPath = `${hotelId}/factsheet.pdf`;
      const publicUrl = await uploadToSupabase(factFile.buffer, factPath, 'application/pdf');
      hotels[hotelId].factSheetUrl = publicUrl;
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
