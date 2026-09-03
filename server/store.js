const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');
const HOTELS_FILE = path.join(DATA_DIR, 'hotels.json');

function init() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(REQUESTS_FILE)) {
    fs.writeFileSync(REQUESTS_FILE, JSON.stringify([]));
  }
  if (!fs.existsSync(HOTELS_FILE)) {
    fs.writeFileSync(HOTELS_FILE, JSON.stringify({}));
  }
}

function getRequests() {
  try {
    const data = fs.readFileSync(REQUESTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function saveRequests(requests) {
  fs.writeFileSync(REQUESTS_FILE, JSON.stringify(requests, null, 2));
}

function addRequest(req) {
  const requests = getRequests();
  requests.unshift(req);
  saveRequests(requests);
  return req;
}

function getHotels() {
  try {
    const data = fs.readFileSync(HOTELS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}

function saveHotel(hotel) {
  const hotels = getHotels();
  hotels[hotel.id] = hotel;
  fs.writeFileSync(HOTELS_FILE, JSON.stringify(hotels, null, 2));
  return hotel;
}

module.exports = {
  init,
  getRequests,
  addRequest,
  getHotels,
  saveHotel
};
