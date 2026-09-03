async function sendTelegramNotification(hotelProperty, requestData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const category = requestData.category; // e.g., "Front Desk", "Housekeeping", "Kitchen"

  let targetChatId;

  // Smart Routing Logic based on Guest Request Type
  if (category.includes("Housekeeping") || category.includes("Amenities")) {
    targetChatId = hotelProperty.housekeepingChatId;
  } else if (category.includes("Kitchen") || category.includes("Food") || category.includes("Dining")) {
    targetChatId = hotelProperty.kitchenChatId;
  } else {
    // Default to Front Office for checkouts, general queries, and desk requests
    targetChatId = hotelProperty.frontOfficeChatId;
  }

  if (!targetChatId) {
    console.error(`No Chat ID configured for category: ${category}`);
    return;
  }

  const message = `🔔 *New Guest Request*\n\n` +
                  `🏨 *Property:* ${hotelProperty.hotelName}\n` +
                  `🚪 *Room:* ${requestData.roomNumber}\n` +
                  `👤 *Guest:* ${requestData.guestName}\n` +
                  `📌 *Category:* ${requestData.category}\n` +
                  `📝 *Details:* ${requestData.details}`;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: targetChatId,
      text: message,
      parse_mode: 'Markdown'
    })
  });
}
