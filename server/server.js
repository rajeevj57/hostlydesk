// HANDLE GUEST SERVICE REQUESTS WITH DYNAMIC DEPARTMENT ROUTING
app.post('/api/requests', (req, res) => {
  const { hotelId, room, items, department } = req.body;

  if (!hotelId || !hotels[hotelId]) {
    return res.status(400).json({ success: false, message: 'Invalid hotel configuration.' });
  }

  const hotel = hotels[hotelId];
  const itemsList = Array.isArray(items) ? items.join(', ') : items;

  // DYNAMIC CHAT ID ROUTING
  let targetChatId = hotel.frontOfficeChatId; // Default fallback

  if (department === 'housekeeping' && hotel.housekeepingChatId) {
    targetChatId = hotel.housekeepingChatId;
  } else if (department === 'kitchen' && hotel.kitchenChatId) {
    targetChatId = hotel.kitchenChatId;
  } else if (department === 'frontoffice' && hotel.frontOfficeChatId) {
    targetChatId = hotel.frontOfficeChatId;
  }

  const messageText = `🛎️ *New ${department ? department.toUpperCase() : 'GUEST'} Request*\n\n🏨 *Hotel:* ${hotel.hotelName}\n🚪 *Room:* ${room || 'Unassigned'}\n📋 *Items:* ${itemsList}`;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (botToken && targetChatId) {
    const postData = JSON.stringify({
      chat_id: targetChatId,
      text: messageText,
      parse_mode: 'Markdown'
    });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const telegramReq = https.request(options, (telegramRes) => {
      telegramRes.on('data', () => {});
    });

    telegramReq.on('error', (e) => {
      console.error('Telegram dispatch error:', e);
    });

    telegramReq.write(postData);
    telegramReq.end();
  }

  res.json({ success: true, message: 'Request received!' });
});
