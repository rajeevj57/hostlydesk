const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/hotels.json');

// Ensure data folder and file exist safely
function ensureStorageExists() {
  const dir = path.dirname(dataPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, '{}', 'utf-8');
  }
}

function getHotels() {
  ensureStorageExists();
  try {
    const raw = fs.readFileSync(dataPath, 'utf-8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    return {};
  }
}

function saveHotel(hotelData) {
  ensureStorageExists();
  const hotels = getHotels();
  hotels[hotelData.hotelId] = hotelData;
  fs.writeFileSync(dataPath, JSON.stringify(hotels, null, 2), 'utf-8');
  return true;
}

function getHotelById(hotelId) {
  const hotels = getHotels();
  return hotels[hotelId] || null;
}

module.exports = { getHotels, saveHotel, getHotelById };
