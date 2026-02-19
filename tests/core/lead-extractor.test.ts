import { describe, it, expect, beforeEach } from 'vitest'
import { LeadExtractor } from '../../src/core/lead-extractor.js'
import type { ConversationMessage } from '../../src/types.js'

const msg = (content: string): ConversationMessage => ({
  role: 'user',
  content,
  timestamp: Date.now()
})

describe('LeadExtractor', () => {
  let extractor: LeadExtractor

  beforeEach(() => {
    extractor = new LeadExtractor()
  })

  // ── Email extraction ──────────────────────────────────────────────────────

  it('extracts a plain email address', () => {
    extractor.processMessage(msg('My email is john.doe@example.com'))
    expect(extractor.getCurrentLead()?.email).toBe('john.doe@example.com')
  })

  it('extracts email with subdomains', () => {
    extractor.processMessage(msg('contact me at alex@mail.company.io'))
    expect(extractor.getCurrentLead()?.email).toBe('alex@mail.company.io')
  })

  it('ignores assistant messages', () => {
    extractor.processMessage({ role: 'assistant', content: 'Your email is test@test.com?' })
    expect(extractor.getCurrentLead()?.email).toBeUndefined()
  })

  // ── Phone extraction ──────────────────────────────────────────────────────

  it('extracts a US phone number (dashes)', () => {
    extractor.processMessage(msg('Call me at 555-867-5309'))
    expect(extractor.getCurrentLead()?.phone).toBeTruthy()
  })

  it('extracts a US phone with country code', () => {
    extractor.processMessage(msg('Reach me at +1 (415) 555-1234'))
    const phone = extractor.getCurrentLead()?.phone
    expect(phone).toBeTruthy()
    expect(phone?.replace(/\D/g, '')).toMatch(/1?4155551234/)
  })

  it('extracts a 10-digit compact phone', () => {
    extractor.processMessage(msg('My number is 4155551234'))
    const lead = extractor.getCurrentLead()
    expect(lead?.phone).toBeTruthy()
  })

  // ── Name extraction ───────────────────────────────────────────────────────

  it('extracts name from "My name is ..."', () => {
    extractor.processMessage(msg('Hi, my name is Sarah Johnson'))
    expect(extractor.getCurrentLead()?.name).toBe('Sarah Johnson')
  })

  it('extracts name from "I am ..."', () => {
    extractor.processMessage(msg('I am Robert Chen'))
    expect(extractor.getCurrentLead()?.name).toBe('Robert Chen')
  })

  it('extracts name from "This is ..."', () => {
    extractor.processMessage(msg('This is Maria Lopez calling'))
    expect(extractor.getCurrentLead()?.name).toBe('Maria Lopez')
  })

  it('extracts name from "Call me ..."', () => {
    extractor.processMessage(msg('Call me Mike'))
    expect(extractor.getCurrentLead()?.name).toBe('Mike')
  })

  // ── Company extraction ────────────────────────────────────────────────────

  it('extracts company from "work at ..."', () => {
    extractor.processMessage(msg('I work at Acme Corp'))
    expect(extractor.getCurrentLead()?.company).toBeTruthy()
  })

  // ── Multi-field in one message ────────────────────────────────────────────

  it('extracts multiple fields from one message', () => {
    extractor.processMessage(
      msg('Hi, my name is Jane Smith. You can email me at jane@company.com or call 415-555-9876')
    )
    const lead = extractor.getCurrentLead()
    expect(lead?.name).toBe('Jane Smith')
    expect(lead?.email).toBe('jane@company.com')
    expect(lead?.phone).toBeTruthy()
  })

  // ── Accumulation across messages ──────────────────────────────────────────

  it('accumulates info across multiple messages', () => {
    extractor.processMessage(msg('My name is Carlos Ruiz'))
    extractor.processMessage(msg('My email is carlos@startup.io'))
    extractor.processMessage(msg('Phone is 650-555-0001'))
    const lead = extractor.getCurrentLead()
    expect(lead?.name).toBe('Carlos Ruiz')
    expect(lead?.email).toBe('carlos@startup.io')
    expect(lead?.phone).toBeTruthy()
  })

  // ── Reset ─────────────────────────────────────────────────────────────────

  it('resets state correctly', () => {
    extractor.processMessage(msg('My email is old@test.com'))
    extractor.reset()
    const lead = extractor.getCurrentLead()
    expect(lead?.email).toBeUndefined()
  })

  // ── hasCompleteLead ───────────────────────────────────────────────────────

  it('reports hasCompleteLead correctly', () => {
    expect(extractor.hasCompleteLead()).toBe(false)
    extractor.processMessage(msg('My name is Full Lead'))
    extractor.processMessage(msg('Email: full@lead.com'))
    extractor.processMessage(msg('Phone: 555-123-4567'))
    expect(extractor.hasCompleteLead()).toBe(true)
  })

  // ── Confidence scores ─────────────────────────────────────────────────────

  it('sets confidence for extracted email', () => {
    extractor.processMessage(msg('Email me at valid@email.com'))
    const lead = extractor.getCurrentLead()
    expect(lead?.confidence.email).toBeGreaterThan(0)
  })

  // ── processConversation ───────────────────────────────────────────────────

  it('processConversation extracts from full history', () => {
    const state = {
      id: 'test-conv',
      messages: [
        { role: 'user' as const, content: 'My name is Alex Test', timestamp: Date.now() },
        { role: 'assistant' as const, content: 'Great, what is your email?', timestamp: Date.now() },
        { role: 'user' as const, content: 'It is alex@test.com', timestamp: Date.now() }
      ],
      isActive: false,
      startedAt: Date.now() - 5000,
      lastActivityAt: Date.now()
    }
    const lead = extractor.processConversation(state)
    expect(lead?.name).toBe('Alex Test')
    expect(lead?.email).toBe('alex@test.com')
  })

  // ── Custom extractors ─────────────────────────────────────────────────────

  it('supports custom extractor functions', () => {
    const customExtractor = new LeadExtractor({
      customExtractors: [
        (text) => {
          const match = text.match(/order #(\d+)/i)
          return match ? { notes: `Order: ${match[1]}` } : {}
        }
      ]
    })
    customExtractor.processMessage(msg('I am calling about order #99887'))
    // Custom data ends up in lead notes
    expect(customExtractor.getCurrentLead()?.notes).toBe('Order: 99887')
  })
})
