document.addEventListener('DOMContentLoaded', () => {
  // Handle Hotel Configuration Form Submission
  const hotelForm = document.getElementById('hotelForm');
  if (hotelForm) {
    hotelForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const hotelData = {
        hotelId: document.getElementById('hotelId').value.trim().toLowerCase(),
        hotelName: document.getElementById('hotelName').value.trim(),
        frontOfficeChatId: document.getElementById('frontOfficeChatId').value.trim(),
        housekeepingChatId: document.getElementById('housekeepingChatId').value.trim(),
        kitchenChatId: document.getElementById('kitchenChatId').value.trim()
      };

      try {
        const response = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(hotelData)
        });

        if (response.ok) {
          alert('Hotel property updated successfully!');
          location.reload();
        } else {
          alert('Failed to save hotel property.');
        }
      } catch (err) {
        console.error('Config save error:', err);
        alert('An error occurred while saving configuration.');
      }
    });
  }

  // Fetch and Render Live Orders Table cleanly
  loadOrders();
  setInterval(loadOrders, 10000); // Auto-refresh orders every 10 seconds
});

async function loadOrders() {
  const ordersContainer = document.getElementById('ordersTableBody') || document.querySelector('.orders-table tbody');
  if (!ordersContainer) return;

  try {
    const res = await fetch('/api/orders');
    const orders = await res.json();

    if (!Array.isArray(orders) || orders.length === 0) return;

    ordersContainer.innerHTML = '';

    orders.forEach(order => {
      let formattedItems = '';
      
      try {
        const parsedItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        
        if (Array.isArray(parsedItems)) {
          formattedItems = parsedItems.map(item => {
            if (typeof item === 'string') return item;
            return `${item.name || 'Item ID ' + item.id} (Qty: ${item.qty || item.quantity || 1})`;
          }).join(', ');
        } else if (parsedItems && typeof parsedItems === 'object') {
          if (parsedItems.items && Array.isArray(parsedItems.items)) {
            formattedItems = parsedItems.items.join(', ');
          } else {
            formattedItems = JSON.stringify(parsedItems);
          }
        } else {
          formattedItems = order.items;
        }
      } catch (e) {
        formattedItems = order.items;
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>#${order.id}</td>
        <td><span class="room-badge">Room ${order.room || 'DEMO101'}</span></td>
        <td>${formattedItems}</td>
        <td>${order.created_at || 'Just now'}</td>
        <td><span class="status-pill">${order.status || 'Pending'}</span></td>
      `;
      ordersContainer.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading orders:', err);
  }
}
