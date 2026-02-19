import { describe, it, expect, beforeEach } from 'vitest'
import { MetricsPlugin } from '../../src/plugins/metrics.js'
import type { ConversationMessage } from '../../src/types.js'
import EventEmitter from 'events'

// Minimal VoxAgent stub
function makeAgentStub() {
  const emitter = new EventEmitter()
  return emitter as unknown as import('../../src/types.js').VoxAgent
}

describe('MetricsPlugin', () => {
  let plugin: MetricsPlugin

  beforeEach(() => {
    plugin = new MetricsPlugin({ printSummary: false })
    plugin.initialize(makeAgentStub())
  })

  it('starts with zero counts', () => {
    const m = plugin.getMetrics()
    expect(m.turnCount).toBe(0)
    expect(m.userTurns).toBe(0)
    expect(m.assistantTurns).toBe(0)
    expect(m.leadCaptured).toBe(false)
  })

  it('increments user turns on user message', () => {
    const msg: ConversationMessage = { role: 'user', content: 'Hello there!', timestamp: Date.now() }
    plugin.onMessage!(msg)
    const m = plugin.getMetrics()
    expect(m.userTurns).toBe(1)
    expect(m.turnCount).toBe(1)
  })

  it('increments assistant turns on assistant message', () => {
    const msg: ConversationMessage = { role: 'assistant', content: 'Hi!', timestamp: Date.now() }
    plugin.onMessage!(msg)
    const m = plugin.getMetrics()
    expect(m.assistantTurns).toBe(1)
    expect(m.turnCount).toBe(1)
  })

  it('marks leadCaptured on onLead', () => {
    plugin.onLead!({
      confidence: {},
      email: 'test@test.com'
    })
    expect(plugin.getMetrics().leadCaptured).toBe(true)
  })

  it('estimates token counts', () => {
    const msg: ConversationMessage = { role: 'user', content: 'A'.repeat(400), timestamp: Date.now() }
    plugin.onMessage!(msg)
    const m = plugin.getMetrics()
    expect(m.estimatedInputTokens).toBeGreaterThan(0)
  })

  it('getMetrics returns a copy (immutable snapshot)', () => {
    const m1 = plugin.getMetrics()
    const msg: ConversationMessage = { role: 'user', content: 'hi', timestamp: Date.now() }
    plugin.onMessage!(msg)
    const m2 = plugin.getMetrics()
    // m1 should not reflect changes
    expect(m1.turnCount).toBe(0)
    expect(m2.turnCount).toBe(1)
  })
})
