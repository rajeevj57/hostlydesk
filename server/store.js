const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');
const GUESTS_FILE = path.join(DATA_DIR, 'guests.json');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');

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

function init() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  ensureFile(REQUESTS_FILE, []);
  ensureFile(GUESTS_FILE, []);
  ensureFile(ROOMS_FILE, {
    // room QR token -> room context. In production, generate one token per room/stay.
    DEMO101: {
      room: '101',
      guestName: 'Guest',
      hotelName: 'HostlyDesk Hotel',
      checkoutTime: '11:00 AM'
    }
  });
}

// ---- Menu items (Visual Request Menu) ----
// department maps to a Telegram chat ID via telegram.js DEPARTMENT_CHATS
const MENU_ITEMS = [
  { id: 'towels', icon: '🚿', label: 'Extra Towels', department: 'housekeeping' },
  { id: 'water', icon: '💧', label: 'Drinking Water', department: 'housekeeping' },
  { id: 'cleaning', icon: '✅', label: 'Room Cleaning', department: 'housekeeping' },
  { id: 'pillow', icon: '💤', label: 'Extra Pillow', department: 'housekeeping' },
  { id: 'food', icon: '🍴', label: 'Order Food', department: 'kitchen' },
  { id: 'tea_coffee', icon: '☕', label: 'Tea / Coffee', department: 'kitchen' },
  { id: 'wakeup', icon: '⏰', label: 'Wake-up Call', department: 'front_office' },
  { id: 'taxi', icon: '🚕', label: 'Book a Taxi', department: 'front_office' },
  { id: 'checkout_help', icon: '🔔', label: 'Checkout Help', department: 'front_office' },
];

const INFO_ITEMS = [
  { title: 'Wi-Fi', body: 'Network: HostlyDesk_Guest — Password: welcome2026' },
  { title: 'Breakfast hours', body: 'Served 7:00 AM – 10:30 AM at the ground floor restaurant.' },
  { title: 'Check-out', body: 'Check-out is by 11:00 AM. Use "Checkout Help" on this page for a late check-out request.' },
  { title: 'Emergency contact', body: 'Front desk: dial 0 from your room phone, available 24/7.' },
];

const LOCAL_GUIDE = [
  { name: 'Apollo Pharmacy', category: 'Pharmacy', distance: '3 min walk' },
  { name: 'HDFC ATM', category: 'ATM', distance: '4 min walk' },
  { name: 'Spice Route', category: 'Restaurant', distance: '6 min walk' },
  { name: 'Cafe Amber', category: 'Cafe', distance: '2 min walk' },
];

module.exports = {
  init,
  readJSON, writeJSON,
  REQUESTS_FILE, GUESTS_FILE, ROOMS_FILE,
  MENU_ITEMS, INFO_ITEMS, LOCAL_GUIDE,
};
