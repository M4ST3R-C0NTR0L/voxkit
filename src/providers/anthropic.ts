/**
 * Anthropic Claude Provider for VoxKit
 * Implements the AIProvider interface for Anthropic's Claude API
 */

import type { 
  AIProvider, 
  Voice, 
  TranscriptSegment, 
  ProviderResponse 
} from '../types.js'
import { logger } from '../logger.js'

export interface AnthropicProviderConfig {
  apiKey?: string
  model?: string
  voice?: Voice
  maxTokens?: number
  temperature?: number
  streaming?: boolean
}

/**
 * Anthropic Claude Provider
 * Uses Claude's API for text-based conversations
 */
export class AnthropicProvider implements AIProvider {
  name = 'anthropic'
  
  private config: Required<AnthropicProviderConfig>
  private messageCallbacks: Array<(response: ProviderResponse) => void> = []
  private transcriptCallbacks: Array<(segment: TranscriptSegment) => void> = []
  private errorCallbacks: Array<(error: Error) => void> = []
  private logger = logger.child('anthropic-provider')
  private currentVoice: Voice
  private isConnected = false
  private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []

  private readonly supportedVoices: Voice[] = [
    'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
  ]

  constructor(config: AnthropicProviderConfig = {}) {
    this.config = {
      apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '',
      model: config.model ?? 'claude-3-5-sonnet-20241022',
      voice: config.voice ?? 'alloy',
      maxTokens: config.maxTokens ?? 4096,
      temperature: config.temperature ?? 0.7,
      streaming: config.streaming ?? true
    }
    this.currentVoice = this.config.voice
  }

  /**
   * Initialize the provider
   */
  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable or pass it in config.')
    }
    this.logger.info('Anthropic provider initialized')
  }

  /**
   * Connect to Anthropic API
   */
  async connect(): Promise<void> {
    // Anthropic uses stateless HTTP requests, so we just validate and set state
    this.isConnected = true
    this.logger.info('Connected to Anthropic API')
  }

  /**
   * Disconnect from Anthropic
   */
  async disconnect(): Promise<void> {
    this.isConnected = false
    this.conversationHistory = []
    this.logger.info('Disconnected from Anthropic')
  }

  /**
   * Send audio data (not directly supported, needs STT)
   */
  async sendAudio(audioData: Uint8Array): Promise<void> {
    this.logger.warn('Anthropic provider does not support direct audio input. Use a separate STT service.')
    throw new Error('Direct audio input not supported by Anthropic. Please use sendText() after transcribing audio.')
  }

  /**
   * Send text to Anthropic
   */
  async sendText(text: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to Anthropic')
    }

    // Add user message to history
    this.conversationHistory.push({ role: 'user', content: text })

    // Emit transcript
    const segment: TranscriptSegment = {
      id: `user-${Date.now()}`,
      text,
      isFinal: true,
      timestamp: Date.now()
    }
    for (const callback of this.transcriptCallbacks) {
      callback(segment)
    }

    // Call Anthropic API
    await this.callAnthropic()
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
   * Set voice (placeholder)
   */
  setVoice(voice: Voice): void {
    this.currentVoice = voice
    this.logger.info(`Voice set to: ${voice}`)
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(): Promise<void> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          messages: this.conversationHistory,
          stream: this.config.streaming
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Anthropic API error: ${response.status} - ${error}`)
      }

      if (this.config.streaming) {
        await this.handleStreamingResponse(response)
      } else {
        await this.handleNonStreamingResponse(response)
      }
    } catch (error) {
      this.logger.error('Error calling Anthropic API', error)
      for (const callback of this.errorCallbacks) {
        callback(error as Error)
      }
    }
  }

  /**
   * Handle streaming response
   */
  private async handleStreamingResponse(response: Response): Promise<void> {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    let fullText = ''
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim() !== '')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const delta = parsed.delta?.text
              
              if (delta) {
                fullText += delta
                const providerResponse: ProviderResponse = {
                  text: delta,
                  done: false
                }
                for (const callback of this.messageCallbacks) {
                  callback(providerResponse)
                }
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      // Send done signal
      this.conversationHistory.push({ role: 'assistant', content: fullText })
      const finalResponse: ProviderResponse = {
        text: fullText,
        done: true
      }
      for (const callback of this.messageCallbacks) {
        callback(finalResponse)
      }
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * Handle non-streaming response
   */
  private async handleNonStreamingResponse(response: Response): Promise<void> {
    const data = await response.json() as { content?: Array<{ text?: string }> }
    const content = data.content?.[0]?.text || ''
    
    this.conversationHistory.push({ role: 'assistant', content })
    
    const providerResponse: ProviderResponse = {
      text: content,
      done: true
    }
    for (const callback of this.messageCallbacks) {
      callback(providerResponse)
    }
  }
}
