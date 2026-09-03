const https = require('https');
const store = require('./store');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function notifyDepartment(requestData) {
  if (!BOT_TOKEN) {
    console.log('Telegram Bot Token not configured. Skipping notification.');
    return;
  }

  // Fetch hotel list to check for custom Telegram Chat IDs
  const hotels = store.getHotels();
  const hotelInfo = hotels[requestData.hotelId];

  // Use property-specific chat ID if available, otherwise fall back to global environment variable
  const chatId = (hotelInfo && hotelInfo.telegramChatId) 
    ? hotelInfo.telegramChatId 
    : process.env.TELEGRAM_CHAT_ID;

  if (!chatId) {
    console.log(`No Telegram Chat ID found for hotel: ${requestData.hotelId}`);
    return;
  }

  const message = `🔔 *NEW SERVICE REQUEST* 🔔\n\n` +
    `🏨 *Hotel ID:* ${requestData.hotelId}\n` +
    `🚪 *Room:* ${requestData.roomNumber}\n` +
    `👤 *Guest:* ${requestData.guestName}\n` +
    `📋 *Category:* ${requestData.category}\n` +
    `💬 *Details:* ${requestData.details || 'None'}\n\n` +
    `⏰ *Time:* ${new Date(requestData.createdAt).toLocaleTimeString()}`;

  const payload = JSON.stringify({
    chat_id: chatId,
    text: message,
    parse_mode: 'Markdown'
  });

  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = https.request(options, (res) => {
    res.on('data', () => {});
  });

  req.on('error', (e) => {
    console.error(`Telegram notification error: ${e.message}`);
  });

  req.write(payload);
  req.end();
}

module.exports = { notifyDepartment };
