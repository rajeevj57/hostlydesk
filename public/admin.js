document.getElementById('hotelForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const hotelData = {
    hotelId: document.getElementById('hotelId').value.trim().toLowerCase(),
    hotelName: document.getElementById('hotelName').value.trim(),
    frontOfficeChatId: document.getElementById('frontOfficeChatId').value.trim(),
    housekeepingChatId: document.getElementById('housekeepingChatId').value.trim(),
    kitchenChatId: document.getElementById('kitchenChatId').value.trim()
  };

  const response = await fetch('/api/hotels', {
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
});
