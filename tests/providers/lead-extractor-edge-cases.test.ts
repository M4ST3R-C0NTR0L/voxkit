/**
 * Edge-case tests for the LeadExtractor
 * focused on real-world patterns from actual voice conversations.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { LeadExtractor } from '../../src/core/lead-extractor.js'

const u = (text: string) => ({ role: 'user' as const, content: text, timestamp: Date.now() })

describe('LeadExtractor — edge cases', () => {
  let ex: LeadExtractor

  beforeEach(() => { ex = new LeadExtractor() })

  it('handles spoken-out phone like "five five five, one two three four"', () => {
    // This won't extract (it's truly spoken) — just confirm no crash
    expect(() => ex.processMessage(u('five five five one two three four'))).not.toThrow()
  })

  it('does not confuse a zip code with a phone', () => {
    ex.processMessage(u('I live in zip code 94043'))
    // Should NOT extract a full phone
    const lead = ex.getCurrentLead()
    const phone = lead?.phone
    if (phone) {
      // If something is extracted, it shouldn't be just 5 digits
      expect(phone.replace(/\D/g, '').length).not.toBe(5)
    }
  })

  it('extracts from a realistic conversational exchange', () => {
    const messages = [
      u('Yeah so I wanted to inquire about the 3-bedroom listing'),
      u("My name's David Nguyen"),
      u('I can be reached at david.n@outlook.com'),
      u('Or just call me, my number is (408) 555-7890'),
    ]
    for (const m of messages) ex.processMessage(m)
    const lead = ex.getCurrentLead()
    expect(lead?.name).toBeTruthy()
    expect(lead?.email).toBe('david.n@outlook.com')
    expect(lead?.phone).toBeTruthy()
  })

  it('handles multiple email addresses and keeps the first', () => {
    ex.processMessage(u('My work email is work@corp.com and personal is me@gmail.com'))
    expect(ex.getCurrentLead()?.email).toBe('work@corp.com')
  })

  it('does not extract email from a non-user message', () => {
    ex.processMessage({ role: 'system', content: 'admin@internal.com', timestamp: Date.now() })
    expect(ex.getCurrentLead()?.email).toBeUndefined()
  })

  it('emits a lead event when minimum info is available', () => {
    const events: unknown[] = []
    ex.on('lead', (lead) => events.push(lead))
    ex.processMessage(u('My email is event@lead.com'))
    expect(events.length).toBeGreaterThan(0)
  })

  it('processConversation resets prior state', () => {
    ex.processMessage(u('My name is OldName'))
    const state = {
      id: 'c1',
      messages: [
        { role: 'user' as const, content: 'I am NewName from a fresh conv', timestamp: Date.now() }
      ],
      isActive: false,
      startedAt: Date.now(),
      lastActivityAt: Date.now()
    }
    ex.processConversation(state)
    // OldName should be gone
    const lead = ex.getCurrentLead()
    expect(lead?.name).toMatch(/NewName/)
  })
})
