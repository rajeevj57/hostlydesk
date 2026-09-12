let cart = {};
let roomToken = 'DEMO101';
let menuData = [];

// Fetch room context and food items on load
async function initMenu() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    
    const contextRes = await fetch(`/api/context${roomParam ? '?room=' + roomParam : ''}`);
    const contextData = await contextRes.json();
    if (contextData && contextData.room) {
      roomToken = contextData.room;
    }
    
    const roomHeader = document.querySelector('h1') || document.querySelector('.room-title');
    if (roomHeader) {
      roomHeader.textContent = `Room ${roomToken}`;
    }

    const itemsRes = await fetch('/api/food-items');
    menuData = await itemsRes.json();
    renderList();
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

function renderList() {
  // Find container for food items or create fallback rendering if needed
  // This interacts with the standard HostlyDesk DOM structure
  const container = document.getElementById('menu-container') || document.querySelector('.menu-list') || document.body;
  // If the HTML page already renders items statically or via DOM elements, 
  // ensure quantity indicators update properly.
  updateCartBar();
}

function updateCartBar() {
  let totalCount = 0;
  let totalPrice = 0;

  const itemPrices = { 1: 150, 2: 100, 3: 250, 4: 350, 5: 550 };

  for (let [id, qty] of Object.entries(cart)) {
    totalCount += qty;
    if (itemPrices[id]) {
      totalPrice += itemPrices[id] * qty;
    }
  }

  // Update DOM elements for cart summary if present
  const countEl = document.getElementById('cart-count') || document.querySelector('.cart-item-count');
  if (countEl) countEl.textContent = totalCount;

  const totalEl = document.getElementById('cart-total') || document.querySelector('.cart-total-price');
  if (totalEl) totalEl.textContent = `₹${totalPrice}`;
}

async function placeOrder() {
  const btn = document.getElementById('placeOrderBtn');
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Placing order...';
    }

    const items = Object.entries(cart).map(([id, qty]) => ({ id, qty }));
    
    const itemPrices = { 1: 150, 2: 100, 3: 250, 4: 350, 5: 550 };
    let calculatedTotal = 0;
    for (let [id, qty] of Object.entries(cart)) {
      if (itemPrices[id]) {
        calculatedTotal += itemPrices[id] * qty;
      }
    }

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
    
    const displayTotal = data.total || calculatedTotal;
    toast(`Order placed — ₹${displayTotal}. On its way!`);
    
    Object.keys(cart).forEach(k => delete cart[k]);
    renderList();
    updateCartBar();
  } catch (e) {
    toast('Could not place order. Please try again.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Place order';
    }
  }
}

function toast(message) {
  let t = document.getElementById('toast-notification');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast-notification';
    t.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#1e293b; color:#fff; padding:12px 24px; border-radius:8px; z-index:1000; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-size:14px;';
    document.body.appendChild(t);
  }
  t.textContent = message;
  t.style.display = 'block';
  setTimeout(() => {
    t.style.display = 'none';
  }, 3500);
}

document.addEventListener('DOMContentLoaded', () => {
  initMenu();
  const orderBtn = document.getElementById('placeOrderBtn');
  if (orderBtn) {
    orderBtn.addEventListener('click', placeOrder);
  }
});
