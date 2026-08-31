const params = new URLSearchParams(location.search);
const roomToken = params.get('room') || 'DEMO101';

const state = { items: {}, }; // id -> qty

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
    document.getElementById('guestName').textContent = `Welcome, ${data.guestName}`;
    document.getElementById('hotelName').textContent = data.hotelName;
    document.getElementById('checkoutTime').textContent = `Checkout ${data.checkoutTime}`;
  } catch (e) {
    document.getElementById('guestName').textContent = 'Guest';
  }
}

async function loadMenuItems() {
  const res = await fetch('/api/menu-items');
  const items = await res.json();
  const grid = document.getElementById('requestGrid');
  grid.innerHTML = '';
  items.forEach(item => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.innerHTML = `
      <div class="tile-icon">${item.icon}</div>
      <div class="tile-label">${item.label}</div>
      <div class="qty-row" style="display:none">
        <button class="qty-btn" data-action="minus">−</button>
        <span class="qty-val">0</span>
        <button class="qty-btn" data-action="plus">+</button>
      </div>
    `;
    const qtyRow = tile.querySelector('.qty-row');
    const qtyVal = tile.querySelector('.qty-val');

    tile.addEventListener('click', (e) => {
      if (e.target.dataset.action) return; // handled below
      if (item.id === 'food') {
        location.href = `food-menu.html?room=${encodeURIComponent(roomToken)}`;
        return;
      }
      if (!state.items[item.id]) {
        state.items[item.id] = 1;
        qtyVal.textContent = '1';
        qtyRow.style.display = 'flex';
        tile.classList.add('selected');
        updateSendButton();
      }
    });

    qtyRow.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = e.target.dataset.action;
      if (!action) return;
      let qty = state.items[item.id] || 0;
      if (action === 'plus') qty += 1;
      if (action === 'minus') qty -= 1;
      if (qty <= 0) {
        delete state.items[item.id];
        qtyRow.style.display = 'none';
        tile.classList.remove('selected');
      } else {
        state.items[item.id] = qty;
        qtyVal.textContent = String(qty);
      }
      updateSendButton();
    });

    grid.appendChild(tile);
  });
}

function updateSendButton() {
  const btn = document.getElementById('sendRequestBtn');
  const count = Object.keys(state.items).length;
  btn.disabled = count === 0;
  btn.textContent = count === 0 ? 'Send request' : `Send request (${count})`;
}

async function loadInfo() {
  const res = await fetch('/api/info');
  const info = await res.json();
  const acc = document.getElementById('accordion');
  acc.innerHTML = '';
  info.forEach((entry, i) => {
    const item = document.createElement('div');
    item.className = 'accordion-item';
    item.innerHTML = `
      <div class="accordion-head">
        <span>${entry.title}</span>
        <span class="accordion-chevron">›</span>
      </div>
      <div class="accordion-body">${entry.body}</div>
    `;
    item.querySelector('.accordion-head').addEventListener('click', () => {
      item.classList.toggle('open');
    });
    acc.appendChild(item);
  });
}

async function loadGuide() {
  const res = await fetch('/api/guide');
  const guide = await res.json();
  const wrap = document.getElementById('localGuide');
  wrap.innerHTML = '';
  guide.forEach(place => {
    const row = document.createElement('div');
    row.className = 'guide-item';
    row.innerHTML = `
      <span class="guide-name">${place.name} <span style="color:var(--charcoal-soft); font-weight:400;">· ${place.category}</span></span>
      <span class="guide-dist">${place.distance}</span>
    `;
    wrap.appendChild(row);
  });
}

async function sendRequest() {
  const btn = document.getElementById('sendRequestBtn');
  btn.disabled = true;
  btn.textContent = 'Sending…';
  try {
    const res = await fetch('/api/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room: roomToken,
        items: Object.entries(state.items).map(([id, qty]) => ({ id, qty }))
      })
    });
    if (!res.ok) throw new Error('failed');
    toast('Request sent — on its way to your room.');
    state.items = {};
    document.querySelectorAll('.tile').forEach(t => t.classList.remove('selected'));
    document.querySelectorAll('.qty-row').forEach(r => r.style.display = 'none');
    updateSendButton();
  } catch (e) {
    toast('Could not send request. Please try again.');
    btn.disabled = false;
  }
}

document.getElementById('sendRequestBtn').addEventListener('click', sendRequest);

loadContext();
loadMenuItems();
loadInfo();
loadGuide();
