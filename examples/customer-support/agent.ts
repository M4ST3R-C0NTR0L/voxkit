/**
 * Customer Support Voice Agent Example
 *
 * A voice agent that handles tier-1 support calls:
 * troubleshooting, FAQ answers, ticket creation, and escalation.
 */

import { VoxAgent, OpenAIProvider } from 'voxkit'
import {
  TranscriptLoggerPlugin,
  LeadWebhookPlugin,
  MetricsPlugin
} from 'voxkit'
import type { LeadInfo, ConversationState } from 'voxkit'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupportTicket {
  id: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  issue: string
  conversationId: string
  createdAt: string
  status: 'open' | 'escalated' | 'resolved'
}

// ─── In-memory ticket store (replace with your real DB) ──────────────────────

const tickets: SupportTicket[] = []
let ticketCounter = 1000

function createTicket(lead: LeadInfo, conversation: ConversationState): SupportTicket {
  const ticket: SupportTicket = {
    id: `TKT-${++ticketCounter}`,
    customerName: lead.name,
    customerEmail: lead.email,
    customerPhone: lead.phone,
    issue: 'Reported via voice support call',
    conversationId: conversation.id,
    createdAt: new Date().toISOString(),
    status: 'open'
  }
  tickets.push(ticket)
  return ticket
}

// ─── System prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
You are Jordan, a helpful customer support specialist for Acme Software.

Your responsibilities:
1. Greet the customer warmly and get their name
2. Understand their issue clearly — ask clarifying questions if needed
3. Attempt to resolve common issues:
   - Login problems: guide through password reset
   - Billing questions: explain charges, offer to escalate billing disputes
   - Technical issues: basic troubleshooting steps
4. If you cannot resolve the issue, let the customer know you'll create a support ticket
   and a human specialist will follow up within 24 hours
5. Always collect: name, email address, and a callback number
6. End every call by confirming the ticket number and expected response time

Tone: Empathetic, patient, professional. Never sound scripted.
If a customer is frustrated, acknowledge their frustration first before helping.
`.trim()

// ─── Build the Agent ──────────────────────────────────────────────────────────

const agent = new VoxAgent({
  provider: new OpenAIProvider({
    model: 'gpt-4o-realtime-preview-2024-12-17',
    temperature: 0.6     // Slightly lower for more consistent support answers
  }),
  voice: 'echo',         // Clear, professional voice
  systemPrompt: SYSTEM_PROMPT,
  enableLeadExtraction: true,
  silenceTimeoutMs: 60_000,  // Support calls can have longer pauses

  onTranscript: (text) => {
    console.log(`\n  👤 Customer: ${text}`)
  },

  onResponse: (text) => {
    console.log(`  🎧 Jordan:   ${text}`)
  },

  onLead: (lead: LeadInfo, conversation: ConversationState) => {
    const ticket = createTicket(lead, conversation)

    console.log('\n┌─────────────────────────────────────')
    console.log('│ 🎫 SUPPORT TICKET CREATED')
    console.log('│─────────────────────────────────────')
    console.log(`│ Ticket:  ${ticket.id}`)
    if (ticket.customerName)  console.log(`│ Name:    ${ticket.customerName}`)
    if (ticket.customerEmail) console.log(`│ Email:   ${ticket.customerEmail}`)
    if (ticket.customerPhone) console.log(`│ Phone:   ${ticket.customerPhone}`)
    console.log(`│ Status:  ${ticket.status}`)
    console.log('└─────────────────────────────────────\n')

    // TODO: Replace with your ticketing system:
    // await zendesk.createTicket(ticket)
    // await sendConfirmationEmail(ticket)
  },

  onError: (error, context) => {
    console.error(`\n⚠️  [${context}] ${error.message}`)
  },

  onConnect: (connected) => {
    if (connected) {
      console.log('✅ Customer Support Agent online\n')
    }
  }
})

// ─── Plugins ─────────────────────────────────────────────────────────────────

// Full call transcripts for QA and compliance
agent.use(new TranscriptLoggerPlugin({
  filePath: './call-logs.jsonl',
  timestamps: true,
  tag: '[support-call]'
}))

// Send tickets to your ticketing system webhook
if (process.env.TICKET_WEBHOOK_URL) {
  agent.use(new LeadWebhookPlugin({
    url: process.env.TICKET_WEBHOOK_URL,
    secret: process.env.TICKET_WEBHOOK_SECRET,
    retries: 5
  }))
}

// Track support metrics
const metrics = new MetricsPlugin({
  printSummary: true,
  reportUrl: process.env.METRICS_URL
})
agent.use(metrics)

// ─── Start ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001

console.log('\n🎧 Acme Software — Customer Support Voice Agent')
console.log('═══════════════════════════════════════════════')

agent.listen(PORT)
  .then(() => {
    console.log(`🔗 WebSocket: ws://localhost:${PORT}`)
    console.log(`📋 Open tickets: ${tickets.length}\n`)
  })
  .catch((err) => {
    console.error('Failed to start agent:', err)
    process.exit(1)
  })

// ─── Admin endpoint summary ───────────────────────────────────────────────────

function printStats(): void {
  const m = metrics.getMetrics()
  console.log('\n📊 Support Stats:')
  console.log(`  Active tickets:  ${tickets.filter(t => t.status === 'open').length}`)
  console.log(`  Total sessions:  1`)
  console.log(`  Total turns:     ${m.turnCount}`)
}

process.on('SIGINT', async () => {
  printStats()
  await agent.stop()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await agent.stop()
  process.exit(0)
})
