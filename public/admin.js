let adminPassword = '';

async function login() {
  const pw = document.getElementById('passwordInput').value;
  const errBox = document.getElementById('loginError');
  errBox.textContent = '';
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    if (!res.ok) { errBox.textContent = 'Wrong password — try again.'; return; }
    adminPassword = pw;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminScreen').style.display = 'block';
    loadAll();
  } catch (e) {
    errBox.textContent = 'Something went wrong. Please try again.';
  }
}

// ---- Tabs ----
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
  });
});

async function loadAll() {
  const [menu, info, guide, food] = await Promise.all([
    fetch('/api/menu-items').then(r => r.json()),
    fetch('/api/info').then(r => r.json()),
    fetch('/api/guide').then(r => r.json()),
    fetch('/api/food-items').then(r => r.json()),
  ]);
  renderMenu(menu);
  renderInfo(info);
  renderGuide(guide);
  renderFood(food);
  loadCheckin();
  loadRoomsList();
}

// ---- Request Menu ----
function renderMenu(items) {
  const wrap = document.getElementById('menuRows');
  wrap.innerHTML = '';
  items.forEach(item => wrap.appendChild(menuRowEl(item)));
}
function menuRowEl(item = { id: '', icon: '✨', label: '', department: 'housekeeping' }) {
  const row = document.createElement('div');
  row.className = 'row-card';
  row.innerHTML = `
    <input class="icon-input" value="${item.icon || ''}" placeholder="🙂" data-field="icon">
    <input class="label-input" value="${item.label || ''}" placeholder="Item name (e.g. Extra Towels)" data-field="label">
    <select class="dept-select" data-field="department">
      <option value="housekeeping" ${item.department === 'housekeeping' ? 'selected' : ''}>Housekeeping</option>
      <option value="kitchen" ${item.department === 'kitchen' ? 'selected' : ''}>Kitchen</option>
      <option value="front_office" ${item.department === 'front_office' ? 'selected' : ''}>Front Office</option>
    </select>
    <button class="remove-btn" onclick="this.closest('.row-card').remove()">✕</button>
  `;
  row.dataset.id = item.id || ('item_' + Math.random().toString(36).slice(2, 8));
  return row;
}
function addMenuRow() {
  document.getElementById('menuRows').appendChild(menuRowEl());
}
async function saveMenu() {
  const rows = document.querySelectorAll('#menuRows .row-card');
  const items = Array.from(rows).map(row => ({
    id: row.dataset.id,
    icon: row.querySelector('[data-field="icon"]').value.trim() || '✨',
    label: row.querySelector('[data-field="label"]').value.trim(),
    department: row.querySelector('[data-field="department"]').value,
  })).filter(i => i.label);
  await adminSave('/api/admin/menu-items', items, 'menuStatus');
}

// ---- Hotel Info ----
function renderInfo(items) {
  const wrap = document.getElementById('infoRows');
  wrap.innerHTML = '';
  items.forEach(item => wrap.appendChild(infoRowEl(item)));
}
function infoRowEl(item = { title: '', body: '' }) {
  const row = document.createElement('div');
  row.className = 'row-card';
  row.innerHTML = `
    <input class="title-input" value="${item.title || ''}" placeholder="Title (e.g. Wi-Fi)" data-field="title">
    <input class="body-input" value="${item.body || ''}" placeholder="Details shown to guest" data-field="body">
    <button class="remove-btn" onclick="this.closest('.row-card').remove()">✕</button>
  `;
  return row;
}
function addInfoRow() {
  document.getElementById('infoRows').appendChild(infoRowEl());
}
async function saveInfo() {
  const rows = document.querySelectorAll('#infoRows .row-card');
  const items = Array.from(rows).map(row => ({
    title: row.querySelector('[data-field="title"]').value.trim(),
    body: row.querySelector('[data-field="body"]').value.trim(),
  })).filter(i => i.title);
  await adminSave('/api/admin/info', items, 'infoStatus');
}

// ---- Nearby Places ----
function renderGuide(items) {
  const wrap = document.getElementById('guideRows');
  wrap.innerHTML = '';
  items.forEach(item => wrap.appendChild(guideRowEl(item)));
}
function guideRowEl(item = { name: '', category: '', distance: '' }) {
  const row = document.createElement('div');
  row.className = 'row-card';
  row.innerHTML = `
    <input class="name-input" value="${item.name || ''}" placeholder="Place name" data-field="name">
    <input class="cat-input" value="${item.category || ''}" placeholder="Category" data-field="category">
    <input class="dist-input" value="${item.distance || ''}" placeholder="e.g. 3 min walk" data-field="distance">
    <button class="remove-btn" onclick="this.closest('.row-card').remove()">✕</button>
  `;
  return row;
}
function addGuideRow() {
  document.getElementById('guideRows').appendChild(guideRowEl());
}
async function saveGuide() {
  const rows = document.querySelectorAll('#guideRows .row-card');
  const items = Array.from(rows).map(row => ({
    name: row.querySelector('[data-field="name"]').value.trim(),
    category: row.querySelector('[data-field="category"]').value.trim(),
    distance: row.querySelector('[data-field="distance"]').value.trim(),
  })).filter(i => i.name);
  await adminSave('/api/admin/guide', items, 'guideStatus');
}

// ---- Food Menu ----
function renderFood(items) {
  const wrap = document.getElementById('foodRows');
  wrap.innerHTML = '';
  items.forEach(item => wrap.appendChild(foodRowEl(item)));
}
function foodRowEl(item = { id: '', name: '', icon: '🍴', price: '', category: '', veg: true }) {
  const row = document.createElement('div');
  row.className = 'row-card';
  row.innerHTML = `
    <input class="icon-input" value="${item.icon || ''}" placeholder="🍴" data-field="icon">
    <input class="label-input" value="${item.name || ''}" placeholder="Dish name" data-field="name">
    <input class="cat-input" value="${item.category || ''}" placeholder="Category" data-field="category">
    <input class="dist-input" type="number" value="${item.price ?? ''}" placeholder="Price ₹" data-field="price">
    <select class="dept-select" data-field="veg" style="width:90px;">
      <option value="true" ${item.veg ? 'selected' : ''}>Veg</option>
      <option value="false" ${!item.veg ? 'selected' : ''}>Non-veg</option>
    </select>
    <button class="remove-btn" onclick="this.closest('.row-card').remove()">✕</button>
  `;
  row.dataset.id = item.id || ('food_' + Math.random().toString(36).slice(2, 8));
  return row;
}
function addFoodRow() {
  document.getElementById('foodRows').appendChild(foodRowEl());
}
async function saveFood() {
  const rows = document.querySelectorAll('#foodRows .row-card');
  const items = Array.from(rows).map(row => ({
    id: row.dataset.id,
    icon: row.querySelector('[data-field="icon"]').value.trim() || '🍴',
    name: row.querySelector('[data-field="name"]').value.trim(),
    category: row.querySelector('[data-field="category"]').value.trim() || 'Mains',
    price: Number(row.querySelector('[data-field="price"]').value) || 0,
    veg: row.querySelector('[data-field="veg"]').value === 'true',
  })).filter(i => i.name);
  await adminSave('/api/admin/food-items', items, 'foodStatus');
}

// ---- Guests / Check-in ----
async function loadCheckin() {
  const res = await fetch('/api/admin/rooms', {
    headers: { 'X-Admin-Password': adminPassword },
  });
  const rooms = await res.json();

  const select = document.getElementById('checkinRoom');
  select.innerHTML = rooms.map(r => `<option value="${r.room}">Room ${r.room}</option>`).join('');

  const occupied = rooms.filter(r => r.guestName && r.guestName !== 'Guest');
  const listEl = document.getElementById('occupiedRooms');
  if (occupied.length === 0) {
    listEl.textContent = 'No rooms currently have a guest checked in.';
    return;
  }
  listEl.innerHTML = '';
  occupied.forEach(r => {
    const row = document.createElement('div');
    row.className = 'row-card';
    row.innerHTML = `
      <div style="flex:1;">
        <div style="font-weight:600; font-size:14px;">Room ${r.room} — ${r.guestName}</div>
        <div style="font-size:12px; color:var(--charcoal-soft);">Checkout: ${r.checkoutTime}</div>
      </div>
      <button class="remove-btn" style="font-size:13px;" data-room="${r.room}">Check out</button>
    `;
    row.querySelector('button').addEventListener('click', () => checkoutGuest(r.room));
    listEl.appendChild(row);
  });
}

async function checkinGuest() {
  const room = document.getElementById('checkinRoom').value;
  const guestName = document.getElementById('checkinName').value.trim();
  const checkoutTime = document.getElementById('checkinCheckout').value.trim();
  const statusEl = document.getElementById('checkinStatus');
  if (!guestName) { statusEl.textContent = 'Enter a guest name.'; statusEl.classList.add('error'); return; }

  statusEl.textContent = 'Checking in…';
  statusEl.classList.remove('error');
  try {
    const res = await fetch('/api/admin/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPassword },
      body: JSON.stringify({ room, guestName, checkoutTime }),
    });
    if (!res.ok) throw new Error('failed');
    statusEl.textContent = `Checked in — Room ${room} now shows "${guestName}".`;
    document.getElementById('checkinName').value = '';
    document.getElementById('checkinCheckout').value = '';
    loadCheckin();
  } catch (e) {
    statusEl.textContent = 'Could not check in. Please try again.';
    statusEl.classList.add('error');
  }
}

async function checkoutGuest(room) {
  await fetch('/api/admin/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPassword },
    body: JSON.stringify({ room }),
  });
  loadCheckin();
}

// ---- Rooms management ----
function parseRoomInput(text) {
  return text.split(/[,\n\s]+/).map(s => s.trim()).filter(Boolean);
}

async function loadRoomsList() {
  const res = await fetch('/api/admin/rooms', { headers: { 'X-Admin-Password': adminPassword } });
  const rooms = await res.json();
  document.getElementById('roomCount').textContent = rooms.length;

  const wrap = document.getElementById('allRoomsList');
  if (rooms.length === 0) {
    wrap.textContent = 'No rooms yet — add some above.';
    return;
  }
  wrap.innerHTML = '';
  rooms.forEach(r => {
    const chip = document.createElement('div');
    chip.style.cssText = 'display:flex; align-items:center; gap:6px; background:var(--paper); border:1px solid var(--line); border-radius:999px; padding:6px 10px; font-size:13px;';
    chip.innerHTML = `<span>${r.room}</span> <button style="border:none;background:none;color:var(--alert);cursor:pointer;font-size:14px;line-height:1;" title="Remove room">✕</button>`;
    chip.querySelector('button').addEventListener('click', () => removeRoom(r.room));
    wrap.appendChild(chip);
  });
}

async function addRooms() {
  const input = document.getElementById('roomsAddInput');
  const statusEl = document.getElementById('roomsAddStatus');
  const rooms = parseRoomInput(input.value);
  if (rooms.length === 0) { statusEl.textContent = 'Paste at least one room number.'; statusEl.classList.add('error'); return; }

  statusEl.textContent = 'Adding…';
  statusEl.classList.remove('error');
  try {
    const res = await fetch('/api/admin/rooms/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPassword },
      body: JSON.stringify({ rooms }),
    });
    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    statusEl.textContent = `Added ${data.added} new room(s).`;
    input.value = '';
    loadRoomsList();
    loadCheckin();
  } catch (e) {
    statusEl.textContent = 'Could not add rooms. Please try again.';
    statusEl.classList.add('error');
  }
}

async function removeRoom(room) {
  if (!confirm(`Remove Room ${room}? Its QR code will stop working.`)) return;
  await fetch('/api/admin/rooms/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPassword },
    body: JSON.stringify({ room }),
  });
  loadRoomsList();
  loadCheckin();
}

async function replaceAllRooms() {
  const input = document.getElementById('roomsReplaceInput');
  const statusEl = document.getElementById('roomsReplaceStatus');
  const rooms = parseRoomInput(input.value);
  if (rooms.length === 0) { statusEl.textContent = 'Paste at least one room number.'; statusEl.classList.add('error'); return; }
  if (!confirm(`This will DELETE all existing rooms and replace with ${rooms.length} new room(s). Continue?`)) return;

  statusEl.textContent = 'Replacing…';
  statusEl.classList.remove('error');
  try {
    const res = await fetch('/api/admin/rooms/replace-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPassword },
      body: JSON.stringify({ rooms }),
    });
    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    statusEl.textContent = `Done — ${data.count} room(s) now active.`;
    input.value = '';
    loadRoomsList();
    loadCheckin();
  } catch (e) {
    statusEl.textContent = 'Could not replace rooms. Please try again.';
    statusEl.classList.add('error');
  }
}

// ---- Shared save helper ----
async function adminSave(url, data, statusElId) {
  const statusEl = document.getElementById(statusElId);
  statusEl.textContent = 'Saving…';
  statusEl.classList.remove('error');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPassword },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('save failed');
    statusEl.textContent = 'Saved ✓ — guests will see this immediately.';
    setTimeout(() => statusEl.textContent = '', 3000);
  } catch (e) {
    statusEl.textContent = 'Could not save. Please try again.';
    statusEl.classList.add('error');
  }
}
