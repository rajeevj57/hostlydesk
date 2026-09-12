const params = new URLSearchParams(location.search);
let roomToken = params.get('room') || 'DEMO101';
let cart = {};
let allFood = [];
let activeCategory = null;

function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.getElementById('toast-notification');
  }
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#1e293b; color:#fff; padding:12px 24px; border-radius:8px; z-index:1000; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-size:14px; transition: opacity 0.3s;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = 'block';
  t.classList.add('show');
  setTimeout(() => {
    t.classList.remove('show');
    t.style.display = 'none';
  }, 3000);
}

async function loadContext() {
  try {
    const res = await fetch(`/api/context?room=${encodeURIComponent(roomToken)}`);
    const data = await res.json();
    if (data && data.room) {
      roomToken = data.room;
    }
    const roomHeader = document.getElementById('roomNumber') || document.querySelector('h1') || document.querySelector('.room-title');
    if (roomHeader) {
      roomHeader.textContent = `Room ${roomToken}`;
    }
  } catch (e) {
    console.warn('Context load error:', e);
  }
}

async function loadFood() {
  try {
    const res = await fetch('/api/food-items');
    allFood = await res.json();
    
    if (!allFood || allFood.length === 0) return;

    const categories = [...new Set(allFood.map(f => f.category))];
    activeCategory = categories[0];

    const tabs = document.getElementById('catTabs');
    if (tabs) {
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
    }

    renderList();
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

function renderList() {
  const wrap = document.getElementById('foodList');
  if (!wrap) return;
  wrap.innerHTML = '';
  
  const items = allFood.filter(f => f.category === activeCategory);

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'food-item';
    row.innerHTML = `
      <div class="food-icon">${item.icon || '🍽️'}</div>
      <div class="food-info">
        <div class="food-name-row">
          <span class="veg-dot ${item.veg !== false ? '' : 'non-veg'}"></span>
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
  
  updateCartBar();
}

function updateCartBar() {
  const bar = document.getElementById('cartBar');
  const entries = Object.entries(cart);
  const count = entries.reduce((sum, [, qty]) => sum + qty, 0);
  
  const totalPrice = entries.reduce((sum, [id, qty]) => {
    const item = allFood.find(f => f.id == id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  if (bar) {
    if (count === 0) {
      bar.classList.remove('show');
    } else {
      bar.classList.add('show');
    }
  }

  const cartCountEl = document.getElementById('cartCount') || document.getElementById('cart-count') || document.querySelector('.cart-item-count');
  if (cartCountEl) {
    cartCountEl.textContent = `${count} item${count > 1 ? 's' : ''}`;
  }

  const cartTotalEl = document.getElementById('cartTotal') || document.getElementById('cart-total') || document.querySelector('.cart-total-price');
  if (cartTotalEl) {
    cartTotalEl.textContent = `₹${totalPrice}`;
  }
}

async function placeOrder() {
  const btn = document.getElementById('placeOrderBtn');
  if (!btn) return;

  try {
    btn.disabled = true;
    btn.textContent = 'Placing order...';

    const items = Object.entries(cart).map(([id, qty]) => ({ id, qty }));
    
    const calculatedTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
      const item = allFood.find(f => f.id == id);
      return sum + (item ? item.price * qty : 0);
    }, 0);

    const res = await fetch('/api/food-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        room: roomToken, 
        items: items, 
        total: calculatedTotal 
      }),
    });

    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    
    const displayTotal = data.total !== undefined ? data.total : calculatedTotal;
    toast(`Order placed — ₹${displayTotal}. On its way!`);
    
    cart = {};
    renderList();
    updateCartBar();
  } catch (e) {
    toast('Could not place order. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Place order';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadContext();
  loadFood();
  
  const orderBtn = document.getElementById('placeOrderBtn');
  if (orderBtn) {
    orderBtn.addEventListener('click', placeOrder);
  }
});
