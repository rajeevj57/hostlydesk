const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. ENSURE UPLOADS DIRECTORY EXISTS (Prevents upload crash on Render)
const uploadsDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 2. CONFIGURE MULTER FILE STORAGE
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage: storage });

// 3. MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// In-memory database store
const hotels = {};

// 4. ROUTE: STAGE 1 - HOTEL & TELEGRAM SETUP
app.post('/api/hotels', (req, res) => {
  try {
    const { hotelId, hotelName, frontOfficeChatId, housekeepingChatId, kitchenChatId } = req.body;

    if (!hotelId || !hotelName) {
      return res.status(400).json({ success: false, message: 'Hotel Slug and Name are required.' });
    }

    if (!hotels[hotelId]) {
      hotels[hotelId] = {};
    }

    hotels[hotelId] = {
      ...hotels[hotelId],
      hotelId,
      hotelName,
      frontOfficeChatId,
      housekeepingChatId,
      kitchenChatId
    };

    console.log(`[Stage 1] Configured Hotel: ${hotelId}`);
    return res.json({ success: true, hotel: hotels[hotelId] });
  } catch (err) {
    console.error('Error saving Stage 1 config:', err);
    return res.status(500).json({ success: false, message: 'Server error saving config.' });
  }
});

// 5. ROUTE: STAGE 2 - HOTEL OPERATIONS & FILE UPLOADS
app.post('/api/hotels/content', upload.fields([
  { name: 'menuPdf', maxCount: 1 },
  { name: 'factSheetPdf', maxCount: 1 }
]), (req, res) => {
  try {
    const { hotelId, wifiName, wifiPassword, nearbyPlaces } = req.body;

    if (!hotelId || !hotels[hotelId]) {
      return res.status(400).json({ success: false, message: 'Invalid Hotel ID. Complete Stage 1 first.' });
    }

    const hostUrl = `${req.protocol}://${req.get('host')}`;

    if (req.files) {
      if (req.files['menuPdf'] && req.files['menuPdf'][0]) {
        hotels[hotelId].menuPdfUrl = `${hostUrl}/uploads/${req.files['menuPdf'][0].filename}`;
      }
      if (req.files['factSheetPdf'] && req.files['factSheetPdf'][0]) {
        hotels[hotelId].factSheetUrl = `${hostUrl}/uploads/${req.files['factSheetPdf'][0].filename}`;
      }
    }

    hotels[hotelId].wifiName = wifiName || '';
    hotels[hotelId].wifiPassword = wifiPassword || '';
    hotels[hotelId].nearbyPlaces = nearbyPlaces || '';

    console.log(`[Stage 2] Updated Content for Hotel: ${hotelId}`);
    return res.json({ success: true, hotel: hotels[hotelId] });
  } catch (err) {
    console.error('Error uploading operations content:', err);
    return res.status(500).json({ success: false, message: 'Server error uploading files.' });
  }
});

// 6. ROUTE: GET HOTEL DATA FOR GUEST INTERFACE
app.get('/api/hotels/:hotelId', (req, res) => {
  const { hotelId } = req.params;
  if (hotels[hotelId]) {
    return res.json({ success: true, hotel: hotels[hotelId] });
  }
  return res.status(404).json({ success: false, message: 'Hotel not found.' });
});

// 7. ROUTE: HANDLE GUEST SERVICE REQUESTS
app.post('/api/requests', async (req, res) => {
  try {
    const { hotelId, roomNumber, guestName, serviceType, details } = req.body;
    const hotel = hotels[hotelId];

    if (!hotel) {
      return res.status(404).json({ success: false, message: 'Hotel profile not found.' });
    }

    console.log(`[Request] ${serviceType} request for Room ${roomNumber} at ${hotel.hotelName}: ${details}`);
    return res.json({ success: true, message: 'Request received successfully.' });
  } catch (err) {
    console.error('Error handling service request:', err);
    return res.status(500).json({ success: false, message: 'Failed to process service request.' });
  }
});

app.listen(PORT, () => {
  console.log(`HostlyDesk Server running live on port ${PORT}`);
});
