const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// In-memory hotel configuration store
const hotelConfigs = {};

// POST Endpoint: Save Configuration & Upload PDFs with Inline Disposition
app.post('/api/admin/config', upload.any(), async (req, res) => {
  try {
    const { hotelId, hotelName, frontDeskChatId, housekeepingChatId, kitchenChatId, maintenanceChatId } = req.body;

    if (!hotelId) {
      return res.status(400).json({ error: 'Hotel ID is required.' });
    }

    if (!hotelConfigs[hotelId]) {
      hotelConfigs[hotelId] = { documents: [] };
    }

    const existingDocs = req.body.existingDocs ? JSON.parse(req.body.existingDocs) : (hotelConfigs[hotelId].documents || []);
    let updatedDocs = [...existingDocs];

    // Process uploaded PDF files with inline content disposition
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const docTitle = req.body[`title_${file.fieldname}`] || file.originalname.replace(/\.[^/.]+$/, "");
        const sanitizeFileName = `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
        const filePath = `documents/${hotelId}/${sanitizeFileName}`;

        // Force inline header to prevent forced browser downloads
        const { data, error } = await supabase.storage
          .from('hostlydesk-files')
          .upload(filePath, file.buffer, {
            contentType: 'application/pdf',
            contentDisposition: 'inline',
            upsert: true
          });

        if (error) throw error;

        const { data: publicUrlData } = supabase.storage
          .from('hostlydesk-files')
          .getPublicUrl(filePath);

        updatedDocs.push({
          title: docTitle,
          url: publicUrlData.publicUrl
        });
      }
    }

    hotelConfigs[hotelId] = {
      hotelId,
      hotelName: hotelName || 'Hotel Concierge',
      chatIds: {
        FrontDesk: frontDeskChatId || '',
        Housekeeping: housekeepingChatId || '',
        Kitchen: kitchenChatId || '',
        Maintenance: maintenanceChatId || ''
      },
      documents: updatedDocs
    };

    res.json({
      success: true,
      message: 'Hotel configuration updated successfully!',
      config: hotelConfigs[hotelId]
    });

  } catch (err) {
    console.error('Server Configuration Error:', err);
    res.status(500).json({ error: 'Server error processing upload or saving config.' });
  }
});

// GET Endpoint: Fetch Hotel Config for Guests
app.get('/api/hotel-config/:hotelId', (req, res) => {
  const { hotelId } = req.params;
  const config = hotelConfigs[hotelId] || {
    hotelId,
    hotelName: 'Hotel Concierge',
    chatIds: {},
    documents: []
  };
  res.json(config);
});

// POST Endpoint: Dispatch Guest Request to Telegram
app.post('/api/guest-request', async (req, res) => {
  try {
    const { hotelId, room, department, requestText } = req.body;
    const config = hotelConfigs[hotelId];
    const chatId = config && config.chatIds ? config.chatIds[department] : null;

    const message = `🔔 *New Guest Request*\n\n🏨 *Hotel:* ${config ? config.hotelName : hotelId}\n🚪 *Room Number:* ${room}\n📋 *Department:* ${department}\n\n📝 *Request Details:*\n${requestText}`;

    if (TELEGRAM_BOT_TOKEN && chatId) {
      const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown'
        })
      });
    }

    res.json({ success: true, message: 'Request sent to staff!' });
  } catch (err) {
    console.error('Guest Request Dispatch Error:', err);
    res.status(500).json({ error: 'Failed to dispatch request to Telegram.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`HostlyDesk running on port ${PORT}`));
