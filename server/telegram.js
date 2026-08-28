// Staff alerts via Telegram Bot API.
// Why Telegram for the MVP: bot creation is free and instant (just message
// @BotFather), unlike WhatsApp Business API which needs Meta business
// verification. Swap in a WhatsApp adapter later without touching the rest
// of the app — every caller just calls notifyDepartment().

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

// One Telegram chat ID per department. Each department (housekeeping,
// kitchen, front office) should have its own Telegram group; add the bot to
// each group and put the group's chat ID here via env vars.
const DEPARTMENT_CHATS = {
  housekeeping: process.env.CHAT_HOUSEKEEPING || '',
  kitchen: process.env.CHAT_KITCHEN || '',
  front_office: process.env.CHAT_FRONT_OFFICE || '',
};

async function sendTelegramMessage(chatId, text) {
  if (!BOT_TOKEN || !chatId) {
    console.log('[telegram:stub] (set TELEGRAM_BOT_TOKEN + chat IDs to send for real)');
    console.log('  ->', text.replace(/\n/g, ' | '));
    return { ok: true, stub: true };
  }
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  return res.json();
}

async function notifyDepartment(department, text) {
  const chatId = DEPARTMENT_CHATS[department] || DEPARTMENT_CHATS.front_office;
  return sendTelegramMessage(chatId, text);
}

module.exports = { sendTelegramMessage, notifyDepartment, DEPARTMENT_CHATS };
