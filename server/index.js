const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const store = require('./store'); // or './server/store' depending on where store.js lives
const { sendAlert } = require('./telegram'); // or './server/telegram'

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure public/uploads folder exists
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage setup for PDF/Image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 1. Initial Setup Endpoint (Hotel IDs & Telegram)
app.post('/api/hotels', (req, res) => {
  try {
    const { hotelId, hotelName, frontOfficeChatId, housekeepingChatId, kitchenChatId } = req.body;
    if (!hotelId || !hotelName) {
      return res.status(400).json({ success: false, message: 'Hotel ID and Name are required.' });
    }

    const existingHotel = store.getHotelById(hotelId) || {};
    const updatedHotel = {
      ...existingHotel,
      hotelId,
      hotelName,
      frontOfficeChatId,
      housekeepingChatId,
      kitchenChatId
    };

    store.saveHotel(updatedHotel);
    res.json({ success: true, hotel: updatedHotel });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Operational Content Endpoint (Wi-Fi, Uploads, Attractions)
app.post('/api/hotels/content', upload.fields([
  { name: 'menuPdf', maxCount: 1 },
  { name: 'factSheetPdf', maxCount: 1 }
]), (req, res) => {
  try {
    const { hotelId, wifiName, wifiPassword, nearbyPlaces } = req.body;
    const existingHotel = store.getHotelById(hotelId);

    if (!existingHotel) {
      return res.status(404).json({ success: false, message: 'Hotel configuration not found.' });
    }

    let menuPdfUrl = existingHotel.menuPdfUrl || '';
    let factSheetUrl = existingHotel.factSheetUrl || '';

    if (req.files && req.files['menuPdf']) {
      menuPdfUrl = `/uploads/${req.files['menuPdf'][0].filename}`;
    }
    if (req.files && req.files['factSheetPdf']) {
      factSheetUrl = `/uploads/${req.files['factSheetPdf'][0].filename}`;
    }

    const updatedHotel = {
      ...existingHotel,
      wifiName: wifiName || existingHotel.wifiName,
      wifiPassword: wifiPassword || existingHotel.wifiPassword,
      nearbyPlaces: nearbyPlaces || existingHotel.nearbyPlaces,
      menuPdfUrl,
      factSheetUrl
    };

    store.saveHotel(updatedHotel);
    res.json({ success: true, hotel: updatedHotel });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Get Hotel Details Endpoint
app.get('/api/hotels/:hotelId', (req, res) => {
  const hotel = store.getHotelById(req.params.hotelId);
  if (hotel) {
    res.json({ success: true, hotel });
  } else {
    res.status(404).json({ success: false, message: 'Hotel not found.' });
  }
});

// 4. Guest Service Request Endpoint
app.post('/api/requests', async (req, res) => {
  try {
    await sendAlert(req.body);
    res.json({ success: true, message: 'Request sent to hotel staff.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => console.log(`HostlyDesk active on port ${PORT}`));
