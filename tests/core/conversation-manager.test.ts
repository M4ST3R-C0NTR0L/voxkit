import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConversationManager } from '../../src/core/conversation-manager.js'

describe('ConversationManager', () => {
  let manager: ConversationManager

  beforeEach(() => {
    manager = new ConversationManager({
      maxMessages: 10,
      silenceTimeoutMs: 0   // disable timeout in tests
    })
  })

  it('starts a conversation with a valid id', () => {
    const state = manager.start()
    expect(state.id).toMatch(/^conv-/)
    expect(state.isActive).toBe(true)
    expect(state.messages).toHaveLength(0)
  })

  it('adds messages and tracks them', () => {
    manager.start()
    manager.addMessage('user', 'Hello')
    manager.addMessage('assistant', 'Hi there!')
    const messages = manager.getMessages()
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('user')
    expect(messages[1].role).toBe('assistant')
  })

  it('emits a message event on addMessage', () => {
    const spy = vi.fn()
    manager.on('message', spy)
    manager.start()
    manager.addMessage('user', 'test')
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ role: 'user', content: 'test' }))
  })

  it('ignores messages when conversation is inactive', () => {
    manager.start()
    manager.end()
    manager.addMessage('user', 'Should be ignored')
    expect(manager.getMessages()).toHaveLength(0)
  })

  it('trims messages when maxMessages is exceeded', () => {
    manager.start()
    for (let i = 0; i < 15; i++) {
      manager.addMessage('user', `Message ${i}`)
    }
    const messages = manager.getMessages()
    expect(messages.length).toBeLessThanOrEqual(10)
  })

  it('ends a conversation and marks it inactive', () => {
    manager.start()
    const state = manager.end()
    expect(state.isActive).toBe(false)
  })

  it('emits ended event on end()', () => {
    const spy = vi.fn()
    manager.on('ended', spy)
    manager.start()
    manager.end()
    expect(spy).toHaveBeenCalled()
  })

  it('returns context messages including system prompt', () => {
    manager.start()
    manager.addMessage('user', 'hi')
    manager.addMessage('assistant', 'hello')
    const ctx = manager.getContextMessages('Be helpful.')
    expect(ctx[0]).toEqual({ role: 'system', content: 'Be helpful.' })
    expect(ctx).toHaveLength(3)
  })

  it('exports conversation as valid JSON', () => {
    manager.start()
    manager.addMessage('user', 'test export')
    const json = manager.export()
    const parsed = JSON.parse(json)
    expect(parsed).toHaveProperty('id')
    expect(parsed).toHaveProperty('messages')
    expect(Array.isArray(parsed.messages)).toBe(true)
  })

  it('adds final transcript segment as a user message', () => {
    manager.start()
    manager.addTranscript({
      id: 'seg-1',
      text: 'I need help',
      isFinal: true,
      timestamp: Date.now()
    })
    expect(manager.getMessages()).toHaveLength(1)
    expect(manager.getMessages()[0].role).toBe('user')
  })

  it('does NOT add non-final transcript segments as messages', () => {
    manager.start()
    manager.addTranscript({
      id: 'seg-2',
      text: 'I nee…',
      isFinal: false,
      timestamp: Date.now()
    })
    expect(manager.getMessages()).toHaveLength(0)
  })

  it('updates metadata', () => {
    manager.start()
    manager.updateMetadata({ source: 'phone', caller: '+15551234567' })
    const state = manager.getState()
    expect(state.metadata?.source).toBe('phone')
    expect(state.metadata?.caller).toBe('+15551234567')
  })

  it('clears messages on clear()', () => {
    manager.start()
    manager.addMessage('user', 'a')
    manager.addMessage('assistant', 'b')
    manager.clear()
    expect(manager.getMessages()).toHaveLength(0)
  })

  it('getLastMessages returns only N messages', () => {
    manager.start()
    for (let i = 0; i < 5; i++) manager.addMessage('user', `msg ${i}`)
    const last3 = manager.getLastMessages(3)
    expect(last3).toHaveLength(3)
    expect(last3[2].content).toBe('msg 4')
  })
})
