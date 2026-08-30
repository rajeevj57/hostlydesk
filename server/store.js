
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');
const GUESTS_FILE = path.join(DATA_DIR, 'guests.json');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const MENU_ITEMS_FILE = path.join(DATA_DIR, 'menu-items.json');
const INFO_ITEMS_FILE = path.join(DATA_DIR, 'info-items.json');
const GUIDE_FILE = path.join(DATA_DIR, 'guide.json');

function ensureFile(file, defaultValue) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2));
  }
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ---- Default seed data (only used the very first time each file is created) ----

const DEFAULT_MENU_ITEMS = [
  { id: 'towels', icon: '🚿', label: 'Extra Towels', department: 'housekeeping' },
  { id: 'water', icon: '💧', label: 'Drinking Water', department: 'housekeeping' },
  { id: 'pillow', icon: '💤', label: 'Extra Pillow', department: 'housekeeping' },
  { id: 'cleaning', icon: '✅', label: 'Room Cleaning', department: 'housekeeping' },
  { id: 'food', icon: '🍴', label: 'Order Food', department: 'kitchen' },
  { id: 'tea_coffee', icon: '☕', label: 'Tea / Coffee', department: 'kitchen' },
  { id: 'wakeup', icon: '⏰', label: 'Wake-up Call', department: 'front_office' },
  { id: 'taxi', icon: '🚕', label: 'Book a Taxi', department: 'front_office' },
  { id: 'checkout_help', icon: '🔔', label: 'Checkout Help', department: 'front_office' },
];

const DEFAULT_INFO_ITEMS = [
  { title: 'Wi-Fi', body: 'Network: HostlyDesk_Guest — Password: welcome2026' },
  { title: 'Breakfast hours', body: 'Served 7:00 AM – 10:30 AM at the ground floor restaurant.' },
  { title: 'Check-out', body: 'Check-out is by 11:00 AM. Use "Checkout Help" on this page for a late check-out request.' },
  { title: 'Emergency contact', body: 'Front desk: dial 0 from your room phone, available 24/7.' },
];

const DEFAULT_GUIDE = [
  { name: 'Apollo Pharmacy', category: 'Pharmacy', distance: '3 min walk' },
  { name: 'HDFC ATM', category: 'ATM', distance: '4 min walk' },
  { name: 'Spice Route', category: 'Restaurant', distance: '6 min walk' },
  { name: 'Cafe Amber', category: 'Cafe', distance: '2 min walk' },
];

function init() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  ensureFile(REQUESTS_FILE, []);
  ensureFile(GUESTS_FILE, []);

  const defaultRooms = {};
  for (let floor = 1; floor <= 10; floor++) {
    for (let num = 1; num <= 10; num++) {
      const token = String(floor * 100 + num); // 101..110, 201..210, ... 1001..1010
      defaultRooms[token] = {
        room: token,
        guestName: 'Guest',
        hotelName: 'HostlyDesk Hotel',
        checkoutTime: '11:00 AM'
      };
    }
  }
  defaultRooms.DEMO101 = { room: '101', guestName: 'Guest', hotelName: 'HostlyDesk Hotel', checkoutTime: '11:00 AM' };
  ensureFile(ROOMS_FILE, defaultRooms);

  ensureFile(MENU_ITEMS_FILE, DEFAULT_MENU_ITEMS);
  ensureFile(INFO_ITEMS_FILE, DEFAULT_INFO_ITEMS);
  ensureFile(GUIDE_FILE, DEFAULT_GUIDE);
}

function getMenuItems() { return readJSON(MENU_ITEMS_FILE); }
function getInfoItems() { return readJSON(INFO_ITEMS_FILE); }
function getGuide() { return readJSON(GUIDE_FILE); }

module.exports = {
  init,
  readJSON, writeJSON,
  REQUESTS_FILE, GUESTS_FILE, ROOMS_FILE,
  MENU_ITEMS_FILE, INFO_ITEMS_FILE, GUIDE_FILE,
  getMenuItems, getInfoItems, getGuide,
};


