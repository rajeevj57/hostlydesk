const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'hotels.json');

// Ensure data directory and hotels.json file exist
function initStorage() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}), 'utf8');
  }
}

function getHotels() {
  initStorage();
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data || '{}');
  } catch (error) {
    console.error('Error reading hotels file:', error);
    return {};
  }
}

function saveHotel(data) {
  initStorage();
  const hotels = getHotels();
  const cleanHotelId = data.hotelId.trim().toLowerCase();

  hotels[cleanHotelId] = {
    hotelId: cleanHotelId,
    hotelName: data.hotelName,
    frontOfficeChatId: data.frontOfficeChatId,
    housekeepingChatId: data.housekeepingChatId,
    kitchenChatId: data.kitchenChatId,
    updatedAt: new Date().toISOString()
  };

  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(hotels, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing to hotels file:', error);
    return false;
  }
}

module.exports = {
  getHotels,
  saveHotel
};
