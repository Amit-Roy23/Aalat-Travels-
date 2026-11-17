# Aalat Travels — Travel CRM & AI WhatsApp Automation

A complete, cloud-hosted business management web app for **Aalat Travels**: lead management, customers, follow-ups, invoicing, reports, and an **AI-powered WhatsApp assistant** that replies in the customer's own language, captures trip details, updates lead status, and schedules follow-ups automatically.

Built with **Next.js 15 (App Router) · TypeScript · MongoDB (Mongoose) · Tailwind CSS · Claude AI · WhatsApp Cloud API**. It's fully responsive (phone, tablet, desktop) and has light & dark themes.

---

## Features

| Module | What it does |
|---|---|
| **Dashboard** | KPIs (leads, interested, converted, pending follow-ups), 30-day lead trend, pipeline, upcoming follow-ups, latest leads, AI WhatsApp stats, billing summary, team activity |
| **Leads** | List and Kanban board (drag-and-drop), search & filters, bulk status/assign/delete, duplicate-phone detection, statuses *New → Interested / Follow-up Required / Not Interested → Converted*, round-robin auto-assignment, full activity timeline, notes / call logs, one-click convert to customer |
| **Automatic lead capture** | WhatsApp (incl. Click-to-WhatsApp ads), Facebook/Instagram Lead Ads, Google Ads lead forms, website forms / Zapier through one API-key-protected webhook. Repeat enquiries update the existing lead instead of creating duplicates |
| **Customers** | Central database with contact details, travel preferences (destinations, style, hotel, meals, budget), birthdays and anniversaries, all trips/enquiries, invoices, follow-ups and history |
| **Follow-ups** | Overdue / Today / Upcoming / Done, call/WhatsApp/email/meeting types, snooze, complete with an outcome (and update the lead status in the same step), reminders in the notification bell |
| **WhatsApp Inbox** | Shared inbox with AI on/off per chat, human hand-over alerts, agent replies (AI pauses automatically), the 24-hour-window warning, and lead details beside the chat |
| **AI Chat Demos** | 7 animated showcase conversations (Hindi, English, Hinglish, Bengali, Arabic, Spanish, opt-out) with a live CRM panel, and a **live sandbox** where you chat as a customer through the real automation pipeline |
| **Invoices** | Auto-numbered GST invoices (`AAL-2026-0001`), line items, discount, tax, drafts, partial payments, balance & overdue tracking, PDF download, public share link and WhatsApp share |
| **Reports** | Conversion funnel, source performance, team performance, revenue billed vs collected, top destinations, customer languages, AI automation stats |
| **Team & roles** | Admins see everything; sales agents see only the leads & follow-ups assigned to them |
| **Settings** | Company profile, invoice defaults (prefix, GST, bank/UPI), AI knowledge base (packages, FAQs, policies, tone), automation toggles, webhook URLs, API key, demo data |

### How the AI WhatsApp automation works
1. A customer messages your WhatsApp Business number (or clicks a Click-to-WhatsApp ad).
2. The conversation is saved and a **lead is created** (source = WhatsApp or Meta Ads) and auto-assigned.
3. The AI replies in the customer's language using **your knowledge base** (packages, prices, FAQs, policies).
4. It extracts **destination, travel date, travellers, budget, name, email** into the lead.
5. It classifies interest → lead status **Interested / Follow-up Required / Not Interested**.
6. It **schedules follow-ups** (e.g. "next week", or a call when the customer wants to book) and notifies the assigned agent.
7. If the customer asks for a human, the chat is **handed over** and AI pauses.

With `ANTHROPIC_API_KEY` set, replies come from **Claude** (90+ languages). Without it, a built-in multilingual demo engine (English, Hindi, Hinglish, Bengali, Arabic, Spanish, French) runs instead, so the whole flow can be demonstrated without any API keys.

---

## Deploy on Vercel

1. **MongoDB Atlas** — create a cluster and a database user. In *Network Access* allow `0.0.0.0/0` (Vercel uses dynamic IPs). Copy the connection string and **include a database name**, e.g. `.../aalat_travels?retryWrites=true&w=majority`.
2. **Import the repo in Vercel** (framework: Next.js; no build settings to change).
3. **Environment variables** (Project → Settings → Environment Variables):

| Variable | Required | Notes |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB Atlas connection string |
| `JWT_SECRET` | ✅ | Long random string, e.g. output of `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | optional | Enables Claude AI replies (otherwise the built-in demo engine is used) |
| `WHATSAPP_TOKEN` | optional | WhatsApp Cloud API permanent access token |
| `WHATSAPP_PHONE_NUMBER_ID` | optional | From Meta → WhatsApp → API Setup |
| `WHATSAPP_VERIFY_TOKEN` | optional | Any string; enter the same value in the Meta webhook settings |
| `WHATSAPP_APP_SECRET` | recommended | Meta App secret, used to verify webhook signatures |
| `META_PAGE_ACCESS_TOKEN` | optional | For Facebook/Instagram Lead Ads capture |
| `META_VERIFY_TOKEN` | optional | Verify token for the Lead Ads webhook |

4. **Deploy**, open the site, and complete the **first-time setup** (company name + admin account). Tick *Load demo data* to explore with sample data; you can remove it later from **Settings → Demo data**.

### Connect WhatsApp (Meta Cloud API)
1. In [Meta for Developers](https://developers.facebook.com/) create an app → add **WhatsApp** → add your business phone number.
2. **Configuration → Webhook**: Callback URL `https://YOUR-DOMAIN/api/webhooks/whatsapp`, Verify token = `WHATSAPP_VERIFY_TOKEN`. Subscribe to the **messages** field.
3. Add `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` in Vercel and redeploy. The sidebar shows *WhatsApp API: Connected*.

### Capture leads from ads & website
- **Facebook / Instagram Lead Ads** — subscribe your Page to the `leadgen` webhook with URL `https://YOUR-DOMAIN/api/webhooks/meta-leads` and set `META_PAGE_ACCESS_TOKEN`.
- **Click-to-WhatsApp ads** — captured automatically via the WhatsApp webhook (source = Meta Ads, with the ad headline as the campaign).
- **Google Ads lead forms** — webhook URL `https://YOUR-DOMAIN/api/webhooks/leads`, key = the API key from **Settings → Lead capture & WhatsApp**.
- **Website forms / Zapier / Make** — `POST` JSON or form data to `/api/webhooks/leads` with header `X-API-Key`:

```bash
curl -X POST https://YOUR-DOMAIN/api/webhooks/leads \
  -H "Content-Type: application/json" -H "X-API-Key: alk_..." \
  -d '{"name":"Rohan Gupta","phone":"9876543210","source":"facebook","destination":"Goa","travel_date":"20 Dec","adults":2,"message":"4N/5D package"}'
```

---

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in MONGODB_URI and JWT_SECRET
npm run dev                  # http://localhost:3000
```

Other scripts:

```bash
npm run build && npm start         # production build
npm run typecheck                  # TypeScript checks
npx tsx scripts/test-engine.ts     # multilingual demo-AI conversation tests
scripts/e2e-api.sh http://localhost:3000 admin@email password   # 47 business-logic API checks (needs demo data)
```

## Project structure

```
src/
  app/
    (app)/            authenticated pages: dashboard, leads, customers, follow-ups, inbox, ai-demo, invoices, reports, team, settings
    api/              REST route handlers (+ webhooks/ for WhatsApp, Meta Lead Ads, universal lead capture)
    login, setup      authentication & first-run setup
    i/[token]         public, shareable invoice page
  components/         UI kit, app shell, forms, charts, WhatsApp chat components, invoice document
  lib/
    models/           Mongoose schemas
    services/         leads, invoices, notifications, WhatsApp, settings
    ai/               Claude integration, built-in multilingual engine, conversation orchestrator
    seed.ts           demo data
    demo-scenarios.ts scripted showcase conversations
```

## Notes
- WhatsApp Business API message charges, AI usage charges and hosting are billed by the respective providers (see the project quotation).
- Free-form WhatsApp replies are only allowed within 24 hours of the customer's last message; the inbox warns you when the window has closed.
- All times are in India Standard Time (IST).
