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
