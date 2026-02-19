# Customer Support Voice Agent

An AI-powered tier-1 support agent built with VoxKit. Handles common issues, creates tickets, and escalates when needed.

## Features

- 🎧 **AI support specialist** — handles login, billing, and technical questions
- 🎫 **Auto ticket creation** — every call creates a support ticket
- 📝 **Call recording** — logs full transcripts for QA and compliance
- 📊 **Support metrics** — tracks resolution rate, call duration, turns per call
- 🔗 **Ticketing webhook** — integrates with Zendesk, Linear, Jira, etc.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Environment Variables

```
OPENAI_API_KEY=sk-...
PORT=3001

# Optional
TICKET_WEBHOOK_URL=https://your-ticketing.com/webhook
TICKET_WEBHOOK_SECRET=...
METRICS_URL=https://your-metrics.com/endpoint
```

## Call Flow

```
Caller → Greet → Identify Issue → Troubleshoot → Resolve / Create Ticket → Goodbye
                                                        ↓
                                              Webhook → Zendesk / Jira
                                                        ↓
                                              Email confirmation to customer
```
