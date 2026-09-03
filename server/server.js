const express = require('express');
const path = require('path');
const store = require('./store');
const telegram = require('./telegram');

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Save Hotel Configuration (Admin Portal)
app.post('/api/hotels', (req, res) => {
  try {
    store.saveHotel(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch Hotel Details (Guest Interface & Admin)
app.get('/api/hotels/:hotelId', (req, res) => {
  try {
    const hotel = store.getHotelById(req.params.hotelId);
    if (!hotel) return res.status(404).json({ error: 'Hotel configuration not found' });
    res.json({ success: true, hotel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send Service Request to Telegram
app.post('/api/requests', async (req, res) => {
  try {
    const result = await telegram.sendAlert(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Render dynamic port binding
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
