/**
 * xAI/Grok Provider for VoxKit
 * Implements the AIProvider interface for xAI's Grok models
 */

import type { 
  AIProvider, 
  Voice, 
  TranscriptSegment, 
  ProviderResponse 
} from '../types.js'
import { logger } from '../logger.js'

export interface XAIProviderConfig {
  apiKey?: string
  model?: string
  voice?: Voice
  temperature?: number
  maxTokens?: number
  streaming?: boolean
}

/**
 * xAI/Grok Provider
 * Note: xAI doesn't have a native realtime API like OpenAI yet.
 * This implementation uses their chat completions API with streaming.
 */
export class XAIProvider implements AIProvider {
  name = 'xai'
  
  private config: Required<XAIProviderConfig>
  private messageCallbacks: Array<(response: ProviderResponse) => void> = []
  private transcriptCallbacks: Array<(segment: TranscriptSegment) => void> = []
  private errorCallbacks: Array<(error: Error) => void> = []
  private logger = logger.child('xai-provider')
  private currentVoice: Voice
  private isConnected = false
  private conversationHistory: Array<{ role: string; content: string }> = []

  private readonly supportedVoices: Voice[] = [
    'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
  ]

  constructor(config: XAIProviderConfig = {}) {
    this.config = {
      apiKey: config.apiKey ?? process.env.XAI_API_KEY ?? '',
      model: config.model ?? 'grok-2-1212',
      voice: config.voice ?? 'alloy',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
      streaming: config.streaming ?? true
    }
    this.currentVoice = this.config.voice
  }

  /**
   * Initialize the provider
   */
  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('xAI API key is required. Set XAI_API_KEY environment variable or pass it in config.')
    }
    this.logger.info('xAI provider initialized')
  }

  /**
   * Connect to xAI API
   */
  async connect(): Promise<void> {
    // xAI doesn't have a persistent connection like OpenAI's realtime API
    // We just validate the API key and set connected state
    this.isConnected = true
    this.logger.info('Connected to xAI API')
  }

  /**
   * Disconnect from xAI
   */
  async disconnect(): Promise<void> {
    this.isConnected = false
    this.conversationHistory = []
    this.logger.info('Disconnected from xAI')
  }

  /**
   * Send audio data (not directly supported by xAI, would need STT)
   */
  async sendAudio(audioData: Uint8Array): Promise<void> {
    // xAI doesn't have native audio input support
    // You would need to integrate with a separate STT service
    this.logger.warn('xAI provider does not support direct audio input. Use a separate STT service.')
    throw new Error('Direct audio input not supported by xAI. Please use sendText() after transcribing audio.')
  }

  /**
   * Send text to xAI
   */
  async sendText(text: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to xAI')
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

    // Call xAI API
    await this.callXAI()
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
   * Set voice (placeholder - xAI doesn't have voice selection)
   */
  setVoice(voice: Voice): void {
    this.currentVoice = voice
    this.logger.info(`Voice set to: ${voice}`)
  }

  /**
   * Call xAI API
   */
  private async callXAI(): Promise<void> {
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: this.conversationHistory,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          stream: this.config.streaming
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`xAI API error: ${response.status} - ${error}`)
      }

      if (this.config.streaming) {
        await this.handleStreamingResponse(response)
      } else {
        await this.handleNonStreamingResponse(response)
      }
    } catch (error) {
      this.logger.error('Error calling xAI API', error)
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
              const delta = parsed.choices?.[0]?.delta?.content
              
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
              // Ignore parse errors for [DONE] or malformed chunks
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
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content || ''
    
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
