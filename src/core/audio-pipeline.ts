/**
 * Audio Pipeline for VoxKit
 * Handles audio streaming, buffering, and format conversion
 */

import EventEmitter from 'events'
import type { AudioConfig, WSMessage } from '../types.js'
import { logger } from '../logger.js'

export interface AudioPipelineConfig extends AudioConfig {
  enableVAD?: boolean
  vadThreshold?: number
  bufferDurationMs?: number
}

export class AudioPipeline extends EventEmitter {
  private config: AudioPipelineConfig
  private audioBuffer: Uint8Array[] = []
  private isStreaming = false
  private sampleCount = 0
  private logger = logger.child('audio-pipeline')

  constructor(config: Partial<AudioPipelineConfig> = {}) {
    super()
    this.config = {
      sampleRate: config.sampleRate ?? 24000,
      channels: config.channels ?? 1,
      format: config.format ?? 'pcm16',
      bufferSize: config.bufferSize ?? 4096,
      enableVAD: config.enableVAD ?? true,
      vadThreshold: config.vadThreshold ?? 0.01,
      bufferDurationMs: config.bufferDurationMs ?? 100
    }
  }

  /**
   * Process incoming audio chunk
   */
  processAudioChunk(chunk: Uint8Array): void {
    if (!this.isStreaming) {
      return
    }

    this.audioBuffer.push(chunk)
    this.sampleCount += chunk.length

    // Emit chunk for real-time processing
    this.emit('chunk', chunk)

    // Check if we should flush buffer
    const bufferDuration = this.calculateBufferDuration()
    if (bufferDuration >= this.config.bufferDurationMs!) {
      this.flushBuffer()
    }
  }

  /**
   * Start audio streaming
   */
  start(): void {
    this.isStreaming = true
    this.audioBuffer = []
    this.sampleCount = 0
    this.logger.info('Audio pipeline started')
    this.emit('started')
  }

  /**
   * Stop audio streaming
   */
  stop(): void {
    this.isStreaming = false
    if (this.audioBuffer.length > 0) {
      this.flushBuffer()
    }
    this.logger.info('Audio pipeline stopped')
    this.emit('stopped')
  }

  /**
   * Flush current audio buffer
   */
  flushBuffer(): Uint8Array | null {
    if (this.audioBuffer.length === 0) {
      return null
    }

    const totalLength = this.audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0)
    const combined = new Uint8Array(totalLength)
    
    let offset = 0
    for (const chunk of this.audioBuffer) {
      combined.set(chunk, offset)
      offset += chunk.length
    }

    this.audioBuffer = []
    this.sampleCount = 0

    this.emit('buffer', combined)
    return combined
  }

  /**
   * Convert audio format
   */
  convertFormat(data: Uint8Array, targetFormat: string): Uint8Array {
    // Placeholder for format conversion logic
    // In a real implementation, this would handle PCM, μ-law, A-law conversions
    this.logger.debug(`Converting audio to format: ${targetFormat}`)
    return data
  }

  /**
   * Apply voice activity detection
   */
  applyVAD(audioData: Uint8Array): { hasSpeech: boolean; confidence: number } {
    if (!this.config.enableVAD) {
      return { hasSpeech: true, confidence: 1.0 }
    }

    // Simple energy-based VAD
    let energy = 0
    const view = new DataView(audioData.buffer)
    
    for (let i = 0; i < audioData.length; i += 2) {
      const sample = view.getInt16(i, true)
      energy += sample * sample
    }
    
    energy = Math.sqrt(energy / (audioData.length / 2))
    const normalizedEnergy = energy / 32768.0
    const hasSpeech = normalizedEnergy > this.config.vadThreshold!

    return {
      hasSpeech,
      confidence: Math.min(normalizedEnergy / (this.config.vadThreshold! * 2), 1.0)
    }
  }

  /**
   * Create WebSocket message for audio data
   */
  createAudioMessage(audioData: Uint8Array): WSMessage {
    return {
      type: 'audio',
      data: Buffer.from(audioData).toString('base64'),
      timestamp: Date.now(),
      id: this.generateId()
    }
  }

  /**
   * Parse audio from WebSocket message
   */
  parseAudioMessage(message: WSMessage): Uint8Array | null {
    if (message.type !== 'audio' || typeof message.data !== 'string') {
      return null
    }
    
    try {
      return new Uint8Array(Buffer.from(message.data, 'base64'))
    } catch (error) {
      this.logger.error('Failed to parse audio message', error)
      return null
    }
  }

  private calculateBufferDuration(): number {
    const bytesPerSample = 2 // 16-bit PCM
    const samples = this.sampleCount / bytesPerSample
    return (samples / this.config.sampleRate) * 1000
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get current configuration
   */
  getConfig(): AudioPipelineConfig {
    return { ...this.config }
  }

  /**
   * Check if pipeline is active
   */
  getIsStreaming(): boolean {
    return this.isStreaming
  }
}
