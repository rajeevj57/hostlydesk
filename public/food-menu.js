const params = new URLSearchParams(location.search);
const roomToken = params.get('room') || 'DEMO101';

let allFood = [];
let activeCategory = null;
const cart = {}; // id -> qty

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

async function loadContext() {
  try {
    const res = await fetch(`/api/context?room=${encodeURIComponent(roomToken)}`);
    const data = await res.json();
    document.getElementById('roomNumber').textContent = `Room ${data.room}`;
  } catch (e) {}
}

async function loadFood() {
  const res = await fetch('/api/food-items');
  allFood = await res.json();
  const categories = [...new Set(allFood.map(f => f.category))];
  activeCategory = categories[0];

  const tabs = document.getElementById('catTabs');
  tabs.innerHTML = '';
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'food-cat-btn' + (cat === activeCategory ? ' active' : '');
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      activeCategory = cat;
      document.querySelectorAll('.food-cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderList();
    });
    tabs.appendChild(btn);
  });

  renderList();
}

function renderList() {
  const wrap = document.getElementById('foodList');
  wrap.innerHTML = '';
  const items = allFood.filter(f => f.category === activeCategory);

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'food-item';
    row.innerHTML = `
      <div class="food-icon">${item.icon}</div>
      <div class="food-info">
        <div class="food-name-row">
          <span class="veg-dot ${item.veg ? '' : 'non-veg'}"></span>
          <span class="food-name">${item.name}</span>
        </div>
        <div class="food-price">₹${item.price}</div>
      </div>
      <div class="food-qty">
        <button class="food-qty-btn" data-action="minus">−</button>
        <span class="food-qty-val">${cart[item.id] || 0}</span>
        <button class="food-qty-btn" data-action="plus">+</button>
      </div>
    `;
    const qtyVal = row.querySelector('.food-qty-val');
    row.querySelector('[data-action="plus"]').addEventListener('click', () => {
      cart[item.id] = (cart[item.id] || 0) + 1;
      qtyVal.textContent = cart[item.id];
      updateCartBar();
    });
    row.querySelector('[data-action="minus"]').addEventListener('click', () => {
      const current = cart[item.id] || 0;
      if (current <= 0) return;
      cart[item.id] = current - 1;
      if (cart[item.id] === 0) delete cart[item.id];
      qtyVal.textContent = cart[item.id] || 0;
      updateCartBar();
    });
    wrap.appendChild(row);
  });
}

function updateCartBar() {
  const bar = document.getElementById('cartBar');
  const entries = Object.entries(cart);
  const count = entries.reduce((sum, [, qty]) => sum + qty, 0);
  const total = entries.reduce((sum, [id, qty]) => {
    const item = allFood.find(f => f.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  if (count === 0) {
    bar.classList.remove('show');
    return;
  }
  bar.classList.add('show');
  document.getElementById('cartCount').textContent = `${count} item${count > 1 ? 's' : ''}`;
  document.getElementById('cartTotal').textContent = `₹${total}`;
}

async function placeOrder() {
  const btn = document.getElementById('placeOrderBtn');
  btn.disabled = true;
  btn.textContent = 'Placing…';
  try {
    const items = Object.entries(cart).map(([id, qty]) => ({ id, qty }));
    const res = await fetch('/api/food-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: roomToken, items }),
    });
    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    toast(`Order placed — ₹${data.total}. On its way!`);
    Object.keys(cart).forEach(k => delete cart[k]);
    renderList();
    updateCartBar();
  } catch (e) {
    toast('Could not place order. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Place order';
  }
}

document.getElementById('placeOrderBtn').addEventListener('click', placeOrder);

loadContext();
loadFood();
