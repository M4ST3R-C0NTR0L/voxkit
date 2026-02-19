import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TranscriptLoggerPlugin } from '../../src/plugins/transcript-logger.js'
import EventEmitter from 'events'

const agentStub = new EventEmitter() as unknown as import('../../src/types.js').VoxAgent

describe('TranscriptLoggerPlugin', () => {
  let plugin: TranscriptLoggerPlugin
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    plugin = new TranscriptLoggerPlugin({ timestamps: false, tag: '[test]' })
    plugin.initialize(agentStub)
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('logs user messages to console', () => {
    plugin.onMessage!({ role: 'user', content: 'Hello plugin', timestamp: Date.now() })
    expect(consoleSpy).toHaveBeenCalled()
    const callArg: string = consoleSpy.mock.calls[0][0]
    expect(callArg).toContain('[test]')
    expect(callArg).toContain('Hello plugin')
  })

  it('logs assistant messages with role label', () => {
    plugin.onMessage!({ role: 'assistant', content: 'Response', timestamp: Date.now() })
    const callArg: string = consoleSpy.mock.calls[0][0]
    expect(callArg).toContain('assistant')
  })

  it('writes interim transcript to stdout', () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    plugin.onTranscript!({ id: '1', text: 'interim text', isFinal: false, timestamp: Date.now() })
    expect(stdoutSpy).toHaveBeenCalled()
    stdoutSpy.mockRestore()
  })
})
