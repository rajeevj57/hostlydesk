# HostlyDesk — Prototype v0.1

A working prototype of the three core pieces of the HostlyDesk workflow:

1. **Guest QR menu** (`public/menu.html`) — visual, tap-to-request menu + info hub + local guide
2. **Pre-check-in form** (`public/precheckin.html`) — collects guest details before arrival
3. **Staff routing backend** (`server/`) — stores requests and routes each one to the right department via Telegram

No paid services, no database server, and no npm install required to run it. Everything is plain Node.js with JSON files as storage — good enough for a pilot at one property, easy to swap for a real database later.

## Run it

```
node server/server.js
```

Then open:
- Guest menu: `http://localhost:3000/menu.html?room=DEMO101`
- Pre-check-in: `http://localhost:3000/precheckin.html`

Without Telegram configured, requests still get saved — the server just logs what *would* have been sent, so you can test the full flow immediately.

## Connect Telegram (staff alerts)

1. In Telegram, message **@BotFather** → `/newbot` → follow the prompts → copy the bot token.
2. Create one Telegram group per department (Housekeeping, Kitchen, Front Office), add your new bot to each group.
3. Get each group's chat ID (easiest way: add **@RawDataBot** to the group briefly, it posts the chat ID).
4. Set environment variables before starting the server:

```
export TELEGRAM_BOT_TOKEN=123456:ABC-your-token
export CHAT_HOUSEKEEPING=-100xxxxxxxxxx
export CHAT_KITCHEN=-100xxxxxxxxxx
export CHAT_FRONT_OFFICE=-100xxxxxxxxxx
node server/server.js
```

Now guest requests post directly into the right department's Telegram group — no dashboard, no app, no login for staff.

## How a room gets its QR code

Each room's QR code just encodes a URL like `https://yourhotel.com/menu.html?room=DEMO101`. The `room` token maps to guest/room context in `data/rooms.json`. Right now there's one demo room; in production your check-in system (or a small admin script) would create one row in `rooms.json` per active stay and print/regenerate the QR when a new guest checks in.

## What's stubbed vs. real

| Piece | Status |
|---|---|
| Visual menu, quantity picker, request submission | Fully working |
| Pre-check-in form + validation | Fully working |
| Request routing by department | Fully working (JSON storage) |
| Telegram delivery | Fully working once bot token + chat IDs are set |
| ID photo upload | Form captures the file name only — wiring actual file storage (S3/local disk) is the next step |
| Room QR → room mapping | One demo room; needs an admin/back-office flow to create rooms per stay |
| AI/RAG for free-text questions | Phase 2, not started — Phase 1 (this) is intentionally rules-based |

## Project layout

```
hostlydesk/
  server/
    server.js      — HTTP server + all API routes
    store.js        — JSON file storage + seed menu/info/guide data
    telegram.js      — department routing to Telegram
  public/
    menu.html/js      — guest QR page
    precheckin.html/js — pre-check-in form
    style.css          — shared "digital keycard" design system
  data/               — JSON storage (auto-created)
```

## Suggested next step

Wire the ID upload to actual file storage, then build the admin script that creates a `rooms.json` entry (and QR code) per new check-in — that closes the loop from Sarah's booking to her scanning the code in her room.
