/**
 * OpenAI Realtime API Provider for VoxKit
 * Implements the AIProvider interface for OpenAI's Realtime API
 */

import type { WebSocket as WsWebSocket } from 'ws'
import type { 
  AIProvider, 
  Voice, 
  TranscriptSegment, 
  ProviderResponse 
} from '../types.js'
import { logger } from '../logger.js'

export interface OpenAIProviderConfig {
  apiKey?: string
  model?: string
  voice?: Voice
  temperature?: number
  maxResponseOutputTokens?: number | 'inf'
}

export class OpenAIProvider implements AIProvider {
  name = 'openai'
  
  private config: Required<OpenAIProviderConfig>
  private ws: WsWebSocket | null = null
  private messageCallbacks: Array<(response: ProviderResponse) => void> = []
  private transcriptCallbacks: Array<(segment: TranscriptSegment) => void> = []
  private errorCallbacks: Array<(error: Error) => void> = []
  private logger = logger.child('openai-provider')
  private currentVoice: Voice
  private sessionCreated = false

  private readonly supportedVoices: Voice[] = [
    'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'ash', 'ballad', 'coral', 'sage', 'verse'
  ]

  constructor(config: OpenAIProviderConfig = {}) {
    this.config = {
      apiKey: config.apiKey ?? process.env.OPENAI_API_KEY ?? '',
      model: config.model ?? 'gpt-4o-realtime-preview-2024-12-17',
      voice: config.voice ?? 'alloy',
      temperature: config.temperature ?? 0.8,
      maxResponseOutputTokens: config.maxResponseOutputTokens ?? 4096
    }
    this.currentVoice = this.config.voice
  }

  /**
   * Initialize the provider
   */
  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass it in config.')
    }
    this.logger.info('OpenAI provider initialized')
  }

  /**
   * Connect to OpenAI Realtime API
   */
  async connect(): Promise<void> {
    const url = `wss://api.openai.com/v1/realtime?model=${this.config.model}`
    
    this.logger.info(`Connecting to OpenAI Realtime API: ${this.config.model}`)

    try {
      const wsModule = await import('ws')
      this.ws = new wsModule.WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      })

      return new Promise((resolve, reject) => {
        const connectionTimeout = setTimeout(() => {
          reject(new Error('Connection timeout'))
        }, 30000)

        this.ws!.onopen = () => {
          clearTimeout(connectionTimeout)
          this.logger.info('Connected to OpenAI Realtime API')
          this.setupEventHandlers()
          this.createSession().then(() => {
            resolve()
          }).catch(reject)
        }

        this.ws!.onerror = (error: unknown) => {
          clearTimeout(connectionTimeout)
          reject(error)
        }
      })
    } catch (error) {
      this.logger.error('Failed to connect to OpenAI', error)
      throw error
    }
  }

  /**
   * Disconnect from OpenAI
   */
  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.sessionCreated = false
    }
    this.logger.info('Disconnected from OpenAI')
  }

  /**
   * Send audio data to OpenAI
   */
  async sendAudio(audioData: Uint8Array): Promise<void> {
    if (!this.ws || this.ws.readyState !== 1) {
      throw new Error('WebSocket not connected')
    }

    const base64Audio = Buffer.from(audioData).toString('base64')
    
    this.ws.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: base64Audio
    }))
  }

  /**
   * Send text to OpenAI
   */
  async sendText(text: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== 1) {
      throw new Error('WebSocket not connected')
    }

    this.ws.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: text
          }
        ]
      }
    }))

    // Request a response
    this.ws.send(JSON.stringify({
      type: 'response.create'
    }))
  }

  /**
   * Register response callback
   */
  onResponse(callback: (response: ProviderResponse) => void): void {
    this.messageCallbacks.push(callback)
  }

  /**
   * Register transcript callback
   */
  onTranscript(callback: (segment: TranscriptSegment) => void): void {
    this.transcriptCallbacks.push(callback)
  }

  /**
   * Register error callback
   */
  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback)
  }

  /**
   * Get supported voices
   */
  getSupportedVoices(): Voice[] {
    return [...this.supportedVoices]
  }

  /**
   * Set voice
   */
  setVoice(voice: Voice): void {
    if (!this.supportedVoices.includes(voice)) {
      throw new Error(`Voice '${voice}' is not supported by OpenAI`)
    }
    this.currentVoice = voice
    this.updateSession({ voice })
  }

  /**
   * Create a session with OpenAI
   */
  private async createSession(): Promise<void> {
    if (!this.ws) return

    this.ws.send(JSON.stringify({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: '',
        voice: this.currentVoice,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        temperature: this.config.temperature,
        max_response_output_tokens: this.config.maxResponseOutputTokens
      }
    }))
  }

  /**
   * Update session configuration
   */
  private updateSession(updates: Record<string, unknown>): void {
    if (!this.ws) return

    this.ws.send(JSON.stringify({
      type: 'session.update',
      session: updates
    }))
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data.toString())
        this.handleMessage(message)
      } catch (error) {
        this.logger.error('Failed to parse message', error)
      }
    }

    this.ws.onclose = (event) => {
      this.logger.info(`WebSocket closed: ${event.code} - ${event.reason}`)
      this.sessionCreated = false
    }

    this.ws.onerror = (error: unknown) => {
      this.logger.error('WebSocket error', error)
      for (const callback of this.errorCallbacks) {
        callback(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * Handle incoming messages from OpenAI
   */
  private handleMessage(message: Record<string, unknown>): void {
    const messageType = message.type as string

    switch (messageType) {
      case 'session.created':
        this.sessionCreated = true
        this.logger.info('Session created')
        break

      case 'session.updated':
        this.logger.debug('Session updated')
        break

      case 'conversation.item.input_audio_transcription.completed':
        // User speech transcribed
        if (message.transcript) {
          const segment: TranscriptSegment = {
            id: `user-${Date.now()}`,
            text: message.transcript as string,
            isFinal: true,
            timestamp: Date.now()
          }
          for (const callback of this.transcriptCallbacks) {
            callback(segment)
          }
        }
        break

      case 'response.audio_transcript.delta':
        // Assistant response delta
        if (message.delta) {
          const response: ProviderResponse = {
            text: message.delta as string,
            done: false
          }
          for (const callback of this.messageCallbacks) {
            callback(response)
          }
        }
        break

      case 'response.audio_transcript.done':
        // Assistant response complete
        if (message.transcript) {
          const response: ProviderResponse = {
            text: message.transcript as string,
            done: true
          }
          for (const callback of this.messageCallbacks) {
            callback(response)
          }
        }
        break

      case 'response.content_part.added':
      case 'response.content_part.done':
        this.logger.debug(`Response content: ${messageType}`)
        break

      case 'response.done':
        this.logger.debug('Response done')
        break

      case 'input_audio_buffer.speech_started':
        this.logger.debug('User started speaking')
        break

      case 'input_audio_buffer.speech_stopped':
        this.logger.debug('User stopped speaking')
        break

      case 'error':
        this.logger.error('OpenAI error', message)
        for (const callback of this.errorCallbacks) {
          const errObj = message.error as Record<string, unknown> | undefined
          callback(new Error(String(errObj?.message ?? 'Unknown error')))
        }
        break

      default:
        this.logger.debug(`Unhandled message type: ${messageType}`)
    }
  }
}
