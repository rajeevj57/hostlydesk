const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/hotels.json');

function getHotels() {
  if (!fs.existsSync(dataPath)) return {};
  const raw = fs.readFileSync(dataPath, 'utf-8');
  return JSON.parse(raw || '{}');
}

function saveHotel(hotelData) {
  const hotels = getHotels();
  hotels[hotelData.hotelId] = hotelData;
  fs.writeFileSync(dataPath, JSON.stringify(hotels, null, 2));
  return true;
}

function getHotelById(hotelId) {
  const hotels = getHotels();
  return hotels[hotelId] || null;
}

module.exports = { getHotels, saveHotel, getHotelById };
