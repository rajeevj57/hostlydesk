const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');
const GUESTS_FILE = path.join(DATA_DIR, 'guests.json');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const MENU_ITEMS_FILE = path.join(DATA_DIR, 'menu-items.json');
const INFO_ITEMS_FILE = path.join(DATA_DIR, 'info-items.json');
const GUIDE_FILE = path.join(DATA_DIR, 'guide.json');
const FOOD_ITEMS_FILE = path.join(DATA_DIR, 'food-items.json');
const FOOD_ORDERS_FILE = path.join(DATA_DIR, 'food-orders.json');

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

const DEFAULT_FOOD_ITEMS = [
  { id: 'f_paneer_tikka', name: 'Paneer Tikka', icon: '🧀', price: 220, category: 'Starters', veg: true },
  { id: 'f_chicken_65', name: 'Chicken 65', icon: '🍗', price: 260, category: 'Starters', veg: false },
  { id: 'f_veg_biryani', name: 'Veg Biryani', icon: '🍛', price: 240, category: 'Mains', veg: true },
  { id: 'f_butter_chicken', name: 'Butter Chicken', icon: '🍛', price: 320, category: 'Mains', veg: false },
  { id: 'f_dal_makhani', name: 'Dal Makhani', icon: '🍲', price: 210, category: 'Mains', veg: true },
  { id: 'f_butter_naan', name: 'Butter Naan', icon: '🫓', price: 60, category: 'Mains', veg: true },
  { id: 'f_gulab_jamun', name: 'Gulab Jamun', icon: '🍮', price: 120, category: 'Desserts', veg: true },
  { id: 'f_ice_cream', name: 'Ice Cream', icon: '🍨', price: 100, category: 'Desserts', veg: true },
  { id: 'f_masala_chai', name: 'Masala Chai', icon: '☕', price: 60, category: 'Drinks', veg: true },
  { id: 'f_fresh_lime', name: 'Fresh Lime Soda', icon: '🥤', price: 90, category: 'Drinks', veg: true },
];

function init() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  ensureFile(REQUESTS_FILE, []);
  ensureFile(GUESTS_FILE, []);
  ensureFile(FOOD_ORDERS_FILE, []);

  const defaultRooms = {};
  for (let floor = 1; floor <= 10; floor++) {
    for (let num = 1; num <= 10; num++) {
      const token = String(floor * 100 + num);
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
  ensureFile(FOOD_ITEMS_FILE, DEFAULT_FOOD_ITEMS);
}

function getMenuItems() { return readJSON(MENU_ITEMS_FILE); }
function getInfoItems() { return readJSON(INFO_ITEMS_FILE); }
function getGuide() { return readJSON(GUIDE_FILE); }
function getFoodItems() { return readJSON(FOOD_ITEMS_FILE); }

module.exports = {
  init,
  readJSON, writeJSON,
  REQUESTS_FILE, GUESTS_FILE, ROOMS_FILE,
  MENU_ITEMS_FILE, INFO_ITEMS_FILE, GUIDE_FILE,
  FOOD_ITEMS_FILE, FOOD_ORDERS_FILE,
  getMenuItems, getInfoItems, getGuide, getFoodItems,
};
