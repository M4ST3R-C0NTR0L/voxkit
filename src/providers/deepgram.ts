/**
 * Deepgram Provider for VoxKit
 * Implements STT using Deepgram's Nova-2 model
 */

import type { WebSocket as WsWebSocket } from 'ws'
import type { 
  AIProvider, 
  Voice, 
  TranscriptSegment, 
  ProviderResponse 
} from '../types.js'
import { logger } from '../logger.js'

export interface DeepgramProviderConfig {
  apiKey?: string
  model?: string
  language?: string
  interimResults?: boolean
  punctuate?: boolean
  smartFormat?: boolean
  endpointing?: number
}

/**
 * Deepgram Provider for Speech-to-Text
 * Uses Deepgram's WebSocket API for realtime transcription
 */
export class DeepgramProvider implements AIProvider {
  name = 'deepgram'
  
  private config: Required<DeepgramProviderConfig>
  private ws: WsWebSocket | null = null
  private messageCallbacks: Array<(response: ProviderResponse) => void> = []
  private transcriptCallbacks: Array<(segment: TranscriptSegment) => void> = []
  private errorCallbacks: Array<(error: Error) => void> = []
  private logger = logger.child('deepgram-provider')
  private isConnected = false
  private currentVoice: Voice = 'alloy'
  private keepAliveInterval: NodeJS.Timeout | null = null

  private readonly supportedVoices: Voice[] = ['nova-2', 'nova', 'enhanced', 'base']

  constructor(config: DeepgramProviderConfig = {}) {
    this.config = {
      apiKey: config.apiKey ?? process.env.DEEPGRAM_API_KEY ?? '',
      model: config.model ?? 'nova-2',
      language: config.language ?? 'en-US',
      interimResults: config.interimResults ?? true,
      punctuate: config.punctuate ?? true,
      smartFormat: config.smartFormat ?? true,
      endpointing: config.endpointing ?? 300
    }
  }

  /**
   * Initialize the provider
   */
  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('Deepgram API key is required. Set DEEPGRAM_API_KEY environment variable or pass it in config.')
    }
    this.logger.info('Deepgram provider initialized')
  }

  /**
   * Connect to Deepgram WebSocket API
   */
  async connect(): Promise<void> {
    const params = new URLSearchParams({
      model: this.config.model,
      language: this.config.language,
      interim_results: String(this.config.interimResults),
      punctuate: String(this.config.punctuate),
      smart_format: String(this.config.smartFormat),
      endpointing: String(this.config.endpointing),
      encoding: 'linear16',
      sample_rate: '24000',
      channels: '1'
    })

    const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`
    
    this.logger.info(`Connecting to Deepgram: ${this.config.model}`)

    try {
      const wsModule = await import('ws')
      this.ws = new wsModule.WebSocket(url, {
        headers: {
          'Authorization': `Token ${this.config.apiKey}`
        }
      })

      return new Promise((resolve, reject) => {
        const connectionTimeout = setTimeout(() => {
          reject(new Error('Connection timeout'))
        }, 30000)

        this.ws!.onopen = () => {
          clearTimeout(connectionTimeout)
          this.isConnected = true
          this.logger.info('Connected to Deepgram')
          this.setupEventHandlers()
          this.startKeepAlive()
          resolve()
        }

        this.ws!.onerror = (error: unknown) => {
          clearTimeout(connectionTimeout)
          reject(error)
        }
      })
    } catch (error) {
      this.logger.error('Failed to connect to Deepgram', error)
      throw error
    }
  }

  /**
   * Disconnect from Deepgram
   */
  async disconnect(): Promise<void> {
    this.stopKeepAlive()
    if (this.ws) {
      // Send close signal to Deepgram
      this.ws.send(JSON.stringify({ type: 'CloseStream' }))
      this.ws.close()
      this.ws = null
    }
    this.isConnected = false
    this.logger.info('Disconnected from Deepgram')
  }

  /**
   * Send audio data to Deepgram
   */
  async sendAudio(audioData: Uint8Array): Promise<void> {
    if (!this.ws || this.ws.readyState !== 1) {
      throw new Error('WebSocket not connected')
    }

    this.ws.send(audioData)
  }

  /**
   * Send text (not supported by Deepgram STT)
   */
  async sendText(text: string): Promise<void> {
    // Deepgram is STT only, doesn't accept text input
    this.logger.warn('Deepgram provider is STT only and does not support text input')
    throw new Error('Deepgram provider is STT only. Use sendAudio() for speech input.')
  }

  /**
   * Register response callback (used for final transcripts)
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
   * Get supported models
   */
  getSupportedVoices(): Voice[] {
    return [...this.supportedVoices]
  }

  /**
   * Set model
   */
  setVoice(voice: Voice): void {
    if (!this.supportedVoices.includes(voice)) {
      this.logger.warn(`Model '${voice}' may not be supported by Deepgram`)
    }
    this.currentVoice = voice
    this.config.model = voice
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
      this.isConnected = false
      this.logger.info(`WebSocket closed: ${event.code} - ${event.reason}`)
    }

    this.ws.onerror = (error: unknown) => {
      this.logger.error('WebSocket error', error)
      for (const callback of this.errorCallbacks) {
        callback(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * Handle incoming messages from Deepgram
   */
  private handleMessage(message: Record<string, unknown>): void {
    // Handle transcript messages
    const channel = (message.channel as Record<string, unknown>) || {}
    const alternatives = (channel.alternatives as Array<Record<string, unknown>>) || []
    const alternative = alternatives[0] || {}
    
    const transcript = alternative.transcript as string
    const isFinal = message.is_final as boolean
    const speechFinal = message.speech_final as boolean
    const confidence = alternative.confidence as number

    if (!transcript) return

    const segment: TranscriptSegment = {
      id: (message.channel_index as string) || `dg-${Date.now()}`,
      text: transcript,
      isFinal: isFinal || speechFinal,
      timestamp: Date.now(),
      confidence
    }

    // Emit transcript
    for (const callback of this.transcriptCallbacks) {
      callback(segment)
    }

    // If final transcript, also emit as response for compatibility
    if (isFinal || speechFinal) {
      const response: ProviderResponse = {
        text: transcript,
        done: true
      }
      for (const callback of this.messageCallbacks) {
        callback(response)
      }
    }

    // Log metadata if available
    if (message.type === 'Metadata') {
      this.logger.debug('Received metadata:', message)
    }
  }

  /**
   * Start keepalive ping
   */
  private startKeepAlive(): void {
    this.keepAliveInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === 1) {
        this.ws.send(JSON.stringify({ type: 'KeepAlive' }))
      }
    }, 8000) // Deepgram recommends 8-10 seconds
  }

  /**
   * Stop keepalive ping
   */
  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval)
      this.keepAliveInterval = null
    }
  }
}
