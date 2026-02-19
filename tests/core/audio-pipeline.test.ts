import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AudioPipeline } from '../../src/core/audio-pipeline.js'

describe('AudioPipeline', () => {
  let pipeline: AudioPipeline

  beforeEach(() => {
    pipeline = new AudioPipeline({
      sampleRate: 24000,
      channels: 1,
      format: 'pcm16',
      bufferDurationMs: 50
    })
  })

  it('starts and stops correctly', () => {
    expect(pipeline.getIsStreaming()).toBe(false)
    pipeline.start()
    expect(pipeline.getIsStreaming()).toBe(true)
    pipeline.stop()
    expect(pipeline.getIsStreaming()).toBe(false)
  })

  it('emits a started event when started', () => {
    const spy = vi.fn()
    pipeline.on('started', spy)
    pipeline.start()
    expect(spy).toHaveBeenCalledOnce()
  })

  it('emits a stopped event when stopped', () => {
    const spy = vi.fn()
    pipeline.on('stopped', spy)
    pipeline.start()
    pipeline.stop()
    expect(spy).toHaveBeenCalledOnce()
  })

  it('drops chunks when not streaming', () => {
    const chunkSpy = vi.fn()
    pipeline.on('chunk', chunkSpy)
    const chunk = new Uint8Array(512)
    pipeline.processAudioChunk(chunk)   // not started
    expect(chunkSpy).not.toHaveBeenCalled()
  })

  it('emits chunk events while streaming', () => {
    const spy = vi.fn()
    pipeline.on('chunk', spy)
    pipeline.start()
    pipeline.processAudioChunk(new Uint8Array(512))
    expect(spy).toHaveBeenCalledOnce()
  })

  it('flushes buffer and resets on stop', () => {
    const bufferSpy = vi.fn()
    pipeline.on('buffer', bufferSpy)
    pipeline.start()
    pipeline.processAudioChunk(new Uint8Array(100))
    pipeline.stop()
    expect(bufferSpy).toHaveBeenCalled()
  })

  it('manually flushing returns combined Uint8Array', () => {
    pipeline.start()
    const a = new Uint8Array([1, 2, 3])
    const b = new Uint8Array([4, 5, 6])
    pipeline.processAudioChunk(a)
    pipeline.processAudioChunk(b)
    const flushed = pipeline.flushBuffer()
    expect(flushed).toBeInstanceOf(Uint8Array)
    expect(flushed?.length).toBe(6)
    expect(Array.from(flushed!)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('returns null from flushBuffer when empty', () => {
    const result = pipeline.flushBuffer()
    expect(result).toBeNull()
  })

  it('creates a valid base64 audio WSMessage', () => {
    const audio = new Uint8Array([0, 1, 2, 3])
    const msg = pipeline.createAudioMessage(audio)
    expect(msg.type).toBe('audio')
    expect(typeof msg.data).toBe('string')
    // Round-trip
    const decoded = Buffer.from(msg.data as string, 'base64')
    expect(Array.from(decoded)).toEqual([0, 1, 2, 3])
  })

  it('parses audio from a WSMessage', () => {
    const audio = new Uint8Array([7, 8, 9])
    const msg = pipeline.createAudioMessage(audio)
    const parsed = pipeline.parseAudioMessage(msg)
    expect(parsed).toBeInstanceOf(Uint8Array)
    expect(Array.from(parsed!)).toEqual([7, 8, 9])
  })

  it('returns null for non-audio WSMessages', () => {
    const result = pipeline.parseAudioMessage({ type: 'text', data: 'hello' })
    expect(result).toBeNull()
  })

  it('VAD returns hasSpeech: true when disabled', () => {
    const p = new AudioPipeline({ sampleRate: 24000, channels: 1, format: 'pcm16', enableVAD: false })
    const { hasSpeech, confidence } = p.applyVAD(new Uint8Array(100))
    expect(hasSpeech).toBe(true)
    expect(confidence).toBe(1.0)
  })

  it('returns current config via getConfig()', () => {
    const config = pipeline.getConfig()
    expect(config.sampleRate).toBe(24000)
    expect(config.channels).toBe(1)
    expect(config.format).toBe('pcm16')
  })
})
