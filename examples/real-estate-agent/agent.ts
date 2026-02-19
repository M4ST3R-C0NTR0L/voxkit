/**
 * Real Estate Voice Agent Example
 *
 * A production-ready voice agent for real estate companies.
 * Qualifies leads, answers property questions, and captures
 * contact details — automatically.
 */

import { VoxAgent, OpenAIProvider } from 'voxkit'
import {
  TranscriptLoggerPlugin,
  LeadWebhookPlugin,
  SlackNotifierPlugin,
  MetricsPlugin,
  type SessionMetrics
} from 'voxkit'
import type { LeadInfo, ConversationState } from 'voxkit'

// ─── Configuration ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
You are Alex, a friendly and knowledgeable real estate assistant for Prestige Realty.

Your goals:
1. Warmly greet callers and understand what they're looking for (buying, selling, or renting)
2. Ask about their budget, preferred location, and timeline
3. Collect their name, email, and phone number naturally during the conversation
4. Answer common real estate questions (market conditions, process, financing basics)
5. Schedule callbacks with our human agents for serious buyers/sellers

Personality: Professional, warm, concise. Never pushy.
Always end by confirming contact details and next steps.
`.trim()

// ─── Lead Storage (replace with your CRM/database) ────────────────────────

interface StoredLead extends LeadInfo {
  conversationId: string
  capturedAt: string
  source: string
}

const leads: StoredLead[] = []

async function saveLead(lead: LeadInfo, conversation: ConversationState): Promise<void> {
  const stored: StoredLead = {
    ...lead,
    conversationId: conversation.id,
    capturedAt: new Date().toISOString(),
    source: 'voice-agent'
  }
  leads.push(stored)

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 NEW LEAD CAPTURED')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  if (lead.name)    console.log(`  Name:    ${lead.name}`)
  if (lead.email)   console.log(`  Email:   ${lead.email}`)
  if (lead.phone)   console.log(`  Phone:   ${lead.phone}`)
  if (lead.company) console.log(`  Company: ${lead.company}`)
  console.log(`  Conv ID: ${conversation.id}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // TODO: Replace with your CRM integration:
  // await crmClient.createContact(stored)
  // await sendConfirmationEmail(stored)
}

// ─── Build the Agent ──────────────────────────────────────────────────────────

const agent = new VoxAgent({
  provider: new OpenAIProvider({
    model: 'gpt-4o-realtime-preview-2024-12-17',
    temperature: 0.7
  }),
  voice: 'nova',             // Warm, professional voice
  systemPrompt: SYSTEM_PROMPT,
  enableLeadExtraction: true,
  silenceTimeoutMs: 45_000,  // 45s — callers sometimes pause to think

  onTranscript: (text) => {
    process.stdout.write(`\r  🎤  ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`)
  },

  onResponse: (text) => {
    console.log(`\n  🏠  ${text}`)
  },

  onLead: saveLead,

  onConnect: (connected) => {
    if (connected) {
      console.log('\n✅ Real Estate Agent online — ready for calls\n')
    }
  },

  onError: (error, context) => {
    console.error(`\n❌ [${context}] ${error.message}`)
  }
})

// ─── Plugins ─────────────────────────────────────────────────────────────────

// Log full transcripts to file for compliance/review
agent.use(new TranscriptLoggerPlugin({
  filePath: './transcripts.jsonl',
  timestamps: true
}))

// Push leads to your CRM webhook
if (process.env.CRM_WEBHOOK_URL) {
  agent.use(new LeadWebhookPlugin({
    url: process.env.CRM_WEBHOOK_URL,
    secret: process.env.CRM_WEBHOOK_SECRET,
    retries: 3
  }))
}

// Ping Slack on every new lead
if (process.env.SLACK_WEBHOOK_URL) {
  agent.use(new SlackNotifierPlugin({
    webhookUrl: process.env.SLACK_WEBHOOK_URL,
    emoji: ':house:'
  }))
}

// Session metrics
const metrics = new MetricsPlugin({ printSummary: true })
agent.use(metrics)

// ─── Start ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000

console.log('\n🏡 Prestige Realty — Voice Agent')
console.log('═══════════════════════════════════')

agent.listen(PORT)
  .then(() => {
    console.log(`🔗 WebSocket: ws://localhost:${PORT}`)
    console.log('\nInstructions:')
    console.log('  • Connect a WebRTC/WebSocket client for live calls')
    console.log('  • Or use the test script: npm run test:call\n')
  })
  .catch((err) => {
    console.error('Failed to start agent:', err)
    process.exit(1)
  })

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

const shutdown = async (signal: string) => {
  console.log(`\n[${signal}] Shutting down gracefully...`)
  await agent.stop()

  const m: SessionMetrics = metrics.getMetrics() as SessionMetrics
  console.log(`\n📊 Final stats: ${leads.length} leads captured across ${m.turnCount} turns`)
  process.exit(0)
}

process.on('SIGINT',  () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
