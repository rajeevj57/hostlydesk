const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure upload directory exists to prevent crash
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

// In-memory data store
const hotels = {};

// STAGE 1: Save Configuration
app.post('/api/hotels', (req, res) => {
  const { hotelId, hotelName, frontOfficeChatId, housekeepingChatId, kitchenChatId } = req.body;
  if (!hotelId) return res.status(400).json({ success: false, message: 'Hotel ID required' });

  hotels[hotelId] = {
    ...(hotels[hotelId] || {}),
    hotelId,
    hotelName,
    frontOfficeChatId,
    housekeepingChatId,
    kitchenChatId
  };

  res.json({ success: true, data: hotels[hotelId] });
});

// STAGE 2: Upload Files & Content
app.post('/api/hotels/content', upload.fields([
  { name: 'menuPdf', maxCount: 1 },
  { name: 'factSheetPdf', maxCount: 1 }
]), (req, res) => {
  const { hotelId, wifiName, wifiPassword, nearbyPlaces } = req.body;

  if (!hotelId || !hotels[hotelId]) {
    return res.status(400).json({ success: false, message: 'Please submit Stage 1 first.' });
  }

  const menuFile = req.files?.['menuPdf']?.[0];
  const factSheetFile = req.files?.['factSheetPdf']?.[0];

  hotels[hotelId] = {
    ...hotels[hotelId],
    wifiName: wifiName || '',
    wifiPassword: wifiPassword || '',
    nearbyPlaces: nearbyPlaces || '',
    menuUrl: menuFile ? `/uploads/${menuFile.filename}` : hotels[hotelId].menuUrl || null,
    factSheetUrl: factSheetFile ? `/uploads/${factSheetFile.filename}` : hotels[hotelId].factSheetUrl || null
  };

  res.json({ success: true, message: 'Published successfully', data: hotels[hotelId] });
});

// Error handling middleware for unexpected upload errors
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, message: err.message || 'Server error occurred' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
