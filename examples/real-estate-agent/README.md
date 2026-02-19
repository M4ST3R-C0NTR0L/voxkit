# Real Estate Voice Agent

A production-ready voice agent for real estate companies built with VoxKit.

## Features

- 🏡 **Lead qualification** — asks about budget, location, timeline
- 📋 **Lead capture** — extracts name, email, phone automatically
- 🔔 **Slack notifications** — pings your team on every new lead
- 🔗 **CRM webhook** — POSTs leads to your CRM
- 📝 **Transcript logging** — saves every conversation to disk
- 📊 **Session metrics** — tracks turns, tokens, conversion rate

## Setup

```bash
npm install
cp .env.example .env
# Fill in your API keys
npm run dev
```

## Environment Variables

```
OPENAI_API_KEY=sk-...
PORT=3000

# Optional integrations
CRM_WEBHOOK_URL=https://your-crm.com/webhook/leads
CRM_WEBHOOK_SECRET=your-webhook-secret
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

## Architecture

```
Caller (WebSocket) → VoxAgent → OpenAI Realtime API
                         ↓
                   LeadExtractor → CRM Webhook
                         ↓
                   SlackNotifier → #leads channel
                         ↓
                   TranscriptLogger → ./transcripts.jsonl
```
