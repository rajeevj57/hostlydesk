const store = require('./store');

async function sendAlert(requestData) {
  const { hotelId, roomNumber, guestName, serviceType, details } = requestData;
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is not configured on Render.');
  }

  const hotel = store.getHotelById(hotelId);
  if (!hotel) {
    throw new Error(`Hotel ID '${hotelId}' not found in configuration.`);
  }

  // Determine targeted Telegram group ID based on request category
  let targetChatId = hotel.frontOfficeChatId;
  const type = (serviceType || '').toLowerCase();

  if (type.includes('housekeeping') || type.includes('towel') || type.includes('clean')) {
    targetChatId = hotel.housekeepingChatId || targetChatId;
  } else if (type.includes('kitchen') || type.includes('food') || type.includes('menu') || type.includes('dining')) {
    targetChatId = hotel.kitchenChatId || targetChatId;
  }

  if (!targetChatId) {
    throw new Error('Target Chat ID is missing for this department.');
  }

  const message = `🔔 *New Guest Request*\n\n` +
    `🏨 *Hotel:* ${hotel.hotelName || hotelId}\n` +
    `🚪 *Room Number:* ${roomNumber || 'N/A'}\n` +
    `👤 *Guest Name:* ${guestName || 'Valued Guest'}\n` +
    `📌 *Service:* ${serviceType}\n` +
    `📝 *Details:* ${details || 'No additional details'}`;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: targetChatId,
      text: message,
      parse_mode: 'Markdown'
    })
  });

  const resData = await response.json();

  if (!response.ok || !resData.ok) {
    throw new Error(resData.description || 'Telegram API failed to deliver message.');
  }

  return { success: true };
}

module.exports = { sendAlert };
