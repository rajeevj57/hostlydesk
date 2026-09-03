const store = require('./store');

async function sendTelegramNotification(requestData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN is missing in environment variables.');
    return { success: false, error: 'Missing bot token' };
  }

  // Retrieve hotel details from storage
  const hotels = store.getHotels();
  const hotelId = (requestData.hotelId || '').toLowerCase();
  const hotel = hotels[hotelId];

  if (!hotel) {
    console.error(`Hotel not registered for ID: ${hotelId}`);
    return { success: false, error: 'Hotel not registered' };
  }

  const category = requestData.requestType || requestData.category || '';
  let targetChatId;

  // Department Routing Logic
  if (category.includes('Housekeeping') || category.includes('Amenities')) {
    targetChatId = hotel.housekeepingChatId;
  } else if (category.includes('Kitchen') || category.includes('Food') || category.includes('Dining')) {
    targetChatId = hotel.kitchenChatId;
  } else {
    targetChatId = hotel.frontOfficeChatId;
  }

  // Fallback to Front Office if specific department ID is missing
  if (!targetChatId) {
    targetChatId = hotel.frontOfficeChatId;
  }

  if (!targetChatId) {
    console.error(`No Chat ID configured for hotel: ${hotelId}`);
    return { success: false, error: 'No Telegram Chat ID found' };
  }

  const message = `🔔 *New Guest Request*\n\n` +
                  `🏨 *Property:* ${hotel.hotelName}\n` +
                  `🚪 *Room/Table:* ${requestData.roomNumber || requestData.room || 'N/A'}\n` +
                  `👤 *Guest:* ${requestData.guestName || requestData.name || 'N/A'}\n` +
                  `📌 *Category:* ${category}\n` +
                  `📝 *Details:* ${requestData.details || 'None'}`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    const result = await response.json();
    
    if (!result.ok) {
      console.error('Telegram API Error:', result);
      return { success: false, error: result.description };
    }

    return { success: true };
  } catch (err) {
    console.error('Error sending Telegram message:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendTelegramNotification
};
